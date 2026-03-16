import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0e17] disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-[#3b82f6] text-white hover:bg-[#2563eb]',
        destructive: 'bg-[#ff3b69] text-white hover:bg-[#ff3b69]/90',
        outline: 'border border-[#1e2a3a] bg-transparent text-[#e2e8f0] hover:bg-[#1a2035] hover:text-[#e2e8f0]',
        secondary: 'bg-[#111827] text-[#e2e8f0] hover:bg-[#1a2035]',
        ghost: 'bg-transparent text-[#e2e8f0] hover:bg-[#1a2035]',
        link: 'text-[#3b82f6] underline-offset-4 hover:underline',
        yes: 'bg-[#00d26a] text-white hover:bg-[#00d26a]/90',
        no: 'bg-[#ff3b69] text-white hover:bg-[#ff3b69]/90',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-md px-8',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  readonly asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
