'use client';

import { useState } from 'react';
import { AlertCircle, Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { parseImport, type ImportPreview } from '@/lib/vault/import';
import type { ItemFields, ItemType } from '@/lib/vault/items';

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (
    items: Array<{ type: ItemType; fields: ItemFields }>,
  ) => Promise<void>;
}

export function ImportDialog({ open, onOpenChange, onImport }: ImportDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80svh] flex-col gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="border-b p-4">
          <DialogTitle>Import items</DialogTitle>
          <DialogDescription>
            Paste an export file or upload one. Parsed entirely in your browser.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <ImportBody
            onImport={onImport}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ImportBody({
  onImport,
  onClose,
}: {
  onImport: (items: Array<{ type: ItemType; fields: ItemFields }>) => Promise<void>;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [needsPassphrase, setNeedsPassphrase] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const contents = await file.text();
    setText(contents);
    setPreview(null);
    setError(null);
  }

  async function analyze() {
    setError(null);
    setBusy(true);
    try {
      const result = await parseImport(text, { passphrase });
      setPreview(result);
      setNeedsPassphrase(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not parse.';
      if (/passphrase/i.test(message)) {
        setNeedsPassphrase(true);
      }
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  async function commitImport() {
    if (!preview) return;
    setBusy(true);
    try {
      await onImport(preview.items);
      onClose();
    } catch {
      setError('Could not import. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <div className="space-y-2">
          <Label htmlFor="import-text">
            Paste an export file (or upload below)
          </Label>
          <Textarea
            id="import-text"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setPreview(null);
            }}
            rows={7}
            placeholder="Vaulty JSON, Bitwarden JSON, or CSV..."
            className="font-mono text-xs"
          />
          <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed bg-muted/20 px-3 py-2 text-xs text-muted-foreground hover:bg-muted/40">
            <Upload className="size-3.5" aria-hidden />
            Upload a file
            <input
              type="file"
              accept=".json,.csv,.txt,application/json,text/csv,text/plain"
              className="sr-only"
              onChange={onFilePicked}
            />
          </label>
        </div>

        {needsPassphrase && (
          <div className="space-y-2">
            <Label htmlFor="import-pass">Export passphrase</Label>
            <Input
              id="import-pass"
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              autoComplete="current-password"
            />
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/8 px-3 py-2 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{error}</span>
          </div>
        )}

        {preview && (
          <div className="space-y-2 rounded-md border bg-muted/30 p-3">
            <p className="text-sm font-medium">
              Ready to import {preview.items.length} item
              {preview.items.length === 1 ? '' : 's'}{' '}
              <span className="text-xs text-muted-foreground">
                ({preview.format})
              </span>
            </p>
            {preview.warnings.length > 0 && (
              <ul className="space-y-0.5 text-xs text-amber-700 dark:text-amber-500">
                {preview.warnings.slice(0, 5).map((w, i) => (
                  <li key={i}>• {w}</li>
                ))}
                {preview.warnings.length > 5 && (
                  <li>+ {preview.warnings.length - 5} more warnings</li>
                )}
              </ul>
            )}
            <ul className="max-h-40 overflow-y-auto space-y-0.5 text-xs">
              {preview.items.slice(0, 20).map((item, i) => (
                <li key={i} className="truncate text-muted-foreground">
                  <span className="text-foreground">{item.fields.title || 'Untitled'}</span>
                  {' — '}
                  {item.type}
                </li>
              ))}
              {preview.items.length > 20 && (
                <li className="text-muted-foreground">
                  + {preview.items.length - 20} more
                </li>
              )}
            </ul>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 border-t bg-muted/40 p-3">
        <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        {!preview ? (
          <Button
            type="button"
            onClick={analyze}
            disabled={busy || text.trim().length === 0}
            className="gap-1.5"
          >
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Analyze
          </Button>
        ) : (
          <Button
            type="button"
            onClick={commitImport}
            disabled={busy || preview.items.length === 0}
            className="gap-1.5"
          >
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Import {preview.items.length} item
            {preview.items.length === 1 ? '' : 's'}
          </Button>
        )}
      </div>
    </div>
  );
}
