import { google } from "@ai-sdk/google";
import {
  convertToModelMessages,
  isStepCount,
  streamText,
  type UIMessage,
} from "ai";
import { readWebPageTool, searchWikipediaTool } from "../../lib/tools";
import { authenticateRequest, unauthorizedResponse } from "@/lib/supabase-server";

export const maxDuration = 120;

const MODEL = "gemini-3.1-flash-lite";
const MAX_REQUEST_LENGTH = 4_000;
const searchGroundingEnabled =
  process.env.ENABLE_SEARCH_GROUNDING?.toLowerCase() === "true";

function getMessageText(message: UIMessage) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}

const systemPrompt = `Jesteś analitykiem konkurencji. Gdy użytkownik poda nazwy firm,
AUTONOMICZNIE zbierasz informacje i porównujesz je.

## TWÓJ PROCES:
1. Dla KAŻDEJ firmy zbierz informacje z dostępnych źródeł: Google, Wikipedia i strony firmowe.
2. Sprawdź opis, branżę, skalę działalności, produkty, ceny oraz mocne i słabe strony.
3. Zweryfikuj aktualność cen i wyraźnie podaj datę lub okres, którego dotyczą.
4. Stwórz czytelną tabelę porównawczą.
5. Napisz rekomendację dopasowaną do kontekstu użytkownika.

## FORMAT:

# 🏢 Analiza konkurencji

## Porównanie

| Aspekt | [Firma 1] | [Firma 2] | [Firma 3] |
|--------|-----------|-----------|-----------|
| Branża | ... | ... | ... |
| Wielkość | ... | ... | ... |
| Główny produkt | ... | ... | ... |
| Kluczowe funkcje | ... | ... | ... |
| Mocne strony | ... | ... | ... |
| Słabe strony | ... | ... | ... |
| Ceny (orientacyjne) | ... | ... | ... |
| Najlepsze zastosowanie | ... | ... | ... |

## Szczegółowa analiza

### [Firma 1]
[3-4 konkretne zdania]

### [Firma 2]
[3-4 konkretne zdania]

### [Firma 3]
[3-4 konkretne zdania]

## Rekomendacja
[Która firma jest najlepsza i dlaczego — w kontekście użytkownika. Wskaż również, kiedy lepiej wybrać każdą z pozostałych.]

## Źródła
[Numerowana lista rzeczywiście użytych źródeł z nazwami i pełnymi linkami]

## ZASADY:
- Porównaj dokładnie trzy podmioty podane przez użytkownika i zachowaj ich nazwy.
- Używaj prawdziwych, możliwie aktualnych danych.
- Nie wymyślaj cen, statystyk, funkcji ani linków.
- Przy każdym istotnym fakcie lub cenie wskaż źródło.
- Gdy danych nie da się potwierdzić, wpisz „brak wiarygodnych danych”.
- Oddziel fakty od oceny analitycznej.
- Jeśli użytkownik poda kontekst, rekomendacja musi się do niego bezpośrednio odnosić.
- Nie opisuj wywołań narzędzi ani wewnętrznego procesu. Zwróć wyłącznie gotową analizę.
- Odpowiadaj po polsku.

## DOSTĘP DO GOOGLE SEARCH:
${
  searchGroundingEnabled
    ? "Google Search grounding jest WŁĄCZONY. Użyj go do zebrania aktualnych danych o każdej z trzech firm."
    : "Google Search grounding jest WYŁĄCZONY. Nie twierdź, że przeszukałeś Google. Korzystaj z Wikipedii i stron podanych przez użytkownika oraz jasno zaznacz ograniczenia źródeł."
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

  const lastUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === "user");
  const requestText = lastUserMessage ? getMessageText(lastUserMessage).trim() : "";

  if (!requestText) {
    return Response.json(
      { error: "Podaj trzy firmy do porównania." },
      { status: 400 },
    );
  }

  if (requestText.length > MAX_REQUEST_LENGTH) {
    return Response.json(
      {
        error: `Opis analizy może mieć maksymalnie ${MAX_REQUEST_LENGTH.toLocaleString("pl-PL")} znaków.`,
      },
      { status: 400 },
    );
  }

  const tools = {
    readWebPage: readWebPageTool,
    searchWikipedia: searchWikipediaTool,
    ...(searchGroundingEnabled
      ? { google_search: google.tools.googleSearch({}) }
      : {}),
  };

  const result = streamText({
    model: google(MODEL),
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    stopWhen: isStepCount(10),
    toolChoice: "auto",
    tools,
  });

  return result.toUIMessageStreamResponse({
    sendSources: true,
    onError: (error) => {
      const message = error instanceof Error ? error.message : String(error);

      console.error("[api/competitor] Gemini stream error:", message);

      if (message.includes("quota") || message.includes("RESOURCE_EXHAUSTED")) {
        return "Limit API Gemini został chwilowo wyczerpany. Spróbuj ponownie później.";
      }

      if (message.includes("connect") || message.includes("EACCES")) {
        return "Serwer nie ma teraz dostępu do internetu, więc nie może zebrać danych o firmach.";
      }

      return "Nie udało się przygotować analizy konkurencji.";
    },
  });
}
