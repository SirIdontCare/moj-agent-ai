"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import SiteNavigation from "../../site-navigation";
import { authenticatedFetch } from "@/lib/supabase";

type Alert = {
  id: string;
  level: "critical" | "warning" | "info" | "success";
  title: string;
  description: string;
};

type TopUser = {
  userId: string;
  label: string;
  email: string;
  tokens: number;
  percentOfLimit: number;
};

type SecurityEvent = {
  id: number;
  userLabel: string;
  type: string;
  reason: string;
  messagePreview: string;
  endpoint: string;
  createdAt: string;
};

type DashboardData = {
  generatedAt: string;
  windowHours: number;
  stats: {
    suspiciousMessages: number;
    blockedRequests: number;
    tokensUsed: number;
    activeAlerts: number;
  };
  alerts: Alert[];
  topUsers: TopUser[];
  events: SecurityEvent[];
};

const eventLabels: Record<string, { label: string; tone: string }> = {
  prompt_injection: { label: "Prompt injection", tone: "danger" },
  system_message: { label: "Wiadomość systemowa", tone: "danger" },
  request_too_large: { label: "Za duże żądanie", tone: "warning" },
  invalid_payload: { label: "Błędny payload", tone: "warning" },
  rate_limit: { label: "Limit żądań", tone: "info" },
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pl-PL", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Warsaw",
  }).format(new Date(value));
}

function LoadingState() {
  return (
    <div className="security-loading" role="status" aria-label="Ładowanie danych">
      <span />
      <span />
      <span />
    </div>
  );
}

export default function SecurityDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState("all");

  const loadDashboard = useCallback(async (refresh = false) => {
    if (refresh) setIsRefreshing(true);

    try {
      const response = await authenticatedFetch("/api/admin/security", {
        cache: "no-store",
      });
      const payload = (await response.json()) as DashboardData & { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Nie udało się pobrać danych.");
      }

      setData(payload);
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Nie udało się pobrać danych.",
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const visibleEvents = useMemo(() => {
    if (!data || filter === "all") return data?.events ?? [];
    if (filter === "suspicious") {
      return data.events.filter(
        (event) =>
          event.type === "prompt_injection" || event.type === "system_message",
      );
    }
    return data.events.filter((event) => event.type === filter);
  }, [data, filter]);

  return (
    <main className="security-shell">
      <SiteNavigation />
      <section className="security-panel" aria-labelledby="security-title">
        <header className="security-hero">
          <div className="security-hero-copy">
            <p>PANEL ADMINISTRATORA</p>
            <h1 id="security-title">Centrum bezpieczeństwa</h1>
            <span>
              Monitoring zagrożeń, limitów i wykorzystania AI z ostatnich 24 godzin.
            </span>
          </div>
          <div className="security-status">
            <span aria-hidden="true" />
            Monitoring aktywny
          </div>
          <button
            className="security-refresh"
            disabled={isRefreshing}
            onClick={() => void loadDashboard(true)}
            type="button"
          >
            {isRefreshing ? "Odświeżam…" : "↻ Odśwież dane"}
          </button>
        </header>

        {error ? (
          <section className="security-access-error" role="alert">
            <span aria-hidden="true">!</span>
            <div>
              <strong>Panel nie jest dostępny</strong>
              <p>{error}</p>
            </div>
          </section>
        ) : null}

        {isLoading ? (
          <LoadingState />
        ) : data ? (
          <>
            <section className="security-stats" aria-label="Podsumowanie bezpieczeństwa">
              <article>
                <span className="security-stat-icon security-stat-icon-red">!</span>
                <div>
                  <small>Podejrzane wiadomości</small>
                  <strong>{data.stats.suspiciousMessages}</strong>
                  <em>ostatnie {data.windowHours}h</em>
                </div>
              </article>
              <article>
                <span className="security-stat-icon security-stat-icon-amber">×</span>
                <div>
                  <small>Zablokowane żądania</small>
                  <strong>{data.stats.blockedRequests}</strong>
                  <em>ochrona aktywna</em>
                </div>
              </article>
              <article>
                <span className="security-stat-icon security-stat-icon-blue">T</span>
                <div>
                  <small>Zużyte tokeny</small>
                  <strong>{data.stats.tokensUsed.toLocaleString("pl-PL")}</strong>
                  <em>ostatnie {data.windowHours}h</em>
                </div>
              </article>
              <article>
                <span className="security-stat-icon security-stat-icon-violet">◆</span>
                <div>
                  <small>Aktywne alerty</small>
                  <strong>{data.stats.activeAlerts}</strong>
                  <em>wymagają uwagi</em>
                </div>
              </article>
            </section>

            <section className="security-grid">
              <article className="security-card security-alerts-card">
                <div className="security-card-heading">
                  <div>
                    <p>SYGNAŁY</p>
                    <h2>Alerty</h2>
                  </div>
                  <span>{data.alerts.length}</span>
                </div>
                <div className="security-alert-list">
                  {data.alerts.map((alert) => (
                    <div
                      className={`security-alert security-alert-${alert.level}`}
                      key={alert.id}
                    >
                      <span aria-hidden="true">
                        {alert.level === "critical"
                          ? "!"
                          : alert.level === "warning"
                            ? "▲"
                            : alert.level === "success"
                              ? "✓"
                              : "i"}
                      </span>
                      <div>
                        <strong>{alert.title}</strong>
                        <p>{alert.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </article>

              <article className="security-card security-users-card">
                <div className="security-card-heading">
                  <div>
                    <p>WYKORZYSTANIE</p>
                    <h2>Top 5 użytkowników</h2>
                  </div>
                  <small>tokeny / 24h</small>
                </div>
                {data.topUsers.length ? (
                  <ol className="security-user-list">
                    {data.topUsers.map((user, index) => (
                      <li key={user.userId}>
                        <span className="security-user-rank">{index + 1}</span>
                        <div className="security-user-details">
                          <div>
                            <strong>{user.label}</strong>
                            <span>{user.tokens.toLocaleString("pl-PL")} tokenów</span>
                          </div>
                          <div className="security-usage-track" aria-hidden="true">
                            <span style={{ width: `${user.percentOfLimit}%` }} />
                          </div>
                        </div>
                        <b>{user.percentOfLimit}%</b>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="security-empty">Brak zarejestrowanego zużycia.</p>
                )}
              </article>
            </section>

            <section className="security-card security-log-card">
              <div className="security-log-header">
                <div className="security-card-heading">
                  <div>
                    <p>DZIENNIK ZDARZEŃ</p>
                    <h2>Podejrzane wiadomości i blokady</h2>
                  </div>
                </div>
                <div className="security-filters" aria-label="Filtry logów">
                  {[
                    ["all", "Wszystkie"],
                    ["suspicious", "Podejrzane"],
                    ["rate_limit", "Limity"],
                  ].map(([value, label]) => (
                    <button
                      aria-pressed={filter === value}
                      className={filter === value ? "is-active" : ""}
                      key={value}
                      onClick={() => setFilter(value)}
                      type="button"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {visibleEvents.length ? (
                <div className="security-table-wrap">
                  <table className="security-table">
                    <thead>
                      <tr>
                        <th>Czas</th>
                        <th>Użytkownik</th>
                        <th>Typ</th>
                        <th>Treść / powód</th>
                        <th>Endpoint</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleEvents.map((event) => {
                        const eventMeta = eventLabels[event.type] ?? {
                          label: event.type,
                          tone: "info",
                        };

                        return (
                          <tr key={event.id}>
                            <td data-label="Czas">{formatDate(event.createdAt)}</td>
                            <td data-label="Użytkownik">
                              <strong>{event.userLabel}</strong>
                            </td>
                            <td data-label="Typ">
                              <span className={`security-event-badge ${eventMeta.tone}`}>
                                {eventMeta.label}
                              </span>
                            </td>
                            <td data-label="Treść / powód">
                              <span className="security-message-preview">
                                {event.messagePreview || event.reason}
                              </span>
                              {event.messagePreview ? <small>{event.reason}</small> : null}
                            </td>
                            <td data-label="Endpoint">
                              <code>{event.endpoint}</code>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="security-empty security-empty-log">
                  <span aria-hidden="true">✓</span>
                  <strong>Brak zdarzeń dla wybranego filtra</strong>
                  <p>Ochrona działa, a dziennik jest czysty.</p>
                </div>
              )}
            </section>

            <p className="security-updated">
              Ostatnia aktualizacja: {formatDate(data.generatedAt)}
            </p>
          </>
        ) : null}
      </section>
    </main>
  );
}
