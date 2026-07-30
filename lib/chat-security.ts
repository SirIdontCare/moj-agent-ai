import {
  safeValidateUIMessages,
  type StreamTextTransform,
  type TextStreamPart,
  type ToolSet,
  type UIMessage,
} from "ai";
import { z } from "zod/v4";

export const CHAT_RATE_LIMIT = 50;
export const CHAT_RATE_LIMIT_WINDOW_SECONDS = 60 * 60;
export const MAX_CHAT_REQUEST_BYTES = 6 * 1024 * 1024;

const MAX_MESSAGES = 100;
const MAX_MESSAGE_TEXT_LENGTH = 12_000;
const MAX_TOTAL_TEXT_LENGTH = 60_000;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_IMAGE_DATA_URL_LENGTH = Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 1024;
const acceptedImageTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

const chatRequestSchema = z
  .object({
    messages: z.unknown(),
    mode: z
      .enum(["casual", "ekspert", "kreatywny", "search", "vision", "agent"])
      .optional(),
    model: z.enum(["flash", "pro"]).optional(),
  })
  .strict();

const promptExtractionPatterns = [
  /(?:ujawnij|pokaż|pokaz|wyświetl|wyswietl|zacytuj|powtórz|powtorz|wypisz|podaj|wydrukuj)[\s\S]{0,100}(?:prompt systemowy|system prompt|ukryte instrukcje|instrukcje systemowe)/i,
  /(?:reveal|show|display|quote|repeat|print|dump)[\s\S]{0,100}(?:system prompt|hidden instructions|system instructions|developer message)/i,
  /(?:zignoruj|ignoruj|pomiń|pomin)[\s\S]{0,80}(?:poprzednie|wcześniejsze|wczesniejsze|systemowe)[\s\S]{0,80}(?:instrukcje|polecenia)/i,
  /(?:ignore|disregard|bypass)[\s\S]{0,80}(?:previous|prior|system|developer)[\s\S]{0,80}(?:instructions|message|rules)/i,
];

const leakIntroductionPatterns = [
  /(?:system prompt|prompt systemowy|ukryte instrukcje|instrukcje systemowe)[\s\S]{0,80}(?:brzmi|zawiera|to:|poniżej|ponizej)/i,
  /(?:system prompt|hidden instructions|system instructions|developer message)[\s\S]{0,80}(?:is:|contains|below|follows)/i,
];

export type ValidChatRequest = {
  messages: UIMessage[];
  mode?: "casual" | "ekspert" | "kreatywny" | "search" | "vision" | "agent";
  model?: "flash" | "pro";
};

export type ChatInputValidationResult =
  | { success: true; data: ValidChatRequest }
  | {
      success: false;
      error: string;
      securityEvent?: "prompt_injection" | "system_message";
      messagePreview?: string;
    };

function getText(message: UIMessage) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}

function isValidImagePart(part: UIMessage["parts"][number]) {
  if (part.type !== "file") {
    return true;
  }

  return (
    acceptedImageTypes.has(part.mediaType) &&
    part.url.startsWith(`data:${part.mediaType};base64,`) &&
    part.url.length <= MAX_IMAGE_DATA_URL_LENGTH
  );
}

export function isPromptExtractionAttempt(text: string) {
  return promptExtractionPatterns.some((pattern) => pattern.test(text));
}

export async function validateChatInput(payload: unknown): Promise<ChatInputValidationResult> {
  const envelope = chatRequestSchema.safeParse(payload);

  if (!envelope.success) {
    return { success: false, error: "Nieprawidłowy format żądania." };
  }

  const validation = await safeValidateUIMessages<UIMessage>({
    messages: envelope.data.messages,
  });

  if (!validation.success) {
    return { success: false, error: "Nieprawidłowy format wiadomości." };
  }

  const messages = validation.data;

  if (messages.length === 0 || messages.length > MAX_MESSAGES) {
    return {
      success: false,
      error: `Rozmowa musi zawierać od 1 do ${MAX_MESSAGES} wiadomości.`,
    };
  }

  if (messages.some((message) => message.role === "system")) {
    return {
      success: false,
      error: "Wiadomości systemowe nie są przyjmowane od użytkownika.",
      securityEvent: "system_message",
      messagePreview: messages
        .filter((message) => message.role === "system")
        .map(getText)
        .join(" ")
        .slice(0, 500),
    };
  }

  if (messages.at(-1)?.role !== "user") {
    return {
      success: false,
      error: "Ostatnia wiadomość musi pochodzić od użytkownika.",
    };
  }

  let totalTextLength = 0;

  for (const message of messages) {
    if (message.id.length === 0 || message.id.length > 200) {
      return { success: false, error: "Nieprawidłowy identyfikator wiadomości." };
    }

    if (
      message.role === "user" &&
      message.parts.some((part) => part.type !== "text" && part.type !== "file")
    ) {
      return {
        success: false,
        error: "Wiadomość użytkownika może zawierać tylko tekst i obraz.",
      };
    }

    if (message.parts.some((part) => !isValidImagePart(part))) {
      return {
        success: false,
        error: "Obraz musi być plikiem PNG, JPG, GIF lub WEBP o rozmiarze do 4 MB.",
      };
    }

    const text = getText(message);

    if (
      text.length > MAX_MESSAGE_TEXT_LENGTH ||
      /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(text)
    ) {
      return {
        success: false,
        error: `Wiadomość może mieć maksymalnie ${MAX_MESSAGE_TEXT_LENGTH} znaków i nie może zawierać znaków sterujących.`,
      };
    }

    totalTextLength += text.length;
  }

  if (totalTextLength > MAX_TOTAL_TEXT_LENGTH) {
    return {
      success: false,
      error: `Łączny kontekst rozmowy może mieć maksymalnie ${MAX_TOTAL_TEXT_LENGTH} znaków.`,
    };
  }

  const lastMessage = messages.at(-1)!;
  const lastText = getText(lastMessage).trim();
  const hasImage = lastMessage.parts.some((part) => part.type === "file");

  if (!lastText && !hasImage) {
    return { success: false, error: "Wiadomość nie może być pusta." };
  }

  if (isPromptExtractionAttempt(lastText)) {
    return {
      success: false,
      error: "Nie mogę przetworzyć polecenia dotyczącego ujawnienia wewnętrznych instrukcji.",
      securityEvent: "prompt_injection",
      messagePreview: lastText.slice(0, 500),
    };
  }

  return {
    success: true,
    data: {
      messages,
      mode: envelope.data.mode,
      model: envelope.data.model,
    },
  };
}

function normalizeForLeakDetection(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("pl-PL")
    .replace(/[`*_>#:[\](){}"'„”’]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsProtectedPromptOverlap(output: string, protectedPrompt: string) {
  const normalizedOutput = normalizeForLeakDetection(output);
  const normalizedPrompt = normalizeForLeakDetection(protectedPrompt);
  const windowLength = 100;
  const step = 40;

  if (normalizedOutput.length < windowLength) {
    return false;
  }

  for (let index = 0; index + windowLength <= normalizedPrompt.length; index += step) {
    if (normalizedOutput.includes(normalizedPrompt.slice(index, index + windowLength))) {
      return true;
    }
  }

  return false;
}

export function filterAssistantOutput(output: string, protectedPrompt: string) {
  const looksLikeLeak =
    leakIntroductionPatterns.some((pattern) => pattern.test(output)) ||
    containsProtectedPromptOverlap(output, protectedPrompt);

  if (looksLikeLeak) {
    return "Nie mogę ujawnić wewnętrznych instrukcji ani konfiguracji systemowej. Mogę za to pomóc w zadaniu użytkowym.";
  }

  return output.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
}

export function createSystemPromptOutputFilter<TOOLS extends ToolSet>(
  protectedPrompt: string,
): StreamTextTransform<TOOLS> {
  return () => {
    const bufferedText = new Map<
      string,
      {
        start: Extract<TextStreamPart<TOOLS>, { type: "text-start" }>;
        text: string;
      }
    >();

    return new TransformStream<TextStreamPart<TOOLS>, TextStreamPart<TOOLS>>({
      transform(part, controller) {
        if (part.type === "text-start") {
          bufferedText.set(part.id, { start: part, text: "" });
          return;
        }

        if (part.type === "text-delta") {
          const buffered = bufferedText.get(part.id);

          if (buffered) {
            buffered.text += part.text;
            return;
          }
        }

        if (part.type === "text-end") {
          const buffered = bufferedText.get(part.id);

          if (buffered) {
            const filteredText = filterAssistantOutput(buffered.text, protectedPrompt);
            controller.enqueue(buffered.start);

            if (filteredText) {
              controller.enqueue({
                type: "text-delta",
                id: part.id,
                text: filteredText,
              });
            }

            controller.enqueue(part);
            bufferedText.delete(part.id);
            return;
          }
        }

        controller.enqueue(part);
      },
      flush(controller) {
        for (const [id, buffered] of bufferedText) {
          const filteredText = filterAssistantOutput(buffered.text, protectedPrompt);
          controller.enqueue(buffered.start);

          if (filteredText) {
            controller.enqueue({ type: "text-delta", id, text: filteredText });
          }

          controller.enqueue({ type: "text-end", id });
        }
      },
    });
  };
}
