"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import SiteNavigation from "../site-navigation";
import ReportMarkdown from "../report/report-markdown";
import { authenticatedFetch } from "@/lib/supabase";

type ReportSummary = {
  id: string;
  topic: string;
  title: string;
  word_count: number;
  created_at: string;
  updated_at: string;
};

type ReportSource = {
  title: string;
  url: string;
};

type SavedReport = ReportSummary & {
  content: string;
  sources: ReportSource[];
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function SavedReportsPage() {
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [selectedReport, setSelectedReport] = useState<SavedReport | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [isListLoading, setIsListLoading] = useState(true);
  const [isReportLoading, setIsReportLoading] = useState(false);
  const [error, setError] = useState("");
  const [copyStatus, setCopyStatus] = useState("");

  const loadReport = useCallback(async (id: string) => {
    setSelectedId(id);
    setIsReportLoading(true);
    setError("");
    setCopyStatus("");

    try {
      const response = await authenticatedFetch(`/api/reports?id=${encodeURIComponent(id)}`);
      const data = (await response.json()) as {
        report?: SavedReport;
        error?: string;
      };

      if (!response.ok || !data.report) {
        throw new Error(data.error ?? "Nie udało się otworzyć raportu.");
      }

      setSelectedReport({
        ...data.report,
        sources: Array.isArray(data.report.sources) ? data.report.sources : [],
      });
    } catch (loadError) {
      setSelectedReport(null);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Nie udało się otworzyć raportu.",
      );
    } finally {
      setIsReportLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadReports() {
      setIsListLoading(true);
      setError("");

      try {
        const response = await authenticatedFetch("/api/reports");
        const data = (await response.json()) as {
          reports?: ReportSummary[];
          error?: string;
        };

        if (!response.ok) {
          throw new Error(data.error ?? "Nie udało się pobrać raportów.");
        }

        const nextReports = data.reports ?? [];
        if (!isMounted) return;

        setReports(nextReports);

        if (nextReports[0]) {
          await loadReport(nextReports[0].id);
        }
      } catch (loadError) {
        if (!isMounted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Nie udało się pobrać raportów.",
        );
      } finally {
        if (isMounted) setIsListLoading(false);
      }
    }

    void loadReports();

    return () => {
      isMounted = false;
    };
  }, [loadReport]);

  const selectedSummary = useMemo(
    () => reports.find((report) => report.id === selectedId),
    [reports, selectedId],
  );

  async function copyReport() {
    if (!selectedReport?.content) return;

    try {
      await navigator.clipboard.writeText(selectedReport.content);
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
            <p>PRYWATNA BIBLIOTEKA</p>
            <h1>🗂️ Zapisane raporty</h1>
            <span>Przeglądaj raporty zapisane na Twoim koncie</span>
          </div>
          <Link href="/report">＋ Wygeneruj nowy raport</Link>
        </header>

        {error ? (
          <p className="saved-reports-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="saved-reports-workspace">
          <aside className="saved-reports-list">
            <div className="saved-reports-list-heading">
              <strong>Twoje raporty</strong>
              <span>{reports.length}</span>
            </div>

            {isListLoading ? (
              <p className="saved-reports-list-status">Wczytuję raporty…</p>
            ) : reports.length === 0 ? (
              <div className="saved-reports-empty-list">
                <span>📭</span>
                <strong>Brak zapisanych raportów</strong>
                <p>Wygeneruj raport i użyj przycisku „Zapisz w bazie”.</p>
                <Link href="/report">Przejdź do generatora</Link>
              </div>
            ) : (
              <div className="saved-reports-items">
                {reports.map((report) => (
                  <button
                    className={report.id === selectedId ? "saved-report-item active" : "saved-report-item"}
                    key={report.id}
                    onClick={() => void loadReport(report.id)}
                    type="button"
                  >
                    <strong>{report.title}</strong>
                    <span>{formatDate(report.created_at)}</span>
                    <small>{report.word_count.toLocaleString("pl-PL")} słów</small>
                  </button>
                ))}
              </div>
            )}
          </aside>

          <section className="saved-report-preview">
            {isReportLoading ? (
              <div className="saved-report-loading">
                <span className="report-spinner" />
                <strong>Otwieram raport…</strong>
              </div>
            ) : selectedReport ? (
              <>
                <header className="saved-report-toolbar">
                  <div>
                    <span>ZAPISANO {formatDate(selectedReport.created_at)}</span>
                    <strong>
                      {(selectedSummary?.word_count ?? selectedReport.word_count).toLocaleString("pl-PL")} słów
                    </strong>
                  </div>
                  <button onClick={() => void copyReport()} type="button">
                    {copyStatus || "📋 Kopiuj raport"}
                  </button>
                </header>
                <article className="saved-report-document">
                  <ReportMarkdown text={selectedReport.content} />
                  {selectedReport.sources.length > 0 ? (
                    <aside className="report-grounding-sources">
                      <h2>Zapisane źródła</h2>
                      <div>
                        {selectedReport.sources.map((source, index) => (
                          <a
                            href={source.url}
                            key={source.url}
                            rel="noreferrer"
                            target="_blank"
                          >
                            <span>{index + 1}</span>
                            {source.title}
                          </a>
                        ))}
                      </div>
                    </aside>
                  ) : null}
                </article>
              </>
            ) : (
              <div className="saved-report-placeholder">
                <span>📄</span>
                <strong>Wybierz raport</strong>
                <p>Treść wybranego raportu pojawi się w tym miejscu.</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
