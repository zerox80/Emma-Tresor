import tailwindcss from '@tailwindcss/postcss';            // Import Tailwind CSS PostCSS plugin
import autoprefixer from 'autoprefixer';                    // Import Autoprefixer for vendor prefixes

// Export PostCSS configuration
export default {
  plugins: [
    tailwindcss(),                                          // Process Tailwind utilities and components
    autoprefixer()                                          // Add vendor prefixes for browser compatibility
  ],
};
