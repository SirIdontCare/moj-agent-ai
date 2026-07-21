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

const thinkingPrompt = `Jesteś analitykiem. Twoim zadaniem jest MYŚLEĆ NA GŁOS.

Gdy dostajesz pytanie, MUSISZ przejść przez te kroki:

### 🧠 MYŚLĘ...

**Krok 1 — Zrozumienie:**
Co dokładnie użytkownik pyta? Przeformułuj pytanie swoimi słowami.

**Krok 2 — Fakty:**
Co wiem na ten temat? Co jest pewne, a co wymaga sprawdzenia?

**Krok 3 — Analiza:**
Jakie są 2-3 możliwe podejścia/odpowiedzi?

**Krok 4 — Ocena:**
Które podejście jest najlepsze? DLACZEGO?

### ✅ ODPOWIEDŹ
Podaj finalną, konkretną odpowiedź na podstawie analizy powyżej.

WAŻNE:
- ZAWSZE pokaż CAŁY proces myślenia — użytkownik widzi jak pracujesz
- Używaj nagłówków markdown do oddzielenia kroków
- Krok "Myślę" powinien być DŁUŻSZY niż finalna odpowiedź`;

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
    system: thinkingPrompt,
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
