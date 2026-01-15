"use client";

import React, { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";

// Import Komponen UI
import ProfileHeader from "./ProfileHeader";
import ProfileSidebar from "./ProfileSidebar";
import ProfileForm from "./ProfileForm";
import BookingHistory from "./BookingHistory";
import RedeemPoints from "./RedeemPoints";

const ProfilePage = () => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("profile");
  const [isLoading, setIsLoading] = useState(false); // Loading saat tombol simpan ditekan
  const [isFetching, setIsFetching] = useState(true); // Loading saat pertama kali buka halaman

  // State Form (Default kosong dulu, jangan isi data palsu)
  const [formData, setFormData] = useState({
    nama_lengkap: "",
    email: "",
    nomor_telepon: "",
    kota_asal: "",
    tanggal_lahir: "",
    pekerjaan: "mahasiswa",
    jenis_kelamin: "pria",
    foto_profil_url: "",
  });

  // === 1. FETCH DATA DARI DATABASE (AUTO RUN) ===
  useEffect(() => {
    // Jika belum login, tendang ke signin
    if (status === "unauthenticated") {
      router.push("/signin");
      return;
    }

    // Jika sudah login, ambil data dari API
    if (status === "authenticated") {
      const fetchUserData = async () => {
        try {
          // Panggil API Backend yang kita buat di route.ts
          const res = await fetch("/api/profile"); 
          
          if (!res.ok) throw new Error("Gagal mengambil data");
          
          const data = await res.json();
          
          // Masukkan data database ke dalam Form
          setFormData((prev) => ({
            ...prev,
            ...data, // Ini data asli dari DB (nama, hp, tgl lahir, dll)
            // Fallback foto profil jika di DB kosong, pakai dari Google/Session
            foto_profil_url: data.foto_profil_url || session?.user?.image || "", 
          }));

        } catch (error) {
          console.error(error);
          toast.error("Gagal memuat data profil");
        } finally {
          setIsFetching(false); // Matikan loading screen
        }
      };

      fetchUserData();
    }
  }, [status, router, session]);


  // === 2. FUNGSI UPDATE KE DATABASE ===
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) throw new Error("Gagal update");

      toast.success("Profil berhasil diperbarui!");
      router.refresh(); // Refresh halaman agar data terbaru terlihat
    } catch (error) {
      toast.error("Gagal menyimpan perubahan.");
    } finally {
      setIsLoading(false);
    }
  };

  // Tampilan Loading saat sedang ambil data
  if (status === "loading" || isFetching) {
    return (
      <div className="min-h-screen bg-[#0F0F0F] flex flex-col items-center justify-center text-white gap-3">
        <div className="w-10 h-10 border-4 border-[#86efac] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm text-gray-400">Memuat data...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F0F0F] text-white pt-24 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        
        {/* Header menerima data user asli */}
        <ProfileHeader user={formData} />

        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
          
          <ProfileSidebar 
            activeTab={activeTab} 
            setActiveTab={setActiveTab} 
            onSignOut={() => signOut({ callbackUrl: "/" })} 
          />

          <main className="flex-1 min-w-0">
            <AnimatePresence mode="wait">
              
              {activeTab === "profile" && (
                <ProfileForm 
                  formData={formData} 
                  setFormData={setFormData} 
                  isLoading={isLoading} 
                  onSave={handleSave} 
                />
              )}

              {activeTab === "booking" && (
                <BookingHistory />
              )}

            {activeTab === "reward" && (
                <RedeemPoints userPoints={formData.total_poin || 0} />
            )}
            </AnimatePresence>
          </main>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;