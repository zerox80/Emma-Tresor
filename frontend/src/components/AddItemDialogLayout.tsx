import React from "react";
import Button from "./common/Button";
import type { StepIndex } from "./addItemForm";

interface AddItemDialogLayoutProps {
  isEditMode: boolean;
  currentStep: StepIndex;
  steps: string[];
  formError: string | null;
  isSubmitting: boolean;
  onRequestClose: () => void;
  onSubmit: React.FormEventHandler<HTMLFormElement>;
  onPreviousStep: () => void;
  onNextStep: () => void;
  children: React.ReactNode;
}

const AddItemDialogLayout: React.FC<AddItemDialogLayoutProps> = ({
  isEditMode,
  currentStep,
  steps,
  formError,
  isSubmitting,
  onRequestClose,
  onSubmit,
  onPreviousStep,
  onNextStep,
  children,
}) => (
  <div className="fixed inset-0 z-50 overflow-y-auto">
    <div
      className="flex min-h-full items-start justify-center bg-slate-900/40 p-4 sm:p-6"
      onClick={(event) => {
        if (event.target === event.currentTarget) onRequestClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-item-heading"
        className="relative w-full max-w-5xl rounded-3xl bg-white shadow-2xl ring-1 ring-slate-900/10"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="border-b border-slate-200 bg-slate-50/70 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 id="add-item-heading" className="text-xl font-semibold text-slate-900">
                {isEditMode ? "Gegenstand bearbeiten" : "Neuer Gegenstand"}
              </h3>
              <p className="mt-1 text-sm text-slate-600">Erfassung in drei übersichtlichen Schritten.</p>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={onRequestClose} aria-label="Dialog schließen">
              ✕
            </Button>
          </div>
          <nav className="mt-4 grid gap-2 text-xs font-semibold uppercase text-slate-500 sm:grid-cols-3">
            {steps.map((step, index) => (
              <div
                key={step}
                className={[
                  "rounded-lg border px-3 py-2",
                  index === currentStep
                    ? "border-brand-300 bg-brand-50 text-brand-700"
                    : "border-slate-200 bg-white",
                ].join(" ")}
              >
                {index + 1}. {step}
              </div>
            ))}
          </nav>
        </header>
        <form className="flex flex-col" onSubmit={onSubmit} noValidate>
          <div className="px-4 py-5 sm:px-6 lg:px-8">
            {formError && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {formError}
              </div>
            )}
            {children}
          </div>
          <footer className="border-t border-slate-200 bg-white px-6 py-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Schritt {currentStep + 1} von {steps.length}
              </p>
              <div className="flex gap-2">
                {currentStep > 0 && (
                  <Button type="button" variant="secondary" onClick={onPreviousStep}>Zurück</Button>
                )}
                {currentStep < 2 ? (
                  <Button type="button" variant="primary" onClick={onNextStep}>Weiter</Button>
                ) : (
                  <Button type="submit" variant="primary" loading={isSubmitting}>
                    {isEditMode ? "Änderungen speichern" : "Gegenstand anlegen"}
                  </Button>
                )}
              </div>
            </div>
          </footer>
        </form>
      </div>
    </div>
  </div>
);

export default AddItemDialogLayout;
