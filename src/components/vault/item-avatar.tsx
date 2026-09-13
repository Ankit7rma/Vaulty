'use client';

import { useMemo, useState } from 'react';
import { KeyRound, StickyNote } from 'lucide-react';
import type { VaultItem } from '@/lib/vault/items';

/**
 * Colored letter avatar (always available) with an optional favicon overlay.
 * The favicon is only fetched when the user opts in via settings — see
 * showFavicons in settings.ts for the privacy tradeoff.
 */

const PALETTE = [
  'bg-slate-500',
  'bg-red-500',
  'bg-orange-500',
  'bg-amber-500',
  'bg-emerald-500',
  'bg-teal-500',
  'bg-cyan-500',
  'bg-sky-500',
  'bg-blue-500',
  'bg-indigo-500',
  'bg-violet-500',
  'bg-fuchsia-500',
  'bg-pink-500',
  'bg-rose-500',
] as const;

function paletteColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

function initial(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) return '?';
  return trimmed.slice(0, 1).toUpperCase();
}

function hostOf(url: string): string | null {
  if (!url) return null;
  try {
    const withScheme = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    return new URL(withScheme).hostname || null;
  } catch {
    return null;
  }
}

function faviconUrl(host: string): string {
  return `https://icons.duckduckgo.com/ip3/${host}.ico`;
}

export function ItemAvatar({
  item,
  showFavicon,
}: {
  item: VaultItem;
  showFavicon: boolean;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const host = useMemo(
    () => (item.type === 'login' ? hostOf(item.fields.url) : null),
    [item],
  );
  const color = paletteColor(item.fields.title || item.id);
  const letter = initial(item.fields.title);

  const useFavicon = showFavicon && host && !imgFailed;

  return (
    <span
      className={`relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md text-xs font-semibold text-white ${color}`}
      aria-hidden
    >
      {useFavicon ? (
        // eslint-disable-next-line @next/next/no-img-element -- external host, sized 20x20
        <img
          src={faviconUrl(host!)}
          alt=""
          width={20}
          height={20}
          onError={() => setImgFailed(true)}
          className="size-5"
        />
      ) : (
        <>
          <span>{letter}</span>
          <span className="absolute right-0.5 bottom-0.5 rounded-sm bg-black/25 p-0.5 text-white/90">
            {item.type === 'login' ? (
              <KeyRound className="size-2.5" />
            ) : (
              <StickyNote className="size-2.5" />
            )}
          </span>
        </>
      )}
    </span>
  );
}
