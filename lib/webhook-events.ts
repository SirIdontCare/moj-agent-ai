import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { createClient } from "@supabase/supabase-js";

const MODEL = "gemini-3.1-flash-lite";
const MAX_DATA_LENGTH = 10_000;

export const WEBHOOK_EVENT_TYPES = ["feedback", "alert", "order"] as const;

export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];
export type WebhookEventData = Record<string, unknown>;

const systemPrompt = `Jesteś agentem operacyjnym, który analizuje zdarzenia przychodzące z systemów zewnętrznych.

ZASADY:
- Odpowiadaj po polsku, zwięźle (maksymalnie 120 słów).
- Używaj wyłącznie podanego formatu. Nie dodawaj wstępu ani komentarza poza analizą.
- Opieraj się tylko na danych ze zdarzenia. Nie wymyślaj faktów, liczb ani nazwisk.
- Jeśli w danych brakuje istotnej informacji, napisz o tym wprost zamiast zgadywać.`;

const formats: Record<WebhookEventType, string> = {
  feedback: `Zdarzenie: opinia klienta. Odpowiedz w formacie:

**Sentyment:** [pozytywny / neutralny / negatywny]
**Priorytet:** [🔴 Wysoki / 🟡 Średni / 🟢 Niski] — [krótkie uzasadnienie]
**Problem:** [czego dotyczy opinia]
**Sugerowana odpowiedź:** [2-3 zdania gotowe do wysłania klientowi]`,
  alert: `Zdarzenie: alert techniczny. Odpowiedz w formacie:

**Severity:** [krytyczny / wysoki / średni / niski] — [krótkie uzasadnienie]
**Wpływ:** [na jakie usługi i użytkowników wpływa]
**Rekomendowana akcja:** [1-3 konkretne kroki w kolejności wykonania]
**Kto powinien zareagować:** [zespół lub rola]`,
  order: `Zdarzenie: nowe zamówienie. Odpowiedz w formacie:

**Potwierdzenie:** [jedno zdanie potwierdzające przyjęcie zamówienia]
**Podsumowanie:** [produkt, klient, kwota]
**Następny krok:** [co zespół lub system powinien teraz zrobić]`,
};

function isWebhookEventType(value: unknown): value is WebhookEventType {
  return (
    typeof value === "string" &&
    (WEBHOOK_EVENT_TYPES as readonly string[]).includes(value)
  );
}

export function validateWebhookPayload(body: unknown) {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { error: "Body musi być obiektem JSON z polami „type” i „data”." } as const;
  }

  const { type, data } = body as { type?: unknown; data?: unknown };

  if (!isWebhookEventType(type)) {
    return {
      error: `Pole „type” musi mieć jedną z wartości: ${WEBHOOK_EVENT_TYPES.join(", ")}.`,
    } as const;
  }

  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return { error: "Pole „data” musi być obiektem JSON." } as const;
  }

  const serialized = JSON.stringify(data);

  if (Object.keys(data).length === 0) {
    return { error: "Pole „data” nie może być puste." } as const;
  }

  if (serialized.length > MAX_DATA_LENGTH) {
    return {
      error: `Pole „data” może mieć maksymalnie ${MAX_DATA_LENGTH.toLocaleString("pl-PL")} znaków po serializacji.`,
    } as const;
  }

  return { type, data: data as WebhookEventData } as const;
}

export async function analyzeWebhookEvent(
  type: WebhookEventType,
  data: WebhookEventData,
) {
  const result = await generateText({
    model: google(MODEL),
    system: systemPrompt,
    prompt: `${formats[type]}\n\nDane zdarzenia:\n${JSON.stringify(data, null, 2)}`,
  });
  const analysis = result.text.trim();

  if (!analysis) {
    throw new Error("Model nie zwrócił analizy zdarzenia.");
  }

  return analysis;
}

export async function saveWebhookEvent(
  type: WebhookEventType,
  data: WebhookEventData,
  analysis: string,
) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Brakuje NEXT_PUBLIC_SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  const { data: saved, error } = await supabase
    .from("webhook_events")
    .insert({ type, data, analysis })
    .select("id, created_at")
    .single();

  if (error) {
    const missingTable = error.code === "42P01" || error.code === "PGRST205";
    throw new Error(
      missingTable
        ? "Tabela webhook_events nie istnieje. Zastosuj migrację 20260728_webhook_events.sql."
        : `Nie udało się zapisać zdarzenia: ${error.message}`,
    );
  }

  return saved;
}
