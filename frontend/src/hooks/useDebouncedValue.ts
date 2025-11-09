// Debounced Value Hook
// ====================
// This React hook creates a debounced version of a value that only updates
// after a specified delay has passed without the value changing.

import { useEffect, useState } from 'react';                       // React hooks for state and effects

/** Default delay in milliseconds for debouncing */
const DEFAULT_DELAY = 400;

/**
 * Create a debounced version of a value.
 *
 * Debouncing delays the update of a value until a specified amount of time
 * has passed without the value changing. This is useful for:
 * - Search input fields (prevent API calls on every keystroke)
 * - Form validation (delay validation until user stops typing)
 * - Performance optimization (reduce rapid state updates)
 *
 * @template T - The type of the value to debounce
 * @param {T} value - The original value that may change frequently
 * @param {number} delay - The delay in milliseconds to wait before updating (default: 400ms)
 * @returns {T} The debounced value that updates after the delay
 *
 * @example
 * ```tsx
 * const [searchTerm, setSearchTerm] = useState('');
 * const debouncedSearch = useDebouncedValue(searchTerm, 300);
 *
 * // useEffect will only run when debouncedSearch changes (after 300ms delay)
 * useEffect(() => {
 *   if (debouncedSearch) {
 *     searchApi(debouncedSearch);
 *   }
 * }, [debouncedSearch]);
 * ```
 */
export const useDebouncedValue = <T>(value: T, delay: number = DEFAULT_DELAY): T => {
  // State to hold the debounced value
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  // Effect to handle the debouncing logic
  useEffect(() => {
    // Set up a timeout that will update the debounced value after the delay
    const handle = window.setTimeout(() => {
      setDebouncedValue(value);                                      // Update debounced value with latest value
    }, delay);

    // Cleanup function: clear the timeout if value changes or component unmounts
    return () => {
      window.clearTimeout(handle);                                   // Cancel pending timeout
    };
  }, [value, delay]);                                                // Re-run effect when value or delay changes

  return debouncedValue;                                             // Return the current debounced value
};
