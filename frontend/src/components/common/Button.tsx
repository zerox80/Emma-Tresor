// Reusable Button Component
// ========================
// This is a flexible, accessible button component that supports multiple variants,
// sizes, and states. It follows the design system and includes loading states.

import React from 'react';                                       // Import React for JSX and types
import clsx from 'clsx';                                       // Utility for conditional class names

/**
 * Available button variants for different visual styles.
 * Each variant has specific colors and hover states.
 */
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

/**
 * Available button sizes for different use cases.
 * Controls padding and text size for appropriate hierarchy.
 */
type ButtonSize = 'sm' | 'md' | 'lg';

/**
 * Props interface for the Button component.
 *
 * Extends standard HTML button attributes to maintain accessibility
 * while adding custom functionality for variants and loading states.
 */
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style variant of the button (default: 'primary') */
  variant?: ButtonVariant;

  /** Size of the button affecting padding and text size (default: 'md') */
  size?: ButtonSize;

  /** Whether the button is in a loading state (shows spinner and disables) */
  loading?: boolean;
}

/**
 * CSS class mappings for button variants.
 *
 * Each variant defines colors for normal, hover, focus, and disabled states.
 * Uses Tailwind classes consistent with the design system.
 */
const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-500 text-white hover:bg-brand-600 focus-visible:outline-brand-300 disabled:bg-brand-200 disabled:text-slate-400',
  // Primary: Blue brand color, white text, darker on hover, lighter when disabled

  secondary:
    'bg-white text-slate-700 border border-slate-200 hover:border-brand-200 hover:text-brand-600 focus-visible:outline-brand-300 disabled:bg-slate-100 disabled:text-slate-400',
  // Secondary: White background with border, brand accent on hover

  ghost:
    'bg-transparent text-slate-600 hover:bg-slate-100 focus-visible:outline-brand-300 disabled:text-slate-300',
  // Ghost: Transparent background, subtle highlight on hover

  danger:
    'bg-red-500 text-white hover:bg-red-600 focus-visible:outline-red-300 disabled:bg-red-200 disabled:text-red-100',
  // Danger: Red for destructive actions, darker red on hover
};

/**
 * CSS class mappings for button sizes.
 *
 * Each size controls padding and text size for appropriate visual hierarchy.
 * All buttons maintain consistent border radius and font weight.
 */
const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs',                                      // Small: Compact padding for tight spaces
  md: 'px-4 py-2 text-sm',                                        // Medium: Standard size for most use cases
  lg: 'px-6 py-3 text-base',                                      // Large: Prominent buttons with more padding
};

/**
 * Reusable Button Component.
 *
 * A flexible button that supports multiple visual variants, sizes, and states.
 * Includes proper accessibility, loading states with spinner animation, and
 * keyboard focus handling.
 *
 * @param {ButtonProps} props - Component props including variant, size, loading state, and standard button attributes
 * @returns {JSX.Element} Rendered button element
 */
const Button: React.FC<ButtonProps> = ({
  variant = 'primary',                                          // Default to primary variant
  size = 'md',                                                   // Default to medium size
  loading = false,                                               // Default to not loading
  className,                                                     // Additional CSS classes
  disabled,                                                      // Standard disabled attribute
  children,                                                      // Button content
  ...props                                                       // Pass through other button attributes
}) => (
  <button
    type="button"                                               // Explicit button type (can be overridden)
    className={clsx(
      // Base button styles: flexbox layout, rounded corners, font styling, transitions, focus rings
      'inline-flex items-center justify-center rounded-lg font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
      variantStyles[variant],                                   // Apply variant-specific colors
      sizeStyles[size],                                        // Apply size-specific padding and text size
      loading && 'cursor-wait opacity-80',                     // Loading state: waiting cursor and reduced opacity
      className,                                               // Merge with any additional classes
    )}
    disabled={disabled || loading}                             // Disable button if explicitly disabled or loading
    {...props}                                                  // Pass through remaining props (onClick, aria-label, etc.)
  >
    {/* Show loading spinner when in loading state */}
    {loading && (
      <span className="mr-2 inline-flex h-4 w-4 animate-spin rounded-full border-2 border-slate-100 border-t-transparent" />
    )}
    {children}
  </button>
);

export default Button;                                          // Export as default
