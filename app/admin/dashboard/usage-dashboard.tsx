"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import SiteNavigation from "../../site-navigation";
import { authenticatedFetch } from "@/lib/supabase";

type DailyPoint = {
  date: string;
  tokens: number;
  conversations: number;
};

type EndpointPoint = {
  endpoint: string;
  tokens: number;
};

type RecentConversation = {
  id: string;
  email: string;
  title: string;
  createdAt: string;
  messageCount: number;
};

type DashboardData = {
  generatedAt: string;
  stats: {
    users: number;
    conversations: number;
    tokensToday: number;
    costToday: number;
  };
  pricing: {
    currency: string;
    inputPerMillion: number;
    outputPerMillion: number;
  };
  daily: DailyPoint[];
  endpoints: EndpointPoint[];
  recentConversations: RecentConversation[];
};

const endpointColors: Record<string, string> = {
  "/chat": "#8b7cf6",
  "/react": "#55c9a5",
  "/report": "#efae63",
  "/email-triage": "#5ca8ed",
  Inne: "#777382",
};

const tooltipStyle = {
  background: "#171720",
  border: "1px solid #30303b",
  borderRadius: "10px",
  color: "#f4f2f7",
  fontSize: "12px",
  boxShadow: "0 16px 38px rgba(0,0,0,.32)",
};

function formatCompact(value: number) {
  return new Intl.NumberFormat("pl-PL", {
    notation: value >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatCost(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value < 0.01 ? 4 : 2,
    maximumFractionDigits: value < 0.01 ? 4 : 2,
  }).format(value);
}

function formatChartDate(value: string) {
  return new Intl.DateTimeFormat("pl-PL", {
    day: "2-digit",
    month: "short",
    timeZone: "Europe/Warsaw",
  }).format(new Date(`${value}T12:00:00Z`));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pl-PL", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Warsaw",
  }).format(new Date(value));
}

function getInitials(email: string) {
  const name = email.split("@")[0] || "U";
  const parts = name.split(/[._-]/).filter(Boolean);

  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "U";
}

function getTrend(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / previous) * 100);
}

function LoadingState() {
  return (
    <div className="usage-dashboard-loading" role="status" aria-label="Ładowanie statystyk">
      <div className="usage-loading-stats"><span /><span /><span /><span /></div>
      <div className="usage-loading-charts"><span /><span /></div>
    </div>
  );
}

export default function UsageDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadDashboard = useCallback(async (refresh = false) => {
    if (refresh) setIsRefreshing(true);

    try {
      const response = await authenticatedFetch("/api/admin/dashboard", {
        cache: "no-store",
      });
      const payload = (await response.json()) as DashboardData & { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Nie udało się pobrać statystyk.");
      }

      setData(payload);
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Nie udało się pobrać statystyk.",
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const chartData = useMemo(
    () => data?.daily.map((point) => ({ ...point, label: formatChartDate(point.date) })) ?? [],
    [data],
  );
  const today = data?.daily.at(-1);
  const yesterday = data?.daily.at(-2);
  const tokenTrend = getTrend(today?.tokens ?? 0, yesterday?.tokens ?? 0);
  const conversationTrend = getTrend(
    today?.conversations ?? 0,
    yesterday?.conversations ?? 0,
  );
  const endpointTotal = data?.endpoints.reduce((sum, item) => sum + item.tokens, 0) ?? 0;

  return (
    <main className="usage-dashboard-shell">
      <SiteNavigation />
      <section className="usage-dashboard-panel" aria-labelledby="usage-dashboard-title">
        <header className="usage-dashboard-hero">
          <div>
            <p>PANEL ADMINISTRATORA</p>
            <h1 id="usage-dashboard-title">Dashboard użycia</h1>
            <span>Ruch, wykorzystanie AI i koszt operacyjny w jednym miejscu.</span>
          </div>
          <div className="usage-dashboard-actions">
            {data ? <small>Aktualizacja {formatDateTime(data.generatedAt)}</small> : null}
            <button
              disabled={isRefreshing}
              onClick={() => void loadDashboard(true)}
              type="button"
            >
              {isRefreshing ? "Odświeżam…" : "↻ Odśwież dane"}
            </button>
          </div>
        </header>

        {error ? (
          <section className="usage-dashboard-error" role="alert">
            <span aria-hidden="true">!</span>
            <div><strong>Nie udało się otworzyć dashboardu</strong><p>{error}</p></div>
          </section>
        ) : null}

        {isLoading ? (
          <LoadingState />
        ) : data ? (
          <>
            <section className="usage-stat-grid" aria-label="Najważniejsze statystyki">
              <article className="usage-stat-card usage-stat-users">
                <div className="usage-stat-heading"><span>◎</span><small>UŻYTKOWNICY</small></div>
                <strong>{data.stats.users.toLocaleString("pl-PL")}</strong>
                <p>z co najmniej jedną rozmową</p>
              </article>
              <article className="usage-stat-card usage-stat-conversations">
                <div className="usage-stat-heading"><span>◌</span><small>ROZMOWY</small></div>
                <strong>{data.stats.conversations.toLocaleString("pl-PL")}</strong>
                <p><i className={conversationTrend < 0 ? "usage-trend-down" : ""}>{conversationTrend >= 0 ? "↗" : "↘"} {Math.abs(conversationTrend)}%</i> względem wczoraj</p>
              </article>
              <article className="usage-stat-card usage-stat-tokens">
                <div className="usage-stat-heading"><span>T</span><small>TOKENY DZISIAJ</small></div>
                <strong>{data.stats.tokensToday.toLocaleString("pl-PL")}</strong>
                <p><i className={tokenTrend < 0 ? "usage-trend-down" : ""}>{tokenTrend >= 0 ? "↗" : "↘"} {Math.abs(tokenTrend)}%</i> względem wczoraj</p>
              </article>
              <article className="usage-stat-card usage-stat-cost">
                <div className="usage-stat-heading"><span>$</span><small>KOSZT DZISIAJ</small></div>
                <strong>{formatCost(data.stats.costToday)}</strong>
                <p>szacowany koszt modeli AI</p>
              </article>
            </section>

            <section className="usage-chart-grid">
              <article className="usage-chart-card">
                <div className="usage-card-heading">
                  <div><p>OSTATNIE 7 DNI</p><h2>Zużycie tokenów</h2></div>
                  <span className="usage-legend-dot usage-legend-violet">Tokeny</span>
                </div>
                <div className="usage-chart" aria-label="Wykres tokenów w ostatnich siedmiu dniach">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 12, right: 8, left: -16, bottom: 0 }}>
                      <CartesianGrid stroke="#262630" strokeDasharray="3 5" vertical={false} />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#777382", fontSize: 11 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: "#777382", fontSize: 11 }} tickFormatter={formatCompact} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(value) => [Number(value).toLocaleString("pl-PL"), "Tokeny"]} />
                      <Line type="monotone" dataKey="tokens" stroke="#8b7cf6" strokeWidth={3} dot={{ r: 3, fill: "#8b7cf6", stroke: "#191821", strokeWidth: 2 }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </article>

              <article className="usage-chart-card">
                <div className="usage-card-heading">
                  <div><p>AKTYWNOŚĆ</p><h2>Rozmowy per dzień</h2></div>
                  <span className="usage-legend-dot usage-legend-mint">Rozmowy</span>
                </div>
                <div className="usage-chart" aria-label="Wykres rozmów w ostatnich siedmiu dniach">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 12, right: 8, left: -22, bottom: 0 }}>
                      <CartesianGrid stroke="#262630" strokeDasharray="3 5" vertical={false} />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#777382", fontSize: 11 }} />
                      <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "#777382", fontSize: 11 }} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(value) => [Number(value), "Aktywne rozmowy"]} cursor={{ fill: "rgba(255,255,255,.03)" }} />
                      <Bar dataKey="conversations" fill="#55c9a5" radius={[5, 5, 1, 1]} maxBarSize={38} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </article>
            </section>

            <section className="usage-detail-grid">
              <article className="usage-chart-card usage-endpoint-card">
                <div className="usage-card-heading">
                  <div><p>STRUKTURA RUCHU</p><h2>Tokeny per endpoint</h2></div>
                  <small>7 dni</small>
                </div>
                <div className="usage-endpoint-content">
                  <div className="usage-donut" aria-label="Udział tokenów według endpointu">
                    {endpointTotal > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={data.endpoints} dataKey="tokens" nameKey="endpoint" innerRadius="66%" outerRadius="92%" paddingAngle={3} stroke="none">
                            {data.endpoints.map((item) => <Cell fill={endpointColors[item.endpoint] ?? endpointColors.Inne} key={item.endpoint} />)}
                          </Pie>
                          <Tooltip contentStyle={tooltipStyle} formatter={(value) => [Number(value).toLocaleString("pl-PL"), "Tokeny"]} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : <div className="usage-donut-empty">Brak danych</div>}
                    <div className="usage-donut-total"><strong>{formatCompact(endpointTotal)}</strong><small>tokenów</small></div>
                  </div>
                  <div className="usage-endpoint-list">
                    {data.endpoints.map((item) => {
                      const percent = endpointTotal ? Math.round((item.tokens / endpointTotal) * 100) : 0;
                      return (
                        <div key={item.endpoint}>
                          <span style={{ backgroundColor: endpointColors[item.endpoint] ?? endpointColors.Inne }} />
                          <strong>{item.endpoint}</strong>
                          <small>{item.tokens.toLocaleString("pl-PL")}</small>
                          <b>{percent}%</b>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <p className="usage-pricing-note">Szacunek kosztu: ${data.pricing.inputPerMillion}/1M tokenów wejścia i ${data.pricing.outputPerMillion}/1M tokenów wyjścia.</p>
              </article>

              <article className="usage-recent-card">
                <div className="usage-card-heading">
                  <div><p>NAJNOWSZA AKTYWNOŚĆ</p><h2>Ostatnie rozmowy</h2></div>
                  <span>{data.recentConversations.length} wpisów</span>
                </div>
                <div className="usage-table-wrap">
                  <table className="usage-table">
                    <thead><tr><th>Użytkownik</th><th>Tytuł</th><th>Wiadomości</th><th>Ostatnia aktywność</th></tr></thead>
                    <tbody>
                      {data.recentConversations.map((conversation) => (
                        <tr key={conversation.id}>
                          <td><span className="usage-user-avatar">{getInitials(conversation.email)}</span><span>{conversation.email}</span></td>
                          <td title={conversation.title}>{conversation.title}</td>
                          <td><span className="usage-message-count">◌ {conversation.messageCount}</span></td>
                          <td>{formatDateTime(conversation.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {data.recentConversations.length === 0 ? <p className="usage-empty-table">Nie ma jeszcze zapisanych rozmów.</p> : null}
                </div>
              </article>
            </section>
          </>
        ) : null}
      </section>
    </main>
  );
}
