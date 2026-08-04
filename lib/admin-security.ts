import { createClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import { DAILY_API_TOKEN_LIMIT } from "@/lib/api-usage";

const DAILY_TOKEN_LIMIT = DAILY_API_TOKEN_LIMIT;

type SecurityEventRow = {
  id: number;
  user_id: string;
  event_type: string;
  reason: string;
  message_preview: string;
  endpoint: string;
  created_at: string;
};

type UsageRow = {
  user_id: string;
  total_tokens: number;
  created_at: string;
};

type UserIdentity = {
  email: string;
  name: string;
};

export type SecurityAlert = {
  id: string;
  level: "critical" | "warning" | "info" | "success";
  title: string;
  description: string;
};

function getAdminEmails() {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLocaleLowerCase("pl-PL"))
      .filter(Boolean),
  );
}

export function isSecurityAdmin(user: User) {
  const role = user.app_metadata?.role;
  const email = user.email?.toLocaleLowerCase("pl-PL") ?? "";

  return role === "admin" || (Boolean(email) && getAdminEmails().has(email));
}

function getServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Brakuje konfiguracji panelu administratora. Uzupełnij SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function buildAlerts(
  events: SecurityEventRow[],
  topUsers: Array<{ tokens: number; label: string }>,
) {
  const alerts: SecurityAlert[] = [];
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  const recentInjections = events.filter(
    (event) =>
      event.event_type === "prompt_injection" &&
      new Date(event.created_at).getTime() >= oneHourAgo,
  );
  const rateLimitEvents = events.filter((event) => event.event_type === "rate_limit");
  const highUsageUsers = topUsers.filter(
    (user) => user.tokens >= DAILY_TOKEN_LIMIT * 0.8,
  );

  if (recentInjections.length >= 3) {
    alerts.push({
      id: "prompt-injection-spike",
      level: "critical",
      title: "Wzrost prób prompt injection",
      description: `${recentInjections.length} prób w ostatniej godzinie. Sprawdź najnowsze wpisy w logu.`,
    });
  } else if (recentInjections.length > 0) {
    alerts.push({
      id: "prompt-injection-detected",
      level: "warning",
      title: "Wykryto próbę prompt injection",
      description: `${recentInjections.length} ${recentInjections.length === 1 ? "zdarzenie" : "zdarzenia"} w ostatniej godzinie.`,
    });
  }

  if (highUsageUsers.length > 0) {
    alerts.push({
      id: "high-token-usage",
      level: "warning",
      title: "Użytkownicy blisko limitu tokenów",
      description: `${highUsageUsers.length} ${highUsageUsers.length === 1 ? "użytkownik przekroczył" : "użytkowników przekroczyło"} 80% dziennego limitu.`,
    });
  }

  if (rateLimitEvents.length > 0) {
    alerts.push({
      id: "rate-limit-blocks",
      level: "info",
      title: "Aktywne blokady limitu",
      description: `${rateLimitEvents.length} zablokowanych żądań w ostatnich 24 godzinach.`,
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      id: "all-clear",
      level: "success",
      title: "Brak aktywnych zagrożeń",
      description: "W ostatnich 24 godzinach nie wykryto zdarzeń wymagających uwagi.",
    });
  }

  return alerts;
}

export async function getSecurityDashboard() {
  const supabase = getServiceClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [eventsResult, usageResult, usersResult] = await Promise.all([
    supabase
      .from("security_events")
      .select("id, user_id, event_type, reason, message_preview, endpoint, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("api_usage")
      .select("user_id, total_tokens, created_at")
      .gte("created_at", since),
    supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);

  if (eventsResult.error) {
    const missingTable =
      eventsResult.error.code === "42P01" || eventsResult.error.code === "PGRST205";

    throw new Error(
      missingTable
        ? "Brakuje tabeli security_events. Zastosuj migrację 20260730_admin_security.sql."
        : "Nie udało się pobrać logów bezpieczeństwa.",
    );
  }

  if (usageResult.error) {
    throw new Error("Nie udało się pobrać danych o zużyciu tokenów.");
  }

  const identities = new Map<string, UserIdentity>();

  for (const user of usersResult.data?.users ?? []) {
    const name =
      typeof user.user_metadata?.display_name === "string"
        ? user.user_metadata.display_name.trim()
        : "";

    identities.set(user.id, {
      email: user.email ?? "",
      name,
    });
  }

  const usageByUser = new Map<string, number>();

  for (const row of (usageResult.data ?? []) as UsageRow[]) {
    usageByUser.set(
      row.user_id,
      (usageByUser.get(row.user_id) ?? 0) + Number(row.total_tokens),
    );
  }

  const topUsers = [...usageByUser.entries()]
    .map(([userId, tokens]) => {
      const identity = identities.get(userId);
      const label = identity?.name || identity?.email || `Użytkownik ${userId.slice(0, 8)}`;

      return {
        userId,
        label,
        email: identity?.email ?? "",
        tokens,
        percentOfLimit: Math.min(
          100,
          Math.round((tokens / DAILY_TOKEN_LIMIT) * 100),
        ),
      };
    })
    .sort((a, b) => b.tokens - a.tokens)
    .slice(0, 5);

  const events = ((eventsResult.data ?? []) as SecurityEventRow[]).map((event) => {
    const identity = identities.get(event.user_id);

    return {
      id: event.id,
      userId: event.user_id,
      userLabel:
        identity?.name ||
        identity?.email ||
        `Użytkownik ${event.user_id.slice(0, 8)}`,
      type: event.event_type,
      reason: event.reason,
      messagePreview: event.message_preview,
      endpoint: event.endpoint,
      createdAt: event.created_at,
    };
  });
  const alerts = buildAlerts(eventsResult.data as SecurityEventRow[], topUsers);

  return {
    generatedAt: new Date().toISOString(),
    windowHours: 24,
    stats: {
      suspiciousMessages: events.filter(
        (event) =>
          event.type === "prompt_injection" || event.type === "system_message",
      ).length,
      blockedRequests: events.filter(
        (event) =>
          event.type === "rate_limit" ||
          event.type === "invalid_payload" ||
          event.type === "request_too_large",
      ).length,
      tokensUsed: [...usageByUser.values()].reduce((sum, tokens) => sum + tokens, 0),
      activeAlerts: alerts.filter(
        (alert) => alert.level === "critical" || alert.level === "warning",
      ).length,
    },
    alerts,
    topUsers,
    events,
  };
}
