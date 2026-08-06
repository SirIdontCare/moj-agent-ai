import { isSecurityAdmin } from "@/lib/admin-security";
import { authenticateRequest, unauthorizedResponse } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authenticateRequest(request);

  if (!auth) {
    return unauthorizedResponse();
  }

  return Response.json(
    { isAdmin: isSecurityAdmin(auth.user) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
