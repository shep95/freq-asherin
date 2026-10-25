# shepherd.freq — design system: relationships & motion

how every part of the interface relates to every other part, and how motion
carries cause → effect between them. this is the reference the code follows;
when the two disagree, the code is wrong.

---

## 1. the components

| region | components | role |
|---|---|---|
| **scene** | wallpaper (blurred), stage image, horizon glow, floor glow, hero frequency, horizon wave | the world. it *responds*; it is never a control |
| **header** (ceiling band) | champagne wordmark, status line, session time, sleep timer, command bar, master volume, play orb | identity + the one global instrument |
| **left glass column** | library · colour filters · custom Hz / modes (sleep · focus · calm · learn) + your hearing / intervals / mute charge | where sound is *chosen* — by frequency or by task |
| **tone band** (on the land) | active-tone cards, save · reset · stop all | what is *sounding* |
| **right glass column** | insight / playlists & combos / connect (output, radios, devices, offline) | what it *means* and where it *goes* |
| **overlays** | first-listen notice, extreme caution, spectrum map, command bar, shortcuts & settings, toast | interruptions — always dismissible, always return focus |
| **phone sheet** | five tabs (library · intervals · active · insight · connect) | the same columns, stacked |

## 2. visual hierarchy

attention is earned in this order, and nothing may outrank the item above it:

1. **the vista** — the image is the largest, calmest, highest-contrast thing on screen
2. **the hero frequency** — one number, in the haze band, the only large type
3. **the play orb** — the single global control; champagne ring when sounding
4. **active cards** — glass on the land, above the diners (who stay visible for scale)
5. **the columns** — dark tiled glass, lit only where the cursor is
6. **overlays** — appear above everything, dim and blur the world behind

### colour has one job each

| colour | meaning | never used for |
|---|---|---|
| horizon light (icy) | **sound / active state** — playing cards, live bands, selection | branding |
| champagne metal | **identity / prestige** — wordmark, orb ring, session time, presets | state |
| amber | the image's own column light; shepherd's audio tier on the spectrum | — |
| caution scale (green → yellow → amber → rose) | beat-rate risk | anything else |
| rose + skull | extreme caution | decoration |
| evidence tags | how solid a claim is | — |

## 3. relationship map — what reacts to what

one store, many views. `tones[]` (plus the engine's live nodes) is the single
source of truth; every view is derived from it.

```mermaid
flowchart LR
  subgraph input[you act]
    LIB[library row / ⌘K / intervals / mute / combo / playlist]
    ORB[play orb · space]
    CARD[tone card controls]
    DEV[device connects]
  end
  STORE[(tones[] + engine nodes + playlist state)]
  LIB --> STORE
  ORB --> STORE
  CARD --> STORE
  DEV --> STORE
  STORE --> ROW[library row echo + ✓]
  STORE --> CARDS[tone cards enter / leave]
  STORE --> HERO[hero rolls to the new Hz]
  STORE --> WAVE[horizon wave reshapes]
  STORE --> GLOW[horizon + floor glow swell]
  STORE --> ORBV[orb ignites · ring turns]
  STORE --> INS[insight: pairs, notes, categories]
  STORE --> STAT[header status · session time]
  STORE --> MEDIA[lock screen / media keys]
  STORE --> SPEC[spectrum live bands]
```

### the echoes (one action, several answers)

| you do | the world answers, in this order |
|---|---|
| **add a tone** | the row flashes light (0 ms) → card springs in (0–750 ms) → hero rolls to the Hz (620 ms) → insight re-reads the mix (next frame, if visible) |
| **press play** | the orb ignites and its champagne ring begins to turn → tones swell in over 1.2 s → horizon and floor light rise with the energy → the wave draws itself on the land horizon → session time appears in the header |
| **stop** | tones swell out over 0.6 s → light settles → wave returns to a hairline → the render loop goes to sleep |
| **change playlist stage** | 3 s crossfade between stages → now-playing card and header status update → hero rolls |
| **a speaker connects** | "connected · use it" → one tap routes everything there → the connect status and device list update → bluetooth lights on the spectrum |
| **sleep timer ends** | everything fades over 20 s → timer clears |
| **start a mode** | the mode card turns champagne → the mix soft-starts over 8 s → sleep dims the world / calm draws a breathing ring around the hero / focus chimes at each block → any other play ends the mode's effects |
| **listening** | every second the dose meter adds the estimated A-weighted level against WHO's 80 dB(A) · 40 h a week; 80 % and 100 % each warn once |

the principle: **nothing changes without the world acknowledging it**, and the
acknowledgement always comes from the part that is *causally* connected — sound
lights the horizon because sound is what the horizon represents.

## 4. motion system

### tokens

| token | value | used for |
|---|---|---|
| `--t-fast` | 160 ms | hover, colour changes |
| `--t-std` | 240 ms | state changes |
| `--t-big` | 480 ms | significant changes (hero caption) |
| `--spring` | 750 ms, ζ 0.72 (CSS `linear()`) | anything physical: presses, cards entering, dialogs |
| `--ease-out` | cubic-bezier(.16,1,.3,1) | entrances |
| `--ease-in` | cubic-bezier(.7,0,.84,0) | exits (200 ms) |
| breath | 8 s, phase-locked | horizon glow, floor glow, card glow, orb glow, session dot |
| ring | 14 s linear | orb's champagne ring while sounding |
| drift | 56 s | the vista slowly breathing in scale |
| roll | 620 ms, cubic-out in log space | hero frequency |
| swell | 1.2 s in / 0.6 s out | global play / stop |
| crossfade | 3 s | playlist stages |
| sleep fade | 20 s | sleep timer |

### rules

1. **enter with ease-out or spring, exit with ease-in.** exits are shorter than entrances.
2. **ambient motion is one rhythm.** every breathing element shares the same 8 s cycle
   and is phase-locked to the horizon (7.5 breaths / min — a calm breathing rate).
3. **loops animate only `opacity` and `transform`.** they run on the compositor and
   never repaint. glows live on pseudo-elements whose opacity breathes.
4. **nothing flickers faster than ~3 times a second** (photosensitivity).
5. **the hero rolls in log space**, so 7.83 → 528 travels evenly, and always lands on
   the exact formatted value.
6. **prefers-reduced-motion** turns motion off; **lite quality** keeps the scene still
   and the glass solid on slower devices.

## 5. performance contract

| rule | why |
|---|---|
| per-frame values are written to the **scene layer**, never the page root | a root custom property restyles the whole document |
| values are written **only when they change** | no style work for nothing |
| the render loop **sleeps** when nothing moves or sounds | zero idle cost |
| insight renders **only when visible**, library & playlists **coalesce** bursts | one render per burst, not per tone |
| the wave uses layered strokes, **no canvas shadowBlur** | shadowBlur is a per-frame blur |
| **adaptive quality**: a device whose median frame exceeds ~30 ms (or uses data saver) switches to lite automatically; settings can force auto / full / lite | the experience stays smooth instead of beautiful-but-stuttering |

measured (headless chromium, software rendering — absolute numbers are slower than
a real device, the ratios are what matter):

| measure | before | after |
|---|---|---|
| style recalculation while playing | 105 ms / s | 9.7 ms / s |
| main-thread work while playing | 162 ms / s | 60 ms / s |
| idle script work | 2.3 ms / s | 0.6 ms / s |
| library + tones + insight render | 22.5 ms | 15.4 ms |
| 20 tones added in a row | 321 ms | 140 ms |

("after" includes the full premium layer — session clock, sleep timer, turning
orb ring — at full visual quality.)
