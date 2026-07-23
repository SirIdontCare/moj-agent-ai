"use client";

import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  type SourceUrlUIPart,
  type UIMessage,
} from "ai";
import {
  FormEvent,
  type ReactNode,
  useMemo,
  useRef,
  useState,
} from "react";
import SiteNavigation from "../site-navigation";
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

function renderInlineMarkdown(text: string): ReactNode[] {
  const pattern = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;

  return text.split(pattern).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }

    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);

    if (link) {
      const url = link[2].trim();

      if (/^https?:\/\//i.test(url)) {
        return (
          <a href={url} key={index} rel="noreferrer" target="_blank">
            {link[1]}
          </a>
        );
      }

      return link[1];
    }

    return part;
  });
}

function splitTableRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isTableSeparator(line: string) {
  const cells = splitTableRow(line);
  return (
    cells.length > 1 &&
    cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s/g, "")))
  );
}

function ReportMarkdown({ text }: { text: string }) {
  const lines = text.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (
      line.includes("|") &&
      lines[index + 1]?.includes("|") &&
      isTableSeparator(lines[index + 1])
    ) {
      const tableLines: string[] = [];

      while (index < lines.length && lines[index].includes("|")) {
        tableLines.push(lines[index]);
        index += 1;
      }

      const header = splitTableRow(tableLines[0]);
      const rows = tableLines.slice(2).map(splitTableRow);

      blocks.push(
        <div className="report-table-wrap" key={`table-${index}`}>
          <table>
            <thead>
              <tr>
                {header.map((cell, cellIndex) => (
                  <th key={cellIndex}>{renderInlineMarkdown(cell)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex}>{renderInlineMarkdown(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];

      while (index < lines.length && /^\d+\.\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\d+\.\s+/, ""));
        index += 1;
      }

      blocks.push(
        <ol key={`ol-${index}`}>
          {items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInlineMarkdown(item)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];

      while (index < lines.length && /^[-*]\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^[-*]\s+/, ""));
        index += 1;
      }

      blocks.push(
        <ul key={`ul-${index}`}>
          {items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInlineMarkdown(item)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    if (line.startsWith("### ")) {
      blocks.push(
        <h3 key={`h3-${index}`}>{renderInlineMarkdown(line.slice(4))}</h3>,
      );
      index += 1;
      continue;
    }

    if (line.startsWith("## ")) {
      blocks.push(
        <h2 key={`h2-${index}`}>{renderInlineMarkdown(line.slice(3))}</h2>,
      );
      index += 1;
      continue;
    }

    if (line.startsWith("# ")) {
      blocks.push(
        <h1 key={`h1-${index}`}>{renderInlineMarkdown(line.slice(2))}</h1>,
      );
      index += 1;
      continue;
    }

    if (line.startsWith("> ")) {
      blocks.push(
        <blockquote key={`quote-${index}`}>
          {renderInlineMarkdown(line.slice(2))}
        </blockquote>,
      );
      index += 1;
      continue;
    }

    blocks.push(<p key={`p-${index}`}>{renderInlineMarkdown(line)}</p>);
    index += 1;
  }

  return <div className="report-markdown">{blocks}</div>;
}

export default function ReportPage() {
  const [topic, setTopic] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
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
  const wordCount = report.trim() ? report.trim().split(/\s+/).length : 0;

  async function generateReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedTopic = topic.trim();

    if (!trimmedTopic || isGenerating) return;

    setCopyStatus("");
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
                <button onClick={() => void copyReport()} type="button">
                  {copyStatus || "📋 Kopiuj do schowka"}
                </button>
              ) : null}
            </header>

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
