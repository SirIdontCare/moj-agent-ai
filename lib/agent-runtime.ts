import { tool, zodSchema } from "ai";
import { z } from "zod/v4";

export const runtimeToolNames = [
  "createTaskPlan",
  "verifyTaskResult",
  "publishArtifact",
] as const;

export function isComplexAgentTask(text: string) {
  const normalized = text.trim();

  return (
    normalized.length > 140 ||
    /\b(?:zaplanuj|przeanalizuj|porównaj|porownaj|przygotuj|stwórz|stworz|zbadaj|research|raport|briefing|strategi|wyjazd|podróż|podroz|jadłospis|jadlospis|maile|dokument)\b/i.test(normalized) ||
    /(?:i|oraz|następnie|nastepnie).{0,40}(?:sprawdź|sprawdz|policz|zapisz|wygeneruj|porównaj|porownaj)/i.test(normalized)
  );
}

export const agentRuntimeInstructions = `## Runtime wykonawczy
Pracujesz w cyklu: PLAN → WYKONANIE → WERYFIKACJA → REZULTAT.

### Plan
- Dla złożonego zadania pierwszym działaniem jest createTaskPlan.
- Plan ma być krótki, użytkowy i zawierać 2-6 kroków. Nie ujawniaj ukrytego toku rozumowania.
- Każdy krok opisuje rezultat, a nie wewnętrzne rozważania modelu.

### Wykonanie
- Dobieraj tylko narzędzia potrzebne do celu. Możesz wywołać kilka niezależnych narzędzi równolegle.
- Po błędzie nie powtarzaj identycznego wywołania. Zmień parametry, wybierz alternatywę albo jasno wskaż ograniczenie.
- Dane aktualne i istotne fakty opieraj na narzędziach. Nie twórz źródeł ani wyników narzędzi.
- Operacje zapisujące dane wykonuj tylko wtedy, gdy użytkownik wyraźnie poprosił o zapisanie.

### Weryfikacja
- Przed zakończeniem złożonego zadania wywołaj verifyTaskResult.
- Sprawdź kompletność względem celu, poprawność obliczeń, aktualność danych i obecność źródeł.
- Jeśli wynik wymaga poprawy i masz jeszcze możliwość działania, uzupełnij brak zamiast kończyć.

### Artifact
- Jeśli wynik jest raportem, planem, analizą, zestawieniem, briefingiem, draftami maili lub innym materiałem do użycia, wywołaj publishArtifact.
- Do publishArtifact przekaż kompletną treść w Markdown, a nie skrót.
- Po publikacji artifactu odpowiedz krótkim zdaniem przekazującym rezultat użytkownikowi.`;

export function createAgentRuntimeTools() {
  const createTaskPlan = tool({
    description:
      "Tworzy jawny, zwięzły plan wykonania złożonego zadania. Nie zapisuje chain-of-thought — tylko kroki i oczekiwane rezultaty widoczne dla użytkownika.",
    inputSchema: zodSchema(
      z.object({
        goal: z.string().trim().min(3).max(500).describe("Cel użytkownika w jednym zdaniu"),
        steps: z.array(z.object({
          title: z.string().trim().min(2).max(120),
          outcome: z.string().trim().min(2).max(240),
          capabilities: z.array(z.string().trim().min(1).max(60)).max(5).default([]),
        })).min(2).max(6),
        deliverable: z.string().trim().min(2).max(200).describe("Końcowy rezultat zadania"),
      }),
    ),
    execute: async ({ goal, steps, deliverable }) => ({
      status: "planned" as const,
      goal,
      steps: steps.map((step, index) => ({ ...step, index: index + 1 })),
      deliverable,
    }),
  });

  const verifyTaskResult = tool({
    description:
      "Rejestruje kontrolę jakości przed zakończeniem złożonego zadania. Używaj po zebraniu danych i przygotowaniu rezultatu.",
    inputSchema: zodSchema(
      z.object({
        status: z.enum(["passed", "needs_attention"]),
        checks: z.array(z.object({
          label: z.string().trim().min(2).max(120),
          passed: z.boolean(),
          note: z.string().trim().max(240).default(""),
        })).min(2).max(8),
        missing: z.array(z.string().trim().min(2).max(200)).max(6).default([]),
        confidence: z.number().min(0).max(100),
      }),
    ),
    execute: async ({ status, checks, missing, confidence }) => ({
      status,
      checks,
      missing,
      confidence,
      verifiedAt: new Date().toISOString(),
    }),
  });

  const publishArtifact = tool({
    description:
      "Publikuje kompletny, gotowy do użycia rezultat jako czytelny artifact w interfejsie czatu.",
    inputSchema: zodSchema(
      z.object({
        type: z.enum([
          "report",
          "travel_plan",
          "comparison",
          "meal_plan",
          "email_drafts",
          "briefing",
          "analysis",
          "document",
        ]),
        title: z.string().trim().min(2).max(240),
        summary: z.string().trim().min(2).max(500),
        content: z.string().trim().min(10).max(200_000).describe("Kompletna treść artifactu w Markdown"),
        suggestedActions: z.array(z.string().trim().min(2).max(160)).max(4).default([]),
      }),
    ),
    execute: async ({ type, title, summary, content, suggestedActions }) => ({
      published: true,
      type,
      title,
      summary,
      content,
      suggestedActions,
      createdAt: new Date().toISOString(),
    }),
  });

  return { createTaskPlan, verifyTaskResult, publishArtifact };
}
