const http = require('http'); const WebSocket = require('ws'); const express = require('express'); const cors = require('cors'); const minimist = require('minimist');
const args = minimist(process.argv.slice(2), { default: { devices: 2000, eps: 1200, dropConnEvery: '60s', dupRate: 0.01, oooRate: 0.01 } });
const DEVICE_COUNT = Number(args.devices) || 2000; const EPS = Number(args.eps) || 1200; const DROP_MS = parseDuration(args.dropConnEvery || '60s'); const DUP_RATE = clamp01(Number(args.dupRate) || 0); const OOO_RATE = clamp01(Number(args.oooRate) || 0);
function clamp01(v){ return Math.max(0, Math.min(1, v)); }
function parseDuration(s) { if (typeof s === 'number') return s; const m = String(s).match(/(\d+)(ms|s|m)/); if (!m) return 60000; const n = Number(m[1]); const unit = m[2]; return unit === 'ms' ? n : unit === 's' ? n * 1000 : n * 60 * 1000; }
const devices = Array.from({ length: DEVICE_COUNT }, (_, i) => ({ id: `dev-${String(i + 1).padStart(6, '0')}`, status: Math.random() > 0.02 ? 'online' : 'offline', cpu: Math.floor(Math.random() * 80), ram: Math.floor(Math.random() * 80), ts: Date.now() }));
const api = express(); api.use(cors()); api.use(express.json());
const processedIdem = new Set();
api.post('/control/reboot', (req, res) => {
  const id = req.body?.deviceId; const idemKey = req.body?.idemKey;
  if (!id) return res.status(400).json({ ok: false, reason: 'invalid_id' });
  if (!idemKey) return res.status(400).json({ ok: false, reason: 'missing_idemKey' });
  if (processedIdem.has(idemKey)) return res.json({ ok: true, dedup: true });
  const d = devices.find(x => x.id === id); if (!d) return res.status(404).json({ ok: false, reason: 'not_found' });
  processedIdem.add(idemKey); if (Math.random() < 0.15) return res.json({ ok: false, reason: 'busy' });
  const now = Date.now(); d.status = 'rebooting'; d.ts = now; broadcast(makeTelemetry(d));
  setTimeout(() => { d.status = 'online'; d.ts = Date.now(); broadcast(makeTelemetry(d)); }, 1500 + Math.random() * 1000);
  res.json({ ok: true });
}); api.listen(4002, () => console.log('Control API on http://localhost:4002'));
const server = http.createServer(); const wss = new WebSocket.Server({ server }); server.listen(4001, () => console.log('WebSocket server on ws://localhost:4001'));
function send(ws, obj) { try { ws.send(JSON.stringify(obj)); } catch {} }
wss.on('connection', (ws) => { send(ws, { type: 'seed', devices }); const dropTimer = setInterval(() => { try { ws.close(); } catch {} }, DROP_MS); ws.on('close', () => clearInterval(dropTimer)); });
let SEQ = 1; const oooBuffer = []; const OOO_BUFFER_MAX = 2000;
function makeTelemetry(d){ return { type: 'telemetry', seq: SEQ++, deviceId: d.id, status: d.status, metrics: { cpu: d.cpu, ram: d.ram }, ts: d.ts }; }
const intervalMs = 60000 / Math.max(1, EPS);
setInterval(() => {
  if (wss.clients.size === 0) return;
  const i = Math.floor(Math.random() * devices.length); const d = devices[i];
  d.cpu = clamp(0, 100, d.cpu + (Math.random() * 10 - 5) | 0); d.ram = clamp(0, 100, d.ram + (Math.random() * 10 - 5) | 0);
  if (Math.random() < 0.01) d.status = d.status === 'online' ? 'offline' : 'online'; d.ts = Date.now();
  const ev = makeTelemetry(d); oooBuffer.push(ev); if (oooBuffer.length > OOO_BUFFER_MAX) oooBuffer.shift();
  if (Math.random() < OOO_RATE && oooBuffer.length > 5) { const j = Math.floor(Math.random() * Math.min(oooBuffer.length, 100)); const past = oooBuffer[j]; broadcast(past); }
  broadcast(ev); if (Math.random() < DUP_RATE) { setTimeout(() => broadcast(ev), 5 + Math.random() * 25); }
}, Math.max(20, intervalMs));
function broadcast(msg) { const data = JSON.stringify(msg); for (const client of wss.clients) { if (client.readyState === WebSocket.OPEN) { try { client.send(data); } catch {} } } }
function clamp(min, max, v) { return Math.max(min, Math.min(max, v)); }
