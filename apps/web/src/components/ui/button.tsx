import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-sm font-medium transition-[background-color,border-color,color,transform] duration-150 ease-out select-none active:translate-y-px disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:stroke-[1.5]',
  {
    variants: {
      variant: {
        /** The one main action on a screen. */
        primary: 'bg-signal text-signal-ink hover:bg-[color-mix(in_oklab,var(--signal)_88%,var(--text))]',
        secondary: 'border border-line bg-panel-2 text-text hover:border-line-strong hover:bg-panel',
        ghost: 'text-muted hover:bg-panel-2 hover:text-text',
        danger:
          'border border-[color-mix(in_oklab,var(--fail)_45%,transparent)] text-fail hover:bg-[color-mix(in_oklab,var(--fail)_10%,transparent)]',
        link: 'h-auto px-0 text-signal underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-8 px-3 text-[13px]',
        md: 'h-9 px-4 text-sm',
        lg: 'h-11 px-5 text-[15px]',
        icon: 'size-9',
        'icon-sm': 'size-8',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, type, ...props }, ref) => {
    const Component = asChild ? Slot : 'button';
    return (
      <Component
        ref={ref}
        type={asChild ? undefined : (type ?? 'button')}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';
