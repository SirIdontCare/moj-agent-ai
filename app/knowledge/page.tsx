"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import SiteNavigation from "../site-navigation";
import { authenticatedFetch } from "@/lib/supabase";

type KnowledgeDocument = {
  title: string;
  chunks: number;
  createdAt: string | null;
};

type KnowledgeFragment = {
  id: string;
  title: string;
  content: string;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
};

type SearchResult = {
  id: string;
  title: string;
  content: string;
  similarity: number;
  metadata: Record<string, unknown>;
  added_at: string | null;
};

function formatDate(value: string | null) {
  if (!value) {
    return "brak daty";
  }

  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "medium",
    timeZone: "Europe/Warsaw",
  }).format(new Date(value));
}

function getChunkIndex(metadata: Record<string, unknown> | null) {
  const index = Number(metadata?.chunk_index ?? 0);
  return Number.isFinite(index) ? index + 1 : 1;
}

export default function KnowledgePage() {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [selectedTitle, setSelectedTitle] = useState("");
  const [fragments, setFragments] = useState<KnowledgeFragment[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingFragments, setIsLoadingFragments] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState("");

  const loadFragments = useCallback(async (title: string) => {
    setSelectedTitle(title);
    setIsLoadingFragments(true);
    setError("");

    try {
      const response = await authenticatedFetch(
        `/api/knowledge-documents?title=${encodeURIComponent(title)}`,
        { cache: "no-store" },
      );
      const data = (await response.json()) as {
        fragments?: KnowledgeFragment[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Nie udało się pobrać fragmentów.");
      }

      setFragments(data.fragments ?? []);
    } catch (loadError) {
      setFragments([]);
      setError(loadError instanceof Error ? loadError.message : "Nie udało się pobrać fragmentów.");
    } finally {
      setIsLoadingFragments(false);
    }
  }, []);

  const loadDocuments = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const response = await authenticatedFetch("/api/knowledge-documents", { cache: "no-store" });
      const data = (await response.json()) as {
        documents?: KnowledgeDocument[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Nie udało się pobrać bazy wiedzy.");
      }

      const nextDocuments = data.documents ?? [];
      setDocuments(nextDocuments);

      const requestedTitle = new URLSearchParams(window.location.search).get("document") ?? "";
      const initialTitle = nextDocuments.some((document) => document.title === requestedTitle)
        ? requestedTitle
        : "";

      if (initialTitle) {
        await loadFragments(initialTitle);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Nie udało się pobrać bazy wiedzy.");
    } finally {
      setIsLoading(false);
    }
  }, [loadFragments]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const totalFragments = useMemo(
    () => documents.reduce((total, document) => total + document.chunks, 0),
    [documents],
  );

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const searchQuery = query.trim();

    if (searchQuery.length < 2) {
      setError("Wpisz co najmniej 2 znaki.");
      return;
    }

    setIsSearching(true);
    setHasSearched(true);
    setError("");

    try {
      const response = await authenticatedFetch("/api/knowledge-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery }),
      });
      const data = (await response.json()) as { results?: SearchResult[]; error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Nie udało się przeszukać bazy wiedzy.");
      }

      setResults(data.results ?? []);
    } catch (searchError) {
      setResults([]);
      setError(searchError instanceof Error ? searchError.message : "Nie udało się przeszukać bazy wiedzy.");
    } finally {
      setIsSearching(false);
    }
  }

  return (
    <main className="knowledge-shell">
      <SiteNavigation />
      <section className="knowledge-panel" aria-label="Podgląd bazy wiedzy">
        <header className="knowledge-hero">
          <div>
            <p>RAG · WERYFIKACJA ŹRÓDEŁ</p>
            <h1>🔎 Twoja baza wiedzy</h1>
            <span>
              {isLoading
                ? "Pobieram statystyki..."
                : `${totalFragments} fragmentów z ${documents.length} ${documents.length === 1 ? "dokumentu" : "dokumentów"}`}
            </span>
          </div>
          <Link href="/upload">📤 Dodaj dokument</Link>
        </header>

        {error ? <p className="knowledge-alert" role="alert">{error}</p> : null}

        <section className="knowledge-search-card" aria-labelledby="knowledge-search-heading">
          <div>
            <p>TEST WYSZUKIWANIA SEMANTYCZNEGO</p>
            <h2 id="knowledge-search-heading">Sprawdź, co znajdzie agent</h2>
          </div>
          <form onSubmit={handleSearch}>
            <input
              aria-label="Szukaj w bazie wiedzy"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Szukaj w bazie wiedzy... np. Co zawiera VIP?"
              value={query}
            />
            <button disabled={isSearching} type="submit">
              {isSearching ? "Szukam..." : "🔎 Szukaj"}
            </button>
          </form>

          {hasSearched ? (
            results.length ? (
              <div className="knowledge-search-results">
                {results.map((result, index) => (
                  <article key={result.id}>
                    <div className="knowledge-result-heading">
                      <div>
                        <span>#{index + 1}</span>
                        <strong>{result.title}</strong>
                      </div>
                      <b>{(result.similarity * 100).toFixed(1)}% podobieństwa</b>
                    </div>
                    <p>{result.content}</p>
                    <footer>
                      Dodano: {result.added_at ? formatDate(result.added_at) : "brak daty"}
                      {typeof result.metadata.chunk_index === "number"
                        ? ` · fragment ${Number(result.metadata.chunk_index) + 1}`
                        : ""}
                    </footer>
                  </article>
                ))}
              </div>
            ) : (
              <p className="knowledge-search-empty">Nie znaleziono pasujących fragmentów.</p>
            )
          ) : null}
        </section>

        <section className="knowledge-browser" aria-label="Dokumenty i fragmenty">
          <aside>
            <div className="knowledge-section-title">
              <p>DOKUMENTY</p>
              <h2>{documents.length}</h2>
            </div>
            {isLoading ? (
              <p className="knowledge-browser-empty">Pobieram dokumenty...</p>
            ) : documents.length ? (
              <div className="knowledge-document-buttons">
                {documents.map((document) => (
                  <button
                    className={selectedTitle === document.title ? "active" : ""}
                    key={document.title}
                    onClick={() => void loadFragments(document.title)}
                    type="button"
                  >
                    <span>📄</span>
                    <div>
                      <strong>{document.title}</strong>
                      <small>{document.chunks} {document.chunks === 1 ? "fragment" : "fragmentów"} · {formatDate(document.createdAt)}</small>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="knowledge-browser-empty">Baza jest pusta.</p>
            )}
          </aside>

          <div className="knowledge-fragment-panel">
            <div className="knowledge-section-title">
              <p>FRAGMENTY DOKUMENTU</p>
              <h2>{selectedTitle || "Wybierz dokument"}</h2>
            </div>
            {isLoadingFragments ? (
              <p className="knowledge-browser-empty">Pobieram fragmenty...</p>
            ) : fragments.length ? (
              <div className="knowledge-fragments">
                {fragments.map((fragment) => (
                  <article key={fragment.id}>
                    <header>
                      <strong>Fragment {getChunkIndex(fragment.metadata)}</strong>
                      <span>{fragment.content.length} znaków</span>
                    </header>
                    <p>{fragment.content}</p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="knowledge-browser-empty">
                {selectedTitle ? "Dokument nie zawiera fragmentów." : "Kliknij dokument po lewej, aby zobaczyć jego treść."}
              </p>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}
