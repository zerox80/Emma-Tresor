import { useCallback, useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR =
  "a[href], area[href], input:not([disabled]), select:not([disabled]), " +
  "textarea:not([disabled]), button:not([disabled]), " +
  '[tabindex]:not([tabindex="-1"])';

interface DialogFocusTrapOptions {
  active: boolean;
  onClose: () => void;
  onNavigatePrevious?: () => void;
  onNavigateNext?: () => void;
  canNavigatePrevious: boolean;
  canNavigateNext: boolean;
}

export const useDialogFocusTrap = ({
  active,
  onClose,
  onNavigatePrevious,
  onNavigateNext,
  canNavigatePrevious,
  canNavigateNext,
}: DialogFocusTrapOptions) => {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);

  const getFocusableElements = useCallback(() => {
    const dialog = dialogRef.current;
    if (!dialog) return [];
    return Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((element) => {
      if (element.hasAttribute("disabled") || element.getAttribute("aria-hidden") === "true") return false;
      const style = window.getComputedStyle(element);
      return style.pointerEvents !== "none" && style.display !== "none" && style.visibility !== "hidden";
    });
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !active) return;
    previouslyFocusedElementRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusTimer = window.setTimeout(() => getFocusableElements()[0]?.focus({ preventScroll: true }), 50);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key === "ArrowRight" && canNavigateNext && onNavigateNext) {
        event.preventDefault();
        onNavigateNext();
        return;
      }
      if (event.key === "ArrowLeft" && canNavigatePrevious && onNavigatePrevious) {
        event.preventDefault();
        onNavigatePrevious();
        return;
      }
      if (event.key !== "Tab") return;
      const elements = getFocusableElements();
      if (elements.length === 0) {
        event.preventDefault();
        return;
      }
      const first = elements[0];
      const last = elements[elements.length - 1];
      const focused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      if (event.shiftKey && (focused === first || !focused || !dialog.contains(focused))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && focused === last) {
        event.preventDefault();
        first.focus();
      }
    };

    dialog.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      dialog.removeEventListener("keydown", handleKeyDown);
      previouslyFocusedElementRef.current?.focus({ preventScroll: true });
    };
  }, [
    active,
    canNavigateNext,
    canNavigatePrevious,
    getFocusableElements,
    onClose,
    onNavigateNext,
    onNavigatePrevious,
  ]);

  return dialogRef;
};
