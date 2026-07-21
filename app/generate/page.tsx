"use client";

import { useState } from "react";
import SiteNavigation from "../site-navigation";

const examplePrompts = [
  "Minimalistyczne logo kawiarni w stylu japońskim",
  "Post na Instagram: kawa latte art, ciepłe światło, widok z góry",
  "Kreacja reklamowa: wyprzedaż letnia -50%, nowoczesny design",
  "Ikona aplikacji: robot AI, gradient fioletowo-niebieski, flat design",
  "Infografika: 5 kroków do produktywności, pastelowe kolory",
  "Zdjęcie produktowe: elegancki zegarek na ciemnym tle",
];

type GenerateImageResponse = {
  image?: string;
  text?: string;
  error?: string;
};

export default function GeneratePage() {
  const [prompt, setPrompt] = useState("");
  const [image, setImage] = useState("");
  const [modelText, setModelText] = useState("");
  const [error, setError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  async function generateImage(nextPrompt = prompt) {
    const trimmedPrompt = nextPrompt.trim();

    if (!trimmedPrompt || isGenerating) {
      return;
    }

    setPrompt(trimmedPrompt);
    setIsGenerating(true);
    setError("");
    setImage("");
    setModelText("");

    try {
      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt: trimmedPrompt }),
      });
      const data = (await response.json()) as GenerateImageResponse;

      if (!response.ok || !data.image) {
        throw new Error(data.error ?? "Nie udało się wygenerować obrazu.");
      }

      setImage(data.image);
      setModelText(data.text ?? "");
    } catch (generateError) {
      setError(
        generateError instanceof Error
          ? generateError.message
          : "Nie udało się wygenerować obrazu.",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  function downloadImage() {
    if (!image) {
      return;
    }

    const link = document.createElement("a");
    link.href = image;
    link.download = "ai-generated.png";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  return (
    <main className="generate-shell">
      <SiteNavigation />
      <section className="generate-panel" aria-label="Generator grafik AI">
        <header className="generate-header">
          <h1>🎨 Generator grafik AI</h1>
          <p>Opisz co chcesz - AI stworzy obraz w kilka sekund</p>
        </header>

        <div className="generate-workspace">
          <section className="generate-controls" aria-label="Opis obrazu">
            <textarea
              className="generate-textarea"
              disabled={isGenerating}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Opisz obraz który chcesz wygenerować..."
              value={prompt}
            />

            <button
              className="generate-button"
              disabled={!prompt.trim() || isGenerating}
              onClick={() => generateImage()}
              type="button"
            >
              {isGenerating ? "Generuję..." : "🎨 Generuj"}
            </button>

            <div className="prompt-examples" aria-label="Przykładowe prompty">
              {examplePrompts.map((example) => (
                <button
                  disabled={isGenerating}
                  key={example}
                  onClick={() => setPrompt(example)}
                  type="button"
                >
                  {example}
                </button>
              ))}
            </div>
          </section>

          <section className="generate-result" aria-live="polite" aria-label="Wygenerowany obraz">
            {isGenerating ? (
              <div className="image-loading">
                <div className="loading-frame" />
                <p>Generuję... (5-15 sekund)</p>
              </div>
            ) : image ? (
              <div className="image-output">
                <img alt="Wygenerowana grafika AI" src={image} />
                {modelText ? <p className="model-comment">{modelText}</p> : null}
                <div className="result-actions">
                  <button onClick={downloadImage} type="button">
                    💾 Pobierz
                  </button>
                  <button onClick={() => generateImage(prompt)} type="button">
                    🔄 Ponownie
                  </button>
                </div>
              </div>
            ) : (
              <div className="empty-image-state">
                <span>🎨</span>
                <p>Wybierz przykład albo opisz własną grafikę.</p>
              </div>
            )}

            {error ? <p className="generate-error">{error}</p> : null}
          </section>
        </div>
      </section>
    </main>
  );
}
