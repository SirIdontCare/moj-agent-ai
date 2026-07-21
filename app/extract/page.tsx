import ChatClient from "../chat-client";

const extractQuestions = [
  "Wyciągnij cały tekst i uporządkuj go w punktach",
  "Zamień dane z obrazu na tabelę markdown",
  "Znajdź najważniejsze liczby i kwoty",
  "Podsumuj dokument w 5 punktach",
];

export default function ExtractPage() {
  return (
    <ChatClient
      api="/api/chat"
      description="Wklej screenshot, zdjęcie dokumentu albo tabelę, a agent wyciągnie z niego dane"
      emptyMessage="Dodaj obraz z tekstem lub tabelą, a ja pomogę go przeanalizować."
      exampleQuestions={extractQuestions}
      inputPlaceholder="Co mam wyciągnąć z obrazu?"
      renderMarkdown
      requestMode="vision"
      showModeSwitcher={false}
      title="📊 Analizator"
      visionIntro
    />
  );
}
