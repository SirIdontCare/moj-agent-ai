import ChatClient from "../chat-client";

const toolPanel = [
  { emoji: "🌤️", name: "Pogoda", status: "Open-Meteo" },
  { emoji: "💶", name: "Waluty", status: "NBP" },
  { emoji: "📅", name: "Święta", status: "Nager.Date" },
  { emoji: "📖", name: "Miasta", status: "Wikipedia" },
  { emoji: "🧮", name: "Budżet", status: "kalkulator" },
  { emoji: "🌐", name: "Atrakcje", status: "Google" },
];

const scenarios = [
  "Planuję weekend w Berlinie. Budżet: 2000 PLN",
  "Lecę do Paryża na tydzień w sierpniu",
  "Wycieczka do Pragi z rodziną na 3 dni",
  "Podróż służbowa do Londynu w przyszłym tygodniu",
  "Porównaj Barcelonę i Lizbonę na wakacje",
];

export default function TravelPage() {
  return (
    <ChatClient
      api="/api/travel"
      description="Powiedz dokąd jedziesz — agent zaplanuje wszystko"
      emptyMessage="Wybierz scenariusz albo opisz podróż, a agent zbierze pogodę, waluty, święta i atrakcje."
      exampleQuestions={scenarios}
      inputPlaceholder="Np. Lecę do Barcelony na weekend..."
      renderMarkdown
      showDiagnostics
      showModeSwitcher={false}
      showToolTimeline
      showTravelCards
      title="✈️ Asystent podróży AI"
      toolPanel={toolPanel}
    />
  );
}
