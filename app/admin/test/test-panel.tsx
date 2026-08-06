"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import SiteNavigation from "../../site-navigation";
import { authenticatedFetch } from "@/lib/supabase";

const testGroups = [
  {
    title: "Rozmowa i agenci",
    description: "Warianty zachowania modelu, narzędzia i łańcuchy rozumowania.",
    items: [
      { href: "/agent", label: "Agent autonomiczny", detail: "Pełny dostęp do narzędzi", icon: "◇" },
      { href: "/react", label: "Agent ReAct", detail: "Planowanie krok po kroku", icon: "↻" },
      { href: "/think", label: "Głębokie myślenie", detail: "Test złożonych odpowiedzi", icon: "⌁" },
      { href: "/fewshot", label: "Few-shot / słownik", detail: "Przykłady i sterowanie formatem", icon: "≡" },
    ],
  },
  {
    title: "Automatyzacje biznesowe",
    description: "Gotowe scenariusze demonstrujące specjalizowane przepływy pracy.",
    items: [
      { href: "/email-triage", label: "E-mail Triage", detail: "Klasyfikacja wiadomości", icon: "＠" },
      { href: "/report", label: "Generator raportów", detail: "Tworzenie i zapis raportu", icon: "▥" },
      { href: "/reports", label: "Zapisane raporty", detail: "Repozytorium wyników", icon: "▤" },
      { href: "/briefings", label: "Briefingi", detail: "Automatyczne podsumowania", icon: "◫" },
      { href: "/competitor", label: "Analiza konkurencji", detail: "Research i porównanie", icon: "◎" },
      { href: "/travel", label: "Planer podróży", detail: "Wielonarzędziowy planning", icon: "⌖" },
      { href: "/meal-planner", label: "Planer posiłków", detail: "Ustrukturyzowane wyniki", icon: "◌" },
    ],
  },
  {
    title: "Modele i media",
    description: "Testy wejść multimodalnych, generowania oraz przetwarzania treści.",
    items: [
      { href: "/generate", label: "Generator grafik", detail: "Text-to-image", icon: "✣" },
      { href: "/vision", label: "Vision", detail: "Analiza obrazu", icon: "◉" },
      { href: "/extract", label: "Ekstrakcja danych", detail: "Obraz i tekst do struktury", icon: "⌗" },
      { href: "/format", label: "Formatowanie", detail: "Transformacja treści", icon: "¶" },
      { href: "/search", label: "Wyszukiwanie", detail: "Grounding w internecie", icon: "⌕" },
      { href: "/upload", label: "Import wiedzy", detail: "Test indeksowania dokumentów", icon: "↑" },
      { href: "/knowledge", label: "Eksplorator wiedzy", detail: "Podgląd bazy dokumentów", icon: "▤" },
    ],
  },
];

export default function AdminTestPanel() {
  const [access, setAccess] = useState<"checking" | "allowed" | "denied">("checking");

  useEffect(() => {
    void authenticatedFetch("/api/admin/me")
      .then(async (response) => response.ok ? response.json() : null)
      .then((result: { isAdmin?: boolean } | null) => setAccess(result?.isAdmin ? "allowed" : "denied"))
      .catch(() => setAccess("denied"));
  }, []);

  return (
    <main className="admin-test-shell">
      <SiteNavigation />
      <section className="admin-test-panel">
        {access === "checking" ? (
          <div className="admin-test-state"><span className="auth-spinner" /><p>Sprawdzam uprawnienia…</p></div>
        ) : access === "denied" ? (
          <div className="admin-test-state admin-test-denied">
            <span>◇</span>
            <h1>Panel tylko dla administratora</h1>
            <p>To środowisko zawiera techniczne demonstratory i narzędzia testowe.</p>
            <Link href="/chat">Wróć do rozmowy</Link>
          </div>
        ) : (
          <>
            <header className="admin-test-hero">
              <div>
                <p>ADMIN · PRODUCT LAB</p>
                <h1>Panel testowy</h1>
                <span>Techniczne endpointy i demonstratory zebrane poza doświadczeniem użytkownika.</span>
              </div>
              <div className="admin-test-status"><i /> Środowisko gotowe</div>
            </header>

            <div className="admin-test-groups">
              {testGroups.map((group) => (
                <section className="admin-test-group" key={group.title}>
                  <div className="admin-test-group-heading">
                    <div><h2>{group.title}</h2><p>{group.description}</p></div>
                    <span>{group.items.length} modułów</span>
                  </div>
                  <div className="admin-test-grid">
                    {group.items.map((item) => (
                      <Link href={item.href} key={item.href}>
                        <span className="admin-test-icon">{item.icon}</span>
                        <div><strong>{item.label}</strong><small>{item.detail}</small></div>
                        <b>↗</b>
                      </Link>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
