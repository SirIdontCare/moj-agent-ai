"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { authenticatedFetch, supabase } from "@/lib/supabase";
import ThemeToggle from "./theme-toggle";
import PwaInstallCard from "./pwa-install";

const userNavigationGroups: Array<{
  label: string;
  items: Array<{ href: string; label: string; icon: string }>;
}> = [];

const adminNavigationGroup = {
  label: "Administracja",
  items: [
    { href: "/admin/test", label: "Panel testowy", icon: "⌘" },
    { href: "/admin/dashboard", label: "Użycie i koszty", icon: "↗" },
    { href: "/admin/security", label: "Bezpieczeństwo", icon: "◇" },
  ],
};

type RecentConversation = {
  id: string;
  title: string | null;
  updated_at: string;
};

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function SiteNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [query, setQuery] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [recentConversations, setRecentConversations] = useState<RecentConversation[]>([]);

  useEffect(() => {
    void supabase.auth.getUser().then(async ({ data: { user } }) => {
      setEmail(user?.email ?? "");

      if (!user) return;

      const { data } = await supabase
        .from("conversations")
        .select("id, title, updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(6);

      setRecentConversations((data ?? []) as RecentConversation[]);
    });
    void authenticatedFetch("/api/admin/me")
      .then((response) => response.ok ? response.json() : null)
      .then((result: { isAdmin?: boolean } | null) => setIsAdmin(result?.isAdmin === true))
      .catch(() => setIsAdmin(false));
  }, []);

  const visibleGroups = useMemo(() => {
    const groups = isAdmin ? [...userNavigationGroups, adminNavigationGroup] : userNavigationGroups;
    const normalizedQuery = query.trim().toLocaleLowerCase("pl-PL");

    if (!normalizedQuery) {
      return groups;
    }

    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => item.label.toLocaleLowerCase("pl-PL").includes(normalizedQuery)),
      }))
      .filter((group) => group.items.length > 0);
  }, [isAdmin, query]);

  const visibleRecentConversations = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("pl-PL");

    return recentConversations.filter((conversation) =>
      !normalizedQuery || (conversation.title ?? "Nowa rozmowa").toLocaleLowerCase("pl-PL").includes(normalizedQuery),
    );
  }, [query, recentConversations]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <>
      <header className="mobile-nav">
        <Link className="mobile-nav-brand" href="/chat">
          <span><Image alt="" height={30} src="/brand-mark.png" width={30} /></span> Agent AI
        </Link>
        <button
          aria-expanded={isOpen}
          aria-label="Otwórz nawigację"
          onClick={() => setIsOpen((current) => !current)}
          type="button"
        >
          {isOpen ? "×" : "☰"}
        </button>
      </header>
      <aside className={`app-sidebar ${isOpen ? "app-sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <span className="sidebar-brand-mark"><Image alt="" height={36} src="/brand-mark.png" width={36} /></span>
          <div>
            <strong>Agent AI</strong>
            <small><i /> Gotowy do pracy</small>
          </div>
        </div>

        <Link className="sidebar-new-chat" href="/chat" onClick={() => setIsOpen(false)}>
          <span>＋</span> Nowa rozmowa
        </Link>

        <label className="sidebar-search">
          <span aria-hidden="true">⌕</span>
          <input
            aria-label="Szukaj w menu"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Szukaj..."
            type="search"
            value={query}
          />
          <kbd>⌘ K</kbd>
        </label>

        <nav className="sidebar-nav" aria-label="Nawigacja główna">
          {visibleGroups.map((group) => (
            <div className="sidebar-nav-group" key={group.label}>
              <p>{group.label}</p>
              {group.items.map((item) => {
                const isActive = isActivePath(pathname, item.href);

                return (
                  <Link
                    className={isActive ? "sidebar-link sidebar-link-active" : "sidebar-link"}
                    href={item.href}
                    key={item.href}
                    onClick={() => setIsOpen(false)}
                  >
                    <span aria-hidden="true">{item.icon}</span>
                    <b>{item.label}</b>
                    {isActive ? <i aria-hidden="true" /> : null}
                  </Link>
                );
              })}
            </div>
          ))}
          {visibleRecentConversations.length > 0 ? (
            <div className="sidebar-nav-group sidebar-recent-group">
              <p>Ostatnie rozmowy</p>
              {visibleRecentConversations.map((conversation) => (
                <a
                  className="sidebar-recent-link"
                  href={`/chat?conversation=${encodeURIComponent(conversation.id)}`}
                  key={conversation.id}
                  onClick={() => setIsOpen(false)}
                  title={conversation.title ?? "Nowa rozmowa"}
                >
                  <span>⌁</span>
                  <b>{conversation.title ?? "Nowa rozmowa"}</b>
                  <i>•••</i>
                </a>
              ))}
            </div>
          ) : null}
          {query && visibleGroups.length === 0 && visibleRecentConversations.length === 0 ? <p className="sidebar-empty">Brak wyników.</p> : null}
        </nav>
        <PwaInstallCard />
        <div className="sidebar-account">
          <div className="sidebar-profile">
            <span>{email ? email.slice(0, 1).toUpperCase() : "A"}</span>
            <div>
              <strong>{email ? email.split("@")[0] : "Konto"}</strong>
              {email ? <small title={email}>{email}</small> : null}
            </div>
            <ThemeToggle />
          </div>
          <button onClick={() => void handleSignOut()} type="button">
            Wyloguj <span aria-hidden="true">↗</span>
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
