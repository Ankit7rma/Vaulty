# Vaulty

A zero-knowledge password manager. All encryption and decryption happen in your
browser; the server only ever stores opaque encrypted blobs. Even a full
database leak reveals nothing usable.

> Portfolio flagship demonstrating applied cryptography + secure full-stack
> engineering. See [PRD.md](PRD.md) for the full product spec.

## Security model (the core idea)

Two independent passwords:

- **Account password** authenticates you to the server, which stores only an
  argon2/bcrypt hash and issues a JWT session. It proves identity and can never
  decrypt anything.
- **Master password** never leaves the browser. It is stretched with Argon2id
  (PBKDF2 fallback) into a 256-bit AES-GCM key held only in memory. Every item
  is encrypted client-side with a fresh random 12-byte IV before it is sent.

Master-password correctness is verified client-side by decrypting a stored
"check blob", never by sending anything to the server.

## Tech stack

- Next.js 16 (App Router) + TypeScript + React 19
- Web Crypto API (`crypto.subtle`) + `hash-wasm` (Argon2id)
- Tailwind CSS v4 + shadcn/ui
- PostgreSQL + Prisma ORM
- Vitest (unit) + Playwright (E2E)
- Deploy: Vercel + Neon; local Postgres via Docker Compose; CI via GitHub Actions

## Getting started

Prerequisites: Node 22 (see `.nvmrc`) and Docker.

```bash
nvm use                 # Node 22
npm install
cp env.example .env     # then edit values
docker compose up -d    # local Postgres
npm run db:migrate      # create tables
npm run dev             # http://localhost:3000
```

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` / `start` | Production build / serve |
| `npm run lint` / `typecheck` | ESLint / TypeScript |
| `npm test` / `test:watch` | Vitest unit tests |
| `npm run e2e` | Playwright E2E |
| `npm run db:migrate` / `db:studio` | Prisma migrate / studio |

## Notes

- Prisma is pinned to the 6.x line: Prisma 7 removed the classic
  `datasource.url` in favor of driver adapters. `npm audit` reports 3 high
  findings from `deepmerge-ts`, a transitive dependency of the Prisma **CLI**
  (build-time only). `@prisma/client`, the sole runtime Prisma package, has zero
  dependencies, so nothing vulnerable ships in the deployed bundle. These clear
  once Prisma bumps `deepmerge-ts` upstream.

## Status

Milestone 0 (scaffold + tooling) complete. Next up: the crypto module
(Milestone 2) with round-trip tests, before any vault UI. Build order is tracked
in [PRD.md](PRD.md#12-milestones-build-order).
