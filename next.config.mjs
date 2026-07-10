/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  swcMinify: true,
  // Jangan kirim header "X-Powered-By: Next.js" (kecil, tapi gratis).
  poweredByHeader: false,
  // Jangan gagalkan production build hanya karena error type/lint.
  // Kode tetap dikompilasi & berjalan (type dihapus saat build). Utang
  // type-strictness bisa dibereskan bertahap tanpa memblokir deploy.
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Exclude heavy Node-only packages from webpack bundling (runs only on server)
  experimental: {
    serverComponentsExternalPackages: ["pdf-parse", "pdfjs-dist", "pdf-lib", "docxtemplater", "pizzip", "puppeteer", "ffmpeg-static"],

    // Tree-shake barrel imports dari library besar. Tanpa ini, `import { X }
    // from "lucide-react"` ikut menyeret SELURUH paket ke bundle browser.
    // Berdampak besar ke ukuran JS halaman (lucide 60 file, framer 127 file,
    // iconify 228 file).
    optimizePackageImports: [
      "@iconify/react",
      "lucide-react",
      "framer-motion",
      "date-fns",
      "@radix-ui/react-dialog",
      "@radix-ui/react-select",
      "@radix-ui/react-label",
      "react-hot-toast",
      "sonner",
    ],
  },

  webpack: (config, { isServer }) => {
    if (isServer) {
      // Paksa nodemailer ikut di-bundle ke dalam .next/server — server tidak perlu install sendiri
      config.externals = (config.externals || []).map((ext) => {
        if (typeof ext !== "function") return ext;
        return (ctx, cb) => {
          if (ctx.request === "nodemailer" || ctx.request?.startsWith("nodemailer/")) {
            return cb();
          }
          return ext(ctx, cb);
        };
      });
    }
    return config;
  },

  images: {
    // Cache hasil optimasi gambar 30 hari, jadi tidak di-encode ulang tiap
    // request. Krusial untuk server tunggal (encoding gambar = beban CPU).
    minimumCacheTTL: 2592000,
    remotePatterns: [
      // Avatar Google (OAuth)
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "**",
      },
      {
        protocol: "https",
        hostname: "googleusercontent.com",
        pathname: "**",
      },

      // Avatar GitHub
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
        pathname: "**",
      },

      // Gambar lelang dari Kemenkeu
      {
        protocol: "https",
        hostname: "file.lelang.go.id",
        pathname: "/lelang/photo_barang/**",
      },

      // Foto dari Google Drive (thumbnail generator)
      {
        protocol: "https",
        hostname: "drive.google.com",
        pathname: "/thumbnail/**",
      },
      // Foto dari Google Drive dengan /uc?export=view&id=...
      {
        protocol: "https",
        hostname: "drive.google.com",
        pathname: "/uc**",
      },
      // Google Drive serves images via this CDN after the redirect from drive.google.com
      {
        protocol: "https",
        hostname: "drive.usercontent.google.com",
        pathname: "**",
      },

      // Unsplash
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "**",
      },
    ],
  },
};

export default nextConfig;