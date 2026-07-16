import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import AddItemDialogLayout from "./AddItemDialogLayout";

describe("AddItemDialogLayout", () => {
  it("only saves after the explicit create button is clicked", () => {
    const onSave = vi.fn();
    const { container } = render(
      <AddItemDialogLayout
        isEditMode={false}
        currentStep={2}
        steps={["Grunddaten", "Zuordnung", "Review & Abschluss"]}
        formError={null}
        isSubmitting={false}
        onRequestClose={vi.fn()}
        onSave={onSave}
        onPreviousStep={vi.fn()}
        onNextStep={vi.fn()}
      >
        <input aria-label="Dateien auswählen" type="file" />
      </AddItemDialogLayout>,
    );

    fireEvent.submit(container.querySelector("form")!);
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Gegenstand anlegen" }));
    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
