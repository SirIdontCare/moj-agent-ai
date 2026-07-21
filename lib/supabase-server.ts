import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Brakuje konfiguracji Supabase w pliku .env.local.");
}

export type AuthenticatedSupabase = {
  supabase: SupabaseClient;
  user: User;
};

export async function authenticateRequest(request: Request): Promise<AuthenticatedSupabase | null> {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";

  if (!token) {
    return null;
  }

  const supabase = createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  return error || !user ? null : { supabase, user };
}

export function unauthorizedResponse() {
  return Response.json({ error: "Zaloguj się, aby wykonać tę operację." }, { status: 401 });
}
