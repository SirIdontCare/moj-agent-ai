import { google } from "@ai-sdk/google";
import {
  convertToModelMessages,
  isStepCount,
  streamText,
  type UIMessage,
} from "ai";
import {
  calculatorTool,
  readWebPageTool,
  searchWikipediaTool,
} from "../../lib/tools";
import { authenticateRequest, unauthorizedResponse } from "@/lib/supabase-server";

export const maxDuration = 120;

const MODEL = "gemini-3.1-flash-lite";
const MAX_TOPIC_LENGTH = 1_000;
const searchGroundingEnabled =
  process.env.ENABLE_SEARCH_GROUNDING?.toLowerCase() === "true";

function getCurrentDate() {
  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "long",
    timeZone: "Europe/Warsaw",
  }).format(new Date());
}

function getMessageText(message: UIMessage) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}

const systemPrompt = `Jesteś profesjonalnym analitykiem biznesowym. Gdy użytkownik poda temat,
AUTONOMICZNIE zbierasz informacje i piszesz raport.

## TWÓJ PROCES:
1. Przeanalizuj temat — co trzeba zbadać?
2. Zbierz dane z dostępnych narzędzi: Google Search, Wikipedia i strony branżowe
3. Zweryfikuj fakty, liczby i statystyki w źródłach
4. W razie potrzeby wykonaj dokładne obliczenia narzędziem calculator
5. Napisz spójny raport w profesjonalnym formacie

## FORMAT RAPORTU:

# 📊 Raport: [TEMAT]
Data: ${getCurrentDate()}
Autor: Agent AI

## Streszczenie (Executive Summary)
[3-4 zdania — kluczowe wnioski]

## 1. Wprowadzenie
[Kontekst, dlaczego ten temat jest ważny]

## 2. Kluczowe dane i fakty
[Wylistowane punkty z danymi — ze źródłami]

## 3. Analiza
[Interpretacja danych, trendy, porównania. Dla tematów porównawczych dodaj tabelę.]

## 4. Wnioski i rekomendacje
[Co z tego wynika? Co robić? Konkretne rekomendacje.]

## Źródła
[Numerowana lista rzeczywiście użytych źródeł z nazwami i pełnymi linkami]

## ZASADY:
- Używaj wyłącznie danych znalezionych w narzędziach lub wiedzy, którą możesz rzetelnie zweryfikować.
- Podawaj źródło przy każdym istotnym fakcie, liczbie i statystyce.
- Bądź konkretny — używaj liczb, dat i nazw.
- Raport powinien mieć 500-1000 słów.
- Nie wymyślaj statystyk, linków ani wyników badań.
- Jeśli źródła podają różne wartości, pokaż rozbieżność i wyjaśnij możliwą przyczynę.
- Jeśli nie uda się zweryfikować danych, napisz to wprost.
- Nie opisuj użytkownikowi swoich kroków ani wywołań narzędzi. Zwróć wyłącznie gotowy raport.
- Odpowiadaj po polsku.

## DOSTĘP DO GOOGLE SEARCH:
${
  searchGroundingEnabled
    ? "Google Search grounding jest WŁĄCZONY. Zawsze rozpocznij badanie od wyszukania aktualnych źródeł w Google."
    : "Google Search grounding jest WYŁĄCZONY. Nie twierdź, że przeszukałeś Google. Korzystaj z Wikipedii oraz stron podanych przez użytkownika; jasno zaznacz ograniczenia dostępnych źródeł."
}`;

export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth) return unauthorizedResponse();

  let messages: UIMessage[];

  try {
    const body = (await request.json()) as { messages?: unknown };
    messages = Array.isArray(body.messages) ? (body.messages as UIMessage[]) : [];
  } catch {
    return Response.json({ error: "Nieprawidłowy format JSON." }, { status: 400 });
  }

  const topic =
    [...messages]
      .reverse()
      .find((message) => message.role === "user")
      ? getMessageText(
          [...messages].reverse().find((message) => message.role === "user")!,
        ).trim()
      : "";

  if (!topic) {
    return Response.json({ error: "Podaj temat raportu." }, { status: 400 });
  }

  if (topic.length > MAX_TOPIC_LENGTH) {
    return Response.json(
      {
        error: `Temat raportu może mieć maksymalnie ${MAX_TOPIC_LENGTH.toLocaleString("pl-PL")} znaków.`,
      },
      { status: 400 },
    );
  }

  const tools = {
    readWebPage: readWebPageTool,
    searchWikipedia: searchWikipediaTool,
    calculator: calculatorTool,
    ...(searchGroundingEnabled
      ? { google_search: google.tools.googleSearch({}) }
      : {}),
  };

  const result = streamText({
    model: google(MODEL),
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    stopWhen: isStepCount(8),
    toolChoice: "auto",
    tools,
    prepareStep: ({ stepNumber }) =>
      searchGroundingEnabled && stepNumber === 0
        ? {
            toolChoice: {
              type: "tool" as const,
              toolName: "google_search" as keyof typeof tools,
            },
          }
        : undefined,
  });

  return result.toUIMessageStreamResponse({
    sendSources: true,
    onError: (error) => {
      const message = error instanceof Error ? error.message : String(error);

      if (message.includes("quota") || message.includes("RESOURCE_EXHAUSTED")) {
        return "Limit API Gemini został chwilowo wyczerpany. Spróbuj ponownie później.";
      }

      if (message.includes("connect") || message.includes("EACCES")) {
        return "Serwer nie ma teraz dostępu do internetu, więc nie może zebrać danych do raportu.";
      }

      return "Nie udało się wygenerować raportu.";
    },
  });
}
