"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import SiteNavigation from "../site-navigation";

type KnowledgeDocument = {
  title: string;
  chunks: number;
  createdAt: string | null;
};

type UploadProgress = {
  current: number;
  total: number;
};

const examples = [
  {
    label: "Cennik",
    title: "Cennik 2026",
    content:
      "Pakiet Basic: 99 zł/miesiąc\n- 5 użytkowników\n- 10 GB miejsca\n- Wsparcie email\n\nPakiet Premium: 299 zł/miesiąc\n- 25 użytkowników\n- 100 GB miejsca\n- Wsparcie email + telefon\n- Priorytetowa obsługa\n\nPakiet VIP: 599 zł/miesiąc\n- Nielimitowani użytkownicy\n- 1 TB miejsca\n- Wsparcie 24/7\n- Dedykowany opiekun\n\nWszystkie pakiety z 14-dniowym okresem próbnym.",
  },
  {
    label: "FAQ",
    title: "FAQ subskrypcji",
    content:
      "Q: Jak mogę anulować subskrypcję?\nA: Wyślij email na pomoc@firma.pl. Potwierdzimy rezygnację w ciągu 2 dni roboczych.\n\nQ: Czy mogę zmienić pakiet?\nA: Tak, pakiet zmienisz w dowolnym momencie w panelu klienta.",
  },
  {
    label: "Regulamin",
    title: "Regulamin firmy",
    content:
      "§1. Postanowienia ogólne. Niniejszy regulamin określa zasady korzystania z usług firmy.\n\n§2. Usługi są świadczone po zaakceptowaniu warunków przez klienta.",
  },
];

function formatDate(value: string | null) {
  if (!value) {
    return "brak daty";
  }

  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Warsaw",
  }).format(new Date(value));
}

async function readEventStream(
  response: Response,
  onEvent: (event: Record<string, unknown>) => void,
) {
  if (!response.body) {
    throw new Error("Serwer nie zwrócił informacji o postępie.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const messages = buffer.split("\n\n");
    buffer = messages.pop() ?? "";

    for (const message of messages) {
      const line = message.split("\n").find((item) => item.startsWith("data: "));

      if (!line) {
        continue;
      }

      onEvent(JSON.parse(line.slice(6)) as Record<string, unknown>);
    }

    if (done) {
      break;
    }
  }
}

export default function UploadPage() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingTitle, setDeletingTitle] = useState<string | null>(null);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const loadDocuments = useCallback(async () => {
    setIsLoadingDocuments(true);

    try {
      const response = await fetch("/api/knowledge-documents", { cache: "no-store" });
      const data = (await response.json()) as { documents?: KnowledgeDocument[]; error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Nie udało się pobrać dokumentów.");
      }

      setDocuments(data.documents ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Nie udało się pobrać dokumentów.");
    } finally {
      setIsLoadingDocuments(false);
    }
  }, []);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!title.trim() || !content.trim()) {
      setError("Uzupełnij tytuł i treść dokumentu.");
      return;
    }

    setIsSaving(true);
    setProgress(null);

    try {
      const response = await fetch("/api/upload-knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Nie udało się rozpocząć zapisu dokumentu.");
      }

      let savedChunks = 0;
      let streamError = "";

      await readEventStream(response, (streamEvent) => {
        const eventType = streamEvent.type;

        if (eventType === "started") {
          const total = Number(streamEvent.total);
          setProgress({ current: 0, total });
        }

        if (eventType === "progress") {
          setProgress({ current: Number(streamEvent.current), total: Number(streamEvent.total) });
        }

        if (eventType === "complete") {
          savedChunks = Number(streamEvent.chunks_saved);
        }

        if (eventType === "error") {
          streamError = typeof streamEvent.message === "string" ? streamEvent.message : "Nie udało się zapisać dokumentu.";
        }
      });

      if (streamError) {
        throw new Error(streamError);
      }

      if (!savedChunks) {
        throw new Error("Zapis dokumentu nie został potwierdzony przez serwer.");
      }

      setTitle("");
      setContent("");
      setNotice(`✅ Zapisano ${savedChunks} ${savedChunks === 1 ? "fragment" : "fragmentów"}!`);
      await loadDocuments();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Nie udało się zapisać dokumentu.");
    } finally {
      setIsSaving(false);
      setProgress(null);
    }
  }

  async function deleteDocument(documentTitle: string) {
    if (!window.confirm(`Usunąć wszystkie fragmenty dokumentu „${documentTitle}”?`)) {
      return;
    }

    setDeletingTitle(documentTitle);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/knowledge-documents", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: documentTitle }),
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Nie udało się usunąć dokumentu.");
      }

      setNotice(`Usunięto dokument „${documentTitle}”.`);
      await loadDocuments();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Nie udało się usunąć dokumentu.");
    } finally {
      setDeletingTitle(null);
    }
  }

  const progressPercent = progress?.total ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <main className="upload-shell">
      <SiteNavigation />
      <section className="upload-panel" aria-label="Baza wiedzy">
        <header className="upload-header">
          <p>RAG · INGESTIA DOKUMENTÓW</p>
          <h1>📚 Baza wiedzy</h1>
          <span>Wklej tekst — agent będzie z niego korzystał.</span>
        </header>

        <form className="upload-form" onSubmit={handleSubmit}>
          <label htmlFor="document-title">
            Tytuł dokumentu
            <input
              id="document-title"
              maxLength={200}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Np. Cennik 2026, FAQ, Regulamin firmy"
              value={title}
            />
          </label>

          <label htmlFor="document-content">
            Treść dokumentu
            <textarea
              id="document-content"
              maxLength={100000}
              onChange={(event) => setContent(event.target.value)}
              placeholder="Wklej tutaj treść dokumentu..."
              value={content}
            />
          </label>

          <div className="upload-examples" aria-label="Przykładowe dokumenty">
            <span>Wstaw przykład:</span>
            {examples.map((example) => (
              <button
                key={example.label}
                onClick={() => {
                  setTitle(example.title);
                  setContent(example.content);
                }}
                type="button"
              >
                {example.label}
              </button>
            ))}
          </div>

          {progress ? (
            <div aria-live="polite" className="upload-progress">
              <div>
                <span>Przetwarzam fragment {progress.current} z {progress.total}...</span>
                <strong>{progressPercent}%</strong>
              </div>
              <i>
                <b style={{ width: `${progressPercent}%` }} />
              </i>
            </div>
          ) : null}

          {error ? <p className="upload-message upload-message-error" role="alert">{error}</p> : null}
          {notice ? <p className="upload-message upload-message-success" role="status">{notice}</p> : null}

          <button className="upload-submit" disabled={isSaving} type="submit">
            {isSaving ? "⏳ Zapisuję fragmenty..." : "📤 Zapisz w bazie wiedzy"}
          </button>
        </form>

        <section className="knowledge-list" aria-labelledby="saved-documents-heading">
          <div className="knowledge-list-heading">
            <div>
              <p>TWÓJ KONTEKST DLA AGENTA</p>
              <h2 id="saved-documents-heading">Zapisane dokumenty</h2>
            </div>
            <button disabled={isLoadingDocuments} onClick={() => void loadDocuments()} type="button">
              🔄 Odśwież
            </button>
          </div>

          {isLoadingDocuments ? (
            <p className="knowledge-empty">Pobieram dokumenty...</p>
          ) : documents.length ? (
            <div className="knowledge-document-list">
              {documents.map((document) => (
                <article className="knowledge-document" key={document.title}>
                  <div>
                    <strong>📄 {document.title}</strong>
                    <span>{document.chunks} {document.chunks === 1 ? "fragment" : "fragmentów"} · dodano {formatDate(document.createdAt)}</span>
                  </div>
                  <button
                    disabled={deletingTitle === document.title}
                    onClick={() => void deleteDocument(document.title)}
                    type="button"
                  >
                    {deletingTitle === document.title ? "Usuwanie..." : "🗑️ Usuń"}
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <p className="knowledge-empty">Nie ma jeszcze zapisanych dokumentów. Dodaj pierwszy tekst powyżej.</p>
          )}
        </section>
      </section>
    </main>
  );
}
