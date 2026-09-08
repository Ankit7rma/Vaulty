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