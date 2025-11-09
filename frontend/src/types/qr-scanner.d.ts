// QR Scanner Type Definitions
// ==========================
// This module provides TypeScript type declarations for third-party
// QR code scanning libraries that don't include their own types.

/**
 * Type declarations for the @yudiel/react-qr-scanner package.
 *
 * This modern QR scanner library provides a React component for scanning
 * QR codes using device cameras with customizable constraints and styling.
 */
declare module '@yudiel/react-qr-scanner' {
  import * as React from 'react';                             // Import React types

  /**
   * Props interface for the QrScanner component.
   *
   * Defines the configuration options for the QR scanner including
   * camera constraints, styling, and event handlers.
   */
  interface QrScannerProps {
    /** Media track constraints for camera access (resolution, facing mode, etc.) */
    constraints?: MediaTrackConstraints;

    /** CSS properties to style the scanner container */
    containerStyle?: React.CSSProperties;

    /** Callback function fired when a QR code is successfully decoded */
    onDecode?: (result: string | null) => void;

    /** Callback function fired when an error occurs during scanning */
    onError?: (error?: Error) => void;
  }

  /** Export the QrScanner React component with typed props */
  export const QrScanner: React.FC<QrScannerProps>;
}

/**
 * Type declarations for the legacy react-qr-reader package.
 *
 * This declaration exists to prevent TypeScript errors if the package
 * is imported somewhere in the codebase. The package has been replaced
 * by @yudiel/react-qr-scanner but this ensures compatibility.
 */
declare module 'react-qr-reader';
