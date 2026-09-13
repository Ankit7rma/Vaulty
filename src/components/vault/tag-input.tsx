'use client';

import { useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { normalizeTags } from '@/lib/vault/items';

/**
 * Chip-style tag editor. Adds a tag on Enter or comma; Backspace on an empty
 * field removes the last tag. Values are normalized (trimmed, deduplicated
 * case-insensitively, capped) on every mutation.
 */
export function TagInput({
  value,
  onChange,
  id,
  placeholder = 'Add tag and press Enter',
}: {
  value: string[];
  onChange: (next: string[]) => void;
  id?: string;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState('');

  function commit(raw: string) {
    if (!raw.trim()) return;
    onChange(normalizeTags([...value, raw]));
    setDraft('');
  }

  function remove(tag: string) {
    onChange(value.filter((t) => t !== tag));
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commit(draft);
    } else if (e.key === 'Backspace' && draft === '' && value.length > 0) {
      e.preventDefault();
      remove(value[value.length - 1]);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1 rounded-lg border border-input bg-transparent px-1.5 py-1 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
      {value.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium"
        >
          {tag}
          <button
            type="button"
            onClick={() => remove(tag)}
            aria-label={`Remove tag ${tag}`}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="size-3" aria-hidden />
          </button>
        </span>
      ))}
      <Input
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => commit(draft)}
        placeholder={value.length === 0 ? placeholder : ''}
        className="h-6 flex-1 border-none px-1 shadow-none focus-visible:ring-0"
        aria-label="Tags"
      />
    </div>
  );
}
