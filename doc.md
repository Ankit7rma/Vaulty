Step-wise plan
Phase 0 — Scaffold & infra (foundation)
create-next-app (App Router, TS, Tailwind, ESLint) in this folder.
Add shadcn/ui, Vitest, Playwright, Prisma.
docker-compose.yml for local Postgres; .env.example (structure only, no secrets).
GitHub Actions CI skeleton (lint + typecheck + unit tests).
Done when: app boots, npm test runs, CI is green on an empty test.
Phase 1 — Crypto module (do this FIRST, no UI) — PRD Milestone 2
Pure functions in lib/crypto/, zero DOM/React dependency:

deriveKey(masterPassword, salt) → AES-GCM 256 key (Argon2id, PBKDF2 fallback)
encrypt(key, plaintext) → { cipher, iv } (fresh 12-byte random IV per call)
decrypt(key, cipher, iv) → plaintext
generatePassword(opts) and generatePassphrase using crypto.getRandomValues
createVerifyBlob / verifyMasterPassword (the check-blob mechanism)
Done when: Vitest round-trip tests pass — encrypt→decrypt returns original, wrong key fails, IVs are unique, tampering is rejected.
Phase 2 — Auth + data layer — PRD Milestone 1
Prisma schema: User(id, email, accountHash, kdfSalt, verifyBlob, settings), VaultItem(id, userId, type, cipher, iv, updatedAt).
API routes: signup, login, logout using jose JWT in an httpOnly + secure cookie; account password hashed with argon2/bcrypt server-side.
Auth middleware guarding vault routes.
Done when: can sign up, log in, hit a protected route, log out.
Phase 3 — Unlock flow & key context — PRD Milestone 3
Onboarding: set master password → generate salt → store verifyBlob.
Unlock screen: derive key → verify check blob (client-side only).
React VaultKeyContext holding the key in memory; manual Lock button wipes it.
First-run explainer (account vs master, unrecoverable warning).
Done when: unlock/lock cycle works and key is gone from memory after lock.
Phase 4 — Vault CRUD — PRD Milestone 4
Login + Secure Note types; encrypt-before-send, decrypt-on-load (all fields incl. title).
List view with icons, reveal/hide toggle, copy username/password, open URL.
Done when: create → list → edit → delete round-trips through encrypted blobs; DB shows only ciphertext.
Phase 5 — Generator, clipboard, auto-lock — PRD Milestone 5
Password generator UI (length + char toggles), use-in-item.
Clipboard auto-clear after N seconds; auto-lock after inactivity + on tab close.
Done when: copied secret clears, vault locks on idle/close.
Phase 6 — Search, strength, polish — PRD Milestone 6
Client-side in-memory search over decrypted titles/usernames.
zxcvbn strength meter on item edit; settings (auto-lock + clipboard timeouts).
Phase 7 — Tests, docs, deploy — PRD Milestone 7
Playwright E2E: the 60-second demo (add login → lock → unlock → decrypt).
README with zero-knowledge architecture diagram; deploy to Vercel + Neon.
Done when: live URL, green CI, all Section 10 success criteria met.
Phase 8 — One wow feature — PRD Milestone 8
Recommend HIBP breach check (k-anonymity, only a hash prefix leaves the browser — stays true to the zero-knowledge story) or TOTP.

---

## Next features / nice-to-have backlog

Full list of features we could build on top of the current MVP. Nothing here is committed — this is the wish list we picked from when we scope future work. Costs are noted where a feature needs an external service; everything else is zero-cost (browser crypto + existing Postgres + Vercel/Neon free tier).

### Sharing
- Email-restricted one-time links (recipient must sign in as that email)
- N-view limit instead of one-shot
- Passphrase-protected shares (extra client-side key layer)
- Custom expiry per share (1h / 24h / 7d / 30d)
- Revoke share before expiry
- "Sent shares" history page
- Shared vaults with roles (Owner / Editor / Reader) — requires per-user asymmetric keypair + wrapped vault key
- Invite by email with pending / accepted state
- Transfer vault ownership
- Leave a vault
- Key rotation on member removal
- Per-item share notes ("here's my Netflix, don't tell mom")

### New item types (currently only Login + Note)
- Credit card
- Identity / personal info
- Passport / ID document
- SSH key
- API key
- Software license
- Wi-Fi network
- Bank account
- Crypto wallet seed phrase
- File attachment (encrypted client-side, chunked upload)
- Passkey (WebAuthn) storage

### Vault features
- Folders / tags
- Favorites / pinned items
- Trash / soft delete with restore
- Item history (previous passwords, revert)
- Duplicate detection
- Weak password report
- Reused password report
- Breach report across all items (batch HIBP)
- Master password strength assessment
- Vault export (encrypted JSON)
- Vault import (from 1Password, Bitwarden, LastPass, Chrome CSV)

### Security
- Two-factor for the account login (TOTP or WebAuthn)
- Passkey/WebAuthn login instead of password
- Emergency access (trusted contact can request after N days)
- Master password change (re-wrap all items)
- Vault key rotation on demand
- Suspicious login alerts
- Audit log of vault access
- IP allowlist for account login
- Session management ("sign out other devices")
- Configurable auto-lock (idle, tab close, system lock)
- Configurable clipboard clear window
- Panic wipe (clear local session immediately)

### UX / productivity
- Global search with fuzzy match
- Keyboard shortcuts (⌘K launcher, ⌘N new item)
- Command palette
- Bulk select + bulk move / delete / tag
- Item templates
- Auto-detect URL/username while browsing (bookmarklet)
- Dark mode toggle with system preference
- Multiple languages (i18n)
- Progressive Web App install
- Offline mode with sync on reconnect
- Import from clipboard (auto-detect otpauth://, JSON, CSV)

### Password generator
- Passphrase mode (word list)
- Pronounceable mode
- Custom rules per site (exclude ambiguous chars, force symbol)
- Save-to-history of generated passwords
- Password aging warnings (rotate every N days)

### Notifications (needs Resend or similar — free tier: 3000/mo)
- Master password entered from new device
- Share opened
- Share expired without being opened
- Weekly security digest email

### Extensions / integrations
- Browser extension (Chrome / Firefox) for autofill
- Mobile app (React Native or PWA)
- CLI (`vaulty get github`) for developers
- SSH agent bridge (for SSH key items)
- Import from `.env` files
- Export to `.env` for local dev

### Admin / team (only if we go SaaS)
- Team billing (Stripe)
- Seat management
- SSO (SAML, Google Workspace)
- SCIM provisioning
- Admin audit log
- Enforced password policies

### Polish
- Item icons auto-fetched from favicon
- Onboarding tour / interactive walkthrough
- In-app changelog
- Public status page
- Recovery kit PDF (emergency printable QR)

### Production hardening (from the readiness audit)
- Strict HTTP security headers (CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy) via `next.config.ts` or `middleware.ts`
- Rate limiting on `/api/auth/*`, `/api/vault/onboard`, `/api/share/*` (Upstash Ratelimit)
- Tighten session cookie to `sameSite: 'strict'` with `__Host-` prefix in production
- Env-var validation at boot (fail fast if `JWT_SECRET` / `DATABASE_URL` missing)
- Server-side password strength check (not just client meter)
- Structured logging + request IDs (pino) — needed for incident response
- Scheduled cleanup for expired share rows (Vercel Cron)
- Short-lived JWTs + refresh so logout invalidates instantly
- `error.tsx` and `not-found.tsx` under `src/app/`
- CSP-friendly styles (drop inline `style={{}}` in auth-shell hero pattern)
- SEO: `robots.txt`, `sitemap.ts`, OG images, `viewport` + `themeColor` exports
- `X-Robots-Tag: noindex` on `/api/*`, `/vault`, `/unlock`, `/onboard`, `/share/*`
- Prisma pooled `DATABASE_URL` + `DIRECT_URL` split for Neon migrations
