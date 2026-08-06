"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { authenticatedFetch, supabase } from "@/lib/supabase";

const adminOnlyPrefixes = [
  "/admin",
  "/agent",
  "/briefings",
  "/competitor",
  "/dashboard",
  "/email-triage",
  "/extract",
  "/fewshot",
  "/format",
  "/generate",
  "/knowledge",
  "/meal-planner",
  "/react",
  "/report",
  "/reports",
  "/search",
  "/think",
  "/travel",
  "/upload",
  "/vision",
];

function requiresAdmin(pathname: string) {
  return adminOnlyPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isPublicPage = pathname === "/" || pathname === "/login";
  const [isReady, setIsReady] = useState(isPublicPage);

  useEffect(() => {
    let isMounted = true;

    if (isPublicPage) {
      setIsReady(true);
      return;
    }

    setIsReady(false);

    void supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!isMounted) return;

      if (!user) {
        const redirect = encodeURIComponent(pathname || "/");
        router.replace(`/login?redirect=${redirect}`);
        return;
      }

      if (requiresAdmin(pathname)) {
        try {
          const response = await authenticatedFetch("/api/admin/me");
          const result = response.ok
            ? await response.json() as { isAdmin?: boolean }
            : null;

          if (!result?.isAdmin) {
            router.replace("/chat");
            return;
          }
        } catch {
          router.replace("/chat");
          return;
        }
      }

      if (isMounted) {
        setIsReady(true);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user && !isPublicPage) {
        router.replace("/login");
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [isPublicPage, pathname, router]);

  if (!isReady) {
    return (
      <main className="auth-loading" role="status">
        <div className="auth-spinner" />
        <p>Sprawdzam sesję...</p>
      </main>
    );
  }

  return children;
}
