"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import ChatClient from "./chat-client";
import { supabase } from "@/lib/supabase";
import ThemeToggle from "./theme-toggle";

const capabilities = [
  {
    index: "01",
    icon: "◎",
    title: "Research, który kończy się decyzją",
    description: "Agent przeszukuje internet, czyta źródła, porównuje opcje i oddaje jasną rekomendację — nie listę linków.",
    accent: "violet",
  },
  {
    index: "02",
    icon: "▤",
    title: "Dokumenty zamienione w działanie",
    description: "Dodaj PDF, CSV albo screenshot. Dostaniesz wnioski, ryzyka, decyzje i konkretną listę kolejnych kroków.",
    accent: "cyan",
  },
  {
    index: "03",
    icon: "✦",
    title: "Gotowy materiał, nie luźna odpowiedź",
    description: "Raport, plan podróży, briefing, analiza czy drafty maili pojawiają się jako dopracowany materiał do użycia.",
    accent: "mint",
  },
  {
    index: "04",
    icon: "◈",
    title: "Kontekst, który pracuje dalej",
    description: "Agent pamięta rozmowę, korzysta z Twojej bazy wiedzy i zapisuje ustalenia wtedy, gdy go o to poprosisz.",
    accent: "amber",
  },
];

const workflow = [
  { number: "01", title: "Mówisz, jaki ma być efekt", text: "Jednym zdaniem. Bez komend, modułów i uczenia się interfejsu." },
  { number: "02", title: "Agent układa plan i dobiera narzędzia", text: "Sam łączy research, dokumenty, obliczenia, dane i generowanie treści." },
  { number: "03", title: "Dostajesz zweryfikowany rezultat", text: "Widzisz źródła, kontrolę jakości i gotowy materiał do pobrania." },
];

const outcomes = [
  { icon: "⌖", title: "Podróż", text: "Pogoda, kursy, daty i budżet" },
  { icon: "◉", title: "Research", text: "Źródła, porównanie i rekomendacja" },
  { icon: "▥", title: "Analiza", text: "Pliki, dane i najważniejsze decyzje" },
  { icon: "✦", title: "Tworzenie", text: "Raporty, briefingi, grafiki i drafty" },
];

function BrandMark() {
  return (
    <span className="landing-brand-mark" aria-hidden="true">
      <Image alt="" height={34} src="/brand-mark.png" width={34} />
    </span>
  );
}

function ProductPreview() {
  return (
    <div className="landing-preview landing-preview-v3" aria-label="Podgląd pracy Agenta AI">
      <div className="preview-glow preview-glow-one" />
      <div className="preview-glow preview-glow-two" />
      <div className="preview-window preview-window-v3">
        <aside className="preview-sidebar preview-sidebar-v3">
          <div className="preview-mini-brand"><BrandMark /><span>Agent AI</span></div>
          <div className="preview-new-chat">＋ Nowa rozmowa</div>
          <small>OSTATNIE</small>
          <div className="preview-thread preview-thread-active"><span>◌</span><div><strong>Analiza rynku AI</strong><small>przed chwilą</small></div></div>
          <div className="preview-thread"><span>◌</span><div><strong>Plan wyjazdu do Tokio</strong><small>wczoraj</small></div></div>
          <div className="preview-thread"><span>◌</span><div><strong>Briefing zarządu</strong><small>2 dni temu</small></div></div>
          <div className="preview-profile"><span>PK</span><div><strong>Paweł</strong><small>konto prywatne</small></div></div>
        </aside>

        <div className="preview-chat preview-chat-v3">
          <header className="preview-chat-header preview-chat-header-v3">
            <div><span className="preview-status-dot" /><strong>Agent AI</strong><small>gotowy do działania</small></div>
            <div className="preview-model"><span>⚡ Flash</span><b>＋</b></div>
          </header>
          <div className="preview-messages preview-messages-v3">
            <div className="preview-message preview-message-user preview-product-prompt">
              Porównaj 3 najlepsze narzędzia AI dla naszej agencji. Sprawdź aktualne ceny i przygotuj rekomendację.
            </div>

            <div className="preview-plan-card">
              <header><span>PLAN</span><div><strong>Plan działania</strong><small>3 kroki do rekomendacji</small></div></header>
              <div><i>1</i><span><strong>Zbiorę aktualne dane</strong><small>Funkcje, ceny i ograniczenia</small></span></div>
              <div><i>2</i><span><strong>Porównam opcje</strong><small>Koszt, jakość i dopasowanie</small></span></div>
              <div><i>3</i><span><strong>Przygotuję rekomendację</strong><small>Werdykt z uzasadnieniem</small></span></div>
            </div>

            <div className="preview-tool-run"><span>✦</span><div><strong>Agent wykonał 5 działań</strong><small>Research · strony WWW · obliczenia · weryfikacja</small></div></div>

            <div className="preview-artifact">
              <header><div><span>GOTOWY MATERIAŁ</span><strong>Rekomendacja narzędzi AI</strong></div><b>↓</b></header>
              <p>Najlepszy wybór: <strong>zestaw hybrydowy</strong> — szybki model do codziennej pracy i Pro do zadań strategicznych.</p>
              <div><span>✓ Źródła</span><span>✓ Koszty</span><span>✓ Werdykt</span></div>
            </div>
          </div>
          <div className="preview-composer preview-composer-v3"><span>Zleć kolejne zadanie…</span><button aria-label="Wyślij" tabIndex={-1}>↑</button></div>
        </div>
      </div>
      <div className="preview-proof-card preview-proof-card-top"><span>✓</span><div><strong>Wynik zweryfikowany</strong><small>Pewność 94%</small></div></div>
      <div className="preview-proof-card preview-proof-card-bottom"><span>✦</span><div><strong>Gotowe do użycia</strong><small>Raport · 4 min</small></div></div>
    </div>
  );
}

function LandingPage() {
  return (
    <main className="landing-shell landing-shell-v3">
      <nav className="landing-nav" aria-label="Nawigacja strony głównej">
        <Link className="landing-logo" href="/" aria-label="Agent AI — strona główna"><BrandMark /><span>Agent <em>AI</em></span></Link>
        <div className="landing-nav-links">
          <a href="#mozliwosci">Możliwości</a>
          <a href="#jak-dziala">Jak działa</a>
          <a href="#rezultaty">Rezultaty</a>
        </div>
        <div className="landing-nav-actions"><ThemeToggle compact /><Link className="landing-nav-login" href="/login">Zaloguj się <span>→</span></Link></div>
      </nav>

      <section className="landing-hero landing-hero-v3">
        <div className="landing-orb landing-orb-one" /><div className="landing-orb landing-orb-two" />
        <div className="landing-hero-copy">
          <div className="landing-eyebrow"><span>✦</span> Jeden czat · wszystkie narzędzia</div>
          <h1>Zleć cel.<br /><span>Agent zrobi resztę.</span></h1>
          <p>
            Research, dokumenty, obliczenia, grafiki i gotowe materiały. Agent sam układa plan,
            dobiera narzędzia, sprawdza wynik i oddaje Ci rezultat — bez przełączania modułów.
          </p>
          <div className="landing-hero-actions">
            <Link className="landing-primary-cta" href="/login?mode=register">Zacznij za darmo <span>→</span></Link>
            <a className="landing-secondary-cta" href="#jak-dziala"><span className="landing-play">▶</span> Zobacz, jak pracuje</a>
          </div>
          <div className="landing-no-risk"><span>✓ Bez karty</span><span>✓ Start w 30 sekund</span><span>✓ Prywatne dane</span></div>
        </div>
        <ProductPreview />
      </section>

      <section className="landing-proof-bar" aria-label="Najważniejsze cechy produktu">
        <span><strong>WIELE</strong><small>narzędzi i możliwości</small></span>
        <i />
        <span><strong>1</strong><small>rozmowa</small></span>
        <i />
        <span><strong>0</strong><small>przełączania modułów</small></span>
        <i />
        <span><strong>24/7</strong><small>gotowy do działania</small></span>
      </section>

      <section className="landing-cinematic" id="rezultaty" aria-labelledby="cinematic-title">
        <Image alt="Wizualizacja Agenta AI łączącego wiele narzędzi w jeden rezultat" fill priority sizes="(max-width: 1000px) 100vw, 1180px" src="/agent-workflow-cinematic.png" />
        <div className="landing-cinematic-shade" />
        <div className="landing-cinematic-copy">
          <p>OD CHAOSU DO REZULTATU</p>
          <h2 id="cinematic-title">Wiele możliwości.<br /><span>Jeden gotowy efekt.</span></h2>
          <span>Nie musisz wiedzieć, którego narzędzia użyć. Opisz cel — Agent sam połączy właściwe elementy.</span>
          <div className="landing-tool-cloud"><b>Internet</b><b>Dokumenty</b><b>Obliczenia</b><b>Obrazy</b><b>Pamięć</b></div>
        </div>
        <div className="landing-result-chip"><span>✓</span><div><small>REZULTAT</small><strong>Gotowy materiał</strong><em>sprawdzony · do pobrania</em></div></div>
      </section>

      <section className="landing-features landing-features-v3" id="mozliwosci" aria-labelledby="features-title">
        <div className="landing-section-heading landing-section-heading-v3">
          <p>WIĘCEJ NIŻ ODPOWIEDŹ</p>
          <h2 id="features-title">Agent, który<br />dowozi pracę.</h2>
          <span>Od pierwszego pytania do materiału, który możesz wysłać klientowi, zespołowi albo od razu wdrożyć.</span>
        </div>
        <div className="landing-capability-grid">
          {capabilities.map((capability) => (
            <article className={`landing-capability-card landing-capability-${capability.accent}`} key={capability.title}>
              <header><span>{capability.index}</span><i>{capability.icon}</i></header>
              <h3>{capability.title}</h3>
              <p>{capability.description}</p>
              <div aria-hidden="true"><span /><span /><span /></div>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-workflow" id="jak-dziala" aria-labelledby="workflow-title">
        <div className="landing-workflow-heading">
          <p>PROSTY DLA CIEBIE. ZAAWANSOWANY W ŚRODKU.</p>
          <h2 id="workflow-title">Ty opisujesz efekt.<br /><span>Agent prowadzi wykonanie.</span></h2>
        </div>
        <div className="landing-workflow-grid">
          {workflow.map((step) => (
            <article key={step.number}><span>{step.number}</span><div><h3>{step.title}</h3><p>{step.text}</p></div></article>
          ))}
        </div>
        <div className="landing-runtime-line" aria-hidden="true">
          <span><i>✓</i> Cel</span><b>→</b><span><i>✓</i> Plan</span><b>→</b><span><i>✓</i> Narzędzia</span><b>→</b><span><i>✓</i> Weryfikacja</span><b>→</b><span className="landing-runtime-result"><i>✦</i> Rezultat</span>
        </div>
      </section>

      <section className="landing-outcomes" aria-labelledby="outcomes-title">
        <div><p>JEDEN AGENT. RÓŻNE ZADANIA.</p><h2 id="outcomes-title">Co dziś<br /><span>chcesz osiągnąć?</span></h2></div>
        <div className="landing-outcome-grid">
          {outcomes.map((outcome) => (
            <article key={outcome.title}><span>{outcome.icon}</span><div><strong>{outcome.title}</strong><small>{outcome.text}</small></div><b>↗</b></article>
          ))}
        </div>
      </section>

      <section className="landing-final-cta landing-final-cta-v3">
        <div className="landing-final-orb" />
        <div><p>TWÓJ PIERWSZY REZULTAT JEST O JEDNO ZDANIE STĄD</p><h2>Nie testuj kolejnego chatbota.<br /><span>Zleć Agentowi prawdziwe zadanie.</span></h2></div>
        <Link className="landing-primary-cta landing-primary-cta-light" href="/login?mode=register">Zacznij za darmo <span>→</span></Link>
      </section>

      <footer className="landing-footer">
        <Link className="landing-logo" href="/"><BrandMark /><span>Agent <em>AI</em></span></Link>
        <p>© 2026 Agent AI. Od celu do gotowego rezultatu.</p>
        <div><a href="#mozliwosci">Możliwości</a><Link href="/login">Logowanie</Link></div>
      </footer>
    </main>
  );
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  useEffect(() => {
    let isMounted = true;

    void supabase.auth.getUser().then(({ data }) => {
      if (!isMounted) return;
      setUser(data.user);
      setIsCheckingSession(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      setUser(session?.user ?? null);
      setIsCheckingSession(false);
    });

    return () => { isMounted = false; subscription.unsubscribe(); };
  }, []);

  if (isCheckingSession) {
    return <main className="auth-loading" role="status"><div className="auth-spinner" /><p>Przygotowuję Agenta...</p></main>;
  }

  return user ? (
    <ChatClient
      api="/api/chat"
      description="Uniwersalny asystent do analizy, pisania, planowania i codziennej pracy."
      emptyMessage="Cześć! W czym mogę Ci dziś pomóc?"
      exampleQuestions={[
        "Zaplanuj 4 dni w Tokio: sprawdź pogodę, święta, kurs JPY i policz budżet 6000 zł",
        "Porównaj aktualnie ChatGPT, Claude i Gemini dla małej agencji — podaj źródła i rekomendację",
        "Przeanalizuj załączony dokument, wyciągnij decyzje i przygotuj listę działań",
        "Przygotuj mój dzisiejszy briefing i zapisz najważniejsze ustalenia jako notatkę",
      ]}
      inputPlaceholder="Zleć zadanie, dołącz plik albo poproś o research..."
      productExperience
      requestMode="agent"
      showModeSwitcher={false}
      title="Agent AI"
    />
  ) : <LandingPage />;
}
