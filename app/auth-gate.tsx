"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isReady, setIsReady] = useState(pathname === "/login");

  useEffect(() => {
    let isMounted = true;

    if (pathname === "/login") {
      setIsReady(true);
      return;
    }

    setIsReady(false);

    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (!isMounted) return;

      if (!user) {
        const redirect = encodeURIComponent(pathname || "/");
        router.replace(`/login?redirect=${redirect}`);
        return;
      }

      setIsReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user && pathname !== "/login") {
        router.replace("/login");
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [pathname, router]);

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
