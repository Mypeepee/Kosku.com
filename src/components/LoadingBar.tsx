"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export default function LoadingBar() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);

  // Matikan loading setiap path berubah (navigasi selesai)
  useEffect(() => {
    if (!pathname) return;
    setLoading(false);
  }, [pathname]);

  // Hidupkan loading saat user klik (kasar tapi simple)
  useEffect(() => {
    function handleClick() {
      setLoading(true);
      // fallback off setelah 1.5 detik kalau navigasi sangat cepat
      setTimeout(() => setLoading(false), 1500);
    }
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

  return (
    <div
      aria-busy={loading}
      className={`fixed top-0 left-0 h-1 w-full z-[9999] transition-opacity duration-300 ${
        loading ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      <div className="h-full w-full bg-gradient-to-r from-emerald-400 via-blue-500 to-purple-500 animate-[loadingBar_1s_linear_infinite]" />
      <style jsx>{`
        @keyframes loadingBar {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </div>
  );
}
