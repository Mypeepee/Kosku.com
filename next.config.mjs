/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // matikan Strict Mode di dev
  turbopack: false,       // optional, pakai webpack klasik

  // output: "export",

  images: {
    // unoptimized: true,
    remotePatterns: [
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
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
        pathname: "**",
      },
      // gambar lelang KPKNL
      {
        protocol: "https",
        hostname: "file.lelang.go.id",
        pathname: "/lelang/photo_barang/**",
      },
    ],
  },
};

export default nextConfig;
