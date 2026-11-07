// Cross-device plan storage: one JSON file per saved option ("slot").
//
//   GET    /api/plan              -> { ok, enabled, slots: [{ slot, name, updated }] }
//   GET    /api/plan?slot=main    -> { ok, slot, name, updated, model }   (404 if not saved yet)
//   PUT    /api/plan?slot=main    body { name, model, base?, force? }    header x-passcode
//   DELETE /api/plan?slot=main    header x-passcode
//
// Storage: Vercel Blob (private store) when BLOB_READ_WRITE_TOKEN is set, otherwise a local folder
// named by PLAN_DIR (used by `npm run dev`). Reads are open to anyone with the link; writes need
// the SAVE_PASSCODE environment variable to match the x-passcode header.
// A PUT carries `base` (the `updated` time the editor loaded). If someone saved in between, it
// gets 409 so the editor can ask before overwriting, unless `force` is true.
import { timingSafeEqual } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const PREFIX = 'plans/';
const MAX_BYTES = 4 * 1024 * 1024;

function slugOf(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  if (Buffer.isBuffer(req.body)) return JSON.parse(req.body.toString('utf8') || '{}');
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > MAX_BYTES) throw Object.assign(new Error('too large'), { status: 413 });
    chunks.push(c);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

function passOk(req) {
  const want = process.env.SAVE_PASSCODE || '';
  const got = String(req.headers['x-passcode'] || '');
  if (!want) return false;
  const a = Buffer.from(want), b = Buffer.from(got);
  return a.length === b.length && timingSafeEqual(a, b);
}

/* ---------- storage backends ---------- */
function fileStore(dir) {
  const file = (slot) => path.join(dir, slot + '.json');
  return {
    async list() {
      await fs.mkdir(dir, { recursive: true });
      return (await fs.readdir(dir)).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));
    },
    async read(slot) {
      try { return JSON.parse(await fs.readFile(file(slot), 'utf8')); } catch (e) { return null; }
    },
    async write(slot, doc) { await fs.mkdir(dir, { recursive: true }); await fs.writeFile(file(slot), JSON.stringify(doc)); },
    async remove(slot) { try { await fs.unlink(file(slot)); } catch (e) { /* already gone */ } },
  };
}

async function blobStore() {
  const { put, get, list, del } = await import('@vercel/blob');
  return {
    async list() {
      const out = [];
      let cursor;
      do {
        const r = await list({ prefix: PREFIX, cursor });
        r.blobs.forEach((b) => out.push(b.pathname.slice(PREFIX.length).replace(/\.json$/, '')));
        cursor = r.hasMore ? r.cursor : undefined;
      } while (cursor);
      return out;
    },
    async read(slot) {
      const r = await get(PREFIX + slot + '.json', { access: 'private', useCache: false });
      if (!r || r.statusCode !== 200) return null;
      return JSON.parse(await new Response(r.stream).text());
    },
    async write(slot, doc) {
      await put(PREFIX + slot + '.json', JSON.stringify(doc), {
        access: 'private', addRandomSuffix: false, allowOverwrite: true,
        contentType: 'application/json', cacheControlMaxAge: 60,
      });
    },
    async remove(slot) { await del(PREFIX + slot + '.json'); },
  };
}

async function getStore() {
  if (process.env.BLOB_READ_WRITE_TOKEN) return blobStore();
  if (process.env.PLAN_DIR) return fileStore(process.env.PLAN_DIR);
  return null;
}

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, 'http://x');
    const slot = slugOf(url.searchParams.get('slot'));
    const store = await getStore();
    const writable = !!(store && process.env.SAVE_PASSCODE);

    if (req.method === 'GET' && !slot) {
      if (!store) return send(res, 200, { ok: true, enabled: false, slots: [] });
      const names = await store.list();
      const docs = await Promise.all(names.map((s) => store.read(s).catch(() => null)));
      const slots = docs.map((d, i) => d && { slot: names[i], name: d.name || names[i], updated: d.updated }).filter(Boolean)
        .sort((a, b) => String(a.name).localeCompare(String(b.name)));
      return send(res, 200, { ok: true, enabled: true, writable, slots });
    }
    if (!store) return send(res, 503, { ok: false, error: 'not_configured', message: 'Cloud saving isn\'t set up on this deployment yet.' });
    if (!slot) return send(res, 400, { ok: false, error: 'bad_slot' });

    if (req.method === 'GET') {
      const doc = await store.read(slot);
      if (!doc) return send(res, 404, { ok: false, error: 'not_found' });
      return send(res, 200, { ok: true, slot, name: doc.name || slot, updated: doc.updated, model: doc.model });
    }

    if (req.method === 'PUT' || req.method === 'POST' || req.method === 'DELETE') {
      if (!process.env.SAVE_PASSCODE) return send(res, 503, { ok: false, error: 'no_passcode', message: 'Set SAVE_PASSCODE in the Vercel project to turn on saving.' });
      if (!passOk(req)) return send(res, 401, { ok: false, error: 'bad_passcode' });
      if (req.method === 'DELETE') { await store.remove(slot); return send(res, 200, { ok: true }); }
      const body = await readBody(req);
      const m = body && body.model;
      if (!m || typeof m !== 'object' || !Array.isArray(m.walls)) return send(res, 400, { ok: false, error: 'bad_model' });
      if (!body.force) {
        const cur = await store.read(slot);
        if (cur && cur.updated !== (body.base || null)) return send(res, 409, { ok: false, error: 'conflict', updated: cur.updated, name: cur.name });
      }
      const doc = { name: String(body.name || slot).slice(0, 60), updated: new Date().toISOString(), model: m };
      await store.write(slot, doc);
      return send(res, 200, { ok: true, slot, name: doc.name, updated: doc.updated });
    }
    res.setHeader('Allow', 'GET, PUT, DELETE');
    return send(res, 405, { ok: false, error: 'method' });
  } catch (err) {
    return send(res, err.status || 500, { ok: false, error: 'server', message: String(err.message || err) });
  }
}
