import type { TextareaHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn('field-control min-h-24 resize-y', className)} {...props} />;
}
