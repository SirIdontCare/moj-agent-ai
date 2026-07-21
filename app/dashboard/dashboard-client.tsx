"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import SiteNavigation from "../site-navigation";

type SafeResult<T> = {
  data: T | null;
  error: string;
};

type WeatherData = {
  city: string;
  temperature?: number;
  humidity?: number;
  windSpeed?: number;
  description: string;
  emoji: string;
  source: string;
  updatedAt: string;
};

type RateData = {
  currency: string;
  rate: number;
  date: string;
  change: number | null;
  source: string;
};

type RatesData = {
  rates: RateData[];
  updatedAt: string;
};

type HolidayData = {
  date: string;
  localName: string;
  name: string;
  daysUntil: number;
};

type HolidaysData = {
  countryCode: string;
  year: number;
  holidays: HolidayData[];
  nextInDays: number | null;
  source: string;
  updatedAt: string;
};

type NowData = {
  dateTime: string;
  dayOfWeek: string;
  timestamp: string;
  updatedAt: string;
};

type DashboardData = {
  now: NowData;
  weather: SafeResult<WeatherData>;
  rates: SafeResult<RatesData>;
  holidays: SafeResult<HolidaysData>;
};

const quickActions = [
  { href: "/travel", label: "Zaplanuj podróż", emoji: "🌍" },
  { href: "/react", label: "Agent ReAct", emoji: "🔄" },
  { href: "/chat", label: "Chat z agentem", emoji: "💬" },
  { href: "/think", label: "Tryb myślenia", emoji: "🧠" },
  { href: "/generate", label: "Generator grafik", emoji: "🎨" },
  { href: "/fewshot", label: "Słownik AI", emoji: "📚" },
];

function formatUpdateTime(value?: string) {
  if (!value) {
    return "brak danych";
  }

  return new Intl.DateTimeFormat("pl-PL", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Warsaw",
  }).format(new Date(value));
}

function formatHolidayDate(value: string) {
  return new Intl.DateTimeFormat("pl-PL", {
    day: "numeric",
    month: "short",
    timeZone: "Europe/Warsaw",
  }).format(new Date(`${value}T00:00:00`));
}

function SkeletonLines({ count = 3 }: { count?: number }) {
  return (
    <div className="dashboard-skeleton" aria-label="Ładowanie">
      {Array.from({ length: count }).map((_, index) => (
        <span key={index} />
      ))}
    </div>
  );
}

function ChangeBadge({ change }: { change: number | null }) {
  if (change == null || change === 0) {
    return <span className="rate-change rate-change-flat">0.00</span>;
  }

  const isUp = change > 0;

  return (
    <span className={isUp ? "rate-change rate-change-up" : "rate-change rate-change-down"}>
      {isUp ? "↑" : "↓"} {Math.abs(change).toFixed(4)}
    </span>
  );
}

export default function DashboardClient() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshAll = useCallback(async () => {
    setIsRefreshing(true);

    try {
      const response = await fetch("/api/dashboard", { cache: "no-store" });
      const nextData = (await response.json()) as DashboardData;

      setData(nextData);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  const refreshSection = useCallback(async (section: "weather" | "rates" | "holidays") => {
    const response = await fetch(`/api/dashboard?section=${section}`, { cache: "no-store" });
    const nextData = (await response.json()) as Partial<DashboardData>;

    setData((current) => (current ? { ...current, ...nextData } : current));
  }, []);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    const weatherInterval = setInterval(() => {
      void refreshSection("weather");
    }, 15 * 60 * 1000);
    const ratesInterval = setInterval(() => {
      void refreshSection("rates");
    }, 60 * 60 * 1000);

    return () => {
      clearInterval(weatherInterval);
      clearInterval(ratesInterval);
    };
  }, [refreshSection]);

  const weather = data?.weather.data;
  const rates = data?.rates.data;
  const holidays = data?.holidays.data;

  return (
    <main className="dashboard-shell">
      <SiteNavigation />
      <section className="dashboard-panel" aria-label="Dashboard agenta">
        <header className="dashboard-hero">
          <div>
            <p>Centrum dowodzenia agenta</p>
            <h1>🌅 Dzień dobry!</h1>
            <span>
              Dziś: {data?.now.dateTime ?? "ładowanie aktualnej daty..."}
            </span>
          </div>
          <button
            aria-label="Odśwież dane"
            className="dashboard-refresh"
            disabled={isRefreshing}
            onClick={() => void refreshAll()}
            type="button"
          >
            🔄
          </button>
        </header>

        <div className="dashboard-grid">
          <article className="dashboard-card dashboard-card-weather">
            <div className="dashboard-card-title">
              <h2>🌤️ Pogoda</h2>
              <span>Ostatnia aktualizacja: {formatUpdateTime(weather?.updatedAt)}</span>
            </div>
            {isLoading ? (
              <SkeletonLines count={4} />
            ) : data?.weather.error ? (
              <p className="dashboard-error">{data.weather.error}</p>
            ) : weather ? (
              <div className="weather-card-body">
                <strong>{weather.city}</strong>
                <div>
                  <span>{weather.emoji}</span>
                  <b>{weather.temperature}°C</b>
                </div>
                <p>{weather.description}</p>
                <p>Wiatr: {weather.windSpeed} km/h</p>
                <p>Wilgotność: {weather.humidity}%</p>
              </div>
            ) : null}
          </article>

          <article className="dashboard-card dashboard-card-rates">
            <div className="dashboard-card-title">
              <h2>💶 Kursy walut</h2>
              <span>Ostatnia aktualizacja: {formatUpdateTime(rates?.updatedAt)}</span>
            </div>
            {isLoading ? (
              <SkeletonLines count={4} />
            ) : data?.rates.error ? (
              <p className="dashboard-error">{data.rates.error}</p>
            ) : rates ? (
              <div className="rates-list">
                {rates.rates.map((rate) => (
                  <div className="rate-row" key={rate.currency}>
                    <strong>{rate.currency}</strong>
                    <span>{rate.rate.toFixed(4)} PLN</span>
                    <ChangeBadge change={rate.change} />
                  </div>
                ))}
                <p>Kurs z: {rates.rates[0]?.date} (NBP)</p>
              </div>
            ) : null}
          </article>

          <article className="dashboard-card dashboard-card-holidays">
            <div className="dashboard-card-title">
              <h2>📅 Nadchodzące święta</h2>
              <span>Ostatnia aktualizacja: {formatUpdateTime(holidays?.updatedAt)}</span>
            </div>
            {isLoading ? (
              <SkeletonLines count={4} />
            ) : data?.holidays.error ? (
              <p className="dashboard-error">{data.holidays.error}</p>
            ) : holidays ? (
              <div className="holidays-list">
                {holidays.holidays.length > 0 ? (
                  holidays.holidays.map((holiday) => (
                    <div className="holiday-row" key={holiday.date}>
                      <strong>{formatHolidayDate(holiday.date)}</strong>
                      <span>{holiday.localName}</span>
                    </div>
                  ))
                ) : (
                  <p>Brak kolejnych świąt w {holidays.year} roku.</p>
                )}
                <p>
                  Następne za:{" "}
                  {holidays.nextInDays == null ? "brak danych" : `${holidays.nextInDays} dni`}
                </p>
              </div>
            ) : null}
          </article>

          <article className="dashboard-card dashboard-card-actions">
            <div className="dashboard-card-title">
              <h2>🤖 Szybkie akcje</h2>
              <span>Przejdź do narzędzia</span>
            </div>
            <div className="quick-action-grid">
              {quickActions.map((action) => (
                <Link href={action.href} key={action.href}>
                  <span aria-hidden="true">{action.emoji}</span>
                  {action.label}
                </Link>
              ))}
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}

