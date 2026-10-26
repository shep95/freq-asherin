# redesign — the colonnade at sunset

**status: built** (october 2026). measured anchors live in the header comment of `index.html`; the stage covers every screen from 320 × 568 to 3840 × 2160, and the suite checks at 12 sizes that the figure stays in view and uncovered on desktop.

the new world: a lone figure on a dark hillside, watching a vast white colonnade arc
through a valley of cloud toward two impossibly tall towers, with the sun setting over
the sea on the left. it replaces the portrait "window" image. the image *is* the
background — full screen, not blurred, not framed.

## 1. what the image gives us (measured on the 1672 × 941 original)

| anchor | where (x, y as % of the image) | what it does in the design |
|---|---|---|
| the figure (red jacket) | ≈ 62.8 %, 83–89 % | the person using the app. scale and awe come from here. never covered by ui |
| the colonnade's lit face | ≈ 36–60 % x, 47–74 % y, arcing right to ≈ 91 % | the instrument. sound lights it; the wave is drawn along its top edge |
| the two towers | ≈ 55–58 % and 64–67 % x, top to 17 % y | vertical axis of the composition; the hero sits between their feet |
| the sun | ≈ 4.5 %, 13.5 % | warm light source; breathes with energy |
| the sea horizon | ≈ 17–19 % y | the ceiling band: header lives above it |
| dark sky, upper right | 70–100 % x, 0–15 % y | calm region: the play orb + master |
| dark foreground hill | 0–100 % x, 76–100 % y | the land: active tone cards rest here, either side of the figure |

## 2. layout

- **background**: the image itself, `object-fit: cover`. on wide screens `object-position`
  holds the figure and the towers in view; on phones it pans so the figure, the near
  colonnade and one tower stay visible (measured per breakpoint, not guessed).
- **header** above the horizon line, on the sky.
- **hero frequency**: inside the colonnade's embrace (≈ 41–75 % x, 33.5–44.5 % y), where the
  figure is looking. (first tried between the towers' feet; the caption collided with the
  far colonnade, so it moved down.) on phones it shows in the "active" view, where the sheet
  is low.
- **left glass column** (library · modes · intervals · mute) over the sea, and the
  **right glass column** (insight · playlists · connect) over the city. both narrower and
  warmer than now, so the colonnade's arc reads between them.
- **tone band** low on the dark hill, stopping short of the figure: cards never cover the
  person.
- **phones**: the image on top, the sheet below, with the figure kept visible above the
  sheet edge.

## 3. palette (sampled from the image)

| token | from | use |
|---|---|---|
| sun gold | the sunset | active / sounding (replaces icy horizon light) |
| marble | the colonnade's lit face | primary text, hero |
| dusk navy | the upper-right sky | glass tint, background of panels |
| ember red | the figure's jacket | used once: the play orb's ring while sounding — "you" |
| caution scale, evidence tags | unchanged | their jobs don't change |

## 4. sound ↔ light (the causal link)

- the wave is drawn **along the colonnade's top edge**, not a straight line.
- energy lights the **colonnade's face** (a screen-blended warm glow masked to the arc)
  and swells the **sun**.
- calm mode's breathing ring centres on the hero.
- sleep mode dims the world toward night.

## 5. the image file

- converted to one webp (1672 × 941, 167 kb). one file keeps the offline single-file
  download simple.
- **all metadata removed**: EXIF, XMP, ICC and any C2PA / provenance chunks. verified by
  reading the RIFF chunk list after conversion: only `VP8 ` / `VP8L` / `VP8X` (no `EXIF`,
  `XMP `, `ICCP`) may remain.
- the old `assets/vista.webp` is removed; the service worker's cache version is bumped so
  installed copies update. a blurred copy of the same image stays as the wallpaper beneath
  the phone sheet, where the stage fades out.

## 6. order of work

1. receive the image file → strip metadata → generate sizes → verify chunks
2. measure anchors on the real pixels; write them as CSS custom properties
3. swap the scene (full-bleed image, colonnade glow mask, sun glow, arc wave)
4. re-tone the palette tokens; re-place hero, header, columns, tone band
5. phone layouts (portrait, landscape, small)
6. update tests (image size check, layout checks), csp hashes, sw version
7. screenshots at 1920 / 1440 / 1100 / 820 / 390 / 844×390 / 360, then push
