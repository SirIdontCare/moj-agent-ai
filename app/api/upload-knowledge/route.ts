import { splitIntoChunks } from "@/lib/chunking";
import { generateEmbedding } from "@/lib/embeddings";
import { supabase } from "@/lib/supabase";

export const maxDuration = 300;

type UploadBody = {
  title?: unknown;
  content?: unknown;
};

function event(type: string, data: Record<string, unknown>) {
  return `data: ${JSON.stringify({ type, ...data })}\n\n`;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as UploadBody | null;
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const content = typeof body?.content === "string" ? body.content.trim() : "";

  if (!title || !content) {
    return Response.json(
      { error: "Uzupełnij tytuł i treść dokumentu." },
      { status: 400 },
    );
  }

  if (title.length > 200) {
    return Response.json({ error: "Tytuł może mieć maksymalnie 200 znaków." }, { status: 400 });
  }

  if (content.length > 100_000) {
    return Response.json(
      { error: "Treść dokumentu może mieć maksymalnie 100 000 znaków." },
      { status: 400 },
    );
  }

  const chunks = splitIntoChunks(content);

  if (!chunks.length) {
    return Response.json({ error: "Treść dokumentu nie zawiera tekstu do zapisania." }, { status: 400 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (type: string, data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(event(type, data)));
      };

      try {
        send("started", { total: chunks.length });
        const addedAt = new Date().toISOString();

        for (const [index, chunk] of chunks.entries()) {
          send("progress", { current: index + 1, total: chunks.length });
          const embedding = await generateEmbedding(chunk);
          const { error } = await supabase.from("documents").insert({
            title,
            content: chunk,
            embedding,
            created_at: addedAt,
            metadata: {
              source: title,
              chunk_index: index,
              total_chunks: chunks.length,
              added_at: addedAt.slice(0, 10),
            },
          });

          if (error) {
            throw new Error(`Nie udało się zapisać fragmentu ${index + 1}: ${error.message}`);
          }
        }

        send("complete", { success: true, chunks_saved: chunks.length });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Nie udało się zapisać dokumentu.";
        send("error", { message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
    },
  });
}
