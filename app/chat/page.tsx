import ChatClient from "../chat-client";

const exampleQuestions = [
  "Zaplanuj 4 dni w Tokio: sprawdź pogodę, święta, kurs JPY i policz budżet 6000 zł",
  "Porównaj aktualnie ChatGPT, Claude i Gemini dla małej agencji — podaj źródła i rekomendację",
  "Przeanalizuj załączony dokument, wyciągnij decyzje i przygotuj listę działań",
  "Przygotuj mój dzisiejszy briefing i zapisz najważniejsze ustalenia jako notatkę",
];

export default function ChatPage() {
  return (
    <ChatClient
      api="/api/chat"
      description="Uniwersalny asystent do analizy, pisania, planowania i codziennej pracy."
      emptyMessage="Cześć! W czym mogę Ci dziś pomóc?"
      exampleQuestions={exampleQuestions}
      inputPlaceholder="Zleć zadanie, dołącz plik albo poproś o research..."
      productExperience
      requestMode="agent"
      showModeSwitcher={false}
      title="Agent AI"
    />
  );
}
