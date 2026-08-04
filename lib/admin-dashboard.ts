import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const PAGE_SIZE = 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const INPUT_PRICE_PER_MILLION_USD = 0.15;
const OUTPUT_PRICE_PER_MILLION_USD = 0.6;

type ConversationUserRow = {
  user_id: string;
};

type ConversationDateRow = {
  created_at: string;
};

type UsageRow = {
  endpoint: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  created_at: string;
};

type RecentConversationRow = {
  id: string;
  user_id: string;
  title: string | null;
  created_at: string;
  messages: Array<{ count: number }> | null;
};

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

function getWarsawDateKey(value: Date | string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Europe/Warsaw",
  }).formatToParts(typeof value === "string" ? new Date(value) : value);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${values.year}-${values.month}-${values.day}`;
}

function getLastSevenDays() {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(Date.now() - (6 - index) * DAY_MS);

    return {
      date: getWarsawDateKey(date),
      tokens: 0,
      conversations: 0,
    };
  });
}

async function fetchAllConversationUsers(supabase: SupabaseClient) {
  const rows: ConversationUserRow[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("conversations")
      .select("user_id")
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error("Nie udało się policzyć aktywnych użytkowników.");
    }

    const page = (data ?? []) as ConversationUserRow[];
    rows.push(...page);

    if (page.length < PAGE_SIZE) break;
  }

  return rows;
}

async function fetchRecentConversationDates(
  supabase: SupabaseClient,
  since: string,
) {
  const rows: ConversationDateRow[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("conversations")
      .select("created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error("Nie udało się pobrać trendu rozmów.");
    }

    const page = (data ?? []) as ConversationDateRow[];
    rows.push(...page);

    if (page.length < PAGE_SIZE) break;
  }

  return rows;
}

async function fetchRecentUsage(supabase: SupabaseClient, since: string) {
  const rows: UsageRow[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("api_usage")
      .select("endpoint, input_tokens, output_tokens, total_tokens, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error("Nie udało się pobrać danych o zużyciu tokenów.");
    }

    const page = (data ?? []) as UsageRow[];
    rows.push(...page);

    if (page.length < PAGE_SIZE) break;
  }

  return rows;
}

function normalizeEndpoint(value: string) {
  const endpoint = value.replace(/^\/api/, "") || "/chat";

  if (endpoint.startsWith("/chat")) return "/chat";
  if (endpoint.startsWith("/react")) return "/react";
  if (endpoint.startsWith("/report")) return "/report";
  if (endpoint.startsWith("/email-triage")) return "/email-triage";

  return "Inne";
}

export async function getAdminUsageDashboard() {
  const supabase = getServiceClient();
  const since = new Date(Date.now() - 7 * DAY_MS).toISOString();
  const [
    totalConversationsResult,
    conversationUsers,
    conversationDates,
    usageRows,
    recentConversationsResult,
  ] = await Promise.all([
    supabase.from("conversations").select("id", { count: "exact", head: true }),
    fetchAllConversationUsers(supabase),
    fetchRecentConversationDates(supabase, since),
    fetchRecentUsage(supabase, since),
    supabase
      .from("conversations")
      .select("id, user_id, title, created_at, messages(count)")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  if (totalConversationsResult.error) {
    throw new Error("Nie udało się policzyć rozmów.");
  }

  if (recentConversationsResult.error) {
    throw new Error("Nie udało się pobrać ostatnich rozmów.");
  }

  const recentConversations = (recentConversationsResult.data ?? []) as unknown as RecentConversationRow[];
  const recentUserIds = [...new Set(recentConversations.map((row) => row.user_id))];
  const identityResults = await Promise.all(
    recentUserIds.map(async (userId) => ({
      userId,
      result: await supabase.auth.admin.getUserById(userId),
    })),
  );
  const emails = new Map(
    identityResults.map(({ userId, result }) => [
      userId,
      result.data.user?.email ?? "Usunięty użytkownik",
    ]),
  );

  const daily = getLastSevenDays();
  const dailyByDate = new Map(daily.map((day) => [day.date, day]));

  for (const row of usageRows) {
    const day = dailyByDate.get(getWarsawDateKey(row.created_at));
    if (day) day.tokens += Number(row.total_tokens) || 0;
  }

  for (const row of conversationDates) {
    const day = dailyByDate.get(getWarsawDateKey(row.created_at));
    if (day) day.conversations += 1;
  }

  const todayKey = getWarsawDateKey(new Date());
  const todayUsage = usageRows.filter(
    (row) => getWarsawDateKey(row.created_at) === todayKey,
  );
  const tokensToday = todayUsage.reduce(
    (sum, row) => sum + (Number(row.total_tokens) || 0),
    0,
  );
  const inputTokensToday = todayUsage.reduce(
    (sum, row) => sum + (Number(row.input_tokens) || 0),
    0,
  );
  const outputTokensToday = todayUsage.reduce(
    (sum, row) => sum + (Number(row.output_tokens) || 0),
    0,
  );
  const costToday =
    (inputTokensToday / 1_000_000) * INPUT_PRICE_PER_MILLION_USD +
    (outputTokensToday / 1_000_000) * OUTPUT_PRICE_PER_MILLION_USD;
  const endpointTotals = new Map<string, number>([
    ["/chat", 0],
    ["/react", 0],
    ["/report", 0],
    ["/email-triage", 0],
  ]);

  for (const row of usageRows) {
    const endpoint = normalizeEndpoint(row.endpoint);
    endpointTotals.set(
      endpoint,
      (endpointTotals.get(endpoint) ?? 0) + (Number(row.total_tokens) || 0),
    );
  }

  return {
    generatedAt: new Date().toISOString(),
    stats: {
      users: new Set(conversationUsers.map((row) => row.user_id)).size,
      conversations: totalConversationsResult.count ?? 0,
      tokensToday,
      costToday,
    },
    pricing: {
      currency: "USD",
      inputPerMillion: INPUT_PRICE_PER_MILLION_USD,
      outputPerMillion: OUTPUT_PRICE_PER_MILLION_USD,
    },
    daily,
    endpoints: [...endpointTotals.entries()]
      .map(([endpoint, tokens]) => ({ endpoint, tokens }))
      .filter((item) => item.tokens > 0 || item.endpoint !== "Inne"),
    recentConversations: recentConversations.map((conversation) => ({
      id: conversation.id,
      email: emails.get(conversation.user_id) ?? "Nieznany użytkownik",
      title: conversation.title?.trim() || "Nowa rozmowa",
      createdAt: conversation.created_at,
      messageCount: conversation.messages?.[0]?.count ?? 0,
    })),
  };
}
