'use client'
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false);
  const pathname = usePathname();

  // ---------------------------------------------------------
  // UPDATE LOGIKA DI SINI
  // ---------------------------------------------------------
  // Gunakan tanda || (artinya ATAU) untuk menambah kondisi baru.
  // Ganti "/CariApartemen/" dengan potongan URL yang ada di halaman detail apartemenmu.
  const isHiddenPage = pathname?.includes("/Carikos/") || pathname?.includes("/CariApartemen/"); 

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  useEffect(() => {
    const toggleVisibility = () => {
      // Jika halaman hidden, jangan set true
      if (!isHiddenPage && window.pageYOffset > 300) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener("scroll", toggleVisibility);

    return () => window.removeEventListener("scroll", toggleVisibility);
  }, [isHiddenPage]); 

  // Jika halaman termasuk dalam daftar hidden, component tidak dirender
  if (isHiddenPage) {
    return null;
  }

  return (
    <div className="fixed bottom-8 right-8 z-[999]">
      {isVisible && (
        <div
          onClick={scrollToTop}
          aria-label="scroll to top"
          className="back-to-top flex h-10 w-10 cursor-pointer items-center justify-center rounded-md bg-[#102C46] text-white shadow-md transition duration-300 ease-in-out hover:bg-dark"
        >
          <span className="mt-[6px] h-3 w-3 rotate-45 border-l border-t border-white"></span>
        </div>
      )}
    </div>
  );
}