import { google } from "@ai-sdk/google";
import {
  convertToModelMessages,
  streamText,
  wrapLanguageModel,
  type LanguageModelMiddleware,
  type UIMessage,
} from "ai";

export const maxDuration = 30;

const PRIMARY_MODEL = "gemini-3.5-flash";
const PRO_MODEL = "gemini-3.1-pro-preview";
const FALLBACK_MODEL = "gemini-2.5-flash";

const selectableModels = {
  flash: PRIMARY_MODEL,
  pro: PRO_MODEL,
} as const;

type ChatModel = keyof typeof selectableModels;

const fewShotPrompt = `Jesteś asystentem który odpowiada w DOKŁADNIE takim formacie jak w przykładach poniżej.

## PRZYKŁADY

Użytkownik: "Czym jest API?"
Asystent:
📖 **API (Application Programming Interface)**
Prosty opis: To "kelner" w restauracji — pośrednik między tobą a kuchnią. 
Ty zamawiasz (wysyłasz request), kelner zanosi do kuchni (serwer), 
i przynosi danie (response).
⚡ W praktyce: Gdy Allegro pokazuje status paczki InPost — 
pobiera dane przez API z systemu InPost.
🔗 Powiązane: REST, endpoint, JSON, HTTP

Użytkownik: "Czym jest B2B?"
Asystent:
📖 **B2B (Business-to-Business)**
Prosty opis: To umowa między Twoją firmą a firmą klienta — 
jak dwóch rzemieślników na targu, a nie sklep i klient.
⚡ W praktyce: Programista zakłada JDG, wystawia fakturę VAT 
zamiast mieć umowę o pracę. Zarabia więcej netto, ale sam płaci ZUS i nie ma urlopu.
🔗 Powiązane: JDG, faktura VAT, ZUS, umowa o pracę

## ZASADY
- ZAWSZE odpowiadaj w DOKŁADNIE tym formacie: 📖 termin → prosty opis z analogią → ⚡ praktyczny przykład → 🔗 powiązane terminy
- Analogie powinny być z codziennego życia (restauracja, mieszkanie, samochód)
- Odpowiedź max 6 linii
- Jeśli pytanie NIE jest o definicję/termin — odpowiedz normalnie ale zachowaj zwięzły styl`;

function getChatModel(model: unknown): ChatModel {
  return model === "pro" ? "pro" : "flash";
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
  const { messages, model }: { messages: UIMessage[]; model?: ChatModel } =
    await request.json();

  const selectedModel = getChatModel(model);
  const chatModel = wrapLanguageModel({
    model: google(selectableModels[selectedModel]),
    middleware: fallbackMiddleware,
  });

  const result = streamText({
    model: chatModel,
    system: fewShotPrompt,
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
