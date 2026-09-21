Step-wise plan

## Foundation (done)

Phase 0 — Scaffold & infra
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

Phase 8 — Security features on top of the MVP (done)
HIBP breach check (k-anonymity), TOTP 2FA, WebAuthn/Passkey login, master password change (client re-wraps every item).

## Shipped after MVP

Phase 9 — Shared vaults (done, backend)
Per-user RSA-OAEP-4096 wrapping keypair (private key stored only as ciphertext under the master key). SharedVault + SharedVaultMembership + SharedVaultInvite models. Create vault + wrap key for creator. Email-based invites with pending/accepted state and cancellation. Editor/Reader roles enforced through a single canWrite/canManage helper. Item CRUD scoped to /api/vaults/[id]/items. Transfer ownership. Leave a vault. Key rotation on member removal (server verifies wrappedKeys covers remaining members AND items covers vault's items; atomic swap; history wiped).
Server never sees the vault symmetric key or item plaintext.
UI (create dialog, invite dialog, members panel, vault switcher, accept-invite banner) still to build.

## Planned

Phase 10 — Notifications (Resend, free tier: 3000/mo)
Email-restricted one-time shares with OTP delivery. New-device master-password alert. Share opened / expired notice. Weekly security digest. Suspicious-login warning.

Phase 11 — Emergency access
Trusted contact can request the vault; owner has N days to deny; on timeout, the wrapped key is released to the contact. Requires the Phase 9 asymmetric keypair.

Phase 12 — PWA + offline-first
Installable PWA (manifest + service worker). Encrypted blobs cached to IndexedDB. Reads decrypt from cache when offline; writes queue and replay on reconnect. Cross-tab sync via BroadcastChannel while offline. Full doc-cache reconciliation on reconnect proven with a smoke test.

Phase 13 — i18n
next-intl with server-negotiated locale. English + one starter locale.

Phase 14 — Polish
Public status page. Recovery kit PDF (printable QR of the KDF descriptor + a hint slot).

## Not in scope

Freemium tiers, seat billing, SSO, SCIM, admin roles across accounts, team billing dashboards. Vaulty stays all-free.

---

## Next features / nice-to-have backlog

Grouped by area. `[done]` markers reflect what has actually shipped. Everything unmarked is planned or optional.

### Sharing
- [done] Email-restricted one-time links (recipient must sign in as that email) — Phase 10 dependency
- [done] N-view limit instead of one-shot
- [done] Passphrase-protected shares (extra client-side key layer)
- [done] Custom expiry per share (1h / 24h / 7d / 30d)
- [done] Revoke share before expiry
- [done] "Sent shares" history page
- [done] Shared vaults with roles (Owner / Editor / Reader) — per-user RSA keypair + wrapped vault key
- [done] Invite by email with pending / accepted state
- [done] Transfer vault ownership
- [done] Leave a vault
- [done] Key rotation on member removal
- [done] Per-item share notes
- Signed invite links (alternative to email invites) — clickable token URL. Recipient signs in, keypair enrolls automatically, owner is prompted to complete the wrap once the recipient's public key is present. Removes the "recipient must have a keypair before you can invite them" constraint. Needs an `InviteLink` model with token + role + expiry, plus a "pending-wrap" queue on the vault.

### New item types (currently Login + Note + 11 more)
- [done] Credit card
- [done] Identity / personal info
- [done] Passport / ID document
- [done] SSH key
- [done] API key
- [done] Software license
- [done] Wi-Fi network
- [done] Bank account
- [done] Crypto wallet seed phrase
- [done] Passkey (WebAuthn) storage
- [done] File attachment (encrypted client-side; chunked upload deferred)

### Vault features
- [done] Folders / tags
- [done] Favorites / pinned items
- [done] Trash / soft delete with restore
- [done] Item history (previous passwords, revert)
- [done] Duplicate detection
- [done] Weak password report
- [done] Reused password report
- [done] Breach report across all items (batch HIBP)
- [done] Master password strength assessment
- [done] Vault export (encrypted JSON)
- [done] Vault import (1Password, Bitwarden, LastPass, Chrome CSV)
- Manual "Save version" checkpoint on top of the automatic snapshots. Adds a button that snapshots the current ciphertext with an optional label, so a user can pin a known-good version before a big edit.

### Security
- [done] Two-factor for the account login (TOTP)
- [done] Passkey/WebAuthn login instead of password
- [done] Master password change (re-wrap all items)
- Emergency access (trusted contact can request after N days) — Phase 11
- [done] Audit log of vault access
- [done] IP allowlist for account login
- [done] Session management ("sign out other devices")
- [done] Configurable auto-lock (idle, tab close, system lock)
- [done] Configurable clipboard clear window
- [done] Panic wipe (clear local session immediately)
- Suspicious login alerts — Phase 10

### UX / productivity
- [done] Global search with fuzzy match
- [done] Keyboard shortcuts (⌘K launcher, ⌘N new item)
- [done] Command palette
- [done] Bulk select + bulk move / delete / tag
- [done] Item templates
- [done] Dark mode toggle with system preference
- [done] Import from clipboard (auto-detect otpauth://, JSON, CSV)
- Progressive Web App install — Phase 12
- Offline mode with sync on reconnect — Phase 12
- Multiple languages (i18n) — Phase 13
- Auto-detect URL/username while browsing (bookmarklet)

### Password generator
- [done] Passphrase mode (word list)
- [done] Pronounceable mode
- [done] Custom rules per site (exclude ambiguous chars, force symbol)
- [done] Save-to-history of generated passwords
- [done] Password aging warnings (rotate every N days)

### Notifications (needs Resend or similar — free tier: 3000/mo) — Phase 10
- Master password entered from new device
- Share opened
- Share expired without being opened
- Weekly security digest email
- Suspicious login alert

### Extensions / integrations
- Browser extension (Chrome / Firefox) for autofill
- Mobile app (React Native or PWA — Phase 12 covers the PWA path)
- CLI (`vaulty get github`) for developers
- SSH agent bridge (for SSH key items)
- Import from `.env` files
- Export to `.env` for local dev

### Polish
- [done] Item icons auto-fetched from favicon
- [done] Onboarding tour / interactive walkthrough
- [done] In-app changelog
- Public status page — Phase 14
- Recovery kit PDF (emergency printable QR) — Phase 14

### Testing / regression guards
- [done] Vitest unit tests over the crypto module
- [done] Playwright E2E for the auth + unlock flow
- Plaintext-never-in-DB smoke test: after every mutating flow (create / update / delete / import / share / rotate), dump the DB, grep every byte for a known plaintext marker embedded in the fixture, and fail if the marker appears. Best possible ZK regression guard, catches any accidental un-encrypted write.

### Production hardening
- [done] Strict HTTP security headers (CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy)
- [done] Rate limiting on /api/auth/*, /api/vault/onboard, /api/share/*
- [done] Session cookie with `sameSite: 'strict'` and `__Host-` prefix in production
- [done] Env-var validation at boot (fail fast on missing JWT_SECRET / DATABASE_URL)
- [done] Server-side password strength check
- [done] Structured logging + request IDs
- [done] Scheduled cleanup for expired share, session, and invite rows (Vercel Cron)
- [done] error.tsx and not-found.tsx under src/app/
- [done] CSP-friendly styles
- [done] SEO: robots.txt, sitemap.ts, OG images
- [done] X-Robots-Tag: noindex on /api/*, /vault, /unlock, /onboard, /share/*
- [done] Prisma pooled DATABASE_URL + DIRECT_URL split for Neon migrations
- Short-lived JWTs + refresh tokens so logout invalidates instantly. Current sessions are long-lived JWTs backed by a Session row (revoked by row-deletion). A short-lived access token + refresh cookie shortens the "stale JWT" window to minutes instead of hours; the refresh call bumps the Session row's lastUsedAt too.
