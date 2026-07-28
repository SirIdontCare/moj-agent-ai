import {
  generateMorningBriefing,
  saveMorningBriefing,
} from "@/lib/morning-briefing";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();

  if (!cronSecret) {
    return process.env.NODE_ENV !== "production";
  }

  return request.headers.get("authorization") === `Bearer ${cronSecret}`;
}

function getPreview(content: string) {
  return content.replace(/^#+\s*/gm, "").replace(/\s+/g, " ").trim().slice(0, 240);
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json(
      {
        success: false,
        error: "Brak dostępu. Ustaw nagłówek Authorization: Bearer <CRON_SECRET>.",
      },
      { status: 401 },
    );
  }

  try {
    const { content, date } = await generateMorningBriefing();
    const saved = await saveMorningBriefing(date, content);

    return Response.json({
      success: true,
      date,
      preview: getPreview(content),
      briefingId: saved.id,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Nieznany błąd endpointu.";

    console.error("[api/cron/morning]", message);

    return Response.json(
      {
        success: false,
        error:
          process.env.NODE_ENV === "development"
            ? message
            : "Nie udało się przygotować porannego briefingu.",
      },
      { status: 500 },
    );
  }
}
