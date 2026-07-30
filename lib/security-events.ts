import type { SupabaseClient } from "@supabase/supabase-js";

export type SecurityEventType =
  | "prompt_injection"
  | "system_message"
  | "invalid_payload"
  | "request_too_large"
  | "rate_limit";

type SecurityEventInput = {
  type: SecurityEventType;
  reason: string;
  messagePreview?: string;
  endpoint?: string;
};

export async function recordSecurityEvent(
  supabase: SupabaseClient,
  event: SecurityEventInput,
) {
  const { error } = await supabase.rpc("log_security_event", {
    p_event_type: event.type,
    p_reason: event.reason.slice(0, 500),
    p_message_preview: (event.messagePreview ?? "").slice(0, 500),
    p_endpoint: (event.endpoint ?? "/api/chat").slice(0, 120),
  });

  if (error) {
    console.warn("Nie udało się zapisać zdarzenia bezpieczeństwa:", error.message);
  }
}
