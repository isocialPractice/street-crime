# Design Language

The look of the documentation site (`docs/`). It is taken from the game's own
mark, `logo.svg`: a night skyline in dark navy, lit by a yellow-to-orange street
glow, with the title set in Impact. `docs/assets/site.css` uses exactly these
values; change them here and there together.

## Where it comes from

| From `logo.svg` | Value | Used as |
| --- | --- | --- |
| sky, top of the gradient | `#04091a` | (the darkest tone; kept out of text pairs, used for the top bar shadow) |
| building fill | `#0a1020` | dark page background |
| sky, bottom of the gradient | `#111d34` | dark menu and top bar |
| window frames | `#1d2f56` | dark code blocks and table heads; light link color |
| building edges | `#2a3a5a` | dark borders; light muted text |
| highlight | `#b0c5c8` | dark muted text; light borders |
| glow, top | `#ffd966` | dark accent: current page marker, focus ring, heading rule |
| glow, bottom | `#e07b30` | accent, decoration only |
| title font | Impact, Arial Black | page and section headings |

Derived, not in the logo:

| Value | From | Why |
| --- | --- | --- |
| `#f0f2f3` | near white | dark text; pure white is avoided for long reading |
| `#cfe0e2` | `#b0c5c8`, lightened | dark links, lighter than muted text |
| `#f5f8f9`, `#e8eff0`, `#dde7e9` | `#b0c5c8`, tinted toward white | light background, menu, code blocks |
| `#9a4a12` | `#e07b30`, darkened | light accent: `#e07b30` reaches only 2.79:1 on the light background |

The palette follows `.github/instructions/html-css-style-color-guide.instructions.md`:
cool tones for backgrounds and text (60 and 30 per cent), hot tones only as the 10
per cent accent, no yellow text, no hot backgrounds.

## Themes

The site follows the reader's system setting, and a button in the top bar picks
light or dark instead (remembered in that browser).

| Role | Dark | Light |
| --- | --- | --- |
| background | `#0a1020` | `#f5f8f9` |
| menu, top bar | `#111d34` | `#e8eff0` |
| code, table head | `#1d2f56` | `#dde7e9` |
| text | `#f0f2f3` | `#0a1020` |
| muted text | `#b0c5c8` | `#2a3a5a` |
| link | `#cfe0e2`, underlined | `#1d2f56`, underlined |
| accent | `#ffd966` | `#9a4a12` |
| decoration | `#e07b30` | `#e07b30` |
| border | `#2a3a5a` | `#b0c5c8` |

## Contrast

Checked with the WCAG 2 formula. Every text pair passes 4.5:1, most by far.

| Pair | Ratio |
| --- | --- |
| dark text `#f0f2f3` on `#0a1020` / `#111d34` / `#1d2f56` | 16.88 / 14.97 / 11.74 |
| dark muted `#b0c5c8` on the same | 10.53 / 9.34 / 7.32 |
| dark link `#cfe0e2` on the same | 13.91 / 12.34 / 9.67 |
| dark accent `#ffd966` on the same | 13.87 / 12.30 / 9.65 |
| light text `#0a1020` on `#f5f8f9` / `#e8eff0` / `#dde7e9` | 17.76 / 16.28 / 15.06 |
| light muted `#2a3a5a` on the same | 10.63 / 9.74 / 9.01 |
| light link `#1d2f56` on the same | 12.35 / 11.32 / 10.47 |
| light accent `#9a4a12` on the same | 5.85 / 5.36 / 4.96 |
| decoration `#e07b30` on `#0a1020` / `#f5f8f9` | 6.36 / 2.79: never text, never the only cue |
| borders `#2a3a5a` on `#0a1020`, `#b0c5c8` on `#f5f8f9` | 1.67 / 1.69: decoration only. Buttons are outlined in the muted text color |

Links are told apart from text by their underline as well as their color.

## Type

| Use | Font | Size |
| --- | --- | --- |
| body | system sans (`system-ui`, Segoe UI, Roboto, Helvetica, Arial) | 16 px, line height 1.6 |
| page title | Impact, Arial Black | 39 px |
| section heading | Impact, Arial Black | 31 px, then 25 px |
| smaller headings | body font, bold | 20 px, 16 px |
| code | Courier New (as the game's HUD), then the system monospace | 14 px |
| menu | body font | 15 px (14 px for indented entries) |
| menu group label | body font, bold, upper case, 1 px letter spacing | 13 px |

Sizes step by 1.25. Impact is condensed and heavy, so it is used only at 25 px and
above, where it reads as the logo does.

## Space and shape

| Decision | Value | From |
| --- | --- | --- |
| spacing steps | 4, 8, 12, 16, 24, 32, 48 px | a 4 px base |
| corner radius | 2 px (code, tables), 4 px (buttons) | the logo's `rx="1"` details and the favicon's `rx="4"` frame: nearly square |
| top bar | 52 px tall, fixed | |
| menu width | 264 px, fixed | |
| text width | at most 820 px | about 80 characters of body text |
| phone layout | below 860 px: a top bar with a menu button; the menu slides over the page. Below 480 px the demo link moves into the menu; below 375 px the brand shows its icon only | |
