/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  safelist: [
    // Profile colors - JH (blue)
    'bg-blue-500', 'bg-blue-100', 'border-blue-500', 'text-blue-600',
    // Profile colors - EH (pink)
    'bg-pink-500', 'bg-pink-100', 'border-pink-500', 'text-pink-600',
    // Profile colors - KJ (neutral)
    'bg-neutral-700', 'bg-neutral-100', 'border-neutral-700', 'text-neutral-700',
  ],
  theme: {
    extend: {
      colors: {
        // Background surfaces
        'bg-page': 'var(--bg-page)',
        'bg-card': 'var(--bg-card)',
        'bg-sidebar': 'var(--bg-sidebar)',
        'bg-hover': 'var(--bg-hover)',
        'bg-selected': 'var(--bg-selected)',

        // Text
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-tertiary': 'var(--text-tertiary)',
        'text-disabled': 'var(--text-disabled)',

        // Subject colors - Math
        'subj-math-light': 'var(--subj-math-light)',
        'subj-math': 'var(--subj-math)',
        'subj-math-dark': 'var(--subj-math-dark)',

        // Subject colors - English
        'subj-english-light': 'var(--subj-english-light)',
        'subj-english': 'var(--subj-english)',
        'subj-english-dark': 'var(--subj-english-dark)',

        // Subject colors - Physics
        'subj-physics-light': 'var(--subj-physics-light)',
        'subj-physics': 'var(--subj-physics)',
        'subj-physics-dark': 'var(--subj-physics-dark)',

        // Subject colors - Chemistry
        'subj-chemistry-light': 'var(--subj-chemistry-light)',
        'subj-chemistry': 'var(--subj-chemistry)',
        'subj-chemistry-dark': 'var(--subj-chemistry-dark)',

        // Subject colors - Biology
        'subj-biology-light': 'var(--subj-biology-light)',
        'subj-biology': 'var(--subj-biology)',
        'subj-biology-dark': 'var(--subj-biology-dark)',

        // Subject colors - History
        'subj-history-light': 'var(--subj-history-light)',
        'subj-history': 'var(--subj-history)',
        'subj-history-dark': 'var(--subj-history-dark)',

        // Subject colors - Economics
        'subj-economics-light': 'var(--subj-economics-light)',
        'subj-economics': 'var(--subj-economics)',
        'subj-economics-dark': 'var(--subj-economics-dark)',

        // Subject colors - CS
        'subj-cs-light': 'var(--subj-cs-light)',
        'subj-cs': 'var(--subj-cs)',
        'subj-cs-dark': 'var(--subj-cs-dark)',

        // Progress
        'progress-streak': 'var(--progress-streak)',
        'progress-locked': 'var(--progress-locked)',

        // Semantic
        'success': 'var(--success)',
        'success-light': 'var(--success-light)',
        'warning': 'var(--warning)',
        'warning-light': 'var(--warning-light)',
        'danger': 'var(--danger)',
        'danger-light': 'var(--danger-light)',
        'info': 'var(--info)',
        'info-light': 'var(--info-light)',

        // Border
        'border-subtle': 'var(--border-subtle)',
        'border-medium': 'var(--border-medium)',
        'border-strong': 'var(--border-strong)',
      },
      fontFamily: {
        primary: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['Geist Mono', 'ui-monospace', 'SF Mono', 'monospace'],
      },
      fontSize: {
        'display': ['28px', { lineHeight: '1.20', fontWeight: '600' }],
        'heading': ['20px', { lineHeight: '1.30', fontWeight: '600' }],
        'subheading': ['16px', { lineHeight: '1.40', fontWeight: '500' }],
        'body': ['15px', { lineHeight: '1.60', fontWeight: '400' }],
        'ui': ['14px', { lineHeight: '1.40', fontWeight: '500' }],
        'caption': ['12px', { lineHeight: '1.50', fontWeight: '500' }],
        'stat': ['32px', { lineHeight: '1.00', fontWeight: '700' }],
      },
      borderRadius: {
        'sm': '4px',
        'md': '8px',
        'lg': '12px',
        'xl': '16px',
        'pill': '9999px',
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        'raised': '0 4px 12px rgba(0,0,0,0.08)',
        'elevated': '0 8px 24px rgba(0,0,0,0.12)',
      },
      spacing: {
        'sidebar': '260px',
        'container': '1280px',
        'content': '1020px',
      },
      animation: {
        'pulse-node': 'pulse 2s infinite',
        'sparkle': 'sparkle 1.5s infinite',
      },
    },
  },
  plugins: [],
};
