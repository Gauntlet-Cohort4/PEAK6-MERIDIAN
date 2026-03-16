import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#3b82f6] focus:ring-offset-2 focus:ring-offset-[#0a0e17]',
  {
    variants: {
      variant: {
        default: 'border-[#3b82f640] bg-[#3b82f620] text-[#3b82f6]',
        secondary: 'border-[#1e2a3a] bg-[#111827] text-[#e2e8f0]',
        destructive: 'border-[#ff3b6940] bg-[#ff3b6920] text-[#ff3b69]',
        outline: 'border-[#1e2a3a] text-[#64748b]',
        yes: 'border-[#00d26a40] bg-[#00d26a20] text-[#00d26a]',
        no: 'border-[#ff3b6940] bg-[#ff3b6920] text-[#ff3b69]',
        warning: 'border-[#f59e0b40] bg-[#f59e0b20] text-[#f59e0b]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps): React.JSX.Element {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
