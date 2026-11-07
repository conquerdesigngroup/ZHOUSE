// Syntax-checks the assembled app script and validates the default plan.
import { build } from './build.mjs';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = build();
const src = html.match(/<script id="app-src">([\s\S]*?)<\/script>/)[1];
new vm.Script(src, { filename: 'app.js' }); // throws on syntax errors

const plan = JSON.parse(readFileSync(new URL('../data/default-plan.json', import.meta.url), 'utf8'));
const problems = [];
for (const k of ['walls', 'doors', 'windows', 'rooms', 'items']) if (!Array.isArray(plan[k])) problems.push(`missing array: ${k}`);
const ids = new Set();
for (const k of ['walls', 'doors', 'windows', 'rooms', 'items']) for (const o of plan[k] || []) {
  if (ids.has(o.id)) problems.push(`duplicate id: ${o.id}`);
  ids.add(o.id);
}
for (const w of plan.walls) if (!(w.t > 0)) problems.push(`wall ${w.id} needs a positive thickness`);
for (const d of plan.doors) if (!['swing', 'barn'].includes(d.type)) problems.push(`door ${d.id} has unknown type ${d.type}`);
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
console.log(`OK: app script parses; plan has ${plan.walls.length} walls, ${plan.doors.length} doors, ${plan.windows.length} windows, ${plan.rooms.length} rooms, ${plan.items.length} items.`);
