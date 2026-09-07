import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

type ButtonVariant = 'default' | 'primary' | 'ghost' | 'outline';

export function Button({
  className,
  variant = 'default',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      className={cn(
        'inline-flex min-h-9 items-center justify-center gap-2 rounded-md border px-3.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
        variant === 'primary' && 'border-primary bg-primary text-primary-foreground hover:bg-primary/90',
        variant === 'default' && 'border-border bg-background hover:bg-accent',
        variant === 'outline' && 'border-white/30 bg-white/10 text-white hover:bg-white/20',
        variant === 'ghost' && 'border-transparent bg-transparent hover:bg-accent',
        className,
      )}
      {...props}
    />
  );
}
