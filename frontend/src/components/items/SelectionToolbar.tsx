// Selection Toolbar Component
// =========================
// This component displays a floating toolbar when items are selected in the table/grid.
// It provides bulk actions like selecting all, clearing selection, and assigning to lists.

import React from 'react';                                       // Import React library for JSX
import Button from '../common/Button';                           // Import reusable Button component

/**
 * Props interface for SelectionToolbar component.
 * Defines the state data and action callbacks for bulk selection operations.
 */
type Props = {
  /** Number of items currently selected across all pages */
  selectedCount: number;

  /** Whether all items on the current page are selected */
  areAllSelectedOnPage: boolean;

  /** Function to toggle selection of all items on current page */
  onToggleSelectAllCurrentPage: () => void;

  /** Function to clear all selections */
  onClearSelection: () => void;

  /** Function to open the sheet for assigning selected items to lists */
  onOpenAssignSheet: () => void;
};

/**
 * Selection Toolbar Component Function.
 *
 * Renders a floating toolbar that appears when items are selected. It provides
 * information about the selection and actions for bulk operations. The toolbar
 * is positioned at the bottom of the screen with a glass morphism effect.
 */
const SelectionToolbar: React.FC<Props> = ({
  selectedCount,                                                 // Number of selected items
  areAllSelectedOnPage,                                          // Whether all page items are selected
  onToggleSelectAllCurrentPage,                                  // Toggle page selection callback
  onClearSelection,                                             // Clear all selections callback
  onOpenAssignSheet,                                            // Open assign to list callback
}) => {
  // Early return: don't render toolbar if no items are selected
  if (selectedCount === 0) return null;

  return (
    {/* Fixed positioning toolbar at bottom center of screen */}
    <div className="fixed bottom-6 left-1/2 z-30 w-full max-w-3xl -translate-x-1/2 rounded-2xl border border-slate-200 bg-white/95 px-5 py-4 shadow-xl backdrop-blur">
      {/* Inner container with responsive layout */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Left side: selection information */}
        <div>
          {/* Display count of selected items */}
          <p className="text-sm font-semibold text-slate-900">{selectedCount} Gegenstände ausgewählt</p>
          {/* German: "{count} items selected" */}

          {/* Helper text explaining available actions */}
          <p className="text-xs text-slate-500">Wähle eine Liste oder ändere deine Auswahl.</p>
          {/* German: "Choose a list or modify your selection" */}
        </div>

        {/* Right side: action buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Toggle selection for current page */}
          <Button
            type="button"                                           // Prevent form submission
            variant="ghost"                                         // Transparent button style
            size="sm"                                               // Small button size
            onClick={onToggleSelectAllCurrentPage}                  // Toggle page selection
          >
            {areAllSelectedOnPage
              ? 'Auswahl dieser Seite entfernen'                    // German: "Remove selection of this page"
              : 'Diese Seite auswählen'                             // German: "Select this page"
            }
          </Button>

          {/* Clear all selections button */}
          <Button
            type="button"                                           // Prevent form submission
            variant="ghost"                                         // Transparent button style
            size="sm"                                               // Small button size
            onClick={onClearSelection}                              // Clear all selected items
          >
            {/* German: "Clear selection" */}
            Auswahl löschen
          </Button>

          {/* Assign to list button */}
          <Button
            type="button"                                           // Prevent form submission
            variant="secondary"                                     // Gray button style
            size="sm"                                               // Small button size
            onClick={onOpenAssignSheet}                             // Open assignment sheet
          >
            {/* German: "Add to list" */}
            Zur Liste hinzufügen
          </Button>
        </div>
      </div>
    </div>                                                          // Close toolbar container
  );                                                               // Close return statement
};

export default SelectionToolbar;                                  // Export as default component
