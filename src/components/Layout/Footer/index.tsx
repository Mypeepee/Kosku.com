"use client";
import React, { FC } from "react";
import Link from "next/link";
import { headerData } from "../Header/Navigation/menuData";
import { footerlabels } from "@/app/api/data";
import { Icon } from "@iconify/react";
import Logo from "../Header/Logo";

const Footer: FC = () => {
  return (
    // REVISI: pt-0 (Hapus padding atas) agar rapat dengan section sebelumnya
    <footer className="bg-darkmode pt-0 pb-10">
      <div className="container mx-auto lg:max-w-screen-xl md:max-w-screen-md px-4">
        
        {/* Border Top halus sebagai pemisah visual yang elegan */}
        <div className="border-t border-white/10 pt-16 pb-10 grid grid-cols-1 sm:grid-cols-12 gap-8 lg:gap-12">
          
          {/* KOLOM 1: Brand & Social */}
          <div className="lg:col-span-4 md:col-span-12 col-span-12 flex flex-col gap-6">
            <Logo />
            <p className="text-gray-400 text-sm leading-relaxed pr-4">
              Platform pencarian kos #1 di Indonesia. Aman, mudah, dan terpercaya.
            </p>
            <div className="flex gap-4 items-center">
              <Link href="#" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white hover:bg-primary hover:text-darkmode transition-all">
                <Icon icon="fa6-brands:facebook-f" width="18" />
              </Link>
              <Link href="#" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white hover:bg-primary hover:text-darkmode transition-all">
                <Icon icon="fa6-brands:instagram" width="18" />
              </Link>
              <Link href="#" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white hover:bg-primary hover:text-darkmode transition-all">
                <Icon icon="fa6-brands:x-twitter" width="18" />
              </Link>
            </div>
          </div>

          {/* KOLOM 2: Links */}
          <div className="lg:col-span-2 md:col-span-4 col-span-6">
            <h4 className="text-white mb-6 font-bold text-lg">Links</h4>
            <ul className="space-y-3">
              {headerData.map((item, index) => (
                <li key={index}>
                  <Link
                    href={item.href}
                    className="text-gray-400 hover:text-primary text-sm transition-colors"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* KOLOM 3: Information */}
          <div className="lg:col-span-2 md:col-span-4 col-span-6">
            <h4 className="text-white mb-6 font-bold text-lg">Information</h4>
            <ul className="space-y-3">
              {footerlabels.map((item, index) => (
                <li key={index}>
                  <Link
                    href={item.herf}
                    className="text-gray-400 hover:text-primary text-sm transition-colors"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* KOLOM 4: Subscribe */}
          <div className="lg:col-span-4 md:col-span-4 col-span-12">
            <h3 className="text-white text-lg font-bold mb-4">Subscribe</h3>
            <p className="text-gray-400 text-sm mb-6">
              Dapatkan info promo dan kos terbaru langsung di inbox Anda.
            </p>
            <div className="relative">
              <input
                type="email"
                placeholder="Masukkan Email"
                className="bg-white/5 border border-white/10 focus:border-primary focus:outline-none py-3 pl-5 pr-12 text-white rounded-xl w-full text-sm transition-all"
              />
              <button className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-primary rounded-lg text-darkmode hover:bg-white transition-colors">
                <Icon icon="tabler:send" width="18" />
              </button>
            </div>
          </div>
        </div>

        {/* COPYRIGHT BAR (Pengganti teks Crypgo/ThemeWagon yang dihapus) */}
        <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-gray-500 text-xs">
            © 2025 Kosku.com. All rights reserved.
          </p>
          <div className="flex gap-6">
            <Link href="#" className="text-gray-500 hover:text-white text-xs">Privacy Policy</Link>
            <Link href="#" className="text-gray-500 hover:text-white text-xs">Terms of Service</Link>
          </div>
        </div>

      </div>
    </footer>
  );
};

export default Footer;