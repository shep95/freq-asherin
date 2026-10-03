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
- **Mute charge** — three “resonance of silence” concepts as tone charges:
  infrasound interference (18.98 Hz · ELF / brainwave), room resonance
  (150–200 Hz · PEMF / research) and auditory saturation (2500 Hz · LRAD).
  Each states plainly what it really does — **no tone can create silence**.
  The room charge includes a real axial room-mode calculator
  (f = n·343 / 2L from your room's size) and a slow 150–200 Hz sweep.
- **Combos** — save the current mix (frequencies, channels, waves, volumes,
  pulses) by name; load, add, play, rename or delete (with undo). Export /
  import as JSON to move them between devices — imports are size-capped and
  re-validated field by field.
- Click an added frequency in the library again to **remove** it; **reset**
  clears every active tone (with undo).
- Beat-rate and pulse choices are **colour-coded by caution**: green low
  (alpha), yellow mild (beta — can feel restless), amber caution (delta /
  theta — drowsiness, never while driving), rose high (gamma — seizure caution).
- **Connect bluetooth** (outputs tab) — shows where sound is going, gives
  pairing steps for the detected device (with an *open Bluetooth settings*
  button on Windows, Mac and Android), notices the speaker the moment it
  connects and offers to use it. Each output has **test** (soft chime) and
  **use**; the choice is remembered and restored when the device reconnects.
- **Wireless spectrum** (connect tab) — a log-scale map from 10 Hz to 100 GHz
  placing shepherd's audio tier beside AM/FM, 4G/5G, WiFi 2.4/5/6E, Bluetooth,
  GPS, Starlink and geostationary satellite bands, with wavelength, reach and
  the more-data ↔ more-reach pattern. Bands this device is using light up:
  the **network** (WiFi / cellular, speed, latency), a **GPS** fix (shown
  rounded, never stored) and a real **find & connect** to nearby Bluetooth LE
  devices (name, battery) in Chrome / Edge. Any band can be heard as an
  octave-transposed stand-in. Browsers cannot scan WiFi, cell towers or radio,
  and sound cannot transmit on these bands — the app says so plainly.
- **Playlists** (saved locally, in this browser only) — sequences of combos
  with a duration per stage, 3 s crossfades, optional loop, previous / next /
  stop and a live countdown. Build your own from the current mix or saved
  combos; rename, set minutes, reorder, duplicate, delete (with undo);
  included in export / import.
- **asherin.playlist** (built-in preset, copy to edit): sleep / deep
  restoration · focus / cognition · meditation / presence · healing /
  recovery · EMF / magnetic protection · silence field (mute charge). Rates
  under ~20 Hz (delta, theta, alpha, beta, gamma, Schumann) are built as
  binaural beats — use headphones. Each stage shows its intent and a short
  "what's known" note.
- A one-time safety notice appears before the first sound.
- **Colour filters** under the search box narrow the library by evidence
  colour; combine several. The **skull** filter shows extreme-caution tones
  (deterrent bands, infrasound, 15 kHz and up). Skull tones start at 20 %
  volume and need a separate confirmation before they play.

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

## Tests

`tests/run.mjs` drives a real Chromium through every feature, safety gate and
a set of attacks (256 checks), served with the production headers:

```sh
npm i --no-save playwright && npx playwright install chromium
node tests/run.mjs
```

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

## Security model

A static, client-only app — no server code, accounts, cookies, analytics or
third-party resources. Hardening (each control was attack-tested):

| Threat | Control |
|---|---|
| Script injection (XSS) via labels, saved data or Bluetooth device names | all dynamic text escaped; strict **CSP** with SHA-256 hashes for the one inline script and style — no `unsafe-inline`, no `unsafe-eval`, no external origins |
| Injection through any HTML sink | **Trusted Types** `default` policy routes every `innerHTML` through a tag-aware sanitizer; `eval`, string timers and new policies are refused |
| Data exfiltration | `connect-src 'self'`, `default-src 'none'`, `form-action 'none'` |
| Clickjacking / framing | `frame-ancestors 'none'`, `X-Frame-Options: DENY`, JS frame-guard in the single file |
| Prototype pollution | saved state rebuilt from an allow-list of keys (no object spread); built-in prototypes and app data frozen |
| Oversized / malformed saved state | strict type checks and clamps; max 48 tones, 40-char labels; control and bidi-override characters stripped |
| Service-worker cache poisoning | caches an explicit allow-list only; no query strings, redirects, errors or cross-origin responses |
| Cross-origin attacks / side channels | COOP + COEP + CORP same-origin (cross-origin isolated), `nosniff`, `no-referrer`, `Origin-Agent-Cluster` |
| Downgrade | HSTS (2 years) + `upgrade-insecure-requests` |
| Permission abuse | Permissions-Policy denies everything except microphone (device names, on click only, released immediately), speaker selection, and — only on a tap — geolocation and Bluetooth |
| Repo files exposed by deploy | `.vercelignore` ships only the app |
| Supply chain | zero runtime dependencies; font self-hosted; CI action pinned by commit |

**After editing `index.html`, run `node tools/csp.mjs`** to refresh the CSP
hashes (CI fails if you forget). Report vulnerabilities via
[SECURITY.md](SECURITY.md).

## Browser notes

- Per-tone output routing uses `AudioContext.setSinkId` (Chromium). Elsewhere
  tones play through the system default.
- Tones below ~20 Hz are mostly inaudible and many speakers can't reproduce them.
- Tone list and master volume are saved in `localStorage`.
