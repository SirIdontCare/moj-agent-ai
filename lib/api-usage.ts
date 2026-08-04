import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const configuredDailyLimit = Number(process.env.DAILY_API_TOKEN_LIMIT);

export const DAILY_API_TOKEN_LIMIT =
  Number.isFinite(configuredDailyLimit) && configuredDailyLimit > 0
    ? Math.floor(configuredDailyLimit)
    : 100_000;

export type DailyApiUsage = {
  allowed: boolean;
  usedTokens: number;
  remainingTokens: number;
  limitTokens: number;
  resetAt: string;
};

type ModelUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

function toTokenCount(value: number | string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
}

function getWarsawDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    timeZone: "Europe/Warsaw",
  }).formatToParts(date);

  return Object.fromEntries(parts.map((part) => [part.type, Number(part.value)]));
}

function getWarsawOffsetMs(date: Date) {
  const parts = getWarsawDateParts(date);
  const localTimeAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  return localTimeAsUtc - Math.floor(date.getTime() / 1000) * 1000;
}

function warsawMidnightToUtc(year: number, month: number, day: number) {
  const utcGuess = new Date(Date.UTC(year, month - 1, day));
  return new Date(utcGuess.getTime() - getWarsawOffsetMs(utcGuess));
}

function getWarsawDayWindow() {
  const now = new Date();
  const parts = getWarsawDateParts(now);

  return {
    start: warsawMidnightToUtc(parts.year, parts.month, parts.day),
    end: warsawMidnightToUtc(parts.year, parts.month, parts.day + 1),
  };
}

export async function getDailyApiUsage(
  userId: string,
): Promise<{ data: DailyApiUsage } | { error: string }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("[api-usage] Brakuje konfiguracji serwerowego sprawdzania limitu.");
    return {
      error: "Nie udało się sprawdzić dziennego limitu tokenów. Spróbuj ponownie za chwilę.",
    };
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  const window = getWarsawDayWindow();
  const { data, error } = await serviceClient
    .from("api_usage")
    .select("total_tokens")
    .eq("user_id", userId)
    .gte("created_at", window.start.toISOString())
    .lt("created_at", window.end.toISOString());

  if (error) {
    console.error("[api-usage] Nie udało się pobrać dziennego zużycia:", error.message);
    return {
      error: "Nie udało się sprawdzić dziennego limitu tokenów. Spróbuj ponownie za chwilę.",
    };
  }

  const usedTokens = (data ?? []).reduce(
    (sum, row) => sum + toTokenCount(row.total_tokens),
    0,
  );

  return {
    data: {
      allowed: usedTokens < DAILY_API_TOKEN_LIMIT,
      usedTokens,
      remainingTokens: Math.max(0, DAILY_API_TOKEN_LIMIT - usedTokens),
      limitTokens: DAILY_API_TOKEN_LIMIT,
      resetAt: window.end.toISOString(),
    },
  };
}

export async function recordApiUsage(
  supabase: SupabaseClient,
  userId: string,
  model: string,
  endpoint: string,
  usage: ModelUsage,
) {
  const inputTokens = toTokenCount(usage.inputTokens ?? 0);
  const outputTokens = toTokenCount(usage.outputTokens ?? 0);
  const totalTokens = toTokenCount(
    usage.totalTokens ?? inputTokens + outputTokens,
  );
  const { error } = await supabase.rpc("record_api_usage", {
    p_model: model,
    p_endpoint: endpoint,
    p_input_tokens: inputTokens,
    p_output_tokens: outputTokens,
    p_total_tokens: totalTokens,
  });

  if (!error) {
    return;
  }

  console.error("Nie udało się zapisać zużycia tokenów przez RPC:", error.message);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Brakuje konfiguracji zapasowego zapisu zużycia tokenów.");
    return;
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  const { error: fallbackError } = await serviceClient.from("api_usage").insert({
    user_id: userId,
    model,
    endpoint,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_tokens: totalTokens,
  });

  if (fallbackError) {
    console.error("Nie udało się zapisać zużycia tokenów:", fallbackError.message);
  }
}

export function dailyApiUsageHeaders(usage: DailyApiUsage) {
  return {
    "X-TokenLimit-Limit": String(usage.limitTokens),
    "X-TokenLimit-Remaining": String(usage.remainingTokens),
    "X-TokenLimit-Reset": String(
      Math.ceil(new Date(usage.resetAt).getTime() / 1000),
    ),
  };
}
