"use client";

import { FormEvent, useMemo, useState } from "react";
import SiteNavigation from "../site-navigation";
import { getAuthHeaders } from "@/lib/supabase";

const exampleEmails = `Mail 1 - PILNY:
Od: jan.kowalski@firma.pl
Temat: PILNE - Problem z fakturą
Treść: Dzień dobry, mam problem z fakturą FV/2026/001. Kwota jest nieprawidłowa — powinno być 5000 zł a jest 3000 zł. Proszę o PILNĄ korektę. Termin płatności mija jutro.

Mail 2 - SPAM:
Od: winner@lucky-prize.com
Temat: Congratulations! You won $1,000,000
Treść: Click here to claim your prize! Limited time offer. Act now!

Mail 3 - OFERTA:
Od: anna.nowak@partner.pl
Temat: Propozycja współpracy
Treść: Dzień dobry, reprezentuję firmę ABC Solutions. Chcielibyśmy omówić możliwość współpracy w zakresie dostarczania usług IT. Czy możemy umówić się na spotkanie w przyszłym tygodniu?

Mail 4 - REKLAMACJA:
Od: klient123@gmail.com
Temat: Nie działa usługa od 3 dni
Treść: Witam, od poniedziałku nie mogę się zalogować do panelu klienta. Próbowałem resetować hasło ale nie dostaje maila. To już trzeci dzień! Jeśli nie rozwiążecie tego dziś, zrezygnuję z usługi.

Mail 5 - INFO:
Od: newsletter@branżowy-portal.pl
Temat: Nowe trendy AI w biznesie - raport 2026
Treść: Zapraszamy do lektury naszego najnowszego raportu o zastosowaniach AI w polskich firmach. Pobierz za darmo na naszej stronie.`;

type Priority = "high" | "medium" | "low";

type EmailCard = {
  number: number;
  subject: string;
  category: string;
  priority: string;
  priorityKind: Priority;
  reason: string;
  draft: string;
  isSpam: boolean;
};

type Summary = {
  high: number;
  medium: number;
  low: number;
  spam: number;
  recommendation: string;
};

function splitEmails(value: string) {
  return value
    .split(/\r?\n\s*\r?\n+/)
    .map((email) => email.trim())
    .filter(Boolean);
}

function readTableValue(section: string, field: string) {
  const escapedField = field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (
    section.match(new RegExp(`^\\|\\s*${escapedField}\\s*\\|\\s*(.*?)\\s*\\|\\s*$`, "im"))?.[1]?.trim() ??
    ""
  );
}

function getPriorityKind(priority: string): Priority {
  const normalized = priority.toLocaleLowerCase("pl-PL");

  if (normalized.includes("wysoki") || priority.includes("🔴")) return "high";
  if (normalized.includes("średni") || normalized.includes("sredni") || priority.includes("🟡")) {
    return "medium";
  }

  return "low";
}

function parseCards(text: string) {
  const headingPattern = /^###\s+Mail\s+(\d+):\s*(.+)$/gim;
  const headings = [...text.matchAll(headingPattern)];

  return headings.map((heading, index): EmailCard => {
    const start = (heading.index ?? 0) + heading[0].length;
    const end = headings[index + 1]?.index ?? text.indexOf("## PODSUMOWANIE", start);
    const section = text.slice(start, end >= 0 ? end : text.length);
    const category = readTableValue(section, "Kategoria");
    const priority = readTableValue(section, "Priorytet");
    const draftSection =
      section.match(/\*\*Proponowana odpowiedź:\*\*\s*([\s\S]*?)(?=\n---|\n##\s|$)/i)?.[1] ?? "";
    const draft = draftSection
      .split(/\r?\n/)
      .map((line) => line.replace(/^\s*>\s?/, "").trim())
      .filter(Boolean)
      .join(" ");

    return {
      number: Number(heading[1]),
      subject: heading[2].trim(),
      category: category || "Analizowanie…",
      priority: priority || "Ustalanie priorytetu…",
      priorityKind: getPriorityKind(priority),
      reason: readTableValue(section, "Uzasadnienie") || "Analizowanie uzasadnienia…",
      draft,
      isSpam: category.toLocaleLowerCase("pl-PL").includes("spam"),
    };
  });
}

function readSummaryCount(text: string, label: RegExp) {
  const summaryText = text.split(/^##\s+PODSUMOWANIE\s*$/im)[1] ?? "";
  const match = summaryText.match(label);
  return match ? Number(match[1]) : undefined;
}

function parseSummary(text: string, cards: EmailCard[]): Summary {
  const derived = cards.reduce(
    (counts, card) => {
      if (card.isSpam) counts.spam += 1;
      else counts[card.priorityKind] += 1;
      return counts;
    },
    { high: 0, medium: 0, low: 0, spam: 0 },
  );
  const recommendation =
    text
      .split(/^##\s+PODSUMOWANIE\s*$/im)[1]
      ?.match(/^\s*-\s*✅\s*Rekomendacja:\s*(.+)$/im)?.[1]
      ?.trim() ?? "";

  return {
    high: readSummaryCount(text, /^\s*-\s*🔴\s*Pilne:\s*(\d+)/im) ?? derived.high,
    medium: readSummaryCount(text, /^\s*-\s*🟡\s*Średnie:\s*(\d+)/im) ?? derived.medium,
    low: readSummaryCount(text, /^\s*-\s*🟢\s*Niskie:\s*(\d+)/im) ?? derived.low,
    spam: readSummaryCount(text, /^\s*-\s*🗑️\s*Spam:\s*(\d+)/im) ?? derived.spam,
    recommendation,
  };
}

function priorityLabel(kind: Priority) {
  if (kind === "high") return "Pilny";
  if (kind === "medium") return "Średni";
  return "Niski";
}

export default function EmailTriagePage() {
  const [input, setInput] = useState("");
  const [streamedText, setStreamedText] = useState("");
  const [error, setError] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [copiedMail, setCopiedMail] = useState<number | null>(null);

  const cards = useMemo(() => parseCards(streamedText), [streamedText]);
  const summary = useMemo(() => parseSummary(streamedText, cards), [streamedText, cards]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const emails = splitEmails(input);

    if (emails.length === 0 || isAnalyzing) return;

    setError("");
    setStreamedText("");
    setCopiedMail(null);
    setIsAnalyzing(true);

    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch("/api/email-triage", {
        method: "POST",
        headers: {
          ...authHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ emails }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Nie udało się przeanalizować maili.");
      }

      if (!response.body) {
        throw new Error("Serwer nie zwrócił strumienia odpowiedzi.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setStreamedText((current) => current + decoder.decode(value, { stream: true }));
      }

      const finalChunk = decoder.decode();
      if (finalChunk) setStreamedText((current) => current + finalChunk);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Nie udało się przeanalizować maili.",
      );
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function copyDraft(card: EmailCard) {
    if (!card.draft) return;

    try {
      await navigator.clipboard.writeText(card.draft);
      setCopiedMail(card.number);
      window.setTimeout(() => setCopiedMail(null), 1800);
    } catch {
      setError("Nie udało się skopiować draftu. Zaznacz tekst i skopiuj go ręcznie.");
    }
  }

  const emailCount = splitEmails(input).length;

  return (
    <main className="email-triage-shell">
      <SiteNavigation />
      <div className="email-triage-panel">
        <header className="email-triage-hero">
          <div>
            <p className="email-triage-eyebrow">INTELIGENTNA SKRZYNKA</p>
            <h1>📧 E-mail Triage</h1>
            <p>Wklej maile — agent posortuje i napisze odpowiedzi</p>
          </div>
          <span className="email-triage-hero-icon" aria-hidden="true">
            ✨
          </span>
        </header>

        <form className="email-triage-form" onSubmit={handleSubmit}>
          <div className="email-triage-form-heading">
            <label htmlFor="emails">Maile do analizy</label>
            <span>{emailCount} {emailCount === 1 ? "mail" : "maili"}</span>
          </div>
          <textarea
            id="emails"
            onChange={(event) => setInput(event.target.value)}
            placeholder="Wklej maile tutaj — oddziel je pustą linią..."
            value={input}
          />
          <div className="email-triage-actions">
            <button
              className="email-triage-example"
              disabled={isAnalyzing}
              onClick={() => setInput(exampleEmails)}
              type="button"
            >
              📋 Wklej przykład
            </button>
            <button
              className="email-triage-submit"
              disabled={emailCount === 0 || isAnalyzing}
              type="submit"
            >
              {isAnalyzing ? (
                <>
                  <span className="email-triage-spinner" aria-hidden="true" />
                  Analizuję…
                </>
              ) : (
                "📧 Analizuj maile"
              )}
            </button>
          </div>
          {error ? (
            <p className="email-triage-error" role="alert">
              {error}
            </p>
          ) : null}
        </form>

        {(isAnalyzing || cards.length > 0) && (
          <section className="email-triage-results" aria-live="polite">
            <div className="email-summary">
              <div className="email-summary-heading">
                <div>
                  <span>WYNIK ANALIZY</span>
                  <h2>Podsumowanie skrzynki</h2>
                </div>
                {isAnalyzing ? <small>Analiza trwa…</small> : <small>Gotowe</small>}
              </div>
              <div className="email-summary-grid">
                <div className="email-summary-high">
                  <span>🔴</span>
                  <strong>{summary.high}</strong>
                  <small>Pilne</small>
                </div>
                <div className="email-summary-medium">
                  <span>🟡</span>
                  <strong>{summary.medium}</strong>
                  <small>Średnie</small>
                </div>
                <div className="email-summary-low">
                  <span>🟢</span>
                  <strong>{summary.low}</strong>
                  <small>Niskie</small>
                </div>
                <div className="email-summary-spam">
                  <span>🗑️</span>
                  <strong>{summary.spam}</strong>
                  <small>Spam</small>
                </div>
              </div>
              {summary.recommendation ? (
                <p className="email-recommendation">
                  <span>✅</span>
                  <span>
                    <strong>Rekomendacja</strong>
                    {summary.recommendation}
                  </span>
                </p>
              ) : null}
            </div>

            <div className="email-card-list">
              {cards.map((card) => {
                const hasReply = card.draft && !card.draft.toLocaleLowerCase("pl-PL").startsWith("brak odpowiedzi");

                return (
                  <article
                    className={`email-card email-card-${card.priorityKind}${card.isSpam ? " email-card-spam" : ""}`}
                    key={card.number}
                  >
                    <div className="email-card-accent" />
                    <div className="email-card-header">
                      <div>
                        <span>MAIL {card.number}</span>
                        <h3>{card.subject}</h3>
                      </div>
                      <span className={`email-priority email-priority-${card.priorityKind}`}>
                        {card.isSpam ? "🗑️ Spam" : `${card.priorityKind === "high" ? "🔴" : card.priorityKind === "medium" ? "🟡" : "🟢"} ${priorityLabel(card.priorityKind)}`}
                      </span>
                    </div>
                    <dl className="email-card-details">
                      <div>
                        <dt>Kategoria</dt>
                        <dd>{card.category}</dd>
                      </div>
                      <div>
                        <dt>Priorytet</dt>
                        <dd>{card.priority}</dd>
                      </div>
                      <div>
                        <dt>Uzasadnienie</dt>
                        <dd>{card.reason}</dd>
                      </div>
                    </dl>
                    {card.draft ? (
                      <div className={`email-draft${hasReply ? "" : " email-draft-no-reply"}`}>
                        <div className="email-draft-heading">
                          <strong>{hasReply ? "✍️ Proponowana odpowiedź" : "ℹ️ Dalsze działanie"}</strong>
                          {hasReply ? (
                            <button onClick={() => void copyDraft(card)} type="button">
                              {copiedMail === card.number ? "✓ Skopiowano" : "Kopiuj draft"}
                            </button>
                          ) : null}
                        </div>
                        <blockquote>{card.draft}</blockquote>
                      </div>
                    ) : isAnalyzing ? (
                      <div className="email-draft-skeleton" aria-label="Tworzę draft odpowiedzi">
                        <i />
                        <i />
                        <i />
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
