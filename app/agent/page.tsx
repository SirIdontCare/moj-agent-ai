import ChatClient from "../chat-client";

const toolPanel = [
  { emoji: "🧮", name: "Kalkulator", status: "✅ aktywny" },
  { emoji: "🕐", name: "Data i czas", status: "✅ aktywny" },
  { emoji: "🌐", name: "Google Search", status: "✅ aktywny" },
  { emoji: "📄", name: "Czytanie stron", status: "✅ aktywny" },
  { emoji: "📚", name: "Baza wiedzy", status: "✅ aktywna" },
  { emoji: "🎨", name: "Generowanie obrazów", status: "✅ aktywny" },
  { emoji: "👁️", name: "Analiza obrazów", status: "✅ aktywny" },
];

const scenarios = [
  "Znajdź w Google co robi firma Syntelligence i wygeneruj dla nich logo",
  "Przeczytaj stronę apple.com i opisz ich aktualną ofertę iPhone",
  "Ile to 23% VAT z 8500 PLN? Podaj kwotę brutto i netto",
  "Jakie są najnowsze wiadomości o AI? Wygeneruj grafikę do posta o tym",
  "Wyszukaj w Google 'best coffee shops Kraków' i streszcz wyniki",
];

export default function AgentPage() {
  return (
    <ChatClient
      api="/api/chat"
      description={`${toolPanel.length} narzędzi • autonomiczne decyzje`}
      emptyMessage="Wybierz scenariusz albo zleć agentowi zadanie łączące kilka narzędzi."
      exampleQuestions={scenarios}
      inputPlaceholder="Zleć zadanie agentowi..."
      renderMarkdown
      requestMode="agent"
      showModeSwitcher={false}
      showToolTimeline
      title="🤖 Agent AI - Pełna moc"
      toolPanel={toolPanel}
    />
  );
}
