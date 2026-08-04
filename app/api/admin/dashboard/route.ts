import { getAdminUsageDashboard } from "@/lib/admin-dashboard";
import { isSecurityAdmin } from "@/lib/admin-security";
import {
  authenticateRequest,
  unauthorizedResponse,
} from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authenticateRequest(request);

  if (!auth) {
    return unauthorizedResponse();
  }

  if (!isSecurityAdmin(auth.user)) {
    return Response.json(
      { error: "Nie masz uprawnień administratora do tego panelu." },
      { status: 403 },
    );
  }

  try {
    return Response.json(await getAdminUsageDashboard(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Nie udało się pobrać danych użycia.";

    console.error("[api/admin/dashboard]", message);

    return Response.json({ error: message }, { status: 500 });
  }
}
