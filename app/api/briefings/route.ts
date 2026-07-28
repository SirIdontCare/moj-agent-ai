import {
  generateMorningBriefing,
  getBriefing,
  getBriefingPreview,
  listBriefings,
  saveMorningBriefing,
} from "@/lib/morning-briefing";
import { authenticateRequest, unauthorizedResponse } from "@/lib/supabase-server";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const BRIEFINGS_LIMIT = 30;

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function errorResponse(error: unknown, fallback: string, status = 500) {
  const message = error instanceof Error ? error.message : fallback;

  console.error("[api/briefings]", message);

  return Response.json({ error: message }, { status });
}

export async function GET(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth) return unauthorizedResponse();

  const briefingId = new URL(request.url).searchParams.get("id")?.trim();

  if (briefingId) {
    if (!isUuid(briefingId)) {
      return Response.json(
        { error: "Nieprawidłowy identyfikator briefingu." },
        { status: 400 },
      );
    }

    try {
      const briefing = await getBriefing(briefingId);

      if (!briefing) {
        return Response.json({ error: "Nie znaleziono briefingu." }, { status: 404 });
      }

      return Response.json({ briefing });
    } catch (error) {
      return errorResponse(error, "Nie udało się otworzyć briefingu.");
    }
  }

  try {
    return Response.json({ briefings: await listBriefings(BRIEFINGS_LIMIT) });
  } catch (error) {
    return errorResponse(error, "Nie udało się pobrać briefingów.");
  }
}

// Ręczny odpowiednik cron joba — ten sam kod generujący, ale autoryzowany sesją
// zalogowanego użytkownika zamiast sekretem CRON_SECRET, którego przeglądarka nie ma.
export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth) return unauthorizedResponse();

  try {
    const { content, date } = await generateMorningBriefing();
    const saved = await saveMorningBriefing(date, content);

    return Response.json({
      briefing: {
        id: saved.id,
        date,
        created_at: saved.created_at,
        preview: getBriefingPreview(content),
        content,
      },
    });
  } catch (error) {
    return errorResponse(error, "Nie udało się wygenerować briefingu.");
  }
}
