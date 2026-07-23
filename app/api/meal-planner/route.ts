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
const MAX_REQUEST_LENGTH = 6_000;
const searchGroundingEnabled =
  process.env.ENABLE_SEARCH_GROUNDING?.toLowerCase() === "true";

function getMessageText(message: UIMessage) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}

const systemPrompt = `Jesteś praktycznym dietetykiem-kulinarnym i planistą domowych posiłków.
Na podstawie preferencji użytkownika tworzysz wykonalny plan, który ogranicza marnowanie
żywności, mieści się możliwie blisko budżetu i nie wymaga kupowania egzotycznych składników.

## TWÓJ PROCES
1. Odczytaj liczbę osób, dni i posiłków dziennie oraz wszystkie ograniczenia.
2. Potraktuj alergie i wykluczenia jako bezwzględne — zakazanych składników nie wolno użyć.
3. Zaplanuj różnorodne dania, ale świadomie wykorzystuj te same składniki w kilku posiłkach.
4. Dopasuj porcje do liczby osób. Używaj kalkulatora do ilości, porcji i kosztów.
5. Jeżeli potrzebujesz aktualnych informacji, korzystaj z dostępnych źródeł.
6. Przy cenach podawaj uczciwe wartości orientacyjne w PLN, a nie fałszywą precyzję.

## FORMAT ODPOWIEDZI

# 🍽️ Plan posiłków

## Założenia
- **Okres:** [...]
- **Dla:** [...]
- **Styl i cel:** [...]
- **Budżet:** [...]
- **Wykluczenia:** [...]

## Plan
Utwórz tabelę. Każdy dzień jest osobnym wierszem, a każda zaplanowana pora posiłku
osobną kolumną. Liczba dni i posiłków musi dokładnie odpowiadać formularzowi.

## Przepisy
Dla każdego unikalnego dania dodaj krótką sekcję:

### [Nazwa dania]
**Porcje:** [...]
**Składniki:** [konkretne ilości]
**Przygotowanie:** [2-4 krótkie kroki]

## Lista zakupów
Zgrupuj i zsumuj ilości dla całego planu:
- **Warzywa i owoce:** [...]
- **Produkty suche:** [...]
- **Nabiał i zamienniki:** [...]
- **Mięso, ryby lub źródła białka:** [...]
- **Pozostałe:** [...]

Nie dodawaj do zakupów produktów, które użytkownik ma już w domu.

## Plan przygotowania
[Co przygotować wcześniej i jak bezpiecznie przechowywać, aby oszczędzić czas.]

## Koszt i wartości odżywcze
- **Szacowany koszt całości:** [...]
- **Szacowany koszt na osobę / dzień:** [...]
- **Orientacyjna energia na osobę / dzień:** [...]
- **Białko na osobę / dzień:** [...]

## Praktyczne zamienniki
[3-5 prostych zamian produktów, bez naruszania wykluczeń.]

## Źródła i uwagi
[Tylko rzeczywiście użyte źródła z linkami. Jeżeli nie użyto źródeł, napisz,
że ilości, ceny i wartości odżywcze są szacunkami.]

## ZASADY
- Odpowiadaj po polsku.
- Plan ma być konkretny, wykonalny i zgodny z danymi użytkownika.
- Nie pomijaj żadnego dnia ani posiłku.
- Nie wymyślaj linków, badań ani aktualnych cen.
- Nie diagnozuj chorób i nie przedstawiaj planu jako porady medycznej.
- Przy chorobie, ciąży, zaburzeniach odżywiania lub diecie leczniczej dodaj krótką
  informację, że indywidualny jadłospis należy skonsultować ze specjalistą.
- Nie opisuj wywołań narzędzi ani swojego toku rozumowania.

## GOOGLE SEARCH
${
  searchGroundingEnabled
    ? "Google Search grounding jest WŁĄCZONY. Możesz użyć go do sprawdzania aktualnych źródeł i orientacyjnych cen."
    : "Google Search grounding jest WYŁĄCZONY. Nie twierdź, że wyszukujesz aktualne ceny w Google; oznacz ceny i wartości jako szacunki."
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
  const preferences = lastUserMessage
    ? getMessageText(lastUserMessage).trim()
    : "";

  if (!preferences) {
    return Response.json(
      { error: "Uzupełnij preferencje planu posiłków." },
      { status: 400 },
    );
  }

  if (preferences.length > MAX_REQUEST_LENGTH) {
    return Response.json(
      {
        error: `Opis planu może mieć maksymalnie ${MAX_REQUEST_LENGTH.toLocaleString("pl-PL")} znaków.`,
      },
      { status: 400 },
    );
  }

  const tools = {
    calculator: calculatorTool,
    searchWikipedia: searchWikipediaTool,
    readWebPage: readWebPageTool,
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

      console.error("[api/meal-planner] Gemini stream error:", message);

      if (message.includes("quota") || message.includes("RESOURCE_EXHAUSTED")) {
        return "Limit API Gemini został chwilowo wyczerpany. Spróbuj ponownie później.";
      }

      if (message.includes("connect") || message.includes("EACCES")) {
        return "Serwer nie ma teraz dostępu do internetu. Plan może zostać przygotowany bez aktualnych źródeł.";
      }

      return "Nie udało się przygotować planu posiłków.";
    },
  });
}
