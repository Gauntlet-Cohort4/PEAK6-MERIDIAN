import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'SF Mono', 'Menlo', 'Consolas', 'Liberation Mono', 'monospace'],
      },
      colors: {
        border: '#1e2a3a',
        input: '#1e2a3a',
        ring: '#3b82f6',
        background: '#0a0e17',
        foreground: '#e2e8f0',
        primary: {
          DEFAULT: '#3b82f6',
          foreground: '#ffffff',
        },
        secondary: {
          DEFAULT: '#111827',
          foreground: '#e2e8f0',
        },
        destructive: {
          DEFAULT: '#ff3b69',
          foreground: '#ffffff',
        },
        muted: {
          DEFAULT: '#111827',
          foreground: '#64748b',
        },
        accent: {
          DEFAULT: '#1a2035',
          foreground: '#e2e8f0',
        },
        card: {
          DEFAULT: '#111827',
          foreground: '#e2e8f0',
        },
        yes: {
          DEFAULT: '#00d26a',
          light: '#00d26a15',
        },
        no: {
          DEFAULT: '#ff3b69',
          light: '#ff3b6915',
        },
      },
      borderRadius: {
        lg: '6px',
        md: '4px',
        sm: '2px',
      },
    },
  },
  plugins: [],
};

export default config;
