/**
 * Constants for file uploads.
 */
export const FILE_UPLOAD_CONSTANTS = {
  /** The maximum number of files that can be uploaded at once. */
  MAX_FILES: 6,
  /** The maximum file size in megabytes. */
  MAX_FILE_SIZE_MB: 8,
  /** The allowed file extensions for uploads. */
  ALLOWED_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.avif', '.heic', '.heif', '.pdf'],
} as const;
