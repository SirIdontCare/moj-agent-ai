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

type MealPreferences = {
  goal: string;
  diet: string;
  people: number;
  days: number;
  mealsPerDay: number;
  budget: number;
  exclusions: string;
  pantry: string;
  notes: string;
};

const initialPreferences: MealPreferences = {
  goal: "Zdrowe, codzienne odżywianie",
  diet: "Standardowa",
  people: 2,
  days: 7,
  mealsPerDay: 3,
  budget: 350,
  exclusions: "",
  pantry: "",
  notes: "",
};

const examples: Array<{
  label: string;
  emoji: string;
  preferences: MealPreferences;
}> = [
  {
    label: "Rodzinny i oszczędny",
    emoji: "👨‍👩‍👧‍👦",
    preferences: {
      goal: "Zdrowe, codzienne odżywianie",
      diet: "Standardowa",
      people: 4,
      days: 7,
      mealsPerDay: 3,
      budget: 500,
      exclusions: "Bez orzechów. Dzieci nie lubią bardzo ostrych dań.",
      pantry: "Ryż, makaron, oliwa, podstawowe przyprawy",
      notes: "Kolacje do 30 minut. Obiady mogą wystarczać na dwa dni.",
    },
  },
  {
    label: "Wege z dużą ilością białka",
    emoji: "🥬",
    preferences: {
      goal: "Więcej białka i energii do treningów",
      diet: "Wegetariańska",
      people: 1,
      days: 5,
      mealsPerDay: 4,
      budget: 230,
      exclusions: "Bez grzybów.",
      pantry: "Soczewica, ciecierzyca, płatki owsiane, masło orzechowe",
      notes: "Trenuję wieczorem. Posiłki powinny nadawać się do zabrania do pracy.",
    },
  },
  {
    label: "Szybko i bez laktozy",
    emoji: "⏱️",
    preferences: {
      goal: "Minimum czasu w kuchni",
      diet: "Bez laktozy",
      people: 2,
      days: 7,
      mealsPerDay: 3,
      budget: 420,
      exclusions: "Bez laktozy i bez owoców morza.",
      pantry: "Kasza bulgur, pomidory w puszce, mrożony szpinak",
      notes: "Gotowanie maksymalnie dwa razy w tygodniu, poza szybkimi śniadaniami.",
    },
  },
];

function getMessageText(message: UIMessage) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}

function getMessageSources(message: UIMessage) {
  const uniqueSources = new Map<string, SourceUrlUIPart>();

  for (const part of message.parts) {
    if (part.type === "source-url") uniqueSources.set(part.url, part);
  }

  return [...uniqueSources.values()];
}

function createPrompt(preferences: MealPreferences) {
  return [
    "Przygotuj plan posiłków według poniższych danych:",
    `Cel: ${preferences.goal}`,
    `Sposób odżywiania: ${preferences.diet}`,
    `Liczba osób: ${preferences.people}`,
    `Liczba dni: ${preferences.days}`,
    `Posiłków dziennie: ${preferences.mealsPerDay}`,
    `Maksymalny budżet: ${preferences.budget} PLN`,
    `Alergie i wykluczenia: ${preferences.exclusions.trim() || "Brak"}`,
    `Produkty dostępne w domu: ${preferences.pantry.trim() || "Brak informacji"}`,
    `Dodatkowe potrzeby: ${preferences.notes.trim() || "Brak"}`,
  ].join("\n");
}

export default function MealPlannerPage() {
  const [preferences, setPreferences] =
    useState<MealPreferences>(initialPreferences);
  const [plannedFor, setPlannedFor] = useState<MealPreferences | null>(null);
  const [formError, setFormError] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/meal-planner",
        headers: async () => getAuthHeaders(),
      }),
    [],
  );
  const { messages, sendMessage, setMessages, status, error } = useChat({
    transport,
  });
  const isPlanning = status === "submitted" || status === "streaming";
  const planMessage = useMemo(
    () => [...messages].reverse().find((message) => message.role === "assistant"),
    [messages],
  );
  const plan = planMessage ? getMessageText(planMessage) : "";
  const sources = planMessage ? getMessageSources(planMessage) : [];

  function updatePreference<Key extends keyof MealPreferences>(
    key: Key,
    value: MealPreferences[Key],
  ) {
    setPreferences((current) => ({ ...current, [key]: value }));
  }

  function useExample(example: (typeof examples)[number]) {
    setPreferences({ ...example.preferences });
    setFormError("");
  }

  async function generatePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (preferences.people < 1 || preferences.people > 12) {
      setFormError("Liczba osób musi mieścić się w zakresie od 1 do 12.");
      return;
    }

    if (preferences.days < 3 || preferences.days > 7) {
      setFormError("Plan może obejmować od 3 do 7 dni.");
      return;
    }

    if (preferences.mealsPerDay < 2 || preferences.mealsPerDay > 5) {
      setFormError("Wybierz od 2 do 5 posiłków dziennie.");
      return;
    }

    if (preferences.budget < 50 || preferences.budget > 10_000) {
      setFormError("Budżet musi mieścić się w zakresie od 50 do 10 000 PLN.");
      return;
    }

    setFormError("");
    setCopyStatus("");
    setPlannedFor({ ...preferences });
    setMessages([]);
    await sendMessage({ text: createPrompt(preferences) });
  }

  async function copyPlan() {
    if (!plan) return;

    try {
      await navigator.clipboard.writeText(plan);
      setCopyStatus("✓ Skopiowano");

      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopyStatus(""), 1800);
    } catch {
      setCopyStatus("Nie udało się skopiować");
    }
  }

  return (
    <main className="meal-shell">
      <SiteNavigation />
      <div className="meal-panel">
        <header className="meal-hero">
          <div className="meal-hero-copy">
            <p>TWÓJ TYDZIEŃ · MNIEJ MARNOWANIA · PROSTSZE ZAKUPY</p>
            <h1>🍽️ Planer posiłków</h1>
            <span>
              Dopasowany jadłospis, przepisy i lista zakupów w kilka chwil.
            </span>
          </div>
          <div className="meal-hero-card" aria-hidden="true">
            <span>PLAN</span>
            <strong>7</strong>
            <small>DNI</small>
          </div>
        </header>

        <section className="meal-workspace">
          <form className="meal-form" onSubmit={generatePlan}>
            <div className="meal-section-heading">
              <span>01</span>
              <div>
                <h2>Podstawy planu</h2>
                <p>Ustaw zakres i główny kierunek jadłospisu.</p>
              </div>
            </div>

            <div className="meal-grid meal-grid-primary">
              <label>
                Cel
                <select
                  disabled={isPlanning}
                  onChange={(event) => updatePreference("goal", event.target.value)}
                  value={preferences.goal}
                >
                  <option>Zdrowe, codzienne odżywianie</option>
                  <option>Redukcja masy ciała</option>
                  <option>Więcej białka i energii do treningów</option>
                  <option>Minimum czasu w kuchni</option>
                  <option>Maksymalnie oszczędnie</option>
                  <option>Więcej warzyw w diecie</option>
                </select>
              </label>

              <label>
                Sposób odżywiania
                <select
                  disabled={isPlanning}
                  onChange={(event) => updatePreference("diet", event.target.value)}
                  value={preferences.diet}
                >
                  <option>Standardowa</option>
                  <option>Wegetariańska</option>
                  <option>Wegańska</option>
                  <option>Bez laktozy</option>
                  <option>Bez glutenu</option>
                  <option>Śródziemnomorska</option>
                  <option>Low carb</option>
                </select>
              </label>
            </div>

            <div className="meal-number-grid">
              <label>
                <span>Osoby</span>
                <input
                  disabled={isPlanning}
                  max={12}
                  min={1}
                  onChange={(event) =>
                    updatePreference("people", Number(event.target.value))
                  }
                  type="number"
                  value={preferences.people}
                />
              </label>
              <label>
                <span>Dni</span>
                <input
                  disabled={isPlanning}
                  max={7}
                  min={3}
                  onChange={(event) =>
                    updatePreference("days", Number(event.target.value))
                  }
                  type="number"
                  value={preferences.days}
                />
              </label>
              <label>
                <span>Posiłki / dzień</span>
                <input
                  disabled={isPlanning}
                  max={5}
                  min={2}
                  onChange={(event) =>
                    updatePreference("mealsPerDay", Number(event.target.value))
                  }
                  type="number"
                  value={preferences.mealsPerDay}
                />
              </label>
              <label>
                <span>Budżet</span>
                <div className="meal-budget-input">
                  <input
                    disabled={isPlanning}
                    max={10_000}
                    min={50}
                    onChange={(event) =>
                      updatePreference("budget", Number(event.target.value))
                    }
                    type="number"
                    value={preferences.budget}
                  />
                  <b>PLN</b>
                </div>
              </label>
            </div>

            <div className="meal-section-heading meal-details-heading">
              <span>02</span>
              <div>
                <h2>Dopasowanie</h2>
                <p>Najważniejsze informacje dla bezpiecznego i praktycznego planu.</p>
              </div>
            </div>

            <div className="meal-grid">
              <label>
                Alergie i wykluczenia
                <textarea
                  disabled={isPlanning}
                  maxLength={800}
                  onChange={(event) =>
                    updatePreference("exclusions", event.target.value)
                  }
                  placeholder="Np. bez orzechów, laktozy i bardzo ostrych dań..."
                  value={preferences.exclusions}
                />
              </label>
              <label>
                Co masz już w domu?
                <textarea
                  disabled={isPlanning}
                  maxLength={800}
                  onChange={(event) =>
                    updatePreference("pantry", event.target.value)
                  }
                  placeholder="Np. ryż, makaron, oliwa, ciecierzyca..."
                  value={preferences.pantry}
                />
              </label>
            </div>

            <label className="meal-notes">
              Dodatkowe potrzeby
              <textarea
                disabled={isPlanning}
                maxLength={1_500}
                onChange={(event) =>
                  updatePreference("notes", event.target.value)
                }
                placeholder="Np. obiady do pracy, gotowanie dwa razy w tygodniu, kolacje do 20 minut..."
                value={preferences.notes}
              />
            </label>

            {formError ? (
              <p className="meal-error" role="alert">
                {formError}
              </p>
            ) : null}

            <div className="meal-submit-row">
              <div className="meal-tools">
                <span>🧮 Porcje i koszt</span>
                <span>🌐 Źródła online</span>
              </div>
              <button disabled={isPlanning} type="submit">
                {isPlanning ? (
                  <>
                    <span className="report-spinner" aria-hidden="true" />
                    Układam jadłospis…
                  </>
                ) : (
                  "✨ Ułóż plan posiłków"
                )}
              </button>
            </div>
          </form>

          <aside className="meal-examples">
            <span className="meal-examples-kicker">SZYBKI START</span>
            <h2>Gotowe scenariusze</h2>
            <p>Wybierz bazę i zmień dowolne szczegóły przed wygenerowaniem.</p>
            <div>
              {examples.map((example) => (
                <button
                  disabled={isPlanning}
                  key={example.label}
                  onClick={() => useExample(example)}
                  type="button"
                >
                  <span>{example.emoji}</span>
                  <div>
                    <strong>{example.label}</strong>
                    <small>
                      {example.preferences.people} os. · {example.preferences.days} dni ·{" "}
                      {example.preferences.budget} PLN
                    </small>
                  </div>
                  <b>→</b>
                </button>
              ))}
            </div>
            <div className="meal-safety-note">
              <span>🛡️</span>
              <p>
                Alergie traktujemy jako twarde wykluczenia. Przy diecie leczniczej
                skonsultuj jadłospis ze specjalistą.
              </p>
            </div>
          </aside>
        </section>

        {error ? (
          <p className="meal-error meal-api-error" role="alert">
            {error.message || "Nie udało się przygotować planu posiłków."}
          </p>
        ) : null}

        {(isPlanning || plan) && (
          <section className="meal-result" aria-live="polite">
            <header className="meal-result-toolbar">
              <div>
                <span>{isPlanning ? "PLANOWANIE W TOKU" : "PLAN GOTOWY"}</span>
                <strong>
                  {plannedFor
                    ? `${plannedFor.days} dni · ${plannedFor.people} ${
                        plannedFor.people === 1 ? "osoba" : "osoby"
                      } · ${plannedFor.budget} PLN`
                    : "Przygotowuję Twój jadłospis…"}
                </strong>
              </div>
              {plan && !isPlanning ? (
                <button onClick={() => void copyPlan()} type="button">
                  {copyStatus || "📋 Kopiuj plan"}
                </button>
              ) : null}
            </header>

            {plan ? (
              <article className="meal-document">
                <ReportMarkdown text={plan} />
                {sources.length > 0 ? (
                  <aside className="report-grounding-sources">
                    <h2>Źródła online</h2>
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
              <div className="meal-loading">
                <div aria-hidden="true">
                  <span>🥦</span>
                  <span>🥕</span>
                  <span>🍅</span>
                </div>
                <strong>Komponuję posiłki i sumuję zakupy</strong>
                <p>Uwzględniam budżet, porcje, produkty w domu i wykluczenia.</p>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
