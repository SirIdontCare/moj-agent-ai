import { google } from "@ai-sdk/google";
import { GoogleGenAI, Modality } from "@google/genai";
import { generateText, tool, zodSchema } from "ai";
import { z } from "zod/v4";
import type { SupabaseClient } from "@supabase/supabase-js";
import { searchKnowledge } from "@/lib/knowledge";

const PRIMARY_MODEL = "gemini-2.5-flash";
const IMAGE_MODEL = "gemini-3.1-flash-lite-image";
const IMAGE_TIMEOUT_MS = 30_000;
const FETCH_TIMEOUT_MS = 5000;

type InlineImagePart = {
  inlineData?: {
    data?: string;
    mimeType?: string;
  };
};

type TextPart = {
  text?: string;
};

type Note = {
  title: string;
  content: string;
  createdAt: string;
};

const notesStore = globalThis as typeof globalThis & {
  __agentNotes?: Note[];
};

function getNotesStore() {
  notesStore.__agentNotes ??= [];

  return notesStore.__agentNotes;
}

function extractTextFromHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 3000);
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Przekroczono limit 30 sekund generowania obrazu."));
    }, timeoutMs);

    promise
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(timeout));
  });
}

function getReadableApiError(error: unknown) {
  const rawMessage = error instanceof Error ? error.message : "Nieznany błąd API.";

  try {
    const parsed = JSON.parse(rawMessage) as {
      error?: {
        code?: number;
        message?: string;
        status?: string;
      };
    };
    const apiError = parsed.error;

    if (apiError?.status === "RESOURCE_EXHAUSTED" || apiError?.code === 429) {
      return "Limit API dla generowania obrazów został wyczerpany. Spróbuj ponownie później albo sprawdź limity i billing w Google AI Studio.";
    }

    return apiError?.message ?? rawMessage;
  } catch {
    return rawMessage;
  }
}

function weatherCodeToDescription(code: number) {
  const descriptions: Record<number, string> = {
    0: "bezchmurnie",
    1: "głównie bezchmurnie",
    2: "częściowe zachmurzenie",
    3: "pochmurno",
    45: "mgła",
    48: "mgła osadzająca szadź",
    51: "lekka mżawka",
    53: "mżawka",
    55: "intensywna mżawka",
    61: "lekki deszcz",
    63: "deszcz",
    65: "silny deszcz",
    71: "lekki śnieg",
    73: "śnieg",
    75: "silny śnieg",
    80: "lekkie przelotne opady",
    81: "przelotne opady",
    82: "silne przelotne opady",
    95: "burza",
    96: "burza z gradem",
    99: "silna burza z gradem",
  };

  return descriptions[code] ?? `kod pogody ${code}`;
}

function getFetchErrorMessage(error: unknown) {
  if (error instanceof Error && error.name === "AbortError") {
    return "Timeout — serwer nie odpowiedział w 5 sekund. Spróbuj ponownie.";
  }

  const message = error instanceof Error ? error.message : "Nieznany błąd.";

  return `Błąd połączenia: ${message}`;
}

async function fetchWithTimeout(url: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export const readWebPageTool = tool({
  description:
    "Pobiera i czyta zawartość strony internetowej. Używaj gdy użytkownik poda URL lub gdy chcesz przeczytać artykuł/stronę znalezioną w wyszukiwarce.",
  inputSchema: zodSchema(
    z.object({
      url: z.string().url().describe("Pełny adres URL strony internetowej"),
    }),
  ),
  execute: async ({ url }) => {
    try {
      const response = await fetchWithTimeout(url, {
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; MojAgent/1.0; +https://localhost)",
        },
      });

      if (!response.ok) {
        return { error: `API zwróciło błąd ${response.status}. Sprawdź parametry.` };
      }

      const html = await response.text();
      const text = extractTextFromHtml(html);

      if (!text) {
        return { error: "Strona została pobrana, ale nie udało się wyciągnąć czytelnego tekstu." };
      }

      return text;
    } catch (error) {
      return { error: getFetchErrorMessage(error) };
    }
  },
});

export const calculatorTool = tool({
  description: "Oblicza wyrażenia matematyczne. Używaj do dokładnych obliczeń.",
  inputSchema: zodSchema(
    z.object({
      expression: z.string().describe("Wyrażenie matematyczne, np. 15 * 247 albo 5000 / 4.28"),
    }),
  ),
  execute: async ({ expression }) => {
    const blockedWords = /\b(import|require|eval|process|fetch|globalThis|window|document|Function)\b/i;

    if (blockedWords.test(expression) || !/^[\d\s+\-*/().,%]+$/.test(expression)) {
      return {
        expression,
        error: "Wyrażenie zawiera niedozwolone znaki",
      };
    }

    try {
      const normalizedExpression = expression.replace(/,/g, ".");
      const result = Function(`"use strict"; return (${normalizedExpression});`)();

      if (typeof result !== "number" || !Number.isFinite(result)) {
        return {
          expression,
          error: "Wynik nie jest poprawną liczbą.",
        };
      }

      return { expression, result };
    } catch {
      return {
        expression,
        error: `Nie mogę obliczyć: ${expression}`,
      };
    }
  },
});

export const currentDateTimeTool = tool({
  description: "Zwraca aktualną datę i czas.",
  inputSchema: zodSchema(z.object({})),
  execute: async () => {
    const now = new Date();

    return {
      dateTime: now.toLocaleString("pl-PL", {
        dateStyle: "full",
        timeStyle: "medium",
        timeZone: "Europe/Warsaw",
      }),
      dayOfWeek: now.toLocaleDateString("pl-PL", {
        weekday: "long",
        timeZone: "Europe/Warsaw",
      }),
      timestamp: now.toISOString(),
    };
  },
});

export const getWeatherTool = tool({
  description: "Sprawdza aktualną pogodę w podanym mieście.",
  inputSchema: zodSchema(
    z.object({
      city: z.string().describe("Nazwa miasta, np. Warszawa albo Kraków"),
    }),
  ),
  execute: async ({ city }) => {
    const normalizedCity = city.trim();

    if (!normalizedCity) {
      return { error: "Podaj nazwę miasta" };
    }

    try {
      const geocodingUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(normalizedCity)}&count=1&language=pl`;
      const geocodingResponse = await fetchWithTimeout(geocodingUrl);

      if (!geocodingResponse.ok) {
        return { error: `API zwróciło błąd ${geocodingResponse.status}. Sprawdź parametry.` };
      }

      const geocoding = (await geocodingResponse.json()) as {
        results?: Array<{ latitude: number; longitude: number; name: string; country?: string }>;
      };
      const location = geocoding.results?.[0];

      if (!location) {
        return { error: `Nie znalazłem miasta ${normalizedCity}. Sprawdź pisownię.` };
      }

      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code`;
      const weatherResponse = await fetchWithTimeout(weatherUrl);

      if (!weatherResponse.ok) {
        return { error: `API zwróciło błąd ${weatherResponse.status}. Sprawdź parametry.` };
      }

      const weather = (await weatherResponse.json()) as {
        current?: {
          temperature_2m?: number;
          relative_humidity_2m?: number;
          wind_speed_10m?: number;
          weather_code?: number;
        };
      };
      const current = weather.current;

      if (!current) {
        return { error: `Brak aktualnych danych pogodowych dla miasta ${location.name}.` };
      }

      return {
        city: location.name,
        temperature: current.temperature_2m,
        humidity: current.relative_humidity_2m,
        windSpeed: current.wind_speed_10m,
        description: weatherCodeToDescription(current.weather_code ?? -1),
        source: "Open-Meteo",
      };
    } catch (error) {
      return { error: getFetchErrorMessage(error) };
    }
  },
});

export const getExchangeRateTool = tool({
  description: "Sprawdza kurs waluty do PLN z NBP.",
  inputSchema: zodSchema(
    z.object({
      currency: z.string().describe("Kod waluty, np. EUR, USD, GBP albo CHF"),
    }),
  ),
  execute: async ({ currency }) => {
    const code = currency.trim().toUpperCase();

    if (!/^[A-Z]{3}$/.test(code)) {
      return { error: "Podaj 3-literowy kod waluty (np. EUR, USD)" };
    }

    try {
      const response = await fetchWithTimeout(`https://api.nbp.pl/api/exchangerates/rates/a/${code}/?format=json`);

      if (response.status === 404) {
        return { error: `Waluta ${code} nie jest w tabeli NBP. Popularne: EUR, USD, GBP, CHF` };
      }

      if (!response.ok) {
        return { error: `API zwróciło błąd ${response.status}. Sprawdź parametry.` };
      }

      const data = (await response.json()) as {
        code: string;
        rates?: Array<{ mid: number; effectiveDate: string }>;
      };
      const rate = data.rates?.[0];

      if (!rate) {
        return { error: `Brak kursu ${code} w odpowiedzi NBP.` };
      }

      return {
        currency: data.code,
        rate: rate.mid,
        date: rate.effectiveDate,
        source: "NBP",
      };
    } catch (error) {
      return { error: getFetchErrorMessage(error) };
    }
  },
});

export const getHolidaysTool = tool({
  description: "Sprawdza święta państwowe w danym kraju na dany rok.",
  inputSchema: zodSchema(
    z.object({
      countryCode: z.string().describe("Kod kraju, np. PL, DE albo FR"),
      year: z.number().int().describe("Rok, np. 2026"),
    }),
  ),
  execute: async ({ countryCode, year }) => {
    const code = countryCode.trim().toUpperCase();

    if (!/^[A-Z]{2}$/.test(code)) {
      return { error: "Podaj 2-literowy kod kraju (np. PL, DE, US)" };
    }

    try {
      const response = await fetchWithTimeout(`https://date.nager.at/api/v3/publicholidays/${year}/${code}`);

      if (!response.ok) {
        return { error: `Nie znalazłem świąt dla kraju ${code}. Popularne: PL, DE, US, GB, FR` };
      }

      const holidays = (await response.json()) as Array<{
        date: string;
        localName: string;
        name: string;
      }>;

      return holidays.slice(0, 15).map((holiday) => ({
        date: holiday.date,
        localName: holiday.localName,
        name: holiday.name,
      }));
    } catch (error) {
      return { error: getFetchErrorMessage(error) };
    }
  },
});

export const searchWikipediaTool = tool({
  description: "Wyszukuje artykuł w Wikipedii i zwraca streszczenie.",
  inputSchema: zodSchema(
    z.object({
      query: z.string().describe("Hasło lub temat do wyszukania w Wikipedii"),
    }),
  ),
  execute: async ({ query }) => {
    async function getSummary(title: string) {
      const response = await fetchWithTimeout(
        `https://pl.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
        {
          headers: {
            "user-agent": "MojAgent/1.0 (learning project)",
          },
        },
      );

      if (!response.ok) {
        return null;
      }

      return (await response.json()) as {
        title?: string;
        extract?: string;
        content_urls?: { desktop?: { page?: string } };
        thumbnail?: { source?: string };
      };
    }

    try {
      let summary = await getSummary(query);

      if (!summary?.extract) {
        const searchResponse = await fetchWithTimeout(
          `https://pl.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`,
          {
            headers: {
              "user-agent": "MojAgent/1.0 (learning project)",
            },
          },
        );

        if (!searchResponse.ok) {
          return { error: `API zwróciło błąd ${searchResponse.status}. Sprawdź parametry.` };
        }

        const searchData = (await searchResponse.json()) as {
          query?: { search?: Array<{ title: string }> };
        };
        const firstTitle = searchData.query?.search?.[0]?.title;

        if (!firstTitle) {
          return { error: `Nie znalazłem hasła ${query} w Wikipedii.` };
        }

        summary = await getSummary(firstTitle);
      }

      if (!summary?.extract) {
        return { error: `Nie znalazłem streszczenia hasła ${query} w Wikipedii.` };
      }

      return {
        title: summary.title ?? query,
        summary: summary.extract.slice(0, 1000),
        url:
          summary.content_urls?.desktop?.page ??
          `https://pl.wikipedia.org/wiki/${encodeURIComponent(summary.title ?? query)}`,
        thumbnail: summary.thumbnail?.source,
      };
    } catch (error) {
      return { error: getFetchErrorMessage(error) };
    }
  },
});

export const saveNoteTool = tool({
  description: "Zapisuje notatkę w pamięci agenta.",
  inputSchema: zodSchema(
    z.object({
      title: z.string().describe("Tytuł notatki"),
      content: z.string().describe("Treść notatki"),
    }),
  ),
  execute: async ({ title, content }) => {
    getNotesStore().push({
      title,
      content,
      createdAt: new Date().toISOString(),
    });

    return { saved: true, title };
  },
});

export const getNotesTool = tool({
  description: "Pobiera wszystkie zapisane notatki.",
  inputSchema: zodSchema(z.object({})),
  execute: async () => getNotesStore(),
});

export const googleSearchTool = tool({
  description:
    "Wyszukuje aktualne informacje w Google. Używaj do newsów, firm, produktów, cen, wydarzeń i tematów wymagających internetu.",
  inputSchema: zodSchema(
    z.object({
      query: z.string().describe("Zapytanie do Google"),
    }),
  ),
  execute: async ({ query }) => {
    const result = await generateText({
      model: google(PRIMARY_MODEL),
      prompt: `Wyszukaj w Google i streść najważniejsze wyniki dla zapytania: ${query}. Podaj najważniejsze fakty i linki, jeśli są dostępne.`,
      tools: {
        google_search: google.tools.googleSearch({}),
      },
      toolChoice: "required",
    });

    return result.text;
  },
});

function createSearchKnowledgeTool(supabase: SupabaseClient, userId: string) {
  return tool({
    description:
      "Przeszukuje bazę wiedzy firmy: cenniki, pakiety, FAQ, regulaminy, warunki i oferty. Używaj zawsze przed odpowiedzią na pytania o firmę, jej usługi lub ceny.",
    inputSchema: zodSchema(
      z.object({
        query: z
          .string()
          .trim()
          .min(2)
          .max(1000)
          .describe("Zwięzłe pytanie lub fraza do wyszukania w dokumentach firmy"),
      }),
    ),
    execute: async ({ query }) => {
      try {
        return await searchKnowledge(supabase, userId, query);
      } catch (error) {
        return {
          results: [],
          total_found: 0,
          source_documents: [],
          error:
            error instanceof Error
              ? `Nie udało się przeszukać bazy wiedzy: ${error.message}`
              : "Nie udało się przeszukać bazy wiedzy.",
        };
      }
    },
  });
}

export const generateImageTool = tool({
  description:
    "Generuje obraz na podstawie opisu. Używaj gdy użytkownik prosi o logo, grafikę, ilustrację, post wizualny.",
  inputSchema: zodSchema(
    z.object({
      prompt: z.string().describe("Opis obrazu do wygenerowania"),
    }),
  ),
  execute: async ({ prompt }) => {
    const apiKey = process.env.GOOGLE_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    if (!apiKey) {
      return {
        error: "Brakuje klucza GOOGLE_API_KEY w konfiguracji aplikacji.",
      };
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await withTimeout(
        ai.models.generateContent({
          model: IMAGE_MODEL,
          contents: prompt,
          config: {
            responseModalities: [Modality.TEXT, Modality.IMAGE],
          },
        }),
        IMAGE_TIMEOUT_MS,
      );
      const parts = response.candidates?.[0]?.content?.parts ?? [];
      let image = "";
      let text = "";

      for (const part of parts) {
        const imagePart = part as InlineImagePart;
        const textPart = part as TextPart;

        if (!image && imagePart.inlineData?.data) {
          const mimeType = imagePart.inlineData.mimeType ?? "image/png";
          image = `data:${mimeType};base64,${imagePart.inlineData.data}`;
        }

        if (textPart.text) {
          text = text ? `${text}\n${textPart.text}` : textPart.text;
        }
      }

      if (!image) {
        return {
          error: "Model nie zwrócił obrazu. Spróbuj doprecyzować prompt.",
        };
      }

      return {
        image,
        text: text || "Obraz został wygenerowany.",
        prompt,
      };
    } catch (error) {
      return {
        error: getReadableApiError(error),
      };
    }
  },
});

export function createReactTools(supabase: SupabaseClient, userId: string) {
  return {
    calculator: calculatorTool,
    currentDateTime: currentDateTimeTool,
    getWeather: getWeatherTool,
    getExchangeRate: getExchangeRateTool,
    getHolidays: getHolidaysTool,
    searchWikipedia: searchWikipediaTool,
    saveNote: saveNoteTool,
    getNotes: getNotesTool,
    readWebPage: readWebPageTool,
    searchKnowledge: createSearchKnowledgeTool(supabase, userId),
  };
}
