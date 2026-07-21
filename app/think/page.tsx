import ChatClient from "../chat-client";

const exampleQuestions = [
  "Firma ma 120 pracowników. Ile osób pracuje zdalnie według podanych procentów?",
  "12 000 zł brutto na UoP vs 15 000 zł netto na B2B. Co się bardziej opłaca?",
  "Czy lepiej najpierw automatyzować sprzedaż czy obsługę klienta?",
  "Jak podejść do wyboru formy opodatkowania przy niepewnych kosztach?",
];

export default function ThinkPage() {
  return (
    <ChatClient
      api="/api/think"
      description="Agent pokazuje tok rozumowania krok po kroku"
      emptyMessage="Zadaj trudniejsze pytanie, a agent rozłoży odpowiedź na etapy."
      exampleQuestions={exampleQuestions}
      inputPlaceholder="Zadaj trudne pytanie..."
      showModeSwitcher={false}
      title="🧠 Tryb głębokiego myślenia"
    />
  );
}
