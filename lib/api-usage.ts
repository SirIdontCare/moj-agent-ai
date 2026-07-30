import type { SupabaseClient } from "@supabase/supabase-js";

export const DAILY_API_TOKEN_LIMIT = 10_000;

type DailyApiUsageRpcRow = {
  allowed: boolean;
  used_tokens: number | string;
  remaining_tokens: number | string;
  limit_tokens: number | string;
  reset_at: string;
};

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

export async function getDailyApiUsage(
  supabase: SupabaseClient,
): Promise<{ data: DailyApiUsage } | { error: string }> {
  const { data, error } = await supabase.rpc("get_daily_api_usage");
  const row = Array.isArray(data)
    ? (data[0] as DailyApiUsageRpcRow | undefined)
    : undefined;

  if (error || !row || typeof row.allowed !== "boolean" || !row.reset_at) {
    return {
      error: "Nie udało się sprawdzić dziennego limitu tokenów. Spróbuj ponownie za chwilę.",
    };
  }

  return {
    data: {
      allowed: row.allowed,
      usedTokens: toTokenCount(row.used_tokens),
      remainingTokens: toTokenCount(row.remaining_tokens),
      limitTokens: toTokenCount(row.limit_tokens),
      resetAt: row.reset_at,
    },
  };
}

export async function recordApiUsage(
  supabase: SupabaseClient,
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

  if (error) {
    console.error("Nie udało się zapisać zużycia tokenów:", error.message);
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
