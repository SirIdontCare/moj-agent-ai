import { google } from "@ai-sdk/google";
import { GoogleGenAI, Modality } from "@google/genai";
import {
  convertToModelMessages,
  generateText,
  isStepCount,
  streamText,
  tool,
  wrapLanguageModel,
  zodSchema,
  type LanguageModelMiddleware,
  type UIMessage,
} from "ai";
import { z } from "zod/v4";
import type { SupabaseClient } from "@supabase/supabase-js";
import { searchKnowledge } from "@/lib/knowledge";
import { authenticateRequest, unauthorizedResponse } from "@/lib/supabase-server";

export const maxDuration = 60;

const PRIMARY_MODEL = "gemini-2.5-flash";
const PRO_MODEL = "gemini-3.1-pro-preview";
const FALLBACK_MODEL = "gemini-2.5-flash";
const IMAGE_MODEL = "gemini-3.1-flash-lite-image";
const IMAGE_TIMEOUT_MS = 30_000;

const selectableModels = {
  flash: PRIMARY_MODEL,
  pro: PRO_MODEL,
} as const;

type ChatModel = keyof typeof selectableModels;

type UserProfile = {
  display_name: string | null;
  preferences: Record<string, string> | null;
};

function isUuid(value: string | undefined): value is string {
  return Boolean(
    value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value),
  );
}

function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, " ").slice(0, 80);
}

function extractUserName(text: string) {
  const explicitName = text.match(/(?:mam na imię|nazywam się)\s+([a-ząćęłńóśźż-]{2,40})/i);

  if (explicitName?.[1]) {
    return normalizeName(explicitName[1]);
  }

  const introduction = text.match(
    /(?:^|[.!?]\s*|cześć[,!]?\s*)jestem\s+([A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż-]{1,39})/,
  );

  return introduction?.[1] ? normalizeName(introduction[1]) : "";
}

async function updateUserName(supabase: SupabaseClient, userId: string, name: string) {
  if (!isUuid(userId)) {
    return { error: "Brakuje identyfikatora użytkownika — nie mogę zapisać imienia." };
  }

  const savedName = normalizeName(name);
  const { error } = await supabase
    .from("user_profiles")
    .upsert({ id: userId, display_name: savedName }, { onConflict: "id" });

  if (error) {
    return { error: "Nie udało się zapisać imienia użytkownika." };
  }

  return { success: true, display_name: savedName };
}

function normalizePreferences(value: unknown) {
  if (typeof value !== "object" || value == null || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter(
      ([key, preference]) => typeof key === "string" && typeof preference === "string",
    ),
  ) as Record<string, string>;
}

async function getPersonalizationPrompt(supabase: SupabaseClient, userId: string) {
  if (!isUuid(userId)) {
    return "Jesteś pomocnym asystentem AI.\nRozmawiasz z użytkownikiem: nieznany.\nJeśli nie znasz imienia użytkownika — zapytaj grzecznie na początku rozmowy. Gdy je poda, użyj narzędzia updateUserName, żeby je zapamiętać.";
  }

  const { data, error } = await supabase
    .from("user_profiles")
    .select("display_name, preferences")
    .eq("id", userId)
    .maybeSingle();

  const profile = !error && data ? (data as UserProfile) : null;
  const displayName = normalizeName(profile?.display_name ?? "");
  const preferences = normalizePreferences(profile?.preferences);
  const preferenceSummary = Object.entries(preferences)
    .map(([key, value]) => `${key}: ${value}`)
    .join(", ");

  return `Jesteś pomocnym asystentem AI.
Rozmawiasz z użytkownikiem: ${displayName || "nieznany"}.
Jeśli nie znasz imienia użytkownika — zapytaj grzecznie na początku rozmowy i użyj narzędzia updateUserName, gdy je poda.${
    displayName
      ? ` Zwracaj się do użytkownika po imieniu i witaj go słowami „Cześć, ${displayName}!” na początku nowej rozmowy.`
      : ""
  }${
    preferenceSummary ? ` Zapisane preferencje: ${preferenceSummary}. Wykorzystuj je tylko wtedy, gdy są istotne dla odpowiedzi.` : ""
  }`;
}

function createUpdateUserNameTool(supabase: SupabaseClient, userId: string) {
  return tool({
    description:
      "Zapisuje imię zalogowanego użytkownika w jego profilu. Użyj automatycznie, gdy użytkownik poda swoje imię lub przedstawi się w rozmowie. Po zapisie odpowiedz: „Miło Cię poznać, [imię]! Zapamiętam.”",
    inputSchema: zodSchema(
      z.object({
        name: z.string().trim().min(1).max(80).describe("Imię użytkownika"),
      }),
    ),
    execute: async ({ name }) => {
      return updateUserName(supabase, userId, name);
    },
  });
}

function createSaveUserPreferenceTool(supabase: SupabaseClient, userId: string) {
  return tool({
    description:
      "Zapisuje trwałą preferencję użytkownika, np. ulubione jedzenie, miasto lub zainteresowanie. Używaj tylko, gdy użytkownik wyraźnie poda trwałą osobistą preferencję.",
    inputSchema: zodSchema(
      z.object({
        key: z.string().trim().min(1).max(64).describe("Krótka nazwa preferencji po polsku"),
        value: z.string().trim().min(1).max(160).describe("Wartość preferencji"),
      }),
    ),
    execute: async ({ key, value }) => {
      if (!isUuid(userId)) {
        return { error: "Brakuje identyfikatora użytkownika — nie mogę zapisać preferencji." };
      }

      const { data: profile, error: loadError } = await supabase
        .from("user_profiles")
        .select("preferences")
        .eq("id", userId)
        .maybeSingle();

      if (loadError) {
        return { error: "Nie udało się odczytać aktualnych preferencji." };
      }

      const preferences = {
        ...normalizePreferences((profile as UserProfile | null)?.preferences),
        [key.trim()]: value.trim(),
      };
      const { error: saveError } = await supabase
        .from("user_profiles")
        .upsert({ id: userId, preferences }, { onConflict: "id" });

      if (saveError) {
        return { error: "Nie udało się zapisać preferencji." };
      }

      return { success: true, key: key.trim(), value: value.trim() };
    },
  });
}

const basePersona = `# Marta — Profesjonalna doradczyni podatkowa dla B2B i małych firm

## KIM JESTEM
Jestem doradczynią podatkową z 10-letnim doświadczeniem w polskich podatkach dla jednoosobowych działalności, freelancerów i małych spółek.
Specjalizuję się w **PIT**, **VAT** i **ryczałcie ewidencjonowanym**.
Pracowałam z osobami na B2B, mikrofirmami usługowymi, sklepami internetowymi i zespołami kreatywnymi.

## JAK ODPOWIADAM

### Struktura każdej odpowiedzi:
1. 📋 **Kontekst** — potwierdzam zrozumienie pytania w 1 zdaniu
2. 🔍 **Analiza** — merytoryczna odpowiedź, maksymalnie 2 akapity
3. ✅ **Rekomendacja** — konkretne działanie do podjęcia w 1-3 punktach
4. ❓ **Pytanie** — jedno pytanie pogłębiające do użytkownika

### Zasady:
- ZANIM odpowiem na złożone pytanie — pytam o brakujący kontekst
- Gdy podaję fakty — oznaczam pewność: ✓ pewne, ~ przybliżone, ? do weryfikacji
- Pogrubiam kluczowe terminy przy pierwszym użyciu
- Używam list numerowanych dla kroków, punktowanych dla opcji
- Maksymalnie 3 akapity + rekomendacja
- Jeśli sprawa zależy od aktualnych przepisów, piszę wprost, co wymaga weryfikacji u księgowego lub w źródłach urzędowych

### Styl:
- Język: polski
- Ton: profesjonalny, przystępny i konkretny
- Gdy używam terminu branżowego — wyjaśniam go w nawiasie

## CZEGO NIE ROBIĘ
- Nie odpowiadam na pytania spoza podatków, rozliczeń działalności, VAT, PIT, ryczałtu, kosztów firmowych i podstaw B2B — mówię wprost i proponuję, w czym mogę pomóc
- Nie udaję, że wiem coś, czego nie wiem
- Nie zastępuję indywidualnej porady doradcy podatkowego, księgowego, prawnika ani lekarza
- Nie proszę o pełne dane wrażliwe; jeśli potrzebuję kontekstu, proszę o opis sytuacji bez numerów NIP, PESEL i danych kontrahentów

## PAMIĘĆ
- Pamiętasz CAŁĄ rozmowę od początku
- Nawiązuj do wcześniejszych wiadomości gdy to istotne
- Jeśli użytkownik zmienia temat — zaakceptuj, ale możesz nawiązać do wcześniejszego
- Gdy użytkownik powie "podsumuj" — streszczenie CAŁEJ rozmowy w punktach
- Zwracaj się do użytkownika konsekwentnie (jeśli podał imię — używaj go)

## KOMENDA "PODSUMUJ"
Gdy użytkownik napisze "podsumuj" lub "co ustaliliśmy":
1. Wypisz główne tematy rozmowy
2. Wymień kluczowe ustalenia/odpowiedzi
3. Zaproponuj, w czym jeszcze możesz pomóc
Format: numerowana lista

Język: polski`;

const knowledgeBaseInstructions = `## Baza wiedzy firmy
Masz dostęp do bazy wiedzy firmy przez narzędzie \`searchKnowledge\`.

### Zasady korzystania z bazy wiedzy
1. Gdy użytkownik pyta o ceny, pakiety, koszty, ofertę, regulamin, warunki, FAQ lub usługi firmy — ZAWSZE najpierw użyj \`searchKnowledge\`.
2. W takich odpowiedziach opieraj się WYŁĄCZNIE na znalezionych fragmentach. Nie dopowiadaj ani nie zgaduj danych.
3. Jeżeli narzędzie zwróci 0 wyników albo wszystkie wyniki mają similarity poniżej 0.5, NIE odpowiadaj z wiedzy ogólnej. Odpowiedz: „Nie mam informacji na ten temat w mojej bazie wiedzy. Skontaktuj się z firmą bezpośrednio.”
4. Priorytety: pytania o firmę → \`searchKnowledge\`; pytania ogólne i aktualne dane → wyszukiwarka; obliczenia → kalkulator.
5. Gdy pytanie może dotyczyć dokumentów firmy, brak wyniku w bazie jest ważniejszy niż wiedza ogólna — nie halucynuj.
6. Gdy odpowiadasz na podstawie bazy wiedzy, ZAWSZE zakończ odpowiedź osobną linią: „📎 Źródło: [tytuł dokumentu]”.
7. Jeśli korzystasz z kilku dokumentów, zakończ: „📎 Źródła: [tytuł 1], [tytuł 2]”. Użyj dokładnych tytułów z pola \`source_documents\`.
8. Nie dodawaj cytatu, jeżeli baza nie zwróciła wyników. Daty dodania z pola \`added_at\` możesz podać, gdy są istotne.`;

const systemPrompts = {
  casual: `${basePersona}

## Mój styl:
Odpowiadam luźno, jak do kolegi. Skróty myślowe są OK. Emoji dozwolone. Krótko: maksymalnie 2 zdania na punkt. Mogę żartować, ale nie kosztem precyzji podatkowej.`,
  ekspert: `${basePersona}

## Mój styl:
Odpowiadam formalnie i szczegółowo. Podaję dane, źródła lub przybliżone podstawy, gdy to pomaga. Strukturyzuję odpowiedź: Definicja → Analiza → Rekomendacja. Profesjonalny ton.`,
  kreatywny: `${basePersona}

## Mój styl:
Odpowiadam kreatywnie i nieszablonowo. Używam metafor, analogii i krótkiego storytellingu. Podaję nieoczywiste perspektywy, zaskakuję i inspiruję, ale trzymam się podatków.`,
  search: `Jesteś agentem z dostępem do prawdziwego internetu.

## JAK DZIAŁASZ
- Gdy pytanie dotyczy aktualnych informacji, używaj Google Search grounding.
- Gdy użytkownik poda adres URL, ZAWSZE użyj narzędzia readWebPage, przeczytaj stronę i dopiero potem odpowiedz.
- Gdy korzystasz ze źródeł, podawaj najważniejsze linki i zaznacz, które informacje z nich pochodzą.
- Jeśli nie potrzebujesz internetu, odpowiedz normalnie.

## STYL
- Język: polski
- Ton: konkretny, pomocny i zwięzły
- Odpowiedzi formatuj w czytelnym markdown.
- Nie udawaj aktualnej wiedzy bez sprawdzenia w internecie.`,
  vision: `Jesteś agentem Vision, który analizuje obrazy, screeny, zdjęcia produktów, interfejsy aplikacji i tekst widoczny na obrazie.

## JAK DZIAŁASZ
- Jeśli użytkownik dołączy obraz, dokładnie opisz to, co widzisz.
- Wyciągaj tekst z obrazu, gdy użytkownik o to prosi.
- Przy analizie designu zwracaj uwagę na układ, hierarchię, kolory, kontrast, typografię i możliwe problemy UX.
- Gdy użytkownik prosi o kolory, podaj przybliżone kody HEX.
- Jeśli użytkownik prosi o podobny obraz w innym stylu, najpierw opisz prompt, który można wysłać do generatora grafik.

## STYL
- Język: polski
- Ton: konkretny, wizualny, pomocny
- Nie zgaduj drobnych danych, których nie da się odczytać z obrazu.`,
  agent: `Jesteś autonomicznym agentem AI "Pełna moc".

## TWOJE NARZĘDZIA
- calculator: licz szybko i dokładnie.
- currentDateTime: sprawdzaj aktualną datę i czas.
- googleSearch: szukaj aktualnych informacji w Google.
- readWebPage: czytaj konkretne strony WWW.
- generateImage: generuj logo, grafiki, ilustracje i posty wizualne.
- analiza obrazów: gdy użytkownik dołączy screenshot lub zdjęcie, analizuj je bez dodatkowego narzędzia.

## JAK DZIAŁASZ
- Sam zdecyduj, których narzędzi użyć.
- Przy złożonych zadaniach możesz użyć kilku narzędzi po kolei.
- Gdy użytkownik prosi o aktualne dane, najpierw użyj googleSearch.
- Gdy użytkownik poda URL, użyj readWebPage.
- Gdy użytkownik prosi o obraz, logo, grafikę lub post wizualny, użyj generateImage.
- Po użyciu narzędzi daj krótką, konkretną odpowiedź po polsku i wyjaśnij wynik.

## STYL
- Język: polski
- Ton: sprawczy, konkretny i pomocny
- Formatuj odpowiedzi w czytelnym markdown.`,
};

type ChatMode = keyof typeof systemPrompts;

const readWebPageTool = tool({
  description:
    "Pobiera i czyta zawartość strony internetowej. Używaj gdy użytkownik poda URL lub gdy chcesz przeczytać artykuł/stronę znalezioną w wyszukiwarce.",
  inputSchema: zodSchema(
    z.object({
      url: z.string().url().describe("Pełny adres URL strony internetowej"),
    }),
  ),
  execute: async ({ url }) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(url, {
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; MojAgent/1.0; +https://localhost)",
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        return `Nie udało się pobrać strony. Serwer zwrócił HTTP ${response.status}.`;
      }

      const html = await response.text();
      const text = extractTextFromHtml(html);

      if (!text) {
        return "Strona została pobrana, ale nie udało się wyciągnąć czytelnego tekstu.";
      }

      return text;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return "Nie udało się pobrać strony: przekroczono limit 5 sekund.";
      }

      return "Nie udało się pobrać strony: strona jest niedostępna lub blokuje odczyt.";
    } finally {
      clearTimeout(timeout);
    }
  },
});

const calculatorTool = tool({
  description:
    "Wykonuje obliczenia matematyczne. Używaj do VAT, brutto/netto, procentów, sum i prostych rachunków.",
  inputSchema: zodSchema(
    z.object({
      expression: z
        .string()
        .describe("Wyrażenie matematyczne, np. 8500 * 0.23 albo 8500 + 8500 * 0.23"),
    }),
  ),
  execute: async ({ expression }) => {
    if (!/^[\d\s+\-*/().,%]+$/.test(expression)) {
      return "Nie mogę policzyć tego wyrażenia. Użyj tylko liczb i operatorów + - * / ( ).";
    }

    try {
      const normalizedExpression = expression.replace(/,/g, ".");
      const result = Function(`"use strict"; return (${normalizedExpression});`)();

      if (typeof result !== "number" || !Number.isFinite(result)) {
        return "Wynik nie jest poprawną liczbą.";
      }

      return {
        expression,
        result,
        formatted: new Intl.NumberFormat("pl-PL", {
          maximumFractionDigits: 2,
        }).format(result),
      };
    } catch {
      return "Nie udało się policzyć tego wyrażenia.";
    }
  },
});

const currentDateTimeTool = tool({
  description: "Zwraca aktualną datę i czas. Używaj gdy pytanie zależy od czasu.",
  inputSchema: zodSchema(z.object({})),
  execute: async () => {
    const now = new Date();

    return {
      iso: now.toISOString(),
      warsaw: new Intl.DateTimeFormat("pl-PL", {
        dateStyle: "full",
        timeStyle: "medium",
        timeZone: "Europe/Warsaw",
      }).format(now),
    };
  },
});

const googleSearchTool = tool({
  description:
    "Wyszukuje aktualne informacje w Google. Używaj do newsów, firm, produktów, cen, wydarzeń i tematów wymagających internetu.",
  inputSchema: zodSchema(
    z.object({
      query: z.string().describe("Zapytanie do Google"),
    }),
  ),
  execute: async ({ query }) => {
    const result = await generateText({
      model: google(PRIMARY_MODEL),
      prompt: `Wyszukaj w Google i streść najważniejsze wyniki dla zapytania: ${query}. Podaj najważniejsze fakty i linki, jeśli są dostępne.`,
      tools: {
        google_search: google.tools.googleSearch({}),
      },
      toolChoice: "required",
    });

    return result.text;
  },
});

function createSearchKnowledgeTool(supabase: SupabaseClient, userId: string) {
  return tool({
    description:
      "Wyszukuje informacje w bazie wiedzy firmy: cenniki, FAQ, regulaminy, oferty, pakiety i warunki. Używaj zawsze przed odpowiedzią na pytania o firmę, ceny, koszty lub procedury.",
    inputSchema: zodSchema(
      z.object({
        query: z
          .string()
          .trim()
          .min(2)
          .max(1000)
          .describe("Pytanie użytkownika lub zwięzła fraza do wyszukania w dokumentach firmy"),
      }),
    ),
    execute: async ({ query }) => {
      try {
        return await searchKnowledge(supabase, userId, query);
      } catch (error) {
        return {
          results: [],
          total_found: 0,
          source_documents: [],
          error:
            error instanceof Error
              ? `Nie udało się przeszukać bazy wiedzy: ${error.message}`
              : "Nie udało się przeszukać bazy wiedzy.",
        };
      }
    },
  });
}

type InlineImagePart = {
  inlineData?: {
    data?: string;
    mimeType?: string;
  };
};

type TextPart = {
  text?: string;
};

function getReadableApiError(error: unknown) {
  const rawMessage = error instanceof Error ? error.message : "Nieznany błąd API.";

  try {
    const parsed = JSON.parse(rawMessage) as {
      error?: {
        code?: number;
        message?: string;
        status?: string;
      };
    };
    const apiError = parsed.error;

    if (apiError?.status === "RESOURCE_EXHAUSTED" || apiError?.code === 429) {
      return "Limit API dla generowania obrazów został wyczerpany. Spróbuj ponownie później albo sprawdź limity i billing w Google AI Studio.";
    }

    return apiError?.message ?? rawMessage;
  } catch {
    return rawMessage;
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Przekroczono limit 30 sekund generowania obrazu."));
    }, timeoutMs);

    promise
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(timeout));
  });
}

const generateImageTool = tool({
  description:
    "Generuje obraz na podstawie opisu. Używaj gdy użytkownik prosi o logo, grafikę, ilustrację, post wizualny.",
  inputSchema: zodSchema(
    z.object({
      prompt: z.string().describe("Opis obrazu do wygenerowania"),
    }),
  ),
  execute: async ({ prompt }) => {
    const apiKey = process.env.GOOGLE_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    if (!apiKey) {
      return {
        error: "Brakuje klucza GOOGLE_API_KEY w konfiguracji aplikacji.",
      };
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await withTimeout(
        ai.models.generateContent({
          model: IMAGE_MODEL,
          contents: prompt,
          config: {
            responseModalities: [Modality.TEXT, Modality.IMAGE],
          },
        }),
        IMAGE_TIMEOUT_MS,
      );
      const parts = response.candidates?.[0]?.content?.parts ?? [];
      let image = "";
      let text = "";

      for (const part of parts) {
        const imagePart = part as InlineImagePart;
        const textPart = part as TextPart;

        if (!image && imagePart.inlineData?.data) {
          const mimeType = imagePart.inlineData.mimeType ?? "image/png";
          image = `data:${mimeType};base64,${imagePart.inlineData.data}`;
        }

        if (textPart.text) {
          text = text ? `${text}\n${textPart.text}` : textPart.text;
        }
      }

      if (!image) {
        return {
          error: "Model nie zwrócił obrazu. Spróbuj doprecyzować prompt.",
        };
      }

      return {
        image,
        text: text || "Obraz został wygenerowany.",
        prompt,
      };
    } catch (error) {
      return {
        error: getReadableApiError(error),
      };
    }
  },
});

function getChatMode(mode: unknown): ChatMode {
  if (
    mode === "ekspert" ||
    mode === "kreatywny" ||
    mode === "search" ||
    mode === "vision" ||
    mode === "agent"
  ) {
    return mode;
  }

  return "casual";
}

function getChatModel(model: unknown): ChatModel {
  return model === "pro" ? "pro" : "flash";
}

function extractTextFromHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 3000);
}

function messageHasUrl(messages: UIMessage[]) {
  return messages.some((message) =>
    getMessageText(message).match(/https?:\/\/[^\s)]+/i),
  );
}

function getLastUserText(messages: UIMessage[]) {
  return [...messages]
    .reverse()
    .find((message) => message.role === "user")
    ? getMessageText([...messages].reverse().find((message) => message.role === "user")!)
    : "";
}

function getMessageText(message: UIMessage) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}

function shouldRequireSearch(text: string, mode: ChatMode) {
  if (mode !== "search") {
    return false;
  }

  return /aktual|najnowsz|dzis|teraz|ostatni|źród|zrodl|cena|koszt|kurs|premier|prezydent|wygrał|wygral|kino|repertuar|wiadomości|wiadomosci/i.test(
    text,
  );
}

function shouldSearchKnowledge(text: string) {
  return /cennik|pakiet|ofert|cena|koszt|regulamin|warunk|faq|subskrypcj|rezygnac|anulow|usług|uslug|firma|firmow/i.test(
    text,
  );
}

const fallbackModel = google(FALLBACK_MODEL);

const fallbackMiddleware: LanguageModelMiddleware = {
  async wrapGenerate({ doGenerate, params }) {
    try {
      return await doGenerate();
    } catch {
      return fallbackModel.doGenerate(params);
    }
  },
  async wrapStream({ doStream, params }) {
    try {
      return await doStream();
    } catch {
      return fallbackModel.doStream(params);
    }
  },
};

export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth) return unauthorizedResponse();
  const { supabase, user } = auth;
  const userId = user.id;
  const {
    messages,
    mode,
    model,
  }: { messages: UIMessage[]; mode?: ChatMode; model?: ChatModel } =
    await request.json();

  const selectedModel = getChatModel(model);
  const selectedMode = getChatMode(mode);
  const lastUserText = getLastUserText(messages);
  const hasUrl = messageHasUrl(messages);
  const requireSearch = shouldRequireSearch(lastUserText, selectedMode);
  const requireKnowledgeSearch = shouldSearchKnowledge(lastUserText);
  const isAgentMode = selectedMode === "agent";
  const chatModel = wrapLanguageModel({
    model: google(selectableModels[selectedModel]),
    middleware: fallbackMiddleware,
  });
  const detectedName = extractUserName(lastUserText);

  if (detectedName) {
    await updateUserName(supabase, userId, detectedName);
  }

  const personalizationPrompt = `${await getPersonalizationPrompt(supabase, userId)}${
    detectedName
      ? `\nUżytkownik właśnie przedstawił się jako ${detectedName}. Rozpocznij odpowiedź dokładnie od: „Miło Cię poznać, ${detectedName}! Zapamiętam.”`
      : ""
  }`;
  const personalizationTools = {
    updateUserName: createUpdateUserNameTool(supabase, userId),
    saveUserPreference: createSaveUserPreferenceTool(supabase, userId),
  };
  const chatTools = {
    calculator: calculatorTool,
    currentDateTime: currentDateTimeTool,
    googleSearch: googleSearchTool,
    readWebPage: readWebPageTool,
    generateImage: generateImageTool,
    searchKnowledge: createSearchKnowledgeTool(supabase, userId),
    ...personalizationTools,
  };

  const result = streamText({
    model: chatModel,
    system: `${systemPrompts[selectedMode]}\n\n${knowledgeBaseInstructions}\n\n## Personalizacja\n${personalizationPrompt}`,
    messages: await convertToModelMessages(messages),
    stopWhen: isStepCount(5),
    toolChoice: isAgentMode
      ? "auto"
      : hasUrl
        ? { type: "tool", toolName: "readWebPage" }
        : requireSearch
          ? { type: "tool", toolName: "googleSearch" }
          : "auto",
    prepareStep: ({ stepNumber }) =>
      requireKnowledgeSearch && stepNumber === 0
        ? { toolChoice: { type: "tool", toolName: "searchKnowledge" } }
        : undefined,
    tools: chatTools,
  });

  return result.toUIMessageStreamResponse({
    sendSources: true,
    onError: (error) => {
      const message = error instanceof Error ? error.message : String(error);

      if (message.includes("quota") || message.includes("RESOURCE_EXHAUSTED")) {
        return "Limit API Gemini został chwilowo wyczerpany. Spróbuj ponownie za moment albo sprawdź limity w Google AI Studio.";
      }

      return "Nie udało się pobrać odpowiedzi od modelu.";
    },
  });
}
