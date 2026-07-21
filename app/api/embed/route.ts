import { NextResponse } from "next/server";
import { generateEmbedding } from "@/lib/embeddings";

export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as { text?: unknown } | null;
    const text = typeof body?.text === "string" ? body.text.trim() : "";

    if (!text) {
      return NextResponse.json({ error: "Pole text jest wymagane." }, { status: 400 });
    }

    const embedding = await generateEmbedding(text);
    return NextResponse.json({ embedding });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nie udało się wygenerować embeddingu.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
