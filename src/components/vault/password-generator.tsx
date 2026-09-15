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
import {
  generatePassphrase,
  generatePassword,
  generatePronounceable,
  type PassphraseOptions,
  type PasswordOptions,
  type PronounceableOptions,
} from '@/lib/crypto';

type Mode = 'chars' | 'passphrase' | 'pronounceable';

const DEFAULT_CHAR_OPTIONS: PasswordOptions = {
  length: 20,
  uppercase: true,
  lowercase: true,
  numbers: true,
  symbols: true,
  excludeAmbiguous: false,
};

const DEFAULT_PASSPHRASE_OPTIONS: PassphraseOptions = {
  words: 5,
  separator: '-',
  capitalize: false,
  includeNumber: false,
};

const DEFAULT_PRONOUNCEABLE_OPTIONS: PronounceableOptions = {
  syllables: 5,
  separator: '-',
  capitalize: false,
  includeNumber: false,
};

const CHAR_TOGGLES: { key: keyof PasswordOptions; label: string }[] = [
  { key: 'uppercase', label: 'Uppercase (A-Z)' },
  { key: 'lowercase', label: 'Lowercase (a-z)' },
  { key: 'numbers', label: 'Numbers (0-9)' },
  { key: 'symbols', label: 'Symbols (!@#...)' },
  { key: 'excludeAmbiguous', label: 'Exclude look-alikes (0/O, 1/l)' },
];

function generateChars(options: PasswordOptions): string {
  try {
    return generatePassword(options);
  } catch {
    return '';
  }
}

function generateWords(options: PassphraseOptions): string {
  try {
    return generatePassphrase(options);
  } catch {
    return '';
  }
}

function generateSyllables(options: PronounceableOptions): string {
  try {
    return generatePronounceable(options);
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
  const [mode, setMode] = useState<Mode>('chars');
  const [charOpts, setCharOpts] = useState<PasswordOptions>(DEFAULT_CHAR_OPTIONS);
  const [phraseOpts, setPhraseOpts] = useState<PassphraseOptions>(
    DEFAULT_PASSPHRASE_OPTIONS,
  );
  const [syllableOpts, setSyllableOpts] = useState<PronounceableOptions>(
    DEFAULT_PRONOUNCEABLE_OPTIONS,
  );
  const [value, setValue] = useState('');

  function regenerate(nextMode: Mode = mode) {
    setValue(
      nextMode === 'chars'
        ? generateChars(charOpts)
        : nextMode === 'passphrase'
          ? generateWords(phraseOpts)
          : generateSyllables(syllableOpts),
    );
  }

  function applyCharOpts(next: PasswordOptions) {
    if (!next.uppercase && !next.lowercase && !next.numbers && !next.symbols) {
      return;
    }
    setCharOpts(next);
    setValue(generateChars(next));
  }

  function applyPhraseOpts(next: PassphraseOptions) {
    setPhraseOpts(next);
    setValue(generateWords(next));
  }

  function applySyllableOpts(next: PronounceableOptions) {
    setSyllableOpts(next);
    setValue(generateSyllables(next));
  }

  function switchMode(next: Mode) {
    setMode(next);
    regenerate(next);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) regenerate();
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
      <PopoverContent align="end" className="w-80 space-y-3">
        <div className="flex gap-1 rounded-md bg-muted p-0.5 text-xs font-medium">
          <ModeChip
            active={mode === 'chars'}
            onClick={() => switchMode('chars')}
          >
            Characters
          </ModeChip>
          <ModeChip
            active={mode === 'passphrase'}
            onClick={() => switchMode('passphrase')}
          >
            Passphrase
          </ModeChip>
          <ModeChip
            active={mode === 'pronounceable'}
            onClick={() => switchMode('pronounceable')}
          >
            Pronounceable
          </ModeChip>
        </div>

        <div className="flex items-center gap-1">
          <code className="min-w-0 flex-1 rounded-md bg-muted px-2 py-1.5 font-mono text-sm break-all">
            {value || ' '}
          </code>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => regenerate()}
            aria-label="Regenerate"
            title="Regenerate"
          >
            <RefreshCw />
          </Button>
          <CopyButton value={value} label="generated password" />
        </div>

        {mode === 'pronounceable' ? (
          <>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Syllables</Label>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {syllableOpts.syllables}
                </span>
              </div>
              <Slider
                min={3}
                max={10}
                step={1}
                value={syllableOpts.syllables}
                onValueChange={(v) =>
                  applySyllableOpts({
                    ...syllableOpts,
                    syllables: Array.isArray(v) ? v[0] : (v as number),
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="syl-sep" className="font-normal">
                  Separator
                </Label>
                <select
                  id="syl-sep"
                  className="ml-auto h-7 rounded-md border border-input bg-transparent px-2 text-sm"
                  value={syllableOpts.separator ?? '-'}
                  onChange={(e) =>
                    applySyllableOpts({
                      ...syllableOpts,
                      separator: e.target.value,
                    })
                  }
                >
                  <option value="-">- (dash)</option>
                  <option value=".">. (dot)</option>
                  <option value="">(none)</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="syl-caps"
                  checked={Boolean(syllableOpts.capitalize)}
                  onCheckedChange={(checked) =>
                    applySyllableOpts({
                      ...syllableOpts,
                      capitalize: Boolean(checked),
                    })
                  }
                />
                <Label htmlFor="syl-caps" className="font-normal">
                  Capitalize each syllable
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="syl-num"
                  checked={Boolean(syllableOpts.includeNumber)}
                  onCheckedChange={(checked) =>
                    applySyllableOpts({
                      ...syllableOpts,
                      includeNumber: Boolean(checked),
                    })
                  }
                />
                <Label htmlFor="syl-num" className="font-normal">
                  Append a random number
                </Label>
              </div>
            </div>
          </>
        ) : mode === 'chars' ? (
          <>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Length</Label>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {charOpts.length}
                </span>
              </div>
              <Slider
                min={8}
                max={64}
                step={1}
                value={charOpts.length}
                onValueChange={(v) =>
                  applyCharOpts({
                    ...charOpts,
                    length: Array.isArray(v) ? v[0] : (v as number),
                  })
                }
              />
            </div>

            <div className="space-y-2">
              {CHAR_TOGGLES.map(({ key, label }) => (
                <div key={key} className="flex items-center gap-2">
                  <Checkbox
                    id={`gen-${key}`}
                    checked={Boolean(charOpts[key])}
                    onCheckedChange={(checked) =>
                      applyCharOpts({ ...charOpts, [key]: checked })
                    }
                  />
                  <Label htmlFor={`gen-${key}`} className="font-normal">
                    {label}
                  </Label>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Words</Label>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {phraseOpts.words}
                </span>
              </div>
              <Slider
                min={3}
                max={10}
                step={1}
                value={phraseOpts.words}
                onValueChange={(v) =>
                  applyPhraseOpts({
                    ...phraseOpts,
                    words: Array.isArray(v) ? v[0] : (v as number),
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="phrase-sep" className="font-normal">
                  Separator
                </Label>
                <select
                  id="phrase-sep"
                  className="ml-auto h-7 rounded-md border border-input bg-transparent px-2 text-sm"
                  value={phraseOpts.separator ?? '-'}
                  onChange={(e) =>
                    applyPhraseOpts({ ...phraseOpts, separator: e.target.value })
                  }
                >
                  <option value="-">- (dash)</option>
                  <option value=".">. (dot)</option>
                  <option value="_">_ (underscore)</option>
                  <option value=" ">space</option>
                  <option value="">(none)</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="phrase-caps"
                  checked={Boolean(phraseOpts.capitalize)}
                  onCheckedChange={(checked) =>
                    applyPhraseOpts({ ...phraseOpts, capitalize: Boolean(checked) })
                  }
                />
                <Label htmlFor="phrase-caps" className="font-normal">
                  Capitalize each word
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="phrase-num"
                  checked={Boolean(phraseOpts.includeNumber)}
                  onCheckedChange={(checked) =>
                    applyPhraseOpts({
                      ...phraseOpts,
                      includeNumber: Boolean(checked),
                    })
                  }
                />
                <Label htmlFor="phrase-num" className="font-normal">
                  Append a random number
                </Label>
              </div>
            </div>
          </>
        )}

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

function ModeChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex-1 rounded px-2 py-1 transition-colors ${
        active
          ? 'bg-background text-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}
