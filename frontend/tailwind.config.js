export default {
  // Define content sources for Tailwind to scan for classes
  content: [
    './index.html',                    // Include main HTML file
    './src*.{js,ts,jsx,tsx}'          // Include all source files with relevant extensions
  ],
  theme: {
    extend: {
      // Custom color palette extension
      colors: {
        // Brand color scheme (blue-purple gradient)
        brand: {
          50: '#f6f7fb',   // Lightest shade - backgrounds
          100: '#eceffa',  // Very light - hover states
          200: '#d9def3',  // Light - disabled states
          300: '#bcc6eb',  // Medium light - secondary elements
          400: '#99a5e1',  // Medium - tertiary elements
          500: '#7b85d6',  // Base brand color - primary actions
          600: '#5b61c4',  // Medium dark - primary hover
          700: '#444ba8',  // Dark - active states
          800: '#373d85',  // Very dark - text emphasis
          900: '#2f356a',  // Darkest - headings
          950: '#1c1f3d',  // Extreme dark - high contrast text
        },
      },
    },
  },
  plugins: [],                                                 // No additional Tailwind plugins
};
