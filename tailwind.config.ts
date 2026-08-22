import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    // src/lib ikut dipindai karena beberapa modul di sana menyimpan peta
    // class (mis. warna gender kos di kosCard.ts, badge status di
    // offerFeedback.ts). Tanpa baris ini class yang HANYA muncul di src/lib
    // tidak pernah digenerate — dan gagalnya diam-diam: tidak ada error,
    // elemennya cuma tampil tanpa warna.
    "./src/lib/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      maxWidth: {
        'screen-xl': '75rem',
        'screen-2xl': '83.75rem'
      },
      boxShadow: {
        'cause-shadow': '0px 4px 17px 0px #00000008',
      },
      transitionDuration: {
        '150': '150ms',
      },
      spacing: {
        '6.25': '6.25rem',
        '70%': '70%',
        '40%': '40%',
        '30%': '30%',
        '80%': '80%',
        8.5: '8.5rem',
        50: '50rem',
        51: "54.375rem",
        25: '35.625rem',
        29: '28rem',
        120: '120rem',
        45: '45rem',
        94: '22.5rem',
        85: '21rem',
        3.75: '3.75rem'
      },
      inset: {
        '5%': '5%',
        '35%': '35%'
      },
      zIndex: {
        '1': '1',
        '2': '2',
        '999': '999'
      },
      keyframes: {
        shimmer: {
          "0%":   { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(200%)" },
        },

        // ── Penanda turun harga lelang (lihat PropertyCard) ──────────────
        // Semuanya hanya menganimasikan `transform` & `opacity`: dua properti
        // yang ditangani compositor GPU tanpa reflow/repaint. Card daftar bisa
        // muncul 12–24 sekaligus, dan menganimasikan width/box-shadow di
        // sebanyak itu akan terasa tersendat saat halaman di-scroll.

        /** Chip masuk: kecil → sedikit melewati ukuran → mantap. */
        "fomo-masuk": {
          "0%":   { transform: "scale(0.72)", opacity: "0" },
          "60%":  { transform: "scale(1.08)", opacity: "1" },
          "100%": { transform: "scale(1)",    opacity: "1" },
        },

        /** Coretan digambar kiri→kanan: harga lama DIBATALKAN di depan mata. */
        "fomo-coret": {
          "0%":   { transform: "scaleX(0)" },
          "100%": { transform: "scaleX(1)" },
        },

        /** Denyut cahaya sangat pelan — hanya untuk diskon terbesar. */
        "fomo-nyala": {
          "0%, 100%": { opacity: "0.35" },
          "50%":      { opacity: "0.9" },
        },
      },
      animation: {
        shimmer: "shimmer 1.5s infinite",

        // Sekali jalan, lalu diam. `backwards` menahan keadaan awal selama
        // jeda, jadi chip tidak sempat berkedip di ukuran penuh sebelum
        // animasinya mulai.
        "fomo-masuk": "fomo-masuk 480ms cubic-bezier(0.34,1.56,0.64,1) 220ms backwards",
        "fomo-coret": "fomo-coret 420ms cubic-bezier(0.22,1,0.36,1) 480ms backwards",

        // 2,8 detik: cukup lambat untuk terbaca sebagai "bernapas", bukan
        // kedipan yang menuntut. Ini satu-satunya animasi berulang di kartu.
        "fomo-nyala": "fomo-nyala 2.8s ease-in-out infinite",
      },
      colors: {
        primary: "#99E39E",
        secondary: "#1DC8CD",
        midnight_text: "#263238",
        muted: "#d8dbdb",
        error: "#CF3127",
        warning: "#F7931A",
        light_grey: "#505050",
        grey: "#F5F7FA",
        dark_grey: "#1E2229",
        border: "#E1E1E1",
        success: "#3cd278",
        section: "#737373",
        darkmode: "#000510",
        darklight: "#0c372a",
        dark_border: "#959595",
        tealGreen: "#477E70",
        charcoalGray: "#666C78",
        deepSlate: "#282C36",
        slateGray: "#2F3543",
      },
      fontSize: {
        86: [
          "5.375rem",
          {
            lineHeight: "1.2",
          }
        ],
        76: [
          "4.75rem",
          {
            lineHeight: "1.2",
          }
        ],
        70: [
          "4.375rem",
          {
            lineHeight: "1.2",
          }
        ],
        54: [
          "3.375rem",
          {
            lineHeight: "1.2",
          }
        ],
        44: [
          "2.75rem",
          {
            lineHeight: "1.3",
          }
        ],
        40: [
          "2.5rem",
          {
            lineHeight: "3rem",
          },
        ],
        36: [
          "2.25rem",
          {
            lineHeight: "2.625rem",
          },
        ],
        30: [
          "1.875rem",
          {
            lineHeight: "2.25rem",
          },
        ],
        28: [
          "1.75rem",
          {
            lineHeight: "2.25rem",
          },
        ],
        24: [
          "1.5rem",
          {
            lineHeight: "2rem",
          },
        ],
        22: [
          "1.375rem",
          {
            lineHeight: "2rem",
          },
        ],
        21: [
          "1.3125rem",
          {
            lineHeight: "1.875rem",
          },
        ],
        18: [
          "1.125rem",
          {
            lineHeight: "1.5rem",
          },
        ],
        17: [
          "1.0625rem",
          {
            lineHeight: "1.4875rem",
          },
        ],
        16: [
          "1rem",
          {
            lineHeight: "1.6875rem",
          },
        ],
        14: [
          "0.875rem",
          {
            lineHeight: "1.225rem",
          },
        ],
      },
      backgroundImage: {
        "start": "url('/images/work/bg-start.png')",
        "perk": "url('/images/perks/perk-bg.png')",
      },
      blur: {
        220: '220px',
        400: '400px',
      }
    },
  },
  plugins: [
    // Custom Scrollbar Plugin
    function ({ addUtilities }: any) {
      const newUtilities = {
        // Custom Scrollbar - Emerald Theme
        '.custom-scrollbar::-webkit-scrollbar': {
          width: '6px',
          height: '6px',
        },
        '.custom-scrollbar::-webkit-scrollbar-track': {
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '10px',
        },
        '.custom-scrollbar::-webkit-scrollbar-thumb': {
          background: 'linear-gradient(to bottom, #10b981, #059669)',
          borderRadius: '10px',
        },
        '.custom-scrollbar::-webkit-scrollbar-thumb:hover': {
          background: 'linear-gradient(to bottom, #34d399, #10b981)',
        },
        // Firefox scrollbar
        '.custom-scrollbar': {
          scrollbarWidth: 'thin',
          scrollbarColor: '#10b981 rgba(255, 255, 255, 0.05)',
        },

        // Alternative: Dark Scrollbar
        '.dark-scrollbar::-webkit-scrollbar': {
          width: '8px',
          height: '8px',
        },
        '.dark-scrollbar::-webkit-scrollbar-track': {
          background: '#1a1a1a',
          borderRadius: '10px',
        },
        '.dark-scrollbar::-webkit-scrollbar-thumb': {
          background: 'linear-gradient(to bottom, #404040, #262626)',
          borderRadius: '10px',
          border: '2px solid #1a1a1a',
        },
        '.dark-scrollbar::-webkit-scrollbar-thumb:hover': {
          background: 'linear-gradient(to bottom, #525252, #404040)',
        },
        '.dark-scrollbar': {
          scrollbarWidth: 'thin',
          scrollbarColor: '#404040 #1a1a1a',
        },

        // Hide Scrollbar
        '.hide-scrollbar::-webkit-scrollbar': {
          display: 'none',
        },
        '.hide-scrollbar': {
          '-ms-overflow-style': 'none',
          'scrollbar-width': 'none',
        },
      };
      addUtilities(newUtilities);
    },
  ],
};

export default config;
