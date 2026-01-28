"use client";

import React, { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";

import ProfileHeader from "./ProfileHeader";
import ProfileSidebar from "./ProfileSidebar";
import ProfileForm from "./ProfileForm";
import BookingHistory from "./FormTransaksi";
import RedeemPoints from "./ZonaHadiah";
import ProfilePhotoModal from "./ProfilePhotoModal";
import DataPenting from "./DataPenting";
import ModalRekening from "./ModalRekening";
import ModalNPWP from "./ModalNPWP";
import ModalKTP from "./ModalKTP";

const buildDriveImageUrl = (idOrUrl?: string | null) => {
  if (!idOrUrl) return null;

  if (!idOrUrl.includes("http")) {
    return `https://drive.google.com/uc?export=view&id=${idOrUrl}`;
  }

  try {
    const url = new URL(idOrUrl);
    const idFromQuery = url.searchParams.get("id");
    if (idFromQuery) {
      return `https://drive.google.com/uc?export=view&id=${idFromQuery}`;
    }

    const match = url.pathname.match(/\/d\/([^/]+)/);
    if (match?.[1]) {
      return `https://drive.google.com/uc?export=view&id=${match[1]}`;
    }
  } catch {
    // ignore
  }

  return null;
};

type SidebarTabId = "profile" | "data-penting" | "booking" | "reward";

const ProfilePage = () => {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<SidebarTabId>("profile");
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  const [userData, setUserData] = useState<any | null>(null);
  const [agentData, setAgentData] = useState<any | null>(null);
  const [statsData, setStatsData] = useState<any | null>(null);

  // form hanya untuk kolom dari tabel pengguna
  const [formData, setFormData] = useState({
    nama_lengkap: "",
    email: "",
    nomor_telepon: "",
    kota_asal: "",
    tanggal_lahir: "",
    foto_profil_url: "",
    peran: "USER" as string,
    kode_referral: "",
    id_agent: "",
  });

  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);

  // state untuk modal Data Penting
  const [openKtp, setOpenKtp] = useState(false);
  const [openNpwp, setOpenNpwp] = useState(false);
  const [openRek, setOpenRek] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/signin");
      return;
    }

    if (status === "authenticated") {
      const fetchUserData = async () => {
        try {
          const res = await fetch("/api/profile");
          if (!res.ok) throw new Error("Gagal mengambil data");

          const data = await res.json();

          const pengguna = data.pengguna;
          const agent = data.agent ?? null;
          const stats = data.stats ?? {};

          setUserData(pengguna);
          setAgentData(agent);
          setStatsData(stats);

          const fotoProfilFromAgent = agent?.foto_profil_url || "";
          const fotoProfilFromUser = pengguna?.foto_profil_url || "";
          const fotoProfilFromSession = session?.user?.image || "";

          const kodeReferralFromAgent = agent?.id_agent || "";
          const kodeReferralFromUser = pengguna?.kode_referral || "";

          setFormData((prev) => ({
            ...prev,
            nama_lengkap: pengguna.nama_lengkap || "",
            email: pengguna.email || "",
            nomor_telepon: pengguna.nomor_telepon || "+62",
            kota_asal: pengguna.kota_asal || "",
            tanggal_lahir: pengguna.tanggal_lahir || "",
            peran: pengguna.peran || "USER",
            id_agent: agent?.id_agent || "",
            kode_referral:
              pengguna.peran === "AGENT"
                ? kodeReferralFromAgent
                : kodeReferralFromUser,
            foto_profil_url:
              fotoProfilFromAgent ||
              fotoProfilFromUser ||
              fotoProfilFromSession ||
              "",
          }));
        } catch (error) {
          console.error(error);
          toast.error("Gagal memuat data profil");
        } finally {
          setIsFetching(false);
        }
      };

      fetchUserData();
    }
  }, [status, router, session]);

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
      router.refresh();
    } catch (error) {
      toast.error("Gagal menyimpan perubahan.");
    } finally {
      setIsLoading(false);
    }
  };

  if (status === "loading" || isFetching) {
    return (
      <div className="min-h-screen bg-[#0F0F0F] flex flex-col items-center justify-center text-white gap-3">
        <div className="w-10 h-10 border-4 border-[#86efac] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-400">Memuat data...</p>
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="min-h-screen bg-[#0F0F0F] flex items-center justify-center text-white">
        <p className="text-sm text-gray-400">
          Data pengguna tidak ditemukan.
        </p>
      </div>
    );
  }

  const isAgent = userData.peran === "AGENT";

  const currentPhotoUrl =
    agentData?.foto_profil_url
      ? buildDriveImageUrl(agentData.foto_profil_url)
      : userData?.foto_profil_url || undefined;

  return (
    <div className="min-h-screen bg-[#0F0F0F] text-white pt-24 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <ProfileHeader
          user={userData}
          agent={agentData}
          statsUser={
            !isAgent
              ? {
                  totalWishlist: statsData?.totalWishlist ?? 0,
                  totalTransaksi: statsData?.totalTransaksi ?? 0,
                  totalReferral: statsData?.totalReferral ?? 0,
                }
              : undefined
          }
          statsAgent={
            isAgent
              ? {
                  premierPoin: statsData?.premierPoin ?? 0,
                  listingAktif: statsData?.listingAktif ?? 0,
                  transaksiBerhasil: statsData?.transaksiBerhasil ?? 0,
                }
              : undefined
          }
          onEditPhoto={() => setIsPhotoModalOpen(true)}
        />

        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
          <ProfileSidebar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            onSignOut={() => signOut({ callbackUrl: "/" })}
            role={userData.peran}
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

              {activeTab === "data-penting" && isAgent && agentData && (
                <>
                  <DataPenting
                    agent={agentData}
                    onUploadKtp={() => setOpenKtp(true)}
                    onUploadNpwp={() => setOpenNpwp(true)}
                    onEditRekening={() => setOpenRek(true)}
                  />

                  {/* KTP */}
                  <ModalKTP
                    open={openKtp}
                    onClose={() => setOpenKtp(false)}
                    initialImageUrl={
                      agentData.foto_ktp_url
                        ? buildDriveImageUrl(agentData.foto_ktp_url)
                        : undefined
                    }
                    onSave={async (croppedBase64) => {
                      try {
                        const res = await fetch("/api/profile/ktp", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            cropped_image: croppedBase64,
                          }),
                        });

                        if (!res.ok) {
                          toast.error("Gagal menyimpan KTP.");
                          return;
                        }

                        const json = await res.json();
                        setAgentData((prev: any) => ({
                          ...prev,
                          foto_ktp_url:
                            json.fileId ?? prev?.foto_ktp_url ?? null,
                        }));
                        toast.success("KTP berhasil diperbarui.");
                      } catch (err) {
                        console.error(err);
                        toast.error(
                          "Terjadi kesalahan saat menyimpan KTP."
                        );
                      }
                    }}
                  />

                  {/* NPWP */}
                  <ModalNPWP
                    open={openNpwp}
                    onClose={() => setOpenNpwp(false)}
                    initialImageUrl={
                      agentData.foto_npwp_url
                        ? buildDriveImageUrl(agentData.foto_npwp_url)
                        : undefined
                    }
                    onSave={async (croppedBase64) => {
                      try {
                        const res = await fetch("/api/profile/npwp", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            nomor_npwp: agentData.nomor_npwp || "",
                            cropped_image_npwp: croppedBase64,
                          }),
                        });

                        if (!res.ok) {
                          toast.error("Gagal menyimpan NPWP.");
                          return;
                        }

                        const json = await res.json();
                        setAgentData((prev: any) => ({
                          ...prev,
                          foto_npwp_url:
                            json.fileId ?? prev?.foto_npwp_url ?? null,
                          nomor_npwp:
                            json.agent?.nomor_npwp ??
                            prev?.nomor_npwp ??
                            "",
                        }));
                        toast.success("NPWP berhasil diperbarui.");
                      } catch (err) {
                        console.error(err);
                        toast.error(
                          "Terjadi kesalahan saat menyimpan NPWP."
                        );
                      }
                    }}
                  />

                  {/* Rekening */}
                  <ModalRekening
                    open={openRek}
                    onClose={() => setOpenRek(false)}
                    defaultValue={agentData}
                    onSave={async (data) => {
                      try {
                        const res = await fetch("/api/profile/rekening", {
                          method: "PUT",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(data),
                        });

                        if (!res.ok) {
                          toast.error("Gagal menyimpan rekening.");
                          return;
                        }

                        const json = await res.json();
                        const agent = json.agent ?? data;

                        setAgentData((prev: any) => ({
                          ...prev,
                          nama_bank: agent.nama_bank,
                          nomor_rekening: agent.nomor_rekening,
                          atas_nama_rekening: agent.atas_nama_rekening,
                        }));

                        toast.success("Rekening berhasil disimpan.");
                      } catch (err) {
                        console.error(err);
                        toast.error(
                          "Terjadi kesalahan saat menyimpan rekening."
                        );
                      }
                    }}
                  />
                </>
              )}

              {activeTab === "booking" && <BookingHistory />}

              {activeTab === "reward" && isAgent && (
                <RedeemPoints userPoints={statsData?.premierPoin || 0} />
              )}
            </AnimatePresence>
          </main>
        </div>
      </div>

      <ProfilePhotoModal
        isOpen={isPhotoModalOpen}
        onClose={() => {
          setIsPhotoModalOpen(false);
          router.refresh();
        }}
        currentPhotoUrl={currentPhotoUrl}
      />
    </div>
  );
};

export default ProfilePage;
