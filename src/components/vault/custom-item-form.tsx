'use client';

import { useState, type FormEvent } from 'react';
import {
  Clock,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  Star,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DialogClose, DialogFooter } from '@/components/ui/dialog';
import { CopyButton } from './copy-button';
import { ShareItem } from './share-item';
import { TagInput } from './tag-input';
import { HistoryDialog } from './history-dialog';
import { getTypeSpec, type FieldSpec } from '@/lib/vault/item-types';
import {
  decodeFilePayload,
  downloadFile,
  encodeFile,
  formatBytes,
} from '@/lib/vault/file-payload';
import {
  normalizeTags,
  type CustomFields,
  type ItemFields,
  type ItemType,
  type VaultItem,
} from '@/lib/vault/items';

interface CustomItemFormProps {
  type: ItemType;
  item?: VaultItem;
  preset?: ItemFields;
  onSave: (type: ItemType, fields: ItemFields, id?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

function openUrl(raw: string) {
  if (!raw) return;
  const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

function initialValues(item?: VaultItem, preset?: ItemFields): Record<string, string> {
  const source =
    item && 'values' in item.fields ? item.fields.values : undefined;
  if (source) return { ...source };
  if (preset && 'values' in preset) return { ...preset.values };
  return {};
}

export function CustomItemForm({
  type,
  item,
  preset,
  onSave,
  onDelete,
}: CustomItemFormProps) {
  const spec = getTypeSpec(type);
  const source = item?.fields ?? preset;
  const [title, setTitle] = useState<string>(
    () => source?.title ?? '',
  );
  const [values, setValues] = useState<Record<string, string>>(() =>
    initialValues(item, preset),
  );
  const [favorite, setFavorite] = useState<boolean>(
    () => Boolean(source?.favorite),
  );
  const [tags, setTags] = useState<string[]>(() => source?.tags ?? []);
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  function setField(name: string, value: string) {
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  function buildFields(): CustomFields {
    const cleanTags = normalizeTags(tags);
    // Strip empty string values so the ciphertext does not carry noise.
    const trimmed: Record<string, string> = {};
    for (const [k, v] of Object.entries(values)) {
      if (typeof v === 'string' && v.length > 0) trimmed[k] = v;
    }
    const out: CustomFields = { title, values: trimmed };
    if (favorite) out.favorite = true;
    if (cleanTags.length > 0) out.tags = cleanTags;
    return out;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSave(type, buildFields(), item?.id);
    } catch {
      setError('Could not save. Please try again.');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <div className="flex gap-1">
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              required
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setFavorite((f) => !f)}
              aria-label={favorite ? 'Unstar item' : 'Star item'}
              aria-pressed={favorite}
              className={favorite ? 'text-amber-500 hover:text-amber-600' : ''}
            >
              <Star fill={favorite ? 'currentColor' : 'none'} aria-hidden />
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="tags">Tags</Label>
          <TagInput id="tags" value={tags} onChange={setTags} />
        </div>

        {spec.fields.map((field) => (
          <CustomField
            key={field.name}
            field={field}
            value={values[field.name] ?? ''}
            revealed={Boolean(reveal[field.name])}
            onToggleReveal={() =>
              setReveal((prev) => ({ ...prev, [field.name]: !prev[field.name] }))
            }
            onChange={(v) => setField(field.name, v)}
          />
        ))}

        {item && <ShareItem type={type} fields={buildFields()} />}
      </div>

      <DialogFooter className="m-0 shrink-0">
        {item && (
          <div className="flex gap-2 sm:mr-auto">
            <Button
              type="button"
              variant="destructive"
              onClick={() => onDelete(item.id)}
            >
              <Trash2 /> Delete
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setHistoryOpen(true)}
              title="View earlier versions"
            >
              <Clock /> History
            </Button>
          </div>
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

      {item && (
        <HistoryDialog
          open={historyOpen}
          onOpenChange={setHistoryOpen}
          itemId={item.id}
          onRestore={async (fields) => {
            await onSave(type, fields, item.id);
          }}
        />
      )}
    </form>
  );
}

function CustomField({
  field,
  value,
  revealed,
  onToggleReveal,
  onChange,
}: {
  field: FieldSpec;
  value: string;
  revealed: boolean;
  onToggleReveal: () => void;
  onChange: (value: string) => void;
}) {
  const id = `custom-${field.name}`;
  const shared = {
    id,
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange(e.target.value),
    placeholder: field.placeholder,
    autoComplete: 'off' as const,
  };

  if (field.kind === 'textarea') {
    return (
      <div className="space-y-2">
        <Label htmlFor={id}>{field.label}</Label>
        <Textarea {...shared} rows={field.sensitive ? 3 : 4} />
        {field.sensitive && (
          <p className="text-xs text-muted-foreground">
            Sensitive value. Anyone with this can access the account.
          </p>
        )}
      </div>
    );
  }

  if (field.kind === 'password') {
    return (
      <div className="space-y-2">
        <Label htmlFor={id}>{field.label}</Label>
        <div className="flex gap-1">
          <Input
            {...shared}
            type={revealed ? 'text' : 'password'}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onToggleReveal}
            aria-label={revealed ? `Hide ${field.label}` : `Show ${field.label}`}
            title={revealed ? `Hide ${field.label}` : `Show ${field.label}`}
          >
            {revealed ? <EyeOff /> : <Eye />}
          </Button>
          <CopyButton value={value} label={field.label.toLowerCase()} />
        </div>
      </div>
    );
  }

  if (field.kind === 'url') {
    return (
      <div className="space-y-2">
        <Label htmlFor={id}>{field.label}</Label>
        <div className="flex gap-1">
          <Input {...shared} inputMode="url" />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => openUrl(value)}
            disabled={!value}
            aria-label={`Open ${field.label} in a new tab`}
            title={`Open ${field.label} in a new tab`}
          >
            <ExternalLink />
          </Button>
        </div>
      </div>
    );
  }

  if (field.kind === 'file') {
    return (
      <FileField
        id={id}
        label={field.label}
        value={value}
        onChange={onChange}
      />
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{field.label}</Label>
      <Input {...shared} />
    </div>
  );
}

function FileField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const payload = decodeFilePayload(value);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset the input so re-picking the same file still fires onChange.
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const encoded = await encodeFile(file);
      onChange(JSON.stringify(encoded));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read file.');
    } finally {
      setBusy(false);
    }
  }

  function clear() {
    onChange('');
    setError(null);
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {payload ? (
        <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{payload.name}</p>
            <p className="text-xs text-muted-foreground">
              {payload.type || 'file'} · {formatBytes(payload.size)}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => downloadFile(payload)}
            aria-label="Download file"
            title="Download"
          >
            <Download />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={clear}
            aria-label="Remove file"
            title="Remove"
          >
            <X />
          </Button>
        </div>
      ) : (
        <label
          htmlFor={id}
          className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed bg-muted/20 px-3 py-3 text-sm text-muted-foreground hover:bg-muted/40"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Upload className="size-4" aria-hidden />
          )}
          <span>{busy ? 'Encoding...' : 'Choose a file (up to 2 MB)'}</span>
          <input
            id={id}
            type="file"
            className="sr-only"
            onChange={onFilePicked}
            disabled={busy}
          />
        </label>
      )}
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        File is base64-encoded and stored inside the encrypted ciphertext.
      </p>
    </div>
  );
}
