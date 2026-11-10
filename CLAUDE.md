# House 3D Walkthrough — project guide for Claude

An editable 3D walkthrough of a single-level house, drafted from a hand sketch on graph paper
(`reference/original-sketch.jpg`, top sheet). It has two halves that share one data model:

- **3D view** (three.js r128): orbit/bird's-eye presets, first-person walk with collision,
  animated swing and barn doors, adjustable ceiling height, wall cutaway, room labels.
- **Plan editor** (SVG): drag/resize walls, doors, windows, rooms and furniture; inspector with
  exact dimensions and spec notes; room schedule; undo/redo; JSON import/export.

## Commands

```bash
npm run dev     # http://localhost:5173 — rebuilds from src/ on every reload (no deps)
npm run build   # writes dist/index.html (the single deliverable file)
npm run check   # syntax-checks the app script + validates data/default-plan.json
```

No npm install needed: zero dependencies. three.js and fonts load from CDNs at runtime.

## Layout

```
src/head.html        <head> contents (meta, fonts, three.js CDN tag)
src/styles.css       all CSS (dark UI; neon purple #b57bff, teal #2de2e6, green #4dff9a)
src/template.html    all UI markup, cloned into <body> at startup
src/app.js           all app logic (one IIFE, plain ES5-ish JS, no modules)
src/tools.js         design tools (tape, clearances, paths, floors, roof, decor, costs, photo, video,
                     notes, shopping). build.mjs splices it into app.js at /*@@TOOLS@@*/ (just
                     before the render loop), so it shares app.js's scope. Several app.js functions
                     call hooks defined here (planExtrasSVG, buildExtra, extraChecks, rimBands...).
                     It must not contain the strings __HEAD__, __DEFAULT__ or a closing script tag.
data/default-plan.json  the house as drafted from the sketch ("Reset to sketch" restores it)
data/plan-*.json     built-in designs (today: plan-v2.json = "V2", from reference/sketch-v2b.jpeg).
                     build.mjs embeds every data/plan-<key>.json as BUILTIN_PLANS[<key>] (placeholder
                     __BUILTINS__); they show in the Designs menu and Specs > Plan options next to
                     Main plan. Saving one stores a normal option under the same slot, which then wins.
scripts/make-plan-v2.py  regenerates data/plan-v2.json (edit the numbers there, not the JSON)
scripts/build.mjs    assembles dist/index.html; also used by dev.mjs and check.mjs
reference/           original sketch photo + the 2D architectural plan (SVG/PNG)
```

## Hard constraint: the output must stay ONE self-contained HTML file

The page was first published as a claude.ai artifact. Its **Save** button calls
`claude.use('artifact').publish(html)`, and `buildDoc()` in app.js regenerates the whole document
from the page's own pieces, by id: `#app-css`, `#tpl`, `#app-src`, `#plan-data` + `HEAD_STATIC`.
So:

- Keep those four ids and that structure. Don't split app.js into external files or ES modules
  in the built output (a bundler is fine *if* it still emits that exact single-file shape).
- `app.js` placeholders `__HEAD__`, `__DEFAULT__` and `__BUILTINS__` are filled by build.mjs. Don't hand-edit them.
- Never write a literal closing script tag in app.js; use `<\/script>` (build fails otherwise).
- Outside claude.ai (e.g. on Vercel), Save writes the current **plan option** ("slot") through
  `api/plan.js` to Vercel Blob when the deployment has `BLOB_READ_WRITE_TOKEN` and `SAVE_PASSCODE`;
  otherwise options live in this browser's `localStorage` (`house3d-slots-v1`). Unsaved edits are a
  draft in `house3d-draft-v1`, keyed to the slot version they started from. `npm run dev` serves the
  same API from `.dev-plans/` with passcode `dev`.

## Data model (units: feet; plan X = east, plan Y = south; north is up / -Y)

```js
specs:   { name, ceiling, doorH, extT, intT, eye, wallColor }
walls:   { id, x1,y1, x2,y2, t, ext, h|null, note }        // centerline segment, any angle
doors:   { id, name, type:'swing'|'barn', x1,y1 (hinge), x2,y2, swing:±1, h|null, note }
windows: { id, name, x1,y1, x2,y2, sill, head, note }
rooms:   { id, name, x,y, w,d, ceil|null, floor:'#hex', note }   // axis-aligned rects
items:   { id, label, kind, cx,cy, w,d,h, rot (deg), color, note, elev?, price?, link? }
notes:   { id, x,y, h, lv (0|1), text, by, at, done }      // family pins
floor2:  { elev, walls, doors, windows, rooms, items, fixtures }   // optional second floor
specs.roof  { style:'none'|'gable'|'hip'|'flat', pitch, over, mat, color, gutters }
specs.rates { floor:{matKey:$/sf}, paint:$/sf, build:$/sf }  specs.paint { coats, cover }
```

Second floor: only the floor being edited lives in model.walls/doors/...; `model.onFloor2` marks
that the arrays are swapped. `swapLevels()` flips them, `canonJSON()` gives the ground-first form
for dirty checks, and `normalize()` unswaps on load. Stairs are an item (kind 'stairs') on the
ground floor; `stairHoles()` cuts the opening upstairs and `walkFloorY()` ramps the walk camera.

Rules the code relies on:
- **Openings aren't stored on walls.** `wallOpenings(w)` finds every door/window whose endpoints lie
  within `t/2 + 0.15` of the wall's line and cuts it out (lintel above doors, sill + head pieces for
  windows). `hostWall(o)` is the same test. Move a wall → `hosted(w)` openings move with it.
- **Swing direction:** `swing:+1` opens toward the left normal of hinge→end, i.e. `(-uy, ux)`.
  Open plan angle = `atan2(dy,dx) + swing·90°`. In three.js: `rotation.y = -atan2(uy,ux) - swing·π/2·f`.
- **Barn doors** slide from `(x2,y2)` toward the hinge `(x1,y1)` by their width; `swing` picks the
  side of the wall they hang on. The double barn door = two leaves meeting in the middle.
- **Wall height** = `w.h`, else the max ceiling of rooms touching either face, else `specs.ceiling`.
- **Coordinates → three.js:** plan (x, y) → world (x, 0, y), Y up. `item.rot` in plan degrees →
  `group.rotation.y = -rot·π/180`.
- Item kinds: cabinet, counter, island, range, fridge, sink, vanity, toilet, tub, shower, bed,
  sofa, chair, table, shelf, plant (see `buildItem` and `ITEM_KINDS`). Items ≥ 1.4 ft tall collide.
- Rebuilds are full (`rebuild()` disposes and recreates the house group); trigger them via
  `scheduleRebuild()` / `afterChange()`, not directly, so they batch to one per frame.
- Every model mutation should go through `pushUndo()` first, then `afterChange()`.

## Things that are guesses from the sketch (verify with the owner before "fixing")

- WC zone fixture next to the 30" linen: drawn as a tub (could be a vanity).
- Walk-in pantry has an angled (45°) door wall — that's intentional.
- Storage room's north wall was added; the sketch didn't show one.
- The right edge of the sketch was cut off: garage and the bedroom's east door destination are unknown.
- 1 grid square = 1 ft. Dimensions are approximate.

## Owner preferences

Tony runs a lighting/staging production company; works across PC, Mac and iPhone; prefers
keyboard-driven workflows and dark UIs with neon purple/teal/green. Keep every feature reachable
by keyboard (shortcuts listed in the in-app `?` dialog and in `keydown` handler) and keep touch
controls working (left-half joystick, right-half look, Door button).

## Ideas not yet built

Angled/curved rooms (rooms are rectangles today), more than two floors, PDF export of the plan with
the room schedule, real-time sync of family notes (today they travel with saved designs).
