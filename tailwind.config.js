/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
    extend: {
      // `land:` y `short:` van como screens (no como variantes de plugin) para que se generen
      // DESPUÉS de sm/md/lg y les ganen en el celular: en la portada hay decenas de pares como
      // `md:mt-10 land:mt-4`. Un screen { raw } desactiva las variantes min-* y max-* de
      // Tailwind (de ahí el aviso "min-* and max-* variants are not supported" en dev/build):
      // no usar min-[...]: ni max-[...]:; para un rango, una variante arbitraria
      // [@media(min-width:400px)_and_(max-width:639px)]:...
      screens: {
        // Smartphone horizontal (mismo criterio que PHONE_LANDSCAPE_QUERY en useMatchMedia).
        land: { raw: '(orientation: landscape) and (max-height: 500px)' },
        // Smartphone vertical de poca altura (ej. 360×740).
        short: { raw: '(orientation: portrait) and (max-width: 767px) and (max-height: 760px)' },
      },
      fontFamily: {
        inter: ['var(--font-inter)'],
        rajdhani: ['var(--font-rajdhani)'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      },
      colors: {
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
          foreground: 'hsl(var(--destructive-foreground))'
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
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up': { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
        'pulse-gold': {
          '0%, 100%': { boxShadow: '0 0 0 0 hsla(45,100%,55%,0.4)' },
          '50%': { boxShadow: '0 0 0 8px hsla(45,100%,55%,0)' }
        }
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'pulse-gold': 'pulse-gold 2s infinite'
      }
    }
  },
  plugins: [require("tailwindcss-animate")],
}
