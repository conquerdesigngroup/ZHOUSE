// Zero-dependency dev server: rebuilds the page from src/ on every request.
// Usage: npm run dev   (then open http://localhost:5173)
import { createServer } from 'node:http';
import { build } from './build.mjs';
import handler from '../api/plan.js';

// Local stand-in for cloud saving: plans go to .dev-plans/ and the passcode is "dev".
process.env.PLAN_DIR ||= new URL('../.dev-plans', import.meta.url).pathname;
process.env.SAVE_PASSCODE ||= 'dev';

const port = Number(process.env.PORT) || 5173;
createServer((req, res) => {
  if (req.url.startsWith('/api/plan')) return handler(req, res);
  if (req.url !== '/' && !req.url.startsWith('/index.html') && !req.url.startsWith('/?')) {
    res.writeHead(404).end('Not found');
    return;
  }
  try {
    const html = build();
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }).end(html);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain' }).end('Build failed:\n' + err.stack);
  }
}).listen(port, () => console.log(`House 3D Walkthrough → http://localhost:${port}  (reload to pick up edits)`));
