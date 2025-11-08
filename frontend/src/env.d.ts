/**
 * This file declares TypeScript types for environment variables,
 * enhancing type safety when accessing `process.env` (for Node.js environments)
 * and `import.meta.env` (for Vite-specific environment variables).
 * It ensures that environment variables like `VITE_API_BASE_URL` are recognized by TypeScript.
 */

/// <reference types="vite/client" />

declare namespace NodeJS {
  /**
   * Extends the NodeJS ProcessEnv interface to include custom environment variables.
   */
  interface ProcessEnv {
    /** Optional: The base URL for the API, typically used in server-side contexts or build processes. */
    readonly VITE_API_BASE_URL?: string;
  }
}

/**
 * Declares the interface for `import.meta.env`, providing type definitions
 * for environment variables exposed by Vite.
 */
declare interface ImportMetaEnv {
  /** Indicates whether the application is running in development mode. */
  readonly DEV: boolean;
  /** Optional: The base URL for the API, exposed to the client-side by Vite. */
  readonly VITE_API_BASE_URL?: string;
}

/**
 * Declares the `ImportMeta` interface, which provides access to `import.meta.env`.
 */
declare interface ImportMeta {
  readonly env: ImportMetaEnv;
}
