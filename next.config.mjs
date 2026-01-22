/** @type {import('next').NextConfig} */
const nextConfig = {
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
      // ⬇️ tambahin ini buat gambar lelang
      {
        protocol: "https",
        hostname: "file.lelang.go.id",
        pathname: "/lelang/photo_barang/**",
      },
    ],
  },
};

export default nextConfig;
