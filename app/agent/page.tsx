import ChatClient from "../chat-client";
import type { PictogramName } from "../pictogram";

const toolPanel: Array<{ icon: PictogramName; name: string; status: string }> = [
  { icon: "calculator", name: "Kalkulator", status: "aktywny" },
  { icon: "clock", name: "Data i czas", status: "aktywny" },
  { icon: "globe", name: "Google Search", status: "aktywny" },
  { icon: "file", name: "Czytanie stron", status: "aktywny" },
  { icon: "book", name: "Baza wiedzy", status: "aktywna" },
  { icon: "image", name: "Generowanie obrazów", status: "aktywny" },
  { icon: "eye", name: "Analiza obrazów", status: "aktywny" },
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
      title="Agent AI - Pełna moc"
      titleIcon="bot"
      toolPanel={toolPanel}
    />
  );
}
