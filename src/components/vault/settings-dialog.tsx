'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  History,
  Loader2,
  MonitorSmartphone,
  Settings,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useSettings } from '@/lib/settings/settings-context';
import { AUTO_LOCK_OPTIONS, CLIPBOARD_OPTIONS } from '@/lib/settings/settings';
import { useVaultKey } from '@/lib/vault/vault-key-context';
import { panicWipeLocal } from '@/lib/vault/panic-wipe';
import { SessionsDialog } from './sessions-dialog';
import { AllowlistDialog } from './allowlist-dialog';
import { AuditLogDialog } from './audit-log-dialog';
import { TotpSetupDialog, TotpDisableDialog } from './totp-setup-dialog';

const SELECT_CLASS =
  'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

export function SettingsDialog() {
  const [open, setOpen] = useState(false);
  const [panicConfirmOpen, setPanicConfirmOpen] = useState(false);
  const [panicking, setPanicking] = useState(false);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [allowlistOpen, setAllowlistOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [totpSetupOpen, setTotpSetupOpen] = useState(false);
  const [totpDisableOpen, setTotpDisableOpen] = useState(false);
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [meTick, setMeTick] = useState(0);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch('/api/auth/me', { cache: 'no-store' })
      .then(async (res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setTotpEnabled(Boolean(data.totpEnabled));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, meTick]);
  const router = useRouter();
  const { lock } = useVaultKey();
  const { autoLockMinutes, clipboardClearSeconds, showFavicons, update } =
    useSettings();

  async function runPanicWipe() {
    setPanicking(true);
    lock();
    await panicWipeLocal();
    router.push('/login');
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label="Settings"
            title="Settings"
          >
            <Settings />
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Saved on this device.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="autolock">Auto-lock after inactivity</Label>
            <select
              id="autolock"
              className={SELECT_CLASS}
              value={autoLockMinutes}
              onChange={(e) => update({ autoLockMinutes: Number(e.target.value) })}
            >
              {AUTO_LOCK_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m === 0 ? 'Never' : `${m} minute${m === 1 ? '' : 's'}`}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="clipboard">Clear clipboard after copying</Label>
            <select
              id="clipboard"
              className={SELECT_CLASS}
              value={clipboardClearSeconds}
              onChange={(e) =>
                update({ clipboardClearSeconds: Number(e.target.value) })
              }
            >
              {CLIPBOARD_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s === 0 ? 'Never' : `${s} seconds`}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-4"
                checked={showFavicons}
                onChange={(e) => update({ showFavicons: e.target.checked })}
              />
              <span>
                <span className="font-medium">Show site favicons</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Loads each login&rsquo;s icon from
                  icons.duckduckgo.com/ip3. This leaks the item URL host to
                  DuckDuckGo. Off by default.
                </span>
              </span>
            </label>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={() => setSessionsOpen(true)}
          >
            <MonitorSmartphone className="size-4" aria-hidden />
            Active sessions
          </Button>

          <Button
            type="button"
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={() => setAllowlistOpen(true)}
          >
            <ShieldCheck className="size-4" aria-hidden />
            Login IP allowlist
          </Button>

          <Button
            type="button"
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={() => setAuditOpen(true)}
          >
            <History className="size-4" aria-hidden />
            Audit log
          </Button>

          <Button
            type="button"
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={() =>
              totpEnabled ? setTotpDisableOpen(true) : setTotpSetupOpen(true)
            }
          >
            <Smartphone className="size-4" aria-hidden />
            Two-factor authentication
            <span
              className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-medium ${
                totpEnabled
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-500'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {totpEnabled ? 'On' : 'Off'}
            </span>
          </Button>

          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
            <div className="mb-2 flex items-start gap-2">
              <AlertTriangle
                className="mt-0.5 size-4 shrink-0 text-destructive"
                aria-hidden
              />
              <div>
                <p className="text-sm font-medium">Panic wipe</p>
                <p className="text-xs text-muted-foreground">
                  Locks the vault, clears the clipboard, invalidates the
                  session cookie, and removes every Vaulty preference on this
                  device. Vault data on the server stays intact.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => setPanicConfirmOpen(true)}
              disabled={panicking}
            >
              Panic wipe
            </Button>
          </div>
        </div>
        <DialogFooter showCloseButton />
      </DialogContent>

      <SessionsDialog open={sessionsOpen} onOpenChange={setSessionsOpen} />
      <AllowlistDialog open={allowlistOpen} onOpenChange={setAllowlistOpen} />
      <AuditLogDialog open={auditOpen} onOpenChange={setAuditOpen} />
      <TotpSetupDialog
        open={totpSetupOpen}
        onOpenChange={setTotpSetupOpen}
        onEnabled={() => setMeTick((t) => t + 1)}
      />
      <TotpDisableDialog
        open={totpDisableOpen}
        onOpenChange={setTotpDisableOpen}
        onDisabled={() => setMeTick((t) => t + 1)}
      />

      <Dialog open={panicConfirmOpen} onOpenChange={setPanicConfirmOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Run panic wipe?</DialogTitle>
            <DialogDescription>
              This immediately locks the vault, clears the clipboard, signs
              you out, and forgets every preference on this device. Your
              encrypted vault items on the server stay untouched.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPanicConfirmOpen(false)}
              disabled={panicking}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={runPanicWipe}
              disabled={panicking}
              className="gap-1.5"
            >
              {panicking && (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              )}
              Wipe now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
