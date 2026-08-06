# Agent AI — reklama z 3 klipów + plansza logo

## Koncepcja

Historia trwa około 13 sekund:

1. **Chaos** — wiele zadań i materiałów.
2. **Agent** — jedna inteligencja łączy właściwe narzędzia.
3. **Rezultat** — pojawia się gotowy materiał.
4. **Marka** — oryginalne logo i hasło.

Generujemy tylko trzy ujęcia. Czwarte jest prostą planszą z prawdziwego pliku `public/brand-mark.png`, dzięki czemu model nie zdeformuje znaku.

Wszystkie generacje: **10 sekund, 16:9, bez dialogu i bez tekstu generowanego przez model**. Z każdego klipu wykorzystujemy tylko najlepsze 3–4 sekundy.

## Gotowe plansze referencyjne

1. `public/video-storyboard/01-chaos-to-plan.png` — materiały układają się w plan.
2. `public/video-storyboard/02-agent-orchestration.png` — agent uruchamia i łączy narzędzia.
3. `public/video-storyboard/03-finished-result.png` — gotowy rezultat na pierwszym planie.
4. `public/video-storyboard/04-agent-ai-end-card.png` — plansza marki z oryginalnym logo i CTA.

Pierwsze trzy plansze są klatkami referencyjnymi do generowania ruchu. Czwarta jest gotowym kadrem do użycia bez generowania. Można ją odtworzyć poleceniem `powershell -ExecutionPolicy Bypass -File scripts/generate-video-end-card.ps1`.

## Klip 1 — Chaos układa się w plan

W finalnym montażu użyj około `0:00–0:03`.

```text
Wide product shot of a dark smoked-glass worktable in a near-black studio, with a document sheet, data chart, travel map, research card and image frame suspended at different depths. The objects drift slowly from scattered positions into one precise horizontal sequence, their edges catching restrained violet and cyan light. Tiny scratches on the glass, faint dust in the air and slightly soft highlights keep the scene tactile. The camera remains almost static with a subtle forward drift. The shot ends when every object clicks into alignment and a narrow line of light connects them.
Ambient: low room tone, paper moving through air, soft glass resonance, distant electrical hum, five quiet mechanical clicks as the objects align.
```

## Klip 2 — Agent uruchamia narzędzia

W finalnym montażu użyj około `0:03–0:07`.

```text
Medium-wide cinematic product shot of a luminous glass intelligence core floating in the right third of a dark studio. One violet-cyan ribbon of light travels through a document, chart, map and image frame arranged around it, activating each surface as it passes. The objects stay fixed while only the ribbon moves, leaving a controlled glow along their edges. Frosted glass, brushed black metal, thin atmospheric haze and fine film grain create physical depth. A slow push-in follows the light toward the core. The shot ends as the core emits one clean warm-white pulse toward the foreground.
Ambient: restrained electrical current, soft glass vibration, a low ventilation hum, subtle data-like pulses, one deep resonant tone as the core activates.
```

## Klip 3 — Gotowy rezultat

W finalnym montażu użyj około `0:07–0:10.5`.

```text
Close product shot of a single polished glass report card emerging from darkness onto a matte black pedestal. Abstract rows, charts and blocks glow softly inside the card while violet and cyan reflections move across its beveled edges. The card slides forward in one smooth motion and locks into perfect focus; the scattered shapes behind it fade into shadow. Fine dust catches the warm-white key light, with subtle lens texture and low-contrast shadows. The camera makes a slow precise push-in. The shot ends on the completed card as a small four-point flare appears at its center.
Ambient: deep studio silence, soft glass sliding over metal, distant electrical air, a restrained rising hum, one clean mechanical click when the card locks into place.
```

## Klip 4 — prawdziwe logo

Nie generuj go w AI. W CapCut użyj gotowego pliku `public/video-storyboard/04-agent-ai-end-card.png`:

- czas: `0:10.5–0:13.5`,
- tło: `#08090d`,
- logo wyśrodkowane, szerokość około 18% kadru,
- animacja skali `92% → 100%`, ease-out,
- delikatna poświata fiolet/cyan,
- pod logo dodaj napis `AGENT AI`,
- niżej dodaj hasło `ZLEĆ CEL. AGENT ZROBI RESZTĘ.`,
- ostatnia klatka nieruchoma przez minimum 1 sekundę.

## Montaż

1. Wygeneruj trzy klipy w Omni Flash / Veo.
2. Wrzuć je do CapCut w kolejności 1 → 2 → 3.
3. Przytnij każdy do najlepszego momentu zgodnie z timingiem powyżej.
4. Między klipami użyj krótkiego `dip to black` albo cięcia na błysku — maksymalnie 4 klatki.
5. Do pierwszych trzech ujęć nie dodawaj napisów. Historia ma być czytelna samym obrazem.
6. Oryginalne audio klipów ścisz do około 35% i połącz krótkimi fade’ami.
7. Na końcu dodaj planszę z prawdziwym logo.
8. Eksport: `agent-ai-hero.mp4`, H.264, 1920×1080, 25 lub 30 fps.

Po wygenerowaniu trzech plików można je złożyć automatycznie i podpiąć jako wyciszone, zapętlone video na landing page’u.
