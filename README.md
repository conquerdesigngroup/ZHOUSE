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
- **Run locally or hosted elsewhere:** edits persist in that browser's local storage. Use
  **Specs → Export JSON** to keep a copy, and **Import JSON** to load one. To bake a plan into the
  build, save it as a JSON file and run `node scripts/build.mjs --plan=path/to/plan.json`.

## Files

- `src/` — head, styles, UI template, app logic
- `data/default-plan.json` — the house as drafted from the sketch
- `reference/` — the original sketch photo and the 2D architectural plan
