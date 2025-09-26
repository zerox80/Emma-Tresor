declare module '@yudiel/react-qr-scanner' {
  import * as React from 'react';

  interface QrScannerProps {
    constraints?: MediaTrackConstraints;
    containerStyle?: React.CSSProperties;
    onDecode?: (result: string | null) => void;
    onError?: (error?: Error) => void;
  }

  export const QrScanner: React.FC<QrScannerProps>;
}

declare module 'react-qr-reader';
