"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const navigationItems = [
  { href: "/", label: "Dashboard", emoji: "🏠" },
  { href: "/email-triage", label: "E-mail Triage", emoji: "📧" },
  { href: "/report", label: "Raporty", emoji: "📊" },
  { href: "/reports", label: "Zapisane raporty", emoji: "🗂️" },
  { href: "/competitor", label: "Konkurencja", emoji: "🏢" },
  { href: "/meal-planner", label: "Posiłki", emoji: "🍽️" },
  { href: "/travel", label: "Podróże", emoji: "✈️" },
  { href: "/react", label: "ReAct", emoji: "🔄" },
  { href: "/agent", label: "Agent", emoji: "🤖" },
  { href: "/chat", label: "Chat", emoji: "💬" },
  { href: "/history", label: "Historia", emoji: "📜" },
  { href: "/think", label: "Myślenie", emoji: "🧠" },
  { href: "/fewshot", label: "Słownik AI", emoji: "📚" },
  { href: "/upload", label: "Baza wiedzy", emoji: "📚" },
  { href: "/knowledge", label: "Podgląd wiedzy", emoji: "🔎" },
  { href: "/format", label: "Formatowanie", emoji: "📐" },
  { href: "/search", label: "Szukaj", emoji: "🌐" },
  { href: "/generate", label: "Grafiki", emoji: "🎨" },
  { href: "/vision", label: "Vision", emoji: "👁️" },
  { href: "/extract", label: "Analizator", emoji: "📊" },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/" || pathname === "/dashboard";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function SiteNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState("");

  useEffect(() => {
    void supabase.auth.getUser().then(({ data: { user } }) => setEmail(user?.email ?? ""));
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <>
      <header className="mobile-nav">
        <Link className="mobile-nav-brand" href="/">
          🏠 Agent AI
        </Link>
        <button
          aria-expanded={isOpen}
          aria-label="Otwórz nawigację"
          onClick={() => setIsOpen((current) => !current)}
          type="button"
        >
          ☰
        </button>
      </header>
      <aside className={`app-sidebar ${isOpen ? "app-sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <span>⚡</span>
          <div>
            <strong>Agent AI</strong>
            <small>Centrum dowodzenia</small>
          </div>
        </div>
        <nav className="sidebar-nav" aria-label="Nawigacja główna">
          {navigationItems.map((item) => {
            const isActive = isActivePath(pathname, item.href);

            return (
              <Link
                className={isActive ? "sidebar-link sidebar-link-active" : "sidebar-link"}
                href={item.href}
                key={item.href}
                onClick={() => setIsOpen(false)}
              >
                <span aria-hidden="true">{item.emoji}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-account">
          {email ? <small title={email}>{email}</small> : null}
          <button onClick={() => void handleSignOut()} type="button">
            ↪ Wyloguj
          </button>
        </div>
      </aside>
      {isOpen ? (
        <button
          aria-label="Zamknij nawigację"
          className="sidebar-backdrop"
          onClick={() => setIsOpen(false)}
          type="button"
        />
      ) : null}
    </>
  );
}
