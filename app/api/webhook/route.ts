import {
  WEBHOOK_EVENT_TYPES,
  analyzeWebhookEvent,
  saveWebhookEvent,
  validateWebhookPayload,
} from "@/lib/webhook-events";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

function isAuthorized(request: Request) {
  if (process.env.NODE_ENV !== "production") {
    return true;
  }

  const webhookSecret = process.env.WEBHOOK_SECRET?.trim();

  if (!webhookSecret) {
    return false;
  }

  return request.headers.get("authorization") === `Bearer ${webhookSecret}`;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json(
      {
        success: false,
        error: "Brak dostępu. Ustaw nagłówek Authorization: Bearer <WEBHOOK_SECRET>.",
      },
      { status: 401 },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json(
      { success: false, error: "Nieprawidłowy format JSON." },
      { status: 400 },
    );
  }

  const payload = validateWebhookPayload(body);

  if ("error" in payload) {
    return Response.json(
      { success: false, error: payload.error },
      { status: 400 },
    );
  }

  try {
    const analysis = await analyzeWebhookEvent(payload.type, payload.data);
    const saved = await saveWebhookEvent(payload.type, payload.data, analysis);

    return Response.json({
      success: true,
      type: payload.type,
      analysis,
      event_id: saved.id,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Nieznany błąd endpointu.";

    console.error("[api/webhook]", message);

    return Response.json(
      {
        success: false,
        error:
          process.env.NODE_ENV === "development"
            ? message
            : "Nie udało się przetworzyć zdarzenia.",
      },
      { status: 500 },
    );
  }
}

export function GET() {
  return Response.json(
    {
      success: false,
      error: "Ten endpoint przyjmuje wyłącznie POST z JSON { type, data }.",
      supportedTypes: WEBHOOK_EVENT_TYPES,
    },
    { status: 405 },
  );
}
