import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export function Badge({ className, tone = 'default', ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: 'default' | 'success' | 'warning' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground',
        tone === 'success' && 'bg-emerald-950/50 text-emerald-300',
        tone === 'warning' && 'bg-amber-950/50 text-amber-300',
        className,
      )}
      {...props}
    />
  );
}
