import React from 'react';
import clsx from 'clsx';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** The visual style of the button. */
  variant?: ButtonVariant;
  /** The size of the button. */
  size?: ButtonSize;
  /** If true, the button will be in a loading state. */
  loading?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-500 text-white hover:bg-brand-600 focus-visible:outline-brand-300 disabled:bg-brand-200 disabled:text-slate-400',
  secondary:
    'bg-white text-slate-700 border border-slate-200 hover:border-brand-200 hover:text-brand-600 focus-visible:outline-brand-300 disabled:bg-slate-100 disabled:text-slate-400',
  ghost:
    'bg-transparent text-slate-600 hover:bg-slate-100 focus-visible:outline-brand-300 disabled:text-slate-300',
  danger:
    'bg-red-500 text-white hover:bg-red-600 focus-visible:outline-red-300 disabled:bg-red-200 disabled:text-red-100',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

/**
 * A customizable button component with different variants, sizes, and a loading state.
 *
 * @param {ButtonProps} props The props for the button component.
 * @returns {JSX.Element} The rendered button element.
 */
const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  className,
  disabled,
  children,
  ...props
}) => (
  <button
    type="button"
    className={clsx(
      'inline-flex items-center justify-center rounded-lg font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
      variantStyles[variant],
      sizeStyles[size],
      loading && 'cursor-wait opacity-80',
      className,
    )}
    disabled={disabled || loading}
    {...props}
  >
    {loading && (
      <span className="mr-2 inline-flex h-4 w-4 animate-spin rounded-full border-2 border-slate-100 border-t-transparent" />
    )}
    {children}
  </button>
);

export default Button;
