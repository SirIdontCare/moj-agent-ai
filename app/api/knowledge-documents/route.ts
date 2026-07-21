import { NextResponse } from "next/server";
import { searchKnowledge } from "@/lib/knowledge";
import { supabase } from "@/lib/supabase";

type DocumentRow = {
  title: string | null;
  created_at: string | null;
};

type KnowledgeDocument = {
  title: string;
  chunks: number;
  createdAt: string | null;
};

type FragmentRow = {
  id: string;
  title: string;
  content: string;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
};

export async function GET(request: Request) {
  const title = new URL(request.url).searchParams.get("title")?.trim() ?? "";

  if (title) {
    const { data, error } = await supabase
      .from("documents")
      .select("id, title, content, metadata, created_at")
      .eq("title", title)
      .order("created_at", { ascending: true })
      .limit(500);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const fragments = ((data ?? []) as FragmentRow[]).sort((first, second) => {
      const firstIndex = Number(first.metadata?.chunk_index ?? 0);
      const secondIndex = Number(second.metadata?.chunk_index ?? 0);
      return firstIndex - secondIndex;
    });

    return NextResponse.json({ title, fragments });
  }

  const { data, error } = await supabase
    .from("documents")
    .select("title, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const grouped = new Map<string, KnowledgeDocument>();

  for (const row of (data ?? []) as DocumentRow[]) {
    const title = row.title?.trim();

    if (!title) {
      continue;
    }

    const existing = grouped.get(title);
    grouped.set(title, {
      title,
      chunks: (existing?.chunks ?? 0) + 1,
      createdAt:
        !existing?.createdAt || (row.created_at && row.created_at < existing.createdAt)
          ? row.created_at
          : existing.createdAt,
    });
  }

  return NextResponse.json({ documents: Array.from(grouped.values()) });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { query?: unknown } | null;
  const query = typeof body?.query === "string" ? body.query.trim() : "";

  if (query.length < 2) {
    return NextResponse.json(
      { error: "Wpisz co najmniej 2 znaki, aby przeszukać bazę wiedzy." },
      { status: 400 },
    );
  }

  try {
    const result = await searchKnowledge(query, { matchThreshold: 0, matchCount: 5 });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Nie udało się przeszukać bazy wiedzy.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const body = (await request.json().catch(() => null)) as { title?: unknown } | null;
  const title = typeof body?.title === "string" ? body.title.trim() : "";

  if (!title) {
    return NextResponse.json({ error: "Tytuł dokumentu jest wymagany." }, { status: 400 });
  }

  const { error } = await supabase.from("documents").delete().eq("title", title);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
