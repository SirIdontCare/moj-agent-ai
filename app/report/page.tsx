"use client";

import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  type SourceUrlUIPart,
  type UIMessage,
} from "ai";
import {
  FormEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import SiteNavigation from "../site-navigation";
import ReportMarkdown from "./report-markdown";
import { getAuthHeaders } from "@/lib/supabase";

const examples = [
  "Rynek AI w Polsce — trendy, firmy, prognozy na 2026",
  "Porównanie platform e-commerce: Shopify vs WooCommerce vs PrestaShop",
  "Wpływ pracy zdalnej na produktywność — badania i statystyki",
  "Rynek nieruchomości w Krakowie — ceny, trendy, prognozy",
];

function getMessageText(message: UIMessage) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}

function getMessageSources(message: UIMessage) {
  const sources = message.parts.filter(
    (part): part is SourceUrlUIPart => part.type === "source-url",
  );
  const uniqueSources = new Map<string, SourceUrlUIPart>();

  for (const source of sources) {
    uniqueSources.set(source.url, source);
  }

  return [...uniqueSources.values()];
}

export default function ReportPage() {
  const [topic, setTopic] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [saveError, setSaveError] = useState("");
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/report",
        headers: async () => getAuthHeaders(),
      }),
    [],
  );
  const { messages, sendMessage, setMessages, status, error } = useChat({
    transport,
  });
  const isGenerating = status === "submitted" || status === "streaming";
  const reportMessage = useMemo(
    () => [...messages].reverse().find((message) => message.role === "assistant"),
    [messages],
  );
  const report = reportMessage ? getMessageText(reportMessage) : "";
  const sources = reportMessage ? getMessageSources(reportMessage) : [];
  const reportTopic =
    [...messages]
      .reverse()
      .find((message) => message.role === "user")
      ?.parts.filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("")
      .trim() ?? topic.trim();
  const wordCount = report.trim() ? report.trim().split(/\s+/).length : 0;

  async function generateReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedTopic = topic.trim();

    if (!trimmedTopic || isGenerating) return;

    setCopyStatus("");
    setSaveStatus("idle");
    setSaveError("");
    setMessages([]);
    await sendMessage({ text: trimmedTopic });
  }

  async function copyReport() {
    if (!report) return;

    try {
      await navigator.clipboard.writeText(report);
      setCopyStatus("✓ Skopiowano");

      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopyStatus(""), 1800);
    } catch {
      setCopyStatus("Nie udało się skopiować");
    }
  }

  async function saveReport() {
    if (!report || !reportTopic || isGenerating || saveStatus === "saving") return;

    setSaveStatus("saving");
    setSaveError("");

    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: {
          ...authHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topic: reportTopic,
          content: report,
          sources: sources.map((source) => ({
            title: source.title,
            url: source.url,
          })),
        }),
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(data?.error ?? "Nie udało się zapisać raportu.");
      }

      setSaveStatus("saved");
    } catch (saveReportError) {
      setSaveStatus("error");
      setSaveError(
        saveReportError instanceof Error
          ? saveReportError.message
          : "Nie udało się zapisać raportu.",
      );
    }
  }

  return (
    <main className="report-shell">
      <SiteNavigation />
      <div className="report-panel">
        <header className="report-hero">
          <div>
            <p className="report-eyebrow">AUTONOMICZNY RESEARCH</p>
            <h1>📊 Generator raportów</h1>
            <p>Opisz temat — agent napisze raport biznesowy</p>
          </div>
          <div className="report-hero-badge" aria-hidden="true">
            <span>AI</span>
            <small>ANALYST</small>
          </div>
        </header>

        <section className="report-composer">
          <form onSubmit={generateReport}>
            <label htmlFor="report-topic">O czym ma być raport?</label>
            <div className="report-input-row">
              <input
                disabled={isGenerating}
                id="report-topic"
                maxLength={1000}
                onChange={(event) => setTopic(event.target.value)}
                placeholder="Np. Rynek AI w Polsce w 2026 roku..."
                value={topic}
              />
              <button disabled={!topic.trim() || isGenerating} type="submit">
                {isGenerating ? (
                  <>
                    <span className="report-spinner" aria-hidden="true" />
                    Tworzę raport…
                  </>
                ) : (
                  "📊 Generuj raport"
                )}
              </button>
            </div>
          </form>

          <div className="report-examples">
            <span>Przykładowe tematy</span>
            <div>
              {examples.map((example) => (
                <button
                  disabled={isGenerating}
                  key={example}
                  onClick={() => setTopic(example)}
                  type="button"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>

          <div className="report-tool-strip">
            <span>🌐 Google Search <small>gdy włączony</small></span>
            <span>📚 Wikipedia</span>
            <span>📄 Strony WWW</span>
            <span>🧮 Kalkulator</span>
          </div>
        </section>

        {error ? (
          <p className="report-error" role="alert">
            {error.message || "Nie udało się wygenerować raportu."}
          </p>
        ) : null}

        {(isGenerating || report) && (
          <section className="report-result" aria-live="polite">
            <header className="report-result-toolbar">
              <div>
                <span>{isGenerating ? "AGENT PRACUJE" : "RAPORT GOTOWY"}</span>
                <strong>
                  {isGenerating
                    ? "Zbieram dane i przygotowuję analizę…"
                    : `${wordCount.toLocaleString("pl-PL")} słów`}
                </strong>
              </div>
              {report && !isGenerating ? (
                <div className="report-result-actions">
                  <button onClick={() => void copyReport()} type="button">
                    {copyStatus || "📋 Kopiuj do schowka"}
                  </button>
                  <button
                    className="report-save-button"
                    disabled={saveStatus === "saving" || saveStatus === "saved"}
                    onClick={() => void saveReport()}
                    type="button"
                  >
                    {saveStatus === "saving"
                      ? "Zapisywanie…"
                      : saveStatus === "saved"
                        ? "✓ Zapisano w bazie"
                        : "💾 Zapisz w bazie"}
                  </button>
                </div>
              ) : null}
            </header>

            {saveError ? (
              <p className="report-save-error" role="alert">
                {saveError}
              </p>
            ) : null}

            {report ? (
              <article className="report-document">
                <ReportMarkdown text={report} />
                {sources.length > 0 ? (
                  <aside className="report-grounding-sources">
                    <h2>Źródła z Google Search</h2>
                    <div>
                      {sources.map((source, index) => (
                        <a
                          href={source.url}
                          key={source.url}
                          rel="noreferrer"
                          target="_blank"
                        >
                          <span>{index + 1}</span>
                          {source.title || new URL(source.url).hostname}
                        </a>
                      ))}
                    </div>
                  </aside>
                ) : null}
              </article>
            ) : (
              <div className="report-loading-state">
                <span className="report-radar" aria-hidden="true" />
                <strong>Rozpoczynam research</strong>
                <p>Agent wybiera źródła, analizuje dane i układa strukturę raportu.</p>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
