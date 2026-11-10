// Assembles the single-file app (dist/index.html) from src/ and data/.
// The output must stay ONE self-contained HTML file: the in-page Save button
// regenerates the whole document from its own <style id="app-css">,
// <template id="tpl">, <script id="app-src"> and <script id="plan-data">.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

export function build({ planFile = 'data/default-plan.json' } = {}) {
  const head = read('src/head.html');
  const css = read('src/styles.css');
  const tpl = read('src/template.html');
  const defaultPlan = JSON.stringify(JSON.parse(read('data/default-plan.json'))).replace(/</g, '\\u003c');
  const plan = JSON.stringify(JSON.parse(read(planFile))).replace(/</g, '\\u003c');
  // Built-in designs: every data/plan-*.json becomes a design you can open from the Designs menu.
  const builtins = {};
  for (const f of readdirSync(join(root, 'data')).filter((n) => /^plan-[\w-]+\.json$/.test(n)).sort()) {
    const m = JSON.parse(read('data/' + f));
    const key = f.slice(5, -5);
    builtins[key] = { name: (m.specs && m.specs.designName) || key.toUpperCase(), model: m };
  }
  const builtinsJs = JSON.stringify(builtins).replace(/</g, '\\u003c');
  const headJs = JSON.stringify(head).replace(/<\//g, '<\\/');
  const src = read('src/app.js').replace('/*@@TOOLS@@*/', () => read('src/tools.js')).replace('__HEAD__', () => headJs).replace('__DEFAULT__', () => defaultPlan).replace('__BUILTINS__', () => builtinsJs);
  if (/<\/script/i.test(src)) throw new Error('src/app.js must not contain a literal closing script tag; write <\\/script> instead.');
  if (/<\/style/i.test(css)) throw new Error('styles.css must not contain </style>.');
  return '<!DOCTYPE html>\n<html lang="en">\n<head>\n' + head +
    '<style id="app-css">' + css + '</style>\n' +
    '<script id="plan-data" type="application/json">' + plan + '</script>\n' +
    '</head>\n<body>\n<template id="tpl">' + tpl + '</template>\n' +
    '<script id="app-src">' + src + '</script>\n</body>\n</html>\n';
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const planArg = process.argv.find((a) => a.startsWith('--plan='));
  const html = build(planArg ? { planFile: planArg.slice(7) } : {});
  mkdirSync(join(root, 'dist'), { recursive: true });
  writeFileSync(join(root, 'dist/index.html'), html);
  console.log(`dist/index.html written (${(html.length / 1024).toFixed(1)} KB)`);
}
