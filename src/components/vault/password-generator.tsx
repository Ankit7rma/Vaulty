'use client';

import { useState } from 'react';
import { RefreshCw, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { CopyButton } from './copy-button';
import { generatePassword, type PasswordOptions } from '@/lib/crypto';

const DEFAULT_OPTIONS: PasswordOptions = {
  length: 20,
  uppercase: true,
  lowercase: true,
  numbers: true,
  symbols: true,
  excludeAmbiguous: false,
};

const TOGGLES: { key: keyof PasswordOptions; label: string }[] = [
  { key: 'uppercase', label: 'Uppercase (A-Z)' },
  { key: 'lowercase', label: 'Lowercase (a-z)' },
  { key: 'numbers', label: 'Numbers (0-9)' },
  { key: 'symbols', label: 'Symbols (!@#...)' },
  { key: 'excludeAmbiguous', label: 'Exclude look-alikes (0/O, 1/l)' },
];

function generate(options: PasswordOptions): string {
  try {
    return generatePassword(options);
  } catch {
    return '';
  }
}

export function PasswordGenerator({
  onUse,
}: {
  onUse: (password: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<PasswordOptions>(DEFAULT_OPTIONS);
  const [value, setValue] = useState('');

  function applyOptions(next: PasswordOptions) {
    // Never allow every character set to be off.
    if (!next.uppercase && !next.lowercase && !next.numbers && !next.symbols) {
      return;
    }
    setOptions(next);
    setValue(generate(next));
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) setValue(generate(options));
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Generate password"
            title="Generate password"
          >
            <Wand2 />
          </Button>
        }
      />
      <PopoverContent align="end" className="w-80">
        <div className="flex items-center gap-1">
          <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-2 py-1.5 font-mono text-sm">
            {value || ' '}
          </code>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setValue(generate(options))}
            aria-label="Regenerate"
            title="Regenerate"
          >
            <RefreshCw />
          </Button>
          <CopyButton value={value} label="generated password" />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label>Length</Label>
            <span className="text-sm tabular-nums text-muted-foreground">
              {options.length}
            </span>
          </div>
          <Slider
            min={8}
            max={64}
            step={1}
            value={options.length}
            onValueChange={(v) =>
              applyOptions({
                ...options,
                length: Array.isArray(v) ? v[0] : (v as number),
              })
            }
          />
        </div>

        <div className="space-y-2">
          {TOGGLES.map(({ key, label }) => (
            <div key={key} className="flex items-center gap-2">
              <Checkbox
                id={`gen-${key}`}
                checked={Boolean(options[key])}
                onCheckedChange={(checked) =>
                  applyOptions({ ...options, [key]: checked })
                }
              />
              <Label htmlFor={`gen-${key}`} className="font-normal">
                {label}
              </Label>
            </div>
          ))}
        </div>

        <Button
          type="button"
          className="w-full"
          disabled={!value}
          onClick={() => {
            onUse(value);
            setOpen(false);
          }}
        >
          Use password
        </Button>
      </PopoverContent>
    </Popover>
  );
}
