import { useEffect, useState } from 'react';

const DEFAULT_DELAY = 400;

/**
 * A hook that debounces a value.
 *
 * @template T
 * @param {T} value - The value to debounce.
 * @param {number} [delay=DEFAULT_DELAY] - The debounce delay in milliseconds.
 * @returns {T} The debounced value.
 */
export const useDebouncedValue = <T>(value: T, delay: number = DEFAULT_DELAY): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      window.clearTimeout(handle);
    };
  }, [value, delay]);

  return debouncedValue;
};
