import { google } from "@ai-sdk/google";
import { streamText } from "ai";
import { authenticateRequest, unauthorizedResponse } from "@/lib/supabase-server";

export const maxDuration = 60;

const MODEL = "gemini-3.1-flash-lite";
const MAX_EMAILS = 20;
const MAX_EMAIL_LENGTH = 10_000;
const MAX_TOTAL_LENGTH = 50_000;

const systemPrompt = `Jesteś profesjonalnym asystentem do zarządzania pocztą.

Dla KAŻDEGO maila wykonaj:
1. 📧 KATEGORYZACJA: określ typ (zapytanie ofertowe / reklamacja / spam / informacja / prośba o spotkanie)
2. 🔴🟡🟢 PRIORYTET: Wysoki (wymaga odpowiedzi dziś) / Średni (w ciągu 3 dni) / Niski (może poczekać)
3. ✍️ DRAFT: Napisz krótki, profesjonalny szkic odpowiedzi (3-5 zdań).

Wyjątki:
- Dla spamu nie pisz odpowiedzi. W polu draft wpisz dokładnie: "Brak odpowiedzi — oznacz jako spam i usuń."
- Dla informacji lub newslettera, które nie wymagają reakcji, wpisz: "Brak odpowiedzi — wiadomość informacyjna."
- Spam zawsze ma priorytet Niski i kategorię spam.

FORMAT ODPOWIEDZI:
Dla każdego maila:

### Mail [numer]: [krótki temat]
| Kategoria | [typ] |
| Priorytet | [🔴 Wysoki / 🟡 Średni / 🟢 Niski] |
| Uzasadnienie | [dlaczego ten priorytet] |

**Proponowana odpowiedź:**
> [draft odpowiedzi albo informacja o braku odpowiedzi]

---

Na końcu napisz:

## PODSUMOWANIE
- 🔴 Pilne: [ile] maili
- 🟡 Średnie: [ile] maili
- 🟢 Niskie: [ile] maili (bez spamu)
- 🗑️ Spam: [ile] maili
- ✅ Rekomendacja: [który mail obsłużyć najpierw i dlaczego]

ZASADY:
- Przeanalizuj wszystkie maile i zachowaj ich kolejność oraz numerację.
- Nie dodawaj żadnego tekstu przed pierwszym nagłówkiem "### Mail".
- Używaj wyłącznie powyższego formatu Markdown.
- Odpowiadaj po polsku.`;

function validateEmails(value: unknown) {
  if (!Array.isArray(value)) {
    return { error: "Pole „emails” musi być tablicą tekstów." } as const;
  }

  const emails = value
    .filter((email): email is string => typeof email === "string")
    .map((email) => email.trim())
    .filter(Boolean);

  if (emails.length === 0) {
    return { error: "Wklej co najmniej jeden mail." } as const;
  }

  if (emails.length !== value.length) {
    return { error: "Każdy element tablicy „emails” musi być niepustym tekstem." } as const;
  }

  if (emails.length > MAX_EMAILS) {
    return { error: `Możesz przeanalizować maksymalnie ${MAX_EMAILS} maili naraz.` } as const;
  }

  if (emails.some((email) => email.length > MAX_EMAIL_LENGTH)) {
    return {
      error: `Pojedynczy mail może mieć maksymalnie ${MAX_EMAIL_LENGTH.toLocaleString("pl-PL")} znaków.`,
    } as const;
  }

  if (emails.reduce((total, email) => total + email.length, 0) > MAX_TOTAL_LENGTH) {
    return {
      error: `Łączna długość maili może wynosić maksymalnie ${MAX_TOTAL_LENGTH.toLocaleString("pl-PL")} znaków.`,
    } as const;
  }

  return { emails } as const;
}

export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth) return unauthorizedResponse();

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Nieprawidłowy format JSON." }, { status: 400 });
  }

  const emailsValue =
    typeof body === "object" && body !== null && "emails" in body
      ? (body as { emails?: unknown }).emails
      : undefined;
  const validation = validateEmails(emailsValue);

  if ("error" in validation) {
    return Response.json({ error: validation.error }, { status: 400 });
  }

  const numberedEmails = validation.emails
    .map((email, index) => `MAIL ${index + 1}\n${email}`)
    .join("\n\n====================\n\n");

  const result = streamText({
    model: google(MODEL),
    system: systemPrompt,
    prompt: `Przeanalizuj poniższe maile:\n\n${numberedEmails}`,
  });

  return result.toTextStreamResponse();
}
