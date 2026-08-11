import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#FAF3E9',
        espresso: '#2B1B12',
        roast: '#5C3A24',
        latte: '#C89B6A',
        clay: '#E8734A',
      },
      fontFamily: {
        display: ['Georgia', 'ui-serif', 'serif'],
      },
    },
  },
  plugins: [],
};

export default config;
