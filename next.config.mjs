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
      {
        protocol: "https",
        hostname: "file.lelang.go.id",
        pathname: "/lelang/photo_barang/**",
      },
      // untuk foto profil dari Google Drive thumbnail
      {
        protocol: "https",
        hostname: "drive.google.com",
        pathname: "/thumbnail/**",
      },
      {
        protocol: "https",
        hostname: "drive.google.com",
        pathname: "/uc*", // karena kita pakai /uc?export=view&id=...
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      
    ],
  },
};

export default nextConfig;
