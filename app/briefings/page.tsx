"use client";

import { useCallback, useEffect, useState } from "react";
import SiteNavigation from "../site-navigation";
import ReportMarkdown from "../report/report-markdown";
import { authenticatedFetch } from "@/lib/supabase";

type BriefingSummary = {
  id: string;
  date: string;
  created_at: string;
  preview: string;
};

type Briefing = {
  id: string;
  date: string;
  created_at: string;
  content: string;
};

function formatBriefingDate(value: string) {
  const date = new Date(value);
  const day = new Intl.DateTimeFormat("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
  const weekday = new Intl.DateTimeFormat("pl-PL", {
    weekday: "long",
    timeZone: "UTC",
  }).format(date);

  return `${day}, ${weekday}`;
}

function formatGeneratedAt(value: string) {
  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function BriefingsPage() {
  const [briefings, setBriefings] = useState<BriefingSummary[]>([]);
  const [selectedBriefing, setSelectedBriefing] = useState<Briefing | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [isListLoading, setIsListLoading] = useState(true);
  const [isBriefingLoading, setIsBriefingLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const [copyStatus, setCopyStatus] = useState("");

  const loadBriefing = useCallback(async (id: string) => {
    setSelectedId(id);
    setIsBriefingLoading(true);
    setError("");
    setCopyStatus("");

    try {
      const response = await authenticatedFetch(
        `/api/briefings?id=${encodeURIComponent(id)}`,
      );
      const data = (await response.json()) as {
        briefing?: Briefing;
        error?: string;
      };

      if (!response.ok || !data.briefing) {
        throw new Error(data.error ?? "Nie udało się otworzyć briefingu.");
      }

      setSelectedBriefing(data.briefing);
    } catch (loadError) {
      setSelectedBriefing(null);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Nie udało się otworzyć briefingu.",
      );
    } finally {
      setIsBriefingLoading(false);
    }
  }, []);

  const loadBriefings = useCallback(async () => {
    setIsListLoading(true);
    setError("");

    try {
      const response = await authenticatedFetch("/api/briefings");
      const data = (await response.json()) as {
        briefings?: BriefingSummary[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Nie udało się pobrać briefingów.");
      }

      const nextBriefings = data.briefings ?? [];

      setBriefings(nextBriefings);

      return nextBriefings;
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Nie udało się pobrać briefingów.",
      );

      return [];
    } finally {
      setIsListLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    void loadBriefings().then((nextBriefings) => {
      if (isMounted && nextBriefings[0]) {
        void loadBriefing(nextBriefings[0].id);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [loadBriefing, loadBriefings]);

  async function generateNow() {
    setIsGenerating(true);
    setError("");
    setCopyStatus("");

    try {
      const response = await authenticatedFetch("/api/briefings", { method: "POST" });
      const data = (await response.json()) as {
        briefing?: Briefing;
        error?: string;
      };

      if (!response.ok || !data.briefing) {
        throw new Error(data.error ?? "Nie udało się wygenerować briefingu.");
      }

      await loadBriefings();
      setSelectedBriefing(data.briefing);
      setSelectedId(data.briefing.id);
    } catch (generateError) {
      setError(
        generateError instanceof Error
          ? generateError.message
          : "Nie udało się wygenerować briefingu.",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  async function copyBriefing() {
    if (!selectedBriefing?.content) return;

    try {
      await navigator.clipboard.writeText(selectedBriefing.content);
      setCopyStatus("✓ Skopiowano");
      window.setTimeout(() => setCopyStatus(""), 1800);
    } catch {
      setCopyStatus("Nie udało się skopiować");
    }
  }

  return (
    <main className="saved-reports-shell">
      <SiteNavigation />
      <div className="saved-reports-panel">
        <header className="saved-reports-hero">
          <div>
            <p>AUTOMATYCZNE RAPORTY</p>
            <h1>📰 Briefingi</h1>
            <span>Automatyczne podsumowania dnia od Twojego agenta</span>
          </div>
          <button
            className="briefings-action"
            disabled={isGenerating}
            onClick={() => void generateNow()}
            type="button"
          >
            {isGenerating ? "Generuję…" : "🔄 Wygeneruj teraz"}
          </button>
        </header>

        {error ? (
          <p className="saved-reports-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="saved-reports-workspace">
          <aside className="saved-reports-list">
            <div className="saved-reports-list-heading">
              <strong>Twoje briefingi</strong>
              <span>{briefings.length}</span>
            </div>

            {isListLoading ? (
              <p className="saved-reports-list-status">Wczytuję briefingi…</p>
            ) : briefings.length === 0 ? (
              <div className="saved-reports-empty-list">
                <span>📭</span>
                <strong>Brak briefingów</strong>
                <p>Cron job wygeneruje pierwszy jutro rano!</p>
                <button
                  className="briefings-action"
                  disabled={isGenerating}
                  onClick={() => void generateNow()}
                  type="button"
                >
                  {isGenerating ? "Generuję…" : "🔄 Wygeneruj teraz"}
                </button>
              </div>
            ) : (
              <div className="saved-reports-items">
                {briefings.map((briefing) => (
                  <button
                    className={
                      briefing.id === selectedId
                        ? "saved-report-item briefing-item active"
                        : "saved-report-item briefing-item"
                    }
                    key={briefing.id}
                    onClick={() => void loadBriefing(briefing.id)}
                    type="button"
                  >
                    <strong>{formatBriefingDate(briefing.date)}</strong>
                    <p>{briefing.preview}</p>
                    <small>✅ wygenerowany automatycznie (z cron)</small>
                  </button>
                ))}
              </div>
            )}
          </aside>

          <section className="saved-report-preview">
            {isBriefingLoading ? (
              <div className="saved-report-loading">
                <span className="report-spinner" />
                <strong>Otwieram briefing…</strong>
              </div>
            ) : selectedBriefing ? (
              <>
                <header className="saved-report-toolbar">
                  <div>
                    <span>{formatBriefingDate(selectedBriefing.date)}</span>
                    <strong>
                      Wygenerowano {formatGeneratedAt(selectedBriefing.created_at)}
                    </strong>
                  </div>
                  <button onClick={() => void copyBriefing()} type="button">
                    {copyStatus || "📋 Kopiuj"}
                  </button>
                </header>
                <article className="saved-report-document">
                  <ReportMarkdown text={selectedBriefing.content} />
                </article>
              </>
            ) : (
              <div className="saved-report-placeholder">
                <span>📄</span>
                <strong>Wybierz briefing</strong>
                <p>Treść wybranego briefingu pojawi się w tym miejscu.</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
