"use client";

import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  type SourceUrlUIPart,
  type UIMessage,
} from "ai";
import { type FormEvent, useMemo, useRef, useState } from "react";
import SiteNavigation from "../site-navigation";
import ReportMarkdown from "../report/report-markdown";
import { getAuthHeaders } from "@/lib/supabase";

const examples = [
  {
    companies: ["Shopify", "WooCommerce", "PrestaShop"],
    context: "Szukam platformy e-commerce dla małego sklepu.",
  },
  {
    companies: ["Notion", "Obsidian", "Evernote"],
    context: "Potrzebuję narzędzia do zarządzania wiedzą w małym zespole.",
  },
  {
    companies: ["Vercel", "Netlify", "Railway"],
    context: "Wdrażam aplikację webową i zależy mi na prostocie oraz przewidywalnych kosztach.",
  },
  {
    companies: ["ChatGPT", "Claude", "Gemini"],
    context: "Szukam asystenta AI do analizy dokumentów i codziennej pracy biznesowej.",
  },
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

export default function CompetitorPage() {
  const [companies, setCompanies] = useState(["", "", ""]);
  const [analyzedCompanies, setAnalyzedCompanies] = useState<string[]>([]);
  const [context, setContext] = useState("");
  const [formError, setFormError] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/competitor",
        headers: async () => getAuthHeaders(),
      }),
    [],
  );
  const { messages, sendMessage, setMessages, status, error } = useChat({
    transport,
  });
  const isAnalyzing = status === "submitted" || status === "streaming";
  const analysisMessage = useMemo(
    () => [...messages].reverse().find((message) => message.role === "assistant"),
    [messages],
  );
  const analysis = analysisMessage ? getMessageText(analysisMessage) : "";
  const sources = analysisMessage ? getMessageSources(analysisMessage) : [];
  const canSubmit =
    companies.every((company) => company.trim().length > 0) && !isAnalyzing;

  function updateCompany(index: number, value: string) {
    setCompanies((current) =>
      current.map((company, companyIndex) =>
        companyIndex === index ? value : company,
      ),
    );
  }

  function useExample(example: (typeof examples)[number]) {
    setCompanies(example.companies);
    setContext(example.context);
    setFormError("");
  }

  async function compareCompanies(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedCompanies = companies.map((company) => company.trim());
    const uniqueCompanies = new Set(
      normalizedCompanies.map((company) => company.toLocaleLowerCase("pl-PL")),
    );

    if (normalizedCompanies.some((company) => !company)) {
      setFormError("Wpisz nazwy wszystkich trzech firm.");
      return;
    }

    if (uniqueCompanies.size !== 3) {
      setFormError("Każde pole musi zawierać inną firmę.");
      return;
    }

    setFormError("");
    setCopyStatus("");
    setAnalyzedCompanies(normalizedCompanies);
    setMessages([]);

    const prompt = [
      "Firmy do porównania:",
      ...normalizedCompanies.map((company, index) => `${index + 1}. ${company}`),
      "",
      `Kontekst użytkownika: ${context.trim() || "Brak dodatkowego kontekstu — przygotuj ogólne porównanie biznesowe."}`,
    ].join("\n");

    await sendMessage({ text: prompt });
  }

  async function copyAnalysis() {
    if (!analysis) return;

    try {
      await navigator.clipboard.writeText(analysis);
      setCopyStatus("✓ Skopiowano");

      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopyStatus(""), 1800);
    } catch {
      setCopyStatus("Nie udało się skopiować");
    }
  }

  return (
    <main className="competitor-shell">
      <SiteNavigation />
      <div className="competitor-panel">
        <header className="competitor-hero">
          <div>
            <p>RESEARCH RYNKOWY AI</p>
            <h1>🏢 Analiza konkurencji</h1>
            <span>Podaj firmy — agent porówna je za Ciebie</span>
          </div>
          <div className="competitor-hero-visual" aria-hidden="true">
            <i>1</i>
            <i>2</i>
            <i>3</i>
          </div>
        </header>

        <section className="competitor-form-card">
          <form onSubmit={compareCompanies}>
            <div className="competitor-inputs">
              {companies.map((company, index) => (
                <label key={index}>
                  Firma {index + 1}
                  <input
                    disabled={isAnalyzing}
                    maxLength={120}
                    onChange={(event) => updateCompany(index, event.target.value)}
                    placeholder={
                      index === 0
                        ? "Np. Shopify"
                        : index === 1
                          ? "Np. WooCommerce"
                          : "Np. PrestaShop"
                    }
                    value={company}
                  />
                </label>
              ))}
            </div>

            <label className="competitor-context">
              Kontekst <span>opcjonalnie</span>
              <textarea
                disabled={isAnalyzing}
                maxLength={1_500}
                onChange={(event) => setContext(event.target.value)}
                placeholder="Np. Szukam platformy e-commerce dla małego sklepu..."
                value={context}
              />
            </label>

            <div className="competitor-submit-row">
              <div className="competitor-tool-pills">
                <span>🌐 Google Search</span>
                <span>📚 Wikipedia</span>
                <span>📄 Strony firmowe</span>
              </div>
              <button disabled={!canSubmit} type="submit">
                {isAnalyzing ? (
                  <>
                    <span className="report-spinner" aria-hidden="true" />
                    Analizuję…
                  </>
                ) : (
                  "🔍 Porównaj"
                )}
              </button>
            </div>

            {formError ? (
              <p className="competitor-error" role="alert">
                {formError}
              </p>
            ) : null}
          </form>

          <div className="competitor-examples">
            <strong>Gotowe przykłady</strong>
            <div>
              {examples.map((example) => (
                <button
                  disabled={isAnalyzing}
                  key={example.companies.join("-")}
                  onClick={() => useExample(example)}
                  type="button"
                >
                  {example.companies.join(" vs ")}
                </button>
              ))}
            </div>
          </div>
        </section>

        {error ? (
          <p className="competitor-error competitor-api-error" role="alert">
            {error.message || "Nie udało się przygotować analizy konkurencji."}
          </p>
        ) : null}

        {(isAnalyzing || analysis) && (
          <section className="competitor-result" aria-live="polite">
            <header className="competitor-result-toolbar">
              <div>
                <span>{isAnalyzing ? "ANALIZA W TOKU" : "ANALIZA GOTOWA"}</span>
                <strong>
                  {isAnalyzing
                    ? "Zbieram i porównuję dane o trzech firmach…"
                    : analyzedCompanies.join(" · ")}
                </strong>
              </div>
              {analysis && !isAnalyzing ? (
                <button onClick={() => void copyAnalysis()} type="button">
                  {copyStatus || "📋 Kopiuj analizę"}
                </button>
              ) : null}
            </header>

            {analysis ? (
              <article className="competitor-document">
                <ReportMarkdown text={analysis} />
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
                          {source.title || source.url}
                        </a>
                      ))}
                    </div>
                  </aside>
                ) : null}
              </article>
            ) : (
              <div className="competitor-loading">
                <span className="competitor-scan" aria-hidden="true" />
                <strong>Agent rozpoczyna research</strong>
                <p>Sprawdzam firmy, produkty, ceny oraz mocne i słabe strony.</p>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
