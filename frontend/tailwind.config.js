/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Semantic Token Bindings (from /docs/DESIGN.md)
        base: 'hsl(var(--bg-base) / <alpha-value>)',
        surface: {
          DEFAULT: 'hsl(var(--surface-card) / <alpha-value>)',
          card: 'hsl(var(--surface-card) / <alpha-value>)',
          subtle: 'hsl(var(--surface-subtle) / <alpha-value>)',
          overlay: 'hsl(var(--surface-overlay) / <alpha-value>)',
        },
        border: {
          DEFAULT: 'hsl(var(--border-subtle) / <alpha-value>)',
          subtle: 'hsl(var(--border-subtle) / <alpha-value>)',
          strong: 'hsl(var(--border-strong) / <alpha-value>)',
        },
        primary: {
          DEFAULT: 'hsl(var(--brand-primary) / <alpha-value>)',
          hover: 'hsl(var(--brand-hover) / <alpha-value>)',
          subtle: 'hsl(var(--brand-subtle) / <alpha-value>)',
          secondary: 'hsl(var(--brand-secondary) / <alpha-value>)',
        },
        content: {
          DEFAULT: 'hsl(var(--text-primary) / <alpha-value>)',
          primary: 'hsl(var(--text-primary) / <alpha-value>)',
          muted: 'hsl(var(--text-muted) / <alpha-value>)',
          inverse: 'hsl(var(--text-inverse) / <alpha-value>)',
        },
        status: {
          normal: {
            bg: 'hsl(var(--status-normal-bg) / <alpha-value>)',
            border: 'hsl(var(--status-normal-border) / <alpha-value>)',
            text: 'hsl(var(--status-normal-text) / <alpha-value>)',
          },
          warning: {
            bg: 'hsl(var(--status-warning-bg) / <alpha-value>)',
            border: 'hsl(var(--status-warning-border) / <alpha-value>)',
            text: 'hsl(var(--status-warning-text) / <alpha-value>)',
          },
          critical: {
            bg: 'hsl(var(--status-critical-bg) / <alpha-value>)',
            border: 'hsl(var(--status-critical-border) / <alpha-value>)',
            text: 'hsl(var(--status-critical-text) / <alpha-value>)',
          },
          info: {
            bg: 'hsl(var(--status-info-bg) / <alpha-value>)',
            border: 'hsl(var(--status-info-border) / <alpha-value>)',
            text: 'hsl(var(--status-info-text) / <alpha-value>)',
          },
        },

        // Legacy Palettes preserved for uninterrupted backward compatibility
        health: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
          950: '#082f49',
        },
        navy: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
        teal: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Noto Sans Devanagari', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['Plus Jakarta Sans', 'Inter', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 1px 2px -1px rgba(0, 0, 0, 0.04)',
        'card-hover': '0 10px 20px -3px rgba(15, 23, 42, 0.06), 0 4px 6px -4px rgba(15, 23, 42, 0.03)',
        'subtle': '0 4px 20px -2px rgba(14, 165, 233, 0.08)',
        'modal': '0 20px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.05)',
      },
      borderRadius: {
        'md': '0.375rem',  /* 6px */
        'xl': '0.75rem',   /* 12px */
        '2xl': '1rem',     /* 16px */
        '3xl': '1.5rem',   /* 24px */
      },
      transitionTimingFunction: {
        'clinical': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      transitionDuration: {
        '150': '150ms',
        '200': '200ms',
        '240': '240ms',
      },
    },
  },
  plugins: [],
};
