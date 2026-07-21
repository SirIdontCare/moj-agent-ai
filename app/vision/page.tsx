import ChatClient from "../chat-client";

const visionQuestions = [
  "Co widzisz na tym obrazie?",
  "Wyciągnij cały tekst z tego screena",
  "Opisz to w 3 zdaniach",
  "Jakie kolory dominują? Podaj kody HEX",
  "Wygeneruj podobny obraz w innym stylu",
];

export default function VisionPage() {
  return (
    <ChatClient
      api="/api/chat"
      description="Wklej screenshot, wrzuć plik lub przeciągnij obraz"
      emptyMessage="Dodaj obraz, a potem zadaj pytanie."
      exampleQuestions={visionQuestions}
      inputPlaceholder="Zadaj pytanie o obraz..."
      renderMarkdown
      requestMode="vision"
      showModeSwitcher={false}
      title="👁️ Agent Vision"
      visionIntro
    />
  );
}
