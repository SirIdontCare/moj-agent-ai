const EMBEDDING_MODEL = "gemini-embedding-2";
const EXPECTED_DIMENSIONS = 768;

type EmbeddingResponse = {
  embedding?: {
    values?: unknown;
  };
  error?: {
    message?: string;
  };
};

function getApiKey() {
  return process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GOOGLE_API_KEY;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const content = text.trim();

  if (!content) {
    throw new Error("Nie można wygenerować embeddingu dla pustego tekstu.");
  }

  const apiKey = getApiKey();

  if (!apiKey) {
    throw new Error("Brakuje GOOGLE_GENERATIVE_AI_API_KEY w pliku .env.local.");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: `models/${EMBEDDING_MODEL}`,
        content: { parts: [{ text: content }] },
        output_dimensionality: EXPECTED_DIMENSIONS,
      }),
    },
  );

  const result = (await response.json().catch(() => ({}))) as EmbeddingResponse;

  if (!response.ok) {
    throw new Error(result.error?.message ?? `Gemini zwrócił błąd HTTP ${response.status}.`);
  }

  const values = result.embedding?.values;

  if (!Array.isArray(values) || values.some((value) => typeof value !== "number" || !Number.isFinite(value))) {
    throw new Error("Gemini nie zwrócił poprawnego wektora embeddingu.");
  }

  if (values.length !== EXPECTED_DIMENSIONS) {
    throw new Error(
      `Gemini zwrócił wektor o długości ${values.length}, a tabela documents wymaga ${EXPECTED_DIMENSIONS} wymiarów.`,
    );
  }

  return values;
}
