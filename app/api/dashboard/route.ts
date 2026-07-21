export const maxDuration = 15;

const FETCH_TIMEOUT_MS = 5000;
const WARSAW = {
  city: "Warszawa",
  latitude: 52.2297,
  longitude: 21.0122,
};

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

function weatherEmoji(code: number) {
  if (code === 0 || code === 1) {
    return "☀️";
  }

  if (code === 2 || code === 3) {
    return "⛅";
  }

  if (code >= 51 && code <= 82) {
    return "🌧️";
  }

  if (code >= 71 && code <= 75) {
    return "❄️";
  }

  if (code >= 95) {
    return "⛈️";
  }

  return "🌤️";
}

async function fetchWithTimeout(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    return await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function getNow() {
  const now = new Date();

  return {
    dateTime: now.toLocaleString("pl-PL", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: "Europe/Warsaw",
    }),
    dayOfWeek: now.toLocaleDateString("pl-PL", {
      weekday: "long",
      timeZone: "Europe/Warsaw",
    }),
    timestamp: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

async function getWeather() {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${WARSAW.latitude}&longitude=${WARSAW.longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code`;
  const response = await fetchWithTimeout(url);

  if (!response.ok) {
    throw new Error(`Open-Meteo zwróciło ${response.status}`);
  }

  const data = (await response.json()) as {
    current?: {
      temperature_2m?: number;
      relative_humidity_2m?: number;
      wind_speed_10m?: number;
      weather_code?: number;
    };
  };
  const current = data.current;

  if (!current) {
    throw new Error("Brak aktualnej pogody z Open-Meteo");
  }

  const weatherCode = current.weather_code ?? -1;

  return {
    city: WARSAW.city,
    temperature: current.temperature_2m,
    humidity: current.relative_humidity_2m,
    windSpeed: current.wind_speed_10m,
    description: weatherCodeToDescription(weatherCode),
    emoji: weatherEmoji(weatherCode),
    source: "Open-Meteo",
    updatedAt: new Date().toISOString(),
  };
}

async function getExchangeRate(currency: "EUR" | "USD") {
  const response = await fetchWithTimeout(
    `https://api.nbp.pl/api/exchangerates/rates/a/${currency}/last/2/?format=json`,
  );

  if (!response.ok) {
    throw new Error(`NBP zwróciło ${response.status} dla ${currency}`);
  }

  const data = (await response.json()) as {
    code: string;
    rates?: Array<{ mid: number; effectiveDate: string }>;
  };
  const currentRate = data.rates?.at(-1);
  const previousRate = data.rates?.at(-2);

  if (!currentRate) {
    throw new Error(`Brak kursu ${currency} w odpowiedzi NBP`);
  }

  return {
    currency: data.code,
    rate: currentRate.mid,
    date: currentRate.effectiveDate,
    change: previousRate ? Number((currentRate.mid - previousRate.mid).toFixed(4)) : null,
    source: "NBP",
  };
}

async function getRates() {
  const [eur, usd] = await Promise.all([getExchangeRate("EUR"), getExchangeRate("USD")]);

  return {
    rates: [eur, usd],
    updatedAt: new Date().toISOString(),
  };
}

async function getHolidays() {
  const now = new Date();
  const year = now.getFullYear();
  const today = now.toISOString().slice(0, 10);
  const response = await fetchWithTimeout(`https://date.nager.at/api/v3/publicholidays/${year}/PL`);

  if (!response.ok) {
    throw new Error(`Nager.Date zwróciło ${response.status}`);
  }

  const data = (await response.json()) as Array<{
    date: string;
    localName: string;
    name: string;
  }>;
  const upcoming = data
    .filter((holiday) => holiday.date >= today)
    .slice(0, 4)
    .map((holiday) => ({
      ...holiday,
      daysUntil: Math.ceil(
        (new Date(`${holiday.date}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) /
          86_400_000,
      ),
    }));

  return {
    countryCode: "PL",
    year,
    holidays: upcoming,
    nextInDays: upcoming[0]?.daysUntil ?? null,
    source: "Nager.Date",
    updatedAt: new Date().toISOString(),
  };
}

async function safeResolve<T>(promise: Promise<T>) {
  try {
    return {
      data: await promise,
      error: "",
    };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : "Nieznany błąd",
    };
  }
}

export async function GET(request: Request) {
  const section = new URL(request.url).searchParams.get("section") ?? "all";

  if (section === "weather") {
    return Response.json({ weather: await safeResolve(getWeather()) });
  }

  if (section === "rates") {
    return Response.json({ rates: await safeResolve(getRates()) });
  }

  if (section === "holidays") {
    return Response.json({ holidays: await safeResolve(getHolidays()) });
  }

  const [weather, rates, holidays] = await Promise.all([
    safeResolve(getWeather()),
    safeResolve(getRates()),
    safeResolve(getHolidays()),
  ]);

  return Response.json({
    now: getNow(),
    weather,
    rates,
    holidays,
  });
}

