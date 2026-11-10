// Syntax-checks the assembled app script and validates every plan in data/.
import { build } from './build.mjs';
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';

const html = build();
const src = html.match(/<script id="app-src">([\s\S]*?)<\/script>/)[1];
new vm.Script(src, { filename: 'app.js' }); // throws on syntax errors

const problems = [];
const files = ['default-plan.json', ...readdirSync(new URL('../data/', import.meta.url)).filter((n) => /^plan-[\w-]+\.json$/.test(n)).sort()];
for (const file of files) {
const plan = JSON.parse(readFileSync(new URL('../data/' + file, import.meta.url), 'utf8'));
const before = problems.length;
for (const k of ['walls', 'doors', 'windows', 'rooms', 'items']) if (!Array.isArray(plan[k])) problems.push(`missing array: ${k}`);
const ids = new Set();
for (const k of ['walls', 'doors', 'windows', 'rooms', 'items']) for (const o of plan[k] || []) {
  if (ids.has(o.id)) problems.push(`duplicate id: ${o.id}`);
  ids.add(o.id);
}
for (const w of plan.walls) if (!(w.t > 0)) problems.push(`wall ${w.id} needs a positive thickness`);
for (const d of plan.doors) if (!['swing', 'barn'].includes(d.type)) problems.push(`door ${d.id} has unknown type ${d.type}`);
for (let i = before; i < problems.length; i++) problems[i] = file + ': ' + problems[i];
console.log(`${file}: ${plan.walls.length} walls, ${plan.doors.length} doors, ${plan.windows.length} windows, ${plan.rooms.length} rooms, ${plan.items.length} items.`);
}
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
console.log(`OK: app script parses; ${files.length} plan files are valid.`);
