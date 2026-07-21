import ChatClient from "../chat-client";

const toolPanel = [
  { emoji: "🧮", name: "Kalkulator", status: "aktywny" },
  { emoji: "🕐", name: "Data i czas", status: "aktywny" },
  { emoji: "🌦️", name: "Pogoda", status: "aktywny" },
  { emoji: "💱", name: "Kursy NBP", status: "aktywny" },
  { emoji: "📅", name: "Święta", status: "aktywny" },
  { emoji: "📚", name: "Wikipedia", status: "aktywny" },
  { emoji: "📝", name: "Zapis notatek", status: "aktywny" },
  { emoji: "🗒️", name: "Odczyt notatek", status: "aktywny" },
  { emoji: "📄", name: "Czytanie stron", status: "aktywny" },
  { emoji: "📚", name: "Baza wiedzy", status: "aktywny" },
];

const scenarios = [
  "Planuję weekend w Krakowie. Sprawdź pogodę, znajdź ciekawe miejsca w Wikipedii, i powiedz czy są jakieś święta w ten weekend",
  "Mam 5000 EUR do wydania. Przelicz na PLN, sprawdź ile to w dolarach, i zapisz wszystkie kursy w notatkach",
  "Porównaj pogodę w Warszawie, Berlinie i Paryżu. Który z tych miast ma dziś najlepszą pogodę?",
  "Ile dni do następnego święta w Polsce? Jaka będzie wtedy pogoda?",
];

export default function ReactAgentPage() {
  return (
    <ChatClient
      api="/api/react"
      description="Opisz cel → agent sam planuje i realizuje"
      emptyMessage="Wybierz scenariusz albo opisz cel, który agent ma zrealizować krok po kroku."
      exampleQuestions={scenarios}
      inputPlaceholder="Opisz co chcesz osiągnąć..."
      renderMarkdown
      showDiagnostics
      showModeSwitcher={false}
      showReactSteps
      showToolTimeline
      title="🔄 Agent ReAct — Autonomiczne rozumowanie"
      toolPanel={toolPanel}
    />
  );
}
