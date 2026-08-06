import ChatClient from "../chat-client";
import type { PictogramName } from "../pictogram";

const toolPanel: Array<{ icon: PictogramName; name: string; status: string }> = [
  { icon: "cloud-sun", name: "Pogoda", status: "Open-Meteo" },
  { icon: "coins", name: "Waluty", status: "NBP" },
  { icon: "calendar", name: "Święta", status: "Nager.Date" },
  { icon: "book", name: "Miasta", status: "Wikipedia" },
  { icon: "calculator", name: "Budżet", status: "kalkulator" },
  { icon: "globe", name: "Atrakcje", status: "Google" },
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
      title="Asystent podróży AI"
      titleIcon="plane"
      toolPanel={toolPanel}
    />
  );
}
