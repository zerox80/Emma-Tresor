import { useEffect, useState } from 'react';

/**
 * The default delay in milliseconds for the debounce effect.
 */
const DEFAULT_DELAY = 400;

/**
 * A custom hook that debounces a value. It returns a new value that only updates
 * after the original value has stopped changing for a specified period of time.
 * This is useful for performance optimization, for example, to delay an API call
 * until the user has finished typing in a search input.
 *
 * @template T The type of the value to be debounced.
 * @param {T} value - The value to debounce.
 * @param {number} [delay=DEFAULT_DELAY] - The debounce delay in milliseconds.
 * @returns {T} The debounced value, which will only update after the specified delay.
 */
export const useDebouncedValue = <T>(value: T, delay: number = DEFAULT_DELAY): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Set up a timer to update the debounced value after the specified delay.
    const handle = window.setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Clean up the timer if the value changes before the delay has passed,
    // or if the component unmounts.
    return () => {
      window.clearTimeout(handle);
    };
  }, [value, delay]);

  return debouncedValue;
};
