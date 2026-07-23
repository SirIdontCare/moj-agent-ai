import { authenticateRequest, unauthorizedResponse } from "@/lib/supabase-server";

const MAX_TOPIC_LENGTH = 1_000;
const MAX_REPORT_LENGTH = 200_000;
const MAX_SOURCES = 50;

type ReportSource = {
  title: string;
  url: string;
};

function normalizeSources(value: unknown): ReportSource[] {
  if (!Array.isArray(value)) return [];

  const sources = new Map<string, ReportSource>();

  for (const item of value.slice(0, MAX_SOURCES)) {
    if (typeof item !== "object" || item === null) continue;

    const title =
      "title" in item && typeof item.title === "string"
        ? item.title.trim().slice(0, 500)
        : "";
    const url =
      "url" in item && typeof item.url === "string" ? item.url.trim() : "";

    if (!/^https?:\/\//i.test(url)) continue;

    try {
      const parsedUrl = new URL(url);

      sources.set(parsedUrl.href, {
        title: title || parsedUrl.hostname,
        url: parsedUrl.href,
      });
    } catch {
      continue;
    }
  }

  return [...sources.values()];
}

function getReportTitle(topic: string, content: string) {
  const heading = content.match(/^#\s+(?:📊\s*)?Raport:\s*(.+)$/im)?.[1]?.trim();
  return (heading || topic).slice(0, 300);
}

export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth) return unauthorizedResponse();

  let body: { topic?: unknown; content?: unknown; sources?: unknown };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Nieprawidłowy format JSON." }, { status: 400 });
  }

  const topic = typeof body.topic === "string" ? body.topic.trim() : "";
  const content = typeof body.content === "string" ? body.content.trim() : "";

  if (!topic) {
    return Response.json({ error: "Brakuje tematu raportu." }, { status: 400 });
  }

  if (!content) {
    return Response.json({ error: "Brakuje treści raportu." }, { status: 400 });
  }

  if (topic.length > MAX_TOPIC_LENGTH) {
    return Response.json(
      { error: `Temat może mieć maksymalnie ${MAX_TOPIC_LENGTH} znaków.` },
      { status: 400 },
    );
  }

  if (content.length > MAX_REPORT_LENGTH) {
    return Response.json(
      {
        error: `Raport może mieć maksymalnie ${MAX_REPORT_LENGTH.toLocaleString("pl-PL")} znaków.`,
      },
      { status: 400 },
    );
  }

  const sources = normalizeSources(body.sources);
  const wordCount = content.split(/\s+/).filter(Boolean).length;
  const { data, error } = await auth.supabase
    .from("reports")
    .insert({
      user_id: auth.user.id,
      topic,
      title: getReportTitle(topic, content),
      content,
      sources,
      word_count: wordCount,
    })
    .select("id, created_at")
    .single();

  if (error) {
    const missingTable = error.code === "42P01" || error.code === "PGRST205";

    return Response.json(
      {
        error: missingTable
          ? "Tabela raportów nie jest jeszcze dostępna. Zastosuj migrację Supabase 20260723_reports.sql."
          : "Nie udało się zapisać raportu w bazie.",
      },
      { status: 500 },
    );
  }

  return Response.json({
    report: {
      id: data.id,
      createdAt: data.created_at,
    },
  });
}
