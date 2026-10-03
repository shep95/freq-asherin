# shepherd.freq

A browser-based multi-tone frequency generator. Pick frequencies from the built-in
library (brainwave, Schumann, solfeggio, reference tones, …) or enter a custom Hz
value, then layer them and route each tone to **L / L+R / R** and — in Chrome/Edge —
to a specific output device.

It's a single static page (`index.html`) with no build step or dependencies.

## Deploy to Vercel

**Dashboard:** import this repo at <https://vercel.com/new>. Leave Framework Preset as
**Other** and Build Command / Output Directory empty — Vercel serves the repo root as-is.

**CLI:**

```sh
npm i -g vercel
vercel        # preview
vercel --prod # production
```

`vercel.json` sets security headers and a `Permissions-Policy` that allows the
microphone (only used, on an explicit "scan devices" click, so the browser reveals
output-device names) and speaker selection.

## Run locally

Any static server works, e.g.:

```sh
npx serve .
# or
python3 -m http.server 3000
```

Device scanning needs a secure context (`https://` or `localhost`).

## Browser notes

- Per-tone output-device routing uses `AudioContext.setSinkId`, available in
  Chromium browsers. Elsewhere every tone plays through the system default.
- Tones below ~20 Hz are mostly inaudible and many speakers can't reproduce them.
- Your tone list and master volume are saved in `localStorage`.
