import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Brakuje konfiguracji Supabase w pliku .env.local.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function getAuthHeaders() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Sesja wygasła. Zaloguj się ponownie.");
  }

  return {
    Authorization: `Bearer ${session.access_token}`,
  };
}

export async function authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const authHeaders = await getAuthHeaders();
  const headers = new Headers(init.headers);
  headers.set("Authorization", authHeaders.Authorization);

  return fetch(input, { ...init, headers });
}
