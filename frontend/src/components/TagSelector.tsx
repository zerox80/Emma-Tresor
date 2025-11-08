import type { ChangeEvent, FC, MouseEvent } from 'react';
import {
  KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

/**
 * Represents a single selectable tag option.
 * @property {string} label - The human-readable text of the tag.
 * @property {number} value - The unique identifier for the tag.
 */
export interface TagSelectorOption {
  label: string;
  value: number;
}

/**
 * Props for the TagSelector component.
 */
interface TagSelectorProps {
  /** The complete list of available tag options. */
  options: TagSelectorOption[];
  /** An array of IDs for the currently selected tags. */
  selectedIds: number[];
  /** Callback function invoked when the selection changes. */
  onChange: (ids: number[]) => void;
  /**
   * Async callback function to create a new tag.
   * @param {string} name - The name of the new tag to create.
   * @returns {Promise<TagSelectorOption | null>} A promise that resolves with the newly created tag option or null on failure.
   */
  onCreateTag: (name: string) => Promise<TagSelectorOption | null>;
  /** Whether the selector is disabled. Defaults to `false`. */
  disabled?: boolean;
  /** Whether a tag creation operation is currently in progress. Defaults to `false`. */
  isCreating?: boolean;
}

/**
 * Represents an item in the dropdown list, which can either be an existing option or a prompt to create a new one.
 */
type DropdownItem =
  | { type: 'option'; option: TagSelectorOption }
  | { type: 'create'; label: string };

/**
 * The maximum number of options to display in the dropdown before scrolling.
 */
const MAX_VISIBLE_OPTIONS = 8;

/**
 * A highly interactive, custom-built component for selecting and creating tags.
 * It supports typing to filter, creating new tags on-the-fly, keyboard navigation (arrows, Enter, Escape),
 * and removing tags with backspace or a click.
 *
 * @param {TagSelectorProps} props The props for the component.
 * @returns {JSX.Element} The rendered tag selector component.
 */
const TagSelector: FC<TagSelectorProps> = ({
  options,
  selectedIds,
  onChange,
  onCreateTag,
  disabled = false,
  isCreating = false,
}) => {
  const [inputValue, setInputValue] = useState<string>('');
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  /** Memoized, normalized (trimmed, lowercase) version of the user's input. */
  const normalisedInput = useMemo(() => inputValue.trim().toLowerCase(), [inputValue]);

  /** Memoized list of the full `TagSelectorOption` objects that are currently selected. */
  const selectedOptions = useMemo<TagSelectorOption[]>(() => {
    return selectedIds
      .map((id) => options.find((option) => option.value === id) ?? null)
      .filter((option): option is TagSelectorOption => option !== null);
  }, [options, selectedIds]);

  /** Memoized list of options that are not currently selected. */
  const availableOptions = useMemo<TagSelectorOption[]>(() => {
    const selectedSet = new Set(selectedIds);
    return options.filter((option) => !selectedSet.has(option.value));
  }, [options, selectedIds]);

  /** Memoized list of available options that match the user's current input, limited for display. */
  const matchingOptions = useMemo<TagSelectorOption[]>(() => {
    if (!normalisedInput) {
      return availableOptions.slice(0, MAX_VISIBLE_OPTIONS);
    }

    return availableOptions
      .filter((option) => option.label.toLowerCase().includes(normalisedInput))
      .slice(0, MAX_VISIBLE_OPTIONS);
  }, [availableOptions, normalisedInput]);

  /** Memoized boolean indicating if the user's input exactly matches an existing tag label. */
  const hasExactMatch = useMemo<boolean>(() => {
    if (!normalisedInput) {
      return false;
    }
    return options.some((option) => option.label.toLowerCase() === normalisedInput);
  }, [normalisedInput, options]);

  /** Memoized list of items to render in the dropdown, including matching options and a "create" prompt if applicable. */
  const dropdownItems = useMemo<DropdownItem[]>(() => {
    const items: DropdownItem[] = matchingOptions.map((option) => ({
      type: 'option',
      option,
    }));

    if (normalisedInput.length > 0 && !hasExactMatch) {
      items.push({ type: 'create', label: inputValue.trim() });
    }

    return items;
  }, [hasExactMatch, inputValue, matchingOptions, normalisedInput]);

  /** Closes the dropdown and resets the highlighted index. */
  const closeDropdown = useCallback(() => {
    setIsOpen(false);
    setHighlightedIndex(-1);
  }, []);

  /** Opens the dropdown if the component is not disabled. */
  const openDropdown = useCallback(() => {
    if (!disabled) {
      setIsOpen(true);
    }
  }, [disabled]);

  /** Effect to reset the highlighted index when the dropdown opens or items change. */
  useEffect(() => {
    if (!isOpen || dropdownItems.length === 0) {
      setHighlightedIndex(-1);
      return;
    }
    setHighlightedIndex(0);
  }, [dropdownItems.length, isOpen]);

  /** Effect to handle clicks outside the component to close the dropdown. */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current) {
        return;
      }
      if (!containerRef.current.contains(event.target as Node)) {
        closeDropdown();
      }
    };

    document.addEventListener('mousedown', handleClickOutside as EventListener);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside as EventListener);
    };
  }, [closeDropdown]);

  /** Focuses the text input element. */
  const focusInput = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  /**
   * Adds a tag to the selection.
   * @param {TagSelectorOption} option The tag option to add.
   */
  const addTag = useCallback(
    (option: TagSelectorOption) => {
      if (selectedIds.includes(option.value)) {
        return;
      }
      onChange([...selectedIds, option.value]);
      setInputValue('');
      closeDropdown();
      focusInput();
    },
    [closeDropdown, focusInput, onChange, selectedIds],
  );

  /**
   * Handles the creation of a new tag from the user's input.
   */
  const handleCreateTag = useCallback(async (): Promise<void> => {
    const trimmed = inputValue.trim();
    if (trimmed.length === 0 || disabled || isCreating) {
      return;
    }

    const created = await onCreateTag(trimmed);
    if (created) {
      onChange([...selectedIds, created.value]);
      setInputValue('');
      closeDropdown();
      focusInput();
    }
  }, [closeDropdown, disabled, focusInput, inputValue, isCreating, onChange, onCreateTag, selectedIds]);

  /**
   * Removes a tag from the selection.
   * @param {number} id The ID of the tag to remove.
   */
  const handleRemoveTag = useCallback(
    (id: number) => {
      onChange(selectedIds.filter((tagId) => tagId !== id));
      focusInput();
    },
    [focusInput, onChange, selectedIds],
  );

  /**
   * Handles all keyboard interactions within the input, including navigation, selection, creation, and deletion.
   * @param {KeyboardEvent<HTMLInputElement>} event The keyboard event.
   */
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      // Remove last tag on backspace if input is empty
      if (event.key === 'Backspace' && inputValue.length === 0 && selectedIds.length > 0) {
        event.preventDefault();
        const lastId = selectedIds[selectedIds.length - 1];
        handleRemoveTag(lastId);
        return;
      }

      // Open dropdown with arrow keys
      if (!isOpen && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
        openDropdown();
        return;
      }

      // Navigate down
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        if (dropdownItems.length === 0) {
          return;
        }
        setHighlightedIndex((prevIndex) => {
          const nextIndex = prevIndex + 1;
          return nextIndex >= dropdownItems.length ? 0 : nextIndex;
        });
        return;
      }

      // Navigate up
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        if (dropdownItems.length === 0) {
          return;
        }
        setHighlightedIndex((prevIndex) => {
          const nextIndex = prevIndex - 1;
          return nextIndex < 0 ? dropdownItems.length - 1 : nextIndex;
        });
        return;
      }

      // Select or create on Enter
      if (event.key === 'Enter') {
        if (highlightedIndex >= 0 && highlightedIndex < dropdownItems.length) {
          event.preventDefault();
          const item = dropdownItems[highlightedIndex];
          if (item.type === 'option') {
            addTag(item.option);
          } else {
            void handleCreateTag();
          }
          return;
        }

        // Fallback to create if there's input but no highlighted item
        if (normalisedInput && !hasExactMatch) {
          event.preventDefault();
          void handleCreateTag();
        }
      }

      // Close on Escape
      if (event.key === 'Escape') {
        closeDropdown();
      }
    },
    [
      addTag,
      closeDropdown,
      dropdownItems,
      handleCreateTag,
      handleRemoveTag,
      hasExactMatch,
      highlightedIndex,
      inputValue.length,
      isOpen,
      normalisedInput,
      openDropdown,
      selectedIds,
    ],
  );

  return (
    <div className="relative" ref={containerRef}>
      <div
        className={`flex min-h-[52px] w-full flex-wrap items-center gap-2 rounded-2xl border px-3 py-2 transition focus-within:border-brand-400 focus-within:shadow-[0_0_0_4px_rgba(99,102,241,0.18)] ${
          disabled
            ? 'cursor-not-allowed border-slate-200 bg-slate-100'
            : 'cursor-text border-slate-300 bg-white shadow-sm hover:border-brand-300'
        }`}
        onClick={() => {
          focusInput();
          openDropdown();
        }}
      >
        {selectedOptions.length > 0 ? (
          selectedOptions.map((option: TagSelectorOption) => (
            <span
              key={option.value}
              className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-700"
            >
              {option.label}
              <button
                type="button"
                className="rounded-full bg-brand-200/60 p-1 text-brand-700 transition hover:bg-brand-300/80"
                onClick={(event: MouseEvent<HTMLButtonElement>) => {
                  event.stopPropagation();
                  handleRemoveTag(option.value);
                }}
                aria-label={`Tag ${option.label} entfernen`}
                disabled={disabled}
              >
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M6 18L18 6" />
                </svg>
              </button>
            </span>
          ))
        ) : (
          <span className="text-xs font-medium text-slate-400">Tags hinzufügen…</span>
        )}

        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          disabled={disabled}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            setInputValue(event.target.value);
            openDropdown();
          }}
          onFocus={openDropdown}
          onKeyDown={handleKeyDown}
          placeholder={selectedOptions.length === 0 ? '' : 'Weiteren Tag eingeben…'}
          className="flex-1 border-none bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
        />

        {isCreating && (
          <span className="flex h-4 w-4 items-center justify-center">
            <svg
              className="h-4 w-4 animate-spin text-brand-500"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4v2m0 12v2m8-10h-2M6 12H4m13.364 6.364l-1.414-1.414M7.05 7.05L5.636 5.636m12.728 0l-1.414 1.414M7.05 16.95l-1.414 1.414"
              />
            </svg>
          </span>
        )}
      </div>

      {isOpen && dropdownItems.length > 0 && !disabled && (
        <div
          className="absolute z-40 mt-2 max-h-64 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1 shadow-2xl"
          role="listbox"
        >
          {dropdownItems.map((item: DropdownItem, index: number) => {
            const isActive = index === highlightedIndex;
            const baseClasses =
              'flex w-full cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm transition';

            if (item.type === 'option') {
              return (
                <button
                  key={`option-${item.option.value}`}
                  type="button"
                  role="option"
                  aria-selected={false}
                  className={`${baseClasses} ${
                    isActive
                      ? 'bg-slate-100 text-slate-900'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onMouseDown={(event: MouseEvent<HTMLButtonElement>) => event.preventDefault()}
                  onClick={() => addTag(item.option)}
                >
                  <span className="font-medium">{item.option.label}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">Hinzufügen</span>
                </button>
              );
            }

            return (
              <button
                key="create-option"
                type="button"
                role="option"
                aria-selected={false}
                className={`${baseClasses} ${
                  isActive
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-brand-600 hover:bg-brand-50 hover:text-brand-700'
                }`}
                onMouseEnter={() => setHighlightedIndex(index)}
                onMouseDown={(event: MouseEvent<HTMLButtonElement>) => event.preventDefault()}
                onClick={() => void handleCreateTag()}
              >
                <span className="font-medium">„{item.label}“ erstellen</span>
                <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-700">Neu</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TagSelector;
