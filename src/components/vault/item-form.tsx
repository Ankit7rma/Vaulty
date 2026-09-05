'use client';

import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, ExternalLink, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DialogClose, DialogFooter } from '@/components/ui/dialog';
import { CopyButton } from './copy-button';
import { PasswordGenerator } from './password-generator';
import type { ItemFields, ItemType, VaultItem } from '@/lib/vault/items';

function initialValues(type: ItemType, item?: VaultItem): Record<string, string> {
  if (item) return { ...item.fields };
  return type === 'login'
    ? { title: '', username: '', password: '', url: '', notes: '' }
    : { title: '', body: '' };
}

function buildFields(type: ItemType, v: Record<string, string>): ItemFields {
  if (type === 'login') {
    return {
      title: v.title ?? '',
      username: v.username ?? '',
      password: v.password ?? '',
      url: v.url ?? '',
      notes: v.notes ?? '',
    };
  }
  return { title: v.title ?? '', body: v.body ?? '' };
}

function openUrl(raw: string) {
  if (!raw) return;
  const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

export function ItemForm({
  type,
  item,
  onSave,
  onDelete,
}: {
  type: ItemType;
  item?: VaultItem;
  onSave: (type: ItemType, fields: ItemFields, id?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    initialValues(type, item),
  );
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(name: string, value: string) {
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!values.title?.trim()) {
      setError('Title is required.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSave(type, buildFields(type, values), item?.id);
    } catch {
      setError('Could not save. Please try again.');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          value={values.title ?? ''}
          onChange={(e) => set('title', e.target.value)}
          autoFocus
          required
        />
      </div>

      {type === 'login' ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <div className="flex gap-1">
              <Input
                id="username"
                value={values.username ?? ''}
                onChange={(e) => set('username', e.target.value)}
                autoComplete="off"
              />
              <CopyButton value={values.username ?? ''} label="username" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="flex gap-1">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={values.password ?? ''}
                onChange={(e) => set('password', e.target.value)}
                autoComplete="off"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff /> : <Eye />}
              </Button>
              <PasswordGenerator
                onUse={(pw) => {
                  set('password', pw);
                  setShowPassword(true);
                }}
              />
              <CopyButton value={values.password ?? ''} label="password" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="url">URL</Label>
            <div className="flex gap-1">
              <Input
                id="url"
                value={values.url ?? ''}
                onChange={(e) => set('url', e.target.value)}
                inputMode="url"
                autoComplete="off"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => openUrl(values.url ?? '')}
                disabled={!values.url}
                aria-label="Open URL in a new tab"
                title="Open URL in a new tab"
              >
                <ExternalLink />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={values.notes ?? ''}
              onChange={(e) => set('notes', e.target.value)}
              rows={3}
            />
          </div>
        </>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="body">Note</Label>
          <Textarea
            id="body"
            value={values.body ?? ''}
            onChange={(e) => set('body', e.target.value)}
            rows={6}
          />
        </div>
      )}

      <DialogFooter>
        {item && (
          <Button
            type="button"
            variant="destructive"
            onClick={() => onDelete(item.id)}
            className="sm:mr-auto"
          >
            <Trash2 /> Delete
          </Button>
        )}
        <DialogClose
          render={
            <Button type="button" variant="outline">
              Cancel
            </Button>
          }
        />
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving...' : 'Save'}
        </Button>
      </DialogFooter>
    </form>
  );
}
