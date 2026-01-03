/** @type {import('next').NextConfig} */
const nextConfig = {
  // output: "export", // <--- INI SUDAH SAYA MATIKAN (Supaya Login Jalan)
  
  images: {
    unoptimized: true, // Biarkan true dulu agar gambar aman
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**", // Mengizinkan gambar dari semua domain (untuk foto profil Google)
      },
    ],
  },
};

export default nextConfig;