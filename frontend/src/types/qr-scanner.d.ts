declare module '@yudiel/react-qr-scanner' {
  import * as React from 'react';

  /**
   * Props for the QrScanner component from `@yudiel/react-qr-scanner`.
   */
  interface QrScannerProps {
    /** Optional: Media track constraints to apply to the camera stream (e.g., `{ facingMode: 'environment' }`). */
    constraints?: MediaTrackConstraints;
    /** Optional: CSS properties to apply to the container div of the scanner. */
    containerStyle?: React.CSSProperties;
    /** Callback function invoked when a QR code is successfully decoded. */
    onDecode?: (result: string | null) => void;
    /** Callback function invoked when an error occurs during scanning (e.g., camera access denied). */
    onError?: (error?: Error) => void;
  }

  /**
   * The QrScanner React component for scanning QR codes using the device's camera.
   */
  export const QrScanner: React.FC<QrScannerProps>;
}

/**
 * Declaration for the 'react-qr-reader' module, indicating its availability.
 * This module is typically used for reading QR codes from a webcam.
 */
declare module 'react-qr-reader';
