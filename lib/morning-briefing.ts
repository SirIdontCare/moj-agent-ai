import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { createClient } from "@supabase/supabase-js";
import {
  getCurrentDateTime,
  getExchangeRate,
  getWeather,
} from "@/app/lib/tools";

const MODEL = "gemini-3.1-flash-lite";
const FETCH_TIMEOUT_MS = 8_000;
const NEWS_FEED_URL =
  "https://news.google.com/rss?hl=pl&gl=PL&ceid=PL%3Apl";

type NewsItem = {
  title: string;
  url: string;
  publishedAt?: string;
};

function decodeXml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function getTag(item: string, tag: string) {
  return decodeXml(
    item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"))?.[1] ??
      "",
  );
}

async function fetchWithTimeout(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "MojAgent/1.0 morning-briefing",
      },
      next: { revalidate: 900 },
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function getTopNews(limit = 5): Promise<NewsItem[]> {
  const response = await fetchWithTimeout(NEWS_FEED_URL);

  if (!response.ok) {
    throw new Error(`Serwis wiadomości zwrócił kod ${response.status}.`);
  }

  const rss = await response.text();
  const items = [...rss.matchAll(/<item>([\s\S]*?)<\/item>/gi)]
    .map((match) => {
      const title = getTag(match[1], "title");
      const url = getTag(match[1], "link");
      const publishedAt = getTag(match[1], "pubDate");

      return {
        title,
        url,
        ...(publishedAt ? { publishedAt } : {}),
      };
    })
    .filter((item) => item.title && /^https?:\/\//i.test(item.url))
    .slice(0, limit);

  if (items.length === 0) {
    throw new Error("Kanał wiadomości nie zwrócił żadnych artykułów.");
  }

  return items;
}

async function getPolishHoliday(date: string) {
  const year = date.slice(0, 4);

  try {
    const response = await fetchWithTimeout(
      `https://date.nager.at/api/v3/publicholidays/${year}/PL`,
    );

    if (!response.ok) return null;

    const holidays = (await response.json()) as Array<{
      date: string;
      localName: string;
    }>;

    return holidays.find((holiday) => holiday.date === date)?.localName ?? null;
  } catch {
    return null;
  }
}

function settledValue<T>(
  result: PromiseSettledResult<T>,
  fallbackMessage: string,
): T | { error: string } {
  return result.status === "fulfilled"
    ? result.value
    : { error: fallbackMessage };
}

export async function collectMorningData() {
  const dateTime = getCurrentDateTime();
  const [weather, eur, usd, news, holiday] = await Promise.allSettled([
    getWeather("Warszawa"),
    getExchangeRate("EUR"),
    getExchangeRate("USD"),
    getTopNews(),
    getPolishHoliday(dateTime.date),
  ]);

  return {
    dateTime,
    weather: settledValue(weather, "Nie udało się pobrać pogody."),
    exchangeRates: {
      EUR: settledValue(eur, "Nie udało się pobrać kursu EUR."),
      USD: settledValue(usd, "Nie udało się pobrać kursu USD."),
    },
    news: settledValue(news, "Nie udało się pobrać wiadomości."),
    holiday: settledValue(
      holiday,
      "Nie udało się sprawdzić kalendarza świąt.",
    ),
  };
}

const systemPrompt = `Jesteś osobistym asystentem. Na podstawie wyłącznie przekazanych danych napisz zwięzły poranny briefing po polsku w formacie:

# Dzień dobry! Twój briefing na [data]

## Pogoda
[temperatura, opis, co ubrać]

## Kursy walut
- EUR: [kurs] PLN
- USD: [kurs] PLN

## Najważniejsze wiadomości
[3-5 krótkich punktów z tytułami i linkami]

## Dzisiejszy dzień
- Dzień tygodnia: [...]
- Uwagi: [czy dziś święto, dzień wolny albo weekend]

## Porada dnia
[Krótka, pozytywna porada na dzień]

Nie wymyślaj brakujących faktów. Jeżeli źródło danych zwróciło błąd, napisz krótko, że dana informacja jest chwilowo niedostępna. Nie dodawaj wstępu ani komentarza poza briefingiem.`;

export async function generateMorningBriefing() {
  const data = await collectMorningData();
  const result = await generateText({
    model: google(MODEL),
    system: systemPrompt,
    prompt: `Dane na dzisiejszy briefing:\n${JSON.stringify(data, null, 2)}`,
  });
  const content = result.text.trim();

  if (!content) {
    throw new Error("Model nie zwrócił treści briefingu.");
  }

  return {
    content,
    date: data.dateTime.date,
  };
}

// Tabela briefings jest dostępna wyłącznie dla roli service_role — zobacz migrację
// 20260728_briefings.sql. Każdy odczyt i zapis musi iść przez ten klient.
function getServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Brakuje NEXT_PUBLIC_SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function briefingsDatabaseError(
  error: { code?: string; message: string },
  fallback: string,
) {
  const missingTable = error.code === "42P01" || error.code === "PGRST205";

  return missingTable
    ? "Tabela briefings nie istnieje. Zastosuj migrację 20260728_briefings.sql."
    : `${fallback}: ${error.message}`;
}

export function getBriefingPreview(content: string, length = 150) {
  const plain = content
    .replace(/^#+\s*/gm, "")
    .replace(/[*_>`]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return plain.length > length ? `${plain.slice(0, length).trimEnd()}…` : plain;
}

export async function listBriefings(limit = 30) {
  const { data, error } = await getServiceClient()
    .from("briefings")
    .select("id, date, created_at, content")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(
      briefingsDatabaseError(error, "Nie udało się pobrać briefingów"),
    );
  }

  return (data ?? []).map(({ content, ...briefing }) => ({
    ...briefing,
    preview: getBriefingPreview(content),
  }));
}

export async function getBriefing(id: string) {
  const { data, error } = await getServiceClient()
    .from("briefings")
    .select("id, date, created_at, content")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }

    throw new Error(
      briefingsDatabaseError(error, "Nie udało się otworzyć briefingu"),
    );
  }

  return data;
}

export async function saveMorningBriefing(date: string, content: string) {
  const { data, error } = await getServiceClient()
    .from("briefings")
    .upsert(
      {
        date,
        content,
      },
      { onConflict: "date" },
    )
    .select("id, created_at")
    .single();

  if (error) {
    throw new Error(
      briefingsDatabaseError(error, "Nie udało się zapisać briefingu"),
    );
  }

  return data;
}
