# shepherd.freq

A multi-tone frequency generator set inside an orbital observation chamber.
Pick frequencies from the built-in library (brainwave, Schumann, solfeggio,
reference tones, …) or enter your own, layer them, and route each tone to
**L / L+R / R** and — in Chrome/Edge — to a specific output device.

Plain static files, no build step, no external requests. **Works 100% offline.**

```
index.html             the whole app (HTML + CSS + JS)
sw.js                  service worker — precaches everything for offline use
manifest.webmanifest   makes it installable (home screen / dock / start menu)
assets/vista.webp      background scene (736 × 983)
assets/inter-var.woff2 Inter variable font, self-hosted (OFL, see inter-LICENSE.txt)
icons/                 app + favicon icons
vercel.json            headers (security, service worker, manifest)
```

## What's inside

- **Library** — 111 frequencies in categories, each tagged with how solid its
  claim is: *traditional claim*, *mixed evidence*, *documented · anecdotal*,
  *EM · not sound*, *audio stand-in*, *use responsibly*, *reference standard*.
- **Intervals** — build sets from one base frequency: binaural or monaural
  **beats** (delta → gamma presets), **harmonic** series, musical **ratios**
  (octave, fifth, fourth, thirds, φ …) and fixed **steps**, optionally with an
  isochronic **pulse**.
- **Insight** — live analysis of the current mix: which categories it draws
  on, every pair's beat frequency, binaural vs. monaural beating, roughness,
  musical interval and difference tones, plus the body / matter / claims notes
  that apply right now (hearing, high and infrasonic ranges, seizures, glass
  resonance, rattling objects, speaker damage, healing and PEMF claims …).
- A one-time safety notice appears before the first sound.

## Use it offline

- **Install it:** open the site once, then use **install app** in the outputs
  panel (Chrome / Edge / Android), or on iPhone / iPad: Share → *Add to Home
  Screen*. After the first visit every file is cached, so it opens and plays
  with no connection.
- **Single file:** **download single file** saves `shepherd.freq.html` with the
  image, font and icons embedded. Open it from any device's files, no network
  needed.

## Deploy to Vercel

Import this repo at <https://vercel.com/new>. Framework Preset **Other**, build
command and output directory empty. Or with the CLI: `vercel --prod`.

When you change a file that the service worker caches, bump `VERSION` in
`sw.js` so installed copies pick up the update.

## Run locally

```sh
npx serve .            # or: python3 -m http.server 3000
```

The service worker and device scanning need `https://` or `localhost`.

## Design notes

Everything placed over the scene is anchored to positions measured from the
image's luminance profile: header in the ceiling band (0–8.9 %), the hero
frequency in the calm haze band (38.7–50.9 %), the live wave drawn on the
distant land horizon (51.4 %), tone cards resting on the land above the
diners, light that swells at the orbital horizon (15.3 %) and floor as tones
play. The stage keeps the image's aspect ratio and is centred on the window
opening, so those anchors hold on every screen size.

- Colour in OKLCH, sampled from the image; text never pure white.
- One type family (Inter, optical sizing on), major-third scale on 12.8 px.
- 4 px spacing grid; one spring curve (ζ 0.72) for every physical motion.
- Sound → light: low tones draw long, tall, slow waves and a heavier numeral;
  high tones draw short, bright ones. Ambient light breathes on an 8 s cycle
  (never flickers). All motion respects `prefers-reduced-motion`.

## Browser notes

- Per-tone output routing uses `AudioContext.setSinkId` (Chromium). Elsewhere
  tones play through the system default.
- Tones below ~20 Hz are mostly inaudible and many speakers can't reproduce them.
- Tone list and master volume are saved in `localStorage`.
