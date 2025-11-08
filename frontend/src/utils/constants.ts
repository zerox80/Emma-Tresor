/**
 * Defines constants related to file upload restrictions and specifications.
 */
export const FILE_UPLOAD_CONSTANTS = {
  /** The maximum number of files that can be uploaded in a single operation. */
  MAX_FILES: 6,
  /** The maximum allowed size for a single file in megabytes (MB). */
  MAX_FILE_SIZE_MB: 8,
  /** An array of allowed file extensions for uploads. */
  ALLOWED_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.avif', '.heic', '.heif', '.pdf'],
} as const;
