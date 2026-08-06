import ChatClient from "../chat-client";
import type { PictogramName } from "../pictogram";

const toolPanel: Array<{ icon: PictogramName; name: string; status: string }> = [
  { icon: "calculator", name: "Kalkulator", status: "aktywny" },
  { icon: "clock", name: "Data i czas", status: "aktywny" },
  { icon: "cloud-sun", name: "Pogoda", status: "aktywny" },
  { icon: "coins", name: "Kursy NBP", status: "aktywny" },
  { icon: "calendar", name: "Święta", status: "aktywny" },
  { icon: "book", name: "Wikipedia", status: "aktywny" },
  { icon: "pencil", name: "Zapis notatek", status: "aktywny" },
  { icon: "notebook", name: "Odczyt notatek", status: "aktywny" },
  { icon: "file", name: "Czytanie stron", status: "aktywny" },
  { icon: "book", name: "Baza wiedzy", status: "aktywny" },
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
      title="Agent ReAct — Autonomiczne rozumowanie"
      titleIcon="refresh"
      toolPanel={toolPanel}
    />
  );
}
