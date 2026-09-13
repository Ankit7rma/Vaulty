'use client';

import { KeyRound, StickyNote } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ITEM_TEMPLATES, type ItemTemplate } from './templates';

interface TemplatePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (template: ItemTemplate) => void;
}

export function TemplatePicker({
  open,
  onOpenChange,
  onPick,
}: TemplatePickerProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New item from template</DialogTitle>
          <DialogDescription>
            Prefills the form. You can change anything before saving.
          </DialogDescription>
        </DialogHeader>
        <ul className="grid gap-1">
          {ITEM_TEMPLATES.map((template) => (
            <li key={template.id}>
              <button
                type="button"
                onClick={() => {
                  onPick(template);
                  onOpenChange(false);
                }}
                className="flex w-full items-start gap-3 rounded-lg border bg-background p-3 text-left transition-colors hover:bg-muted"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  {template.type === 'login' ? (
                    <KeyRound className="size-4" aria-hidden />
                  ) : (
                    <StickyNote className="size-4" aria-hidden />
                  )}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-tight">
                    {template.label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {template.description}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
