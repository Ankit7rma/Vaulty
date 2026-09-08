import type { ReactNode } from 'react';
import Link from 'next/link';
import { KeyRound, ShieldCheck, EyeOff, Sparkles } from 'lucide-react';

type AuthShellProps = {
  title: string;
  description: string;
  eyebrow?: string;
  footer: ReactNode;
  children: ReactNode;
};

const FEATURES = [
  {
    icon: ShieldCheck,
    title: 'Zero-knowledge by design',
    body: 'Secrets are encrypted on your device. The server only ever sees ciphertext.',
  },
  {
    icon: KeyRound,
    title: 'Your master key stays local',
    body: 'Derived in the browser with Argon2id and held only in memory while unlocked.',
  },
  {
    icon: EyeOff,
    title: 'No trackers, no telemetry',
    body: 'A quiet, focused vault. Nothing leaves the browser without your action.',
  },
];

export function AuthShell({
  title,
  description,
  eyebrow,
  footer,
  children,
}: AuthShellProps) {
  return (
    <main className="relative flex min-h-svh w-full flex-col overflow-hidden bg-background lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <BackgroundDecor />

      <section className="relative z-10 hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-primary via-primary to-primary/85 p-10 text-primary-foreground lg:flex xl:p-14">
        <HeroPattern />
        <div className="relative flex items-center gap-2.5">
          <BrandMark tone="light" />
          <span className="font-heading text-lg font-semibold tracking-tight">
            Vaulty
          </span>
        </div>

        <div className="relative space-y-8">
          <div className="space-y-4">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary-foreground/20 bg-primary-foreground/10 px-3 py-1 text-xs font-medium backdrop-blur">
              <Sparkles className="size-3.5" aria-hidden />
              Encrypted end-to-end
            </span>
            <h2 className="font-heading text-3xl leading-tight font-semibold tracking-tight xl:text-4xl">
              A password vault the server cannot read.
            </h2>
            <p className="max-w-md text-sm text-primary-foreground/75 xl:text-base">
              Vaulty keeps your logins, notes, and TOTP codes locked behind a
              master password that never leaves your browser.
            </p>
          </div>

          <ul className="space-y-4">
            {FEATURES.map(({ icon: Icon, title: t, body }) => (
              <li key={t} className="flex gap-3">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-primary-foreground/10 ring-1 ring-primary-foreground/15">
                  <Icon className="size-4" aria-hidden />
                </span>
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">{t}</p>
                  <p className="text-xs text-primary-foreground/70">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-primary-foreground/60">
          Built on modern Web Crypto. Open source and inspectable.
        </p>
      </section>

      <section className="relative z-10 flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <Link
            href="/"
            className="mb-8 inline-flex items-center gap-2 text-foreground lg:hidden"
          >
            <BrandMark tone="dark" />
            <span className="font-heading text-lg font-semibold tracking-tight">
              Vaulty
            </span>
          </Link>

          <div className="rounded-2xl border border-border/60 bg-card/90 p-6 shadow-xl shadow-foreground/5 backdrop-blur-sm sm:p-8">
            <div className="mb-6 space-y-1.5">
              {eyebrow && (
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {eyebrow}
                </p>
              )}
              <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
                {title}
              </h1>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>

            {children}

            <div className="mt-6 border-t border-border/60 pt-5 text-center text-sm text-muted-foreground">
              {footer}
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground/80">
            Protected with Argon2id + AES-GCM. We never see your master
            password.
          </p>
        </div>
      </section>
    </main>
  );
}

function BrandMark({ tone }: { tone: 'light' | 'dark' }) {
  const bg =
    tone === 'light'
      ? 'bg-primary-foreground text-primary'
      : 'bg-primary text-primary-foreground';
  return (
    <span
      className={`flex size-9 items-center justify-center rounded-lg ${bg} shadow-sm`}
      aria-hidden
    >
      <KeyRound className="size-4.5" />
    </span>
  );
}

function BackgroundDecor() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-0 lg:hidden"
    >
      <div className="absolute -top-32 -right-24 size-72 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute -bottom-24 -left-24 size-72 rounded-full bg-primary/10 blur-3xl" />
    </div>
  );
}

function HeroPattern() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 opacity-[0.08]"
      style={{
        backgroundImage:
          'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)',
        backgroundSize: '24px 24px',
      }}
    />
  );
}
