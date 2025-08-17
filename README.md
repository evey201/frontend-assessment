# FrontEnd Assessment

A small, production-style slice of a real-time dashboard using **Next.js App Router**, **React 19**, **TypeScript**, **Tailwind**, **Zustand**, and **react-virtuoso**.

## Quick start
1) Ensure Node 20: `nvm use 20` (see `.nvmrc`)
2) Install deps: `npm i`
3) Start the simulator: `npm run sim`
4) In another terminal: `npm run dev`
5) Open `http://localhost:3000/devices`

> WSL users: keep the project under your Linux home (e.g. `~/work/frontend-assessment`), not `/mnt/c/...`, to avoid file lock issues during `npm i`.

## Build This
- **Devices table** with virtualization, filter by ID/status, keyboard/focus a11y.
- **Details page** with a 30s CPU mini chart (SVG, throttled ~5–10 fps) and latest metrics.
- **Reboot** Server Action with optimistic UI + rollback and idempotency key.
- **Resilience**: WebSocket auto-reconnect and simple batching; tolerate duplicates/out-of-order (sim includes `seq`).

## Tests
Run `npm test` (Vitest + RTL).

## Submission
Choose ONE:
- **A) Git repository link** (public or invite reviewer). Ensure `npm run sim`, `npm run dev`, `npm test` work.
- **B) ZIP of the project root** (name like `YOURNAME-FrontEnd-Assessment.zip`), include source + docs; exclude heavy folders (`node_modules`, `.next`, `dist`).

## Docs
See `/docs/FrontEnd-Assessment-Instructions.pdf` for candidate instructions (ASCII-only).
