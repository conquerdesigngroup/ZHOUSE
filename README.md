# House 3D Walkthrough

An editable 3D model of a single-level house: fly around it, walk through it in first person,
open and close doors, change the ceiling height, and edit the layout and specs in a plan editor
that updates the 3D view live.

## Run it

Requires Node 18+. There's nothing to install.

```bash
npm run dev      # open http://localhost:5173
npm run build    # produces dist/index.html — one self-contained file you can open or host anywhere
npm run check    # sanity checks
```

Open in Claude Code with `claude` from this folder; `CLAUDE.md` explains the code and data model.

## Using it

| Key | Action |
| --- | --- |
| `O` / `F` | Orbit / walk mode |
| `1`–`7` | Top, NE, NW, SE, SW, front, side views |
| `W A S D` / arrows, `Shift` | Walk, run |
| `E` | Open/close the door you're facing |
| `[` `]` | Ceiling height −/+ 3" |
| `C` / `L` | Ceilings / room labels |
| `P` | Plan editor |
| `Ctrl+Z` / `Ctrl+Shift+Z` | Undo / redo |
| `Ctrl+D`, `Del`, arrows | Duplicate, delete, nudge the selection |
| `Ctrl+S` | Save (on the claude.ai-hosted copy) |

Lengths can be typed as `9.5`, `9'6"` or `114"`.

## Saving

- **Hosted on claude.ai:** Save writes your changes into the page itself, so every device sees them.
- **On Vercel:** Save stores the current plan option online (Vercel Blob), so it opens the same on
  any device. It needs two things in the Vercel project: a Blob store connected to the project
  (Storage → Create → Blob, which adds `BLOB_READ_WRITE_TOKEN`) and an environment variable
  `SAVE_PASSCODE`. The first save on each device asks for that passcode. Without them, options are
  kept in the browser.
- **Plan options:** Specs → Plan options keeps several versions (A, B, the garage…), compares them
  side by side, and prints a one-page plan sheet (Print / PDF).
- **Run locally:** `npm run dev` saves options to `.dev-plans/` with passcode `dev`. Otherwise
  edits persist in that browser's local storage. Use
  **Specs → Export JSON** to keep a copy, and **Import JSON** to load one. To bake a plan into the
  build, save it as a JSON file and run `node scripts/build.mjs --plan=path/to/plan.json`.

## Files

- `src/` — head, styles, UI template, app logic
- `data/default-plan.json` — the house as drafted from the sketch
- `reference/` — the original sketch photo and the 2D architectural plan
