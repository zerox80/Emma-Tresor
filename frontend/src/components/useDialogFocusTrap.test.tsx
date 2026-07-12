import { fireEvent, render, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useDialogFocusTrap } from "./useDialogFocusTrap";

interface HarnessProps {
  onClose: () => void;
  onNext: () => void;
  onPrevious: () => void;
}

const FocusTrapHarness = ({ onClose, onNext, onPrevious }: HarnessProps) => {
  const dialogRef = useDialogFocusTrap({
    active: true,
    onClose,
    onNavigateNext: onNext,
    onNavigatePrevious: onPrevious,
    canNavigateNext: true,
    canNavigatePrevious: true,
  });

  return (
    <div ref={dialogRef} role="dialog">
      <button type="button">First</button>
      <button type="button">Last</button>
    </div>
  );
};

describe("useDialogFocusTrap", () => {
  afterEach(() => vi.useRealTimers());

  it("traps focus, handles navigation and restores the prior focus", () => {
    vi.useFakeTimers();
    const trigger = document.createElement("button");
    document.body.append(trigger);
    trigger.focus();
    const onClose = vi.fn();
    const onNext = vi.fn();
    const onPrevious = vi.fn();
    const view = render(
      <FocusTrapHarness
        onClose={onClose}
        onNext={onNext}
        onPrevious={onPrevious}
      />,
    );
    const dialog = view.getByRole("dialog");
    const [first, last] = within(dialog).getAllByRole("button");

    vi.advanceTimersByTime(50);
    expect(document.activeElement).toBe(first);
    last.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(dialog, { key: "ArrowRight" });
    fireEvent.keyDown(dialog, { key: "ArrowLeft" });
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onNext).toHaveBeenCalledOnce();
    expect(onPrevious).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();

    view.unmount();
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });
});
