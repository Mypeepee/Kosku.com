"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { Icon } from "@iconify/react";
import { AnimatePresence, motion } from "framer-motion";

export default function ImageGallery({ images }: { images: string[] }) {
  // --- STATE ---
  const [isOpen, setIsOpen] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [mounted, setMounted] = useState(false);

  // State Khusus Mobile Slider
  const [mobileActiveIndex, setMobileActiveIndex] = useState(0);

  // Ref
  const mobileSliderRef = useRef<HTMLDivElement>(null);

  // Pastikan minimal ada 5 gambar untuk Grid Desktop
  const displayImagesGrid =
    images.length >= 5
      ? images.slice(0, 5)
      : [
          ...images,
          ...Array(5 - images.length).fill(
            images[images.length - 1] || "/images/banner.jpg"
          ),
        ];

  const mobileImages =
    images.length > 0 ? images : ["/images/banner.jpg"];

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // --- LIGHTBOX HANDLERS (Cinema Mode) ---
  const openLightbox = (index: number) => {
    setPhotoIndex(index);
    setIsOpen(true);
  };

  const closeLightbox = () => setIsOpen(false);

  const nextPhoto = useCallback(() => {
    setPhotoIndex((prev) => (prev + 1) % images.length);
  }, [images.length]);

  const prevPhoto = useCallback(() => {
    setPhotoIndex((prev) => (prev + images.length - 1) % images.length);
  }, [images.length]);

  // --- MOBILE SLIDER LOGIC ---
  const handleScrollUpdate = () => {
    if (mobileSliderRef.current) {
      const { scrollLeft, clientWidth } = mobileSliderRef.current;
      const newIndex = Math.round(scrollLeft / clientWidth);
      setMobileActiveIndex(newIndex);
    }
  };

  const scrollMobile = (direction: "left" | "right") => {
    if (!mobileSliderRef.current) return;

    const { clientWidth, scrollLeft } = mobileSliderRef.current;
    const currentIndex = Math.round(scrollLeft / clientWidth);

    let targetIndex =
      direction === "left" ? currentIndex - 1 : currentIndex + 1;
    targetIndex = Math.max(0, Math.min(targetIndex, mobileImages.length - 1));

    mobileSliderRef.current.scrollTo({
      left: targetIndex * clientWidth,
      behavior: "smooth",
    });

    setMobileActiveIndex(targetIndex);
  };

  // Keyboard Support (Arrow Keys)
  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowRight") nextPhoto();
      if (e.key === "ArrowLeft") prevPhoto();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "auto";
    };
  }, [isOpen, nextPhoto, prevPhoto]);

  return (
    <div className="w-full relative">
      {/* =========================================================
          1. DESKTOP GRID VIEW
      ========================================================== */}
      <div className="hidden lg:grid grid-cols-4 grid-rows-2 gap-3 h-[450px] rounded-2xl overflow-hidden">
        {/* Main Image */}
        <div
          className="col-span-2 row-span-2 relative cursor-pointer group overflow-hidden"
          onClick={() => openLightbox(0)}
        >
          <Image
            src={displayImagesGrid[0]}
            alt="Main View"
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-110"
            priority
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-500" />
        </div>

        {/* Small Images */}
        {displayImagesGrid.slice(1, 5).map((img, idx) => (
          <div
            key={idx}
            className="relative cursor-pointer group col-span-1 row-span-1 overflow-hidden"
            onClick={() => openLightbox(idx + 1)}
          >
            <Image
              src={img}
              alt={`Gallery ${idx}`}
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-110"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-500" />

            {/* Tombol Lihat Semua di Gambar Terakhir */}
            {idx === 3 && images.length > 5 && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openLightbox(4);
                  }}
                  className="bg-white text-black px-4 py-2 rounded-lg text-xs font-bold shadow-lg flex items-center gap-2 hover:bg-gray-200 transition-colors active:scale-95"
                >
                  <Icon icon="solar:gallery-bold-duotone" />
                  Lihat Semua ({images.length})
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* =========================================================
          2. MOBILE SLIDER VIEW
      ========================================================== */}
      <div className="lg:hidden relative w-full h-[280px] sm:h-[320px] rounded-2xl overflow-hidden shadow-sm group mt-4">
        <div
          ref={mobileSliderRef}
          onScroll={handleScrollUpdate}
          className="flex h-full w-full overflow-x-auto snap-x snap-mandatory scrollbar-hide touch-pan-x"
        >
          {mobileImages.map((img, idx) => (
            <div
              key={idx}
              className="relative h-full min-w-full snap-center bg-gray-900"
              onClick={() => openLightbox(idx)}
            >
              <Image
                src={img}
                alt={`Slide ${idx}`}
                fill
                className="object-cover"
                priority={idx === 0}
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60 pointer-events-none" />
            </div>
          ))}
        </div>

        {/* Arrow Kiri / Kanan */}
        {mobileActiveIndex > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              scrollMobile("left");
            }}
            className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/70 text-white p-2.5 rounded-full shadow-xl active:scale-95 transition-all z-20 border border-white/20"
          >
            <Icon icon="solar:alt-arrow-left-linear" className="text-xl" />
          </button>
        )}

        {mobileActiveIndex < mobileImages.length - 1 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              scrollMobile("right");
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/70 text-white p-2.5 rounded-full shadow-xl active:scale-95 transition-all z-20 border border-white/20"
          >
            <Icon icon="solar:alt-arrow-right-linear" className="text-xl" />
          </button>
        )}

        {/* Badge Counter */}
        <div className="absolute bottom-4 right-4 bg-black/75 px-3 py-1.5 rounded-lg text-xs font-bold text-white backdrop-blur-md border border-white/10 pointer-events-none z-10 shadow-lg">
          {mobileActiveIndex + 1} / {mobileImages.length} Foto
        </div>

        {/* Indikator Dots */}
        <div className="absolute bottom-4 left-4 flex gap-1.5 z-10">
          {mobileImages.slice(0, 5).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full backdrop-blur-sm transition-all duration-300 ${
                i === mobileActiveIndex ? "bg-white w-4" : "bg-white/40 w-1.5"
              }`}
            />
          ))}
          {mobileImages.length > 5 && (
            <div className="text-white/70 text-[10px] font-semibold ml-1 self-center">
              +{mobileImages.length - 5}
            </div>
          )}
        </div>
      </div>

      {/* =========================================================
          3. CINEMA MODE (LIGHTBOX)
      ========================================================== */}
      {mounted &&
        isOpen &&
        createPortal(
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[99999999] bg-black flex items-center justify-center w-screen h-screen top-0 left-0"
            >
              {/* Close */}
              <button
                onClick={closeLightbox}
                className="absolute top-6 right-6 z-50 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all active:scale-95"
              >
                <Icon
                  icon="solar:close-circle-bold"
                  className="text-3xl lg:text-4xl text-gray-300 hover:text-white"
                />
              </button>

              {/* Prev */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  prevPhoto();
                }}
                className="absolute left-2 lg:left-8 z-50 p-3 lg:p-4 rounded-full bg-black/50 text-white transition-all active:scale-95 hover:bg-white hover:text-black border border-white/10"
              >
                <Icon
                  icon="solar:alt-arrow-left-linear"
                  className="text-2xl lg:text-3xl"
                />
              </button>

              {/* Main Image */}
              <motion.div
                key={photoIndex}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                className="relative w-full h-full max-h-[80vh] lg:max-h-[85vh] max-w-[95vw] lg:max-w-[90vw] flex items-center justify-center"
              >
                <Image
                  src={images[photoIndex]}
                  alt="Cinema View"
                  fill
                  className="object-contain"
                  priority
                  quality={100}
                />
              </motion.div>

              {/* Next */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  nextPhoto();
                }}
                className="absolute right-2 lg:right-8 z-50 p-3 lg:p-4 rounded-full bg-black/50 text-white transition-all active:scale-95 hover:bg-white hover:text-black border border-white/10"
              >
                <Icon
                  icon="solar:alt-arrow-right-linear"
                  className="text-2xl lg:text-3xl"
                />
              </button>

              {/* Counter */}
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur-md px-6 py-2 rounded-full border border-white/5 text-white font-bold text-sm tracking-widest z-50">
                {photoIndex + 1} / {images.length}
              </div>
            </motion.div>
          </AnimatePresence>,
          document.body
        )}

      {/* CSS scrollbar-hide */}
      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
