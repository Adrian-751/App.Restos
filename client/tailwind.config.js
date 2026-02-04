/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                'dark-bg': '#0f172a', // slate-900
                'dark-text': '#f1f5f9', // slate-100
                'fuxia-primary': '#d946ef', // fuchsia-500
                'fuxia-light': '#ff00ff', // fuchsia-300
                'fuxia-dark': '#a21caf', // fuchsia-700
            },
        },
    },
    plugins: [],
}

