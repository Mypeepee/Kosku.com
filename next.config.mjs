/** @type {import('next').NextConfig} */
const nextConfig = {
  // output: "export", // Tetap dimatikan agar Login jalan
  
  images: {
    // unoptimized: true, <--- HAPUS atau comment baris ini agar fitur optimasi jalan
    
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com", // Server utama foto profil Google
        pathname: "**",
      },
      {
        protocol: "https",
        hostname: "googleusercontent.com", // Cadangan domain Google
        pathname: "**",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com", // Jaga-jaga kalau login Github nanti
        pathname: "**",
      },
    ],
  },
};

export default nextConfig;