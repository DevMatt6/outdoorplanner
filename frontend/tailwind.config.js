/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      // All interface text uses Geist, including legacy font utility classes.
      fontFamily: {
        sans: ['Geist', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['Geist', 'Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      },
      colors: {
        brand: { foreground: 'hsl(var(--brand-foreground) / <alpha-value>)' },
        success: { DEFAULT: 'hsl(var(--success) / <alpha-value>)', muted: 'hsl(var(--success-muted) / <alpha-value>)', foreground: 'hsl(var(--success-foreground) / <alpha-value>)' },
        warning: { DEFAULT: 'hsl(var(--warning) / <alpha-value>)', muted: 'hsl(var(--warning-muted) / <alpha-value>)', foreground: 'hsl(var(--warning-foreground) / <alpha-value>)' },
        info: { DEFAULT: 'hsl(var(--info) / <alpha-value>)', muted: 'hsl(var(--info-muted) / <alpha-value>)' },
        slate: { 50: 'hsl(var(--background) / <alpha-value>)', 100: 'hsl(var(--muted) / <alpha-value>)', 200: 'hsl(var(--border) / <alpha-value>)', 300: 'hsl(var(--input) / <alpha-value>)', 400: 'hsl(var(--muted-foreground) / <alpha-value>)', 500: 'hsl(var(--muted-foreground) / <alpha-value>)', 600: 'hsl(var(--muted-foreground) / <alpha-value>)', 700: 'hsl(var(--foreground) / <alpha-value>)', 800: 'hsl(var(--foreground) / <alpha-value>)', 900: 'hsl(var(--foreground) / <alpha-value>)' },
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))'
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))'
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))'
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))', muted: 'hsl(var(--destructive-muted) / <alpha-value>)'
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))'
        }
      },
      keyframes: {
        'accordion-down': {
          from: {
            height: '0'
          },
          to: {
            height: 'var(--radix-accordion-content-height)'
          }
        },
        'accordion-up': {
          from: {
            height: 'var(--radix-accordion-content-height)'
          },
          to: {
            height: '0'
          }
        }
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out'
      }
    }
  },
  plugins: [require("tailwindcss-animate")],
};