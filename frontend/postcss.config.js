// PostCSS Configuration
// ====================
// This file configures PostCSS plugins that transform CSS during the build process.
// PostCSS is used by Vite to process CSS before it reaches the browser.

import tailwindcss from '@tailwindcss/postcss';              // Import Tailwind CSS PostCSS plugin
import autoprefixer from 'autoprefixer';                    // Import Autoprefixer for vendor prefixes

/**
 * Export PostCSS configuration with plugins.
 *
 * The plugins are processed in order:
 * 1. tailwindcss() - Processes Tailwind utility classes and generates CSS
 * 2. autoprefixer() - Adds vendor prefixes (-webkit-, -moz-, etc.) for browser compatibility
 */
export default {
  plugins: [
    tailwindcss(),                                          // Process Tailwind utilities and components, scan source files for classes
    autoprefixer()                                          // Add vendor prefixes for browser compatibility (e.g., -webkit-, -moz-)
  ],
};
