// Application Constants
// ====================
// This module defines constant values used throughout the application
// for configuration, validation, and business rules.

/**
 * File upload configuration constants.
 *
 * These constants define the limits and restrictions for file uploads
 * in the inventory management system, particularly for item images.
 */
export const FILE_UPLOAD_CONSTANTS = {
  /** Maximum number of files that can be uploaded simultaneously */
  MAX_FILES: 6,

  /** Maximum file size allowed per upload in megabytes */
  MAX_FILE_SIZE_MB: 8,

  /**
   * Array of allowed file extensions for uploads.
   *
   * Includes common image formats and PDF support for document attachments:
   * - Image formats: jpg, jpeg, png, gif, webp, bmp, avif
   * - Modern Apple formats: heic, heif (iPhone photos)
   * - Document format: pdf (for manuals or receipts)
   */
  ALLOWED_EXTENSIONS: [
    '.jpg',    // JPEG image format
    '.jpeg',   // JPEG image format (alternative extension)
    '.png',    // PNG image format (supports transparency)
    '.gif',    // GIF animated image format
    '.webp',   // WebP modern image format
    '.bmp',    // Bitmap image format
    '.avif',   // AVIF next-gen image format
    '.heic',   // Apple HEIC image format (iPhone photos)
    '.heif',   // Apple HEIF image format
    '.pdf',    // Portable Document Format for documents
  ],
} as const;                                                           // Prevent modification of constant object
