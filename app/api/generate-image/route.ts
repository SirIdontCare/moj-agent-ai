import { GoogleGenAI, Modality } from "@google/genai";
import { NextResponse } from "next/server";

export const maxDuration = 30;

const IMAGE_MODEL = "gemini-3.1-flash-lite-image";
const TIMEOUT_MS = 30_000;

type InlineImagePart = {
  inlineData?: {
    data?: string;
    mimeType?: string;
  };
};

type TextPart = {
  text?: string;
};

function isTimeoutError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function getReadableApiError(error: unknown) {
  const fallback = "Nieznany błąd API.";
  const rawMessage = error instanceof Error ? error.message : fallback;

  try {
    const parsed = JSON.parse(rawMessage) as {
      error?: {
        code?: number;
        message?: string;
        status?: string;
      };
    };
    const apiError = parsed.error;

    if (!apiError?.message) {
      return rawMessage;
    }

    if (apiError.status === "RESOURCE_EXHAUSTED" || apiError.code === 429) {
      return "Limit API dla generowania obrazów został wyczerpany. Spróbuj ponownie później albo sprawdź limity i billing w Google AI Studio.";
    }

    return apiError.message;
  } catch {
    return rawMessage;
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      const error = new Error("Przekroczono limit 30 sekund generowania obrazu.");
      error.name = "AbortError";
      reject(error);
    }, timeoutMs);

    promise
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(timeout));
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as { prompt?: unknown } | null;
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";

    if (!prompt) {
      return NextResponse.json(
        { error: "Podaj opis obrazu do wygenerowania." },
        { status: 400 },
      );
    }

    const apiKey = process.env.GOOGLE_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Brakuje klucza GOOGLE_API_KEY w konfiguracji aplikacji." },
        { status: 500 },
      );
    }

    const ai = new GoogleGenAI({ apiKey });
    const response = await withTimeout(
      ai.models.generateContent({
        model: IMAGE_MODEL,
        contents: prompt,
        config: {
          responseModalities: [Modality.TEXT, Modality.IMAGE],
        },
      }),
      TIMEOUT_MS,
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
      return NextResponse.json(
        { error: "Model nie zwrócił obrazu. Spróbuj doprecyzować prompt." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      image,
      text: text || "Gotowe. Obraz został wygenerowany na podstawie Twojego opisu.",
    });
  } catch (error) {
    if (isTimeoutError(error)) {
      return NextResponse.json(
        { error: "Generowanie trwało dłużej niż 30 sekund. Spróbuj krótszego opisu." },
        { status: 504 },
      );
    }

    const message = getReadableApiError(error);

    return NextResponse.json(
      { error: `Nie udało się wygenerować obrazu: ${message}` },
      { status: 500 },
    );
  }
}
