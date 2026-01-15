"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import Loader from "@/components/Common/Loader";
import Image from "next/image";

type Mode = "email" | "phone";

// ✅ TAMBAHAN 1: Definisikan tipe props untuk fungsi close
interface SigninProps {
  closeModal?: () => void;
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    // Eye Off (modern)
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M3 3l18 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M10.58 10.58a3 3 0 104.24 4.24"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M9.88 5.08A10.77 10.77 0 0112 4.8c5.2 0 9.27 3.83 10.8 7.2a11.7 11.7 0 01-3.02 4.14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M6.2 6.2A11.6 11.6 0 001.2 12c1.6 3.52 5.86 7.2 10.8 7.2 1.78 0 3.44-.36 4.92-.98"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  ) : (
    // Eye (modern)
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M1.2 12c1.6-3.52 5.86-7.2 10.8-7.2s9.2 3.68 10.8 7.2c-1.6 3.52-5.86 7.2-10.8 7.2S2.8 15.52 1.2 12z"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        strokeLinejoin="round"
      />
      <path
        d="M12 15.2a3.2 3.2 0 110-6.4 3.2 3.2 0 010 6.4z"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
    </svg>
  );
}

function normalizePhoneDigits(raw: string) {
  let digits = (raw || "").replace(/\D/g, "");
  if (digits.startsWith("62")) digits = digits.slice(2);
  digits = digits.replace(/^0+/, "");
  return digits;
}

// ✅ TAMBAHAN 2: Terima props closeModal disini
const Signin = ({ closeModal }: SigninProps) => {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("email");
  const [email, setEmail] = useState("");
  const [phoneDigits, setPhoneDigits] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // --- REVISI: Handle Google Login menggunakan NextAuth ---
  const handleGoogle = async () => {
    setLoading(true);
    // ✅ TAMBAHAN 3A: Tutup modal saat user klik Google (UX lebih mulus saat redirect)
    if (closeModal) closeModal();
    
    try {
      // callbackUrl: "/" artinya setelah login sukses akan diarahkan ke Home
      await signIn("google", { callbackUrl: "/" });
    } catch (error) {
      console.error(error);
      toast.error("Gagal koneksi ke Google");
    } finally {
      setLoading(false);
    }
  };

  const loginUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);

    try {
      const payload: any =
        mode === "email"
          ? { email: email.trim(), password, redirect: false }
          : { phone: `+62${phoneDigits}`, password, redirect: false };

      if (mode === "email" && !payload.email) {
        throw new Error("Email wajib diisi.");
      }
      if (mode === "phone" && !phoneDigits) {
        throw new Error("No. HP wajib diisi.");
      }
      if (!password) {
        throw new Error("Kata sandi wajib diisi.");
      }

      // Login Credentials (Manual)
      const callback = await signIn("credentials", payload);

      if (callback?.error) {
        toast.error(callback.error);
        setLoading(false);
        return;
      }

      if (callback?.ok && !callback?.error) {
        toast.success("Berhasil masuk.");
        
        // ✅ TAMBAHAN 3B: Tutup modal secara manual sebelum redirect
        if (closeModal) closeModal();
        
        setLoading(false);
        router.push("/");
      }
    } catch (err: any) {
      setLoading(false);
      toast.error(err?.message || "Terjadi kesalahan.");
    }
  };

  const inputClass =
    "w-full rounded-md border border-dark_border/60 bg-transparent px-5 py-3 text-base outline-none transition " +
    "text-white placeholder:text-white/35 " +
    "focus:border-primary focus:bg-white/5 focus-visible:shadow-none";

  return (
    <>
      {/* Header: sama gaya dengan SignUp */}
      <div className="mb-6 w-full flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="relative h-12 w-12 shrink-0">
            <Image
              src="/images/logo/logokosku.svg"
              alt="Kosku"
              fill
              priority
              className="object-contain"
            />
          </div>

          <div className="leading-tight text-left">
            <div className="text-white font-semibold text-xl">
              Kos<span className="text-primary">ku</span>.com
            </div>
            <div className="text-white/60 text-xs">Masuk akun</div>
          </div>
        </div>
      </div>

      {/* Google only */}
      <button
        type="button"
        onClick={handleGoogle}
        disabled={loading}
        className="
          flex w-full items-center justify-center gap-3
          rounded-md border border-dark_border/60
          bg-transparent px-5 py-3
          text-base font-medium text-white
          transition hover:bg-white/5 hover:border-primary/60
          disabled:opacity-50 disabled:cursor-not-allowed
        "
      >
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.659 32.659 29.197 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
          <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 16.108 19.001 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
          <path fill="#4CAF50" d="M24 44c5.092 0 9.797-1.953 13.333-5.127l-6.153-5.207C29.125 35.091 26.7 36 24 36c-5.176 0-9.627-3.317-11.297-7.946l-6.522 5.025C9.49 39.556 16.227 44 24 44z"/>
          <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.246-2.23 4.148-4.123 5.46l.003-.002 6.153 5.207C36.9 39.018 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
        </svg>
        Masuk dengan Google
      </button>

      {/* Divider */}
      <span className="z-1 relative my-6 block text-center before:content-[''] before:absolute before:h-px before:w-[40%] before:bg-dark_border before:bg-opacity-60 before:left-0 before:top-3 after:content-[''] after:absolute after:h-px after:w-[40%] after:bg-dark_border after:bg-opacity-60 after:top-3 after:right-0">
        <span className="text-body-secondary relative z-10 inline-block px-3 text-sm text-white/70">
          ATAU
        </span>
      </span>

      {/* Mode switch (konsisten dengan signup) */}
      <div className="mb-4">
        <div className="inline-flex w-full rounded-md border border-dark_border/60 bg-white/5 p-1">
          <button
            type="button"
            onClick={() => setMode("email")}
            className={[
              "flex-1 rounded-md px-3 py-2 text-sm font-medium transition",
              mode === "email"
                ? "bg-primary text-darkmode"
                : "text-white/80 hover:bg-white/5",
            ].join(" ")}
          >
            Email
          </button>
          <button
            type="button"
            onClick={() => setMode("phone")}
            className={[
              "flex-1 rounded-md px-3 py-2 text-sm font-medium transition",
              mode === "phone"
                ? "bg-primary text-darkmode"
                : "text-white/80 hover:bg-white/5",
            ].join(" ")}
          >
            No. HP
          </button>
        </div>
      </div>

      <form onSubmit={loginUser}>
        {/* Email / Phone */}
        {mode === "email" ? (
          <div className="mb-[18px]">
            <input
              type="email"
              placeholder="Email (contoh: nama@email.com)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className={inputClass}
            />
          </div>
        ) : (
          <div className="mb-[18px]">
            <div className="flex">
              <span className="inline-flex items-center rounded-l-md border border-dark_border/60 bg-white/5 px-4 text-white/80 text-sm">
                +62
              </span>
              <input
                type="tel"
                required
                inputMode="numeric"
                autoComplete="tel-national"
                placeholder="81234567890"
                value={phoneDigits}
                onChange={(e) => setPhoneDigits(normalizePhoneDigits(e.target.value))}
                onKeyDown={(e) => {
                  if (phoneDigits.length === 0 && e.key === "0") {
                    e.preventDefault();
                  }
                }}
                className={[inputClass, "rounded-l-none border-l-0"].join(" ")}
              />
            </div>
          </div>
        )}

        {/* Password */}
        <div className="mb-[22px]">
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Kata sandi"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className={[inputClass, "pr-12"].join(" ")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/45 hover:text-white/90 transition"
              aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
              title={showPassword ? "Sembunyikan" : "Tampilkan"}
            >
              <EyeIcon open={showPassword} />
            </button>
          </div>
        </div>

        <div className="mb-7">
          <button
            type="submit"
            disabled={loading}
            className="
              flex w-full items-center justify-center gap-2
              text-18 font-medium rounded-md
              bg-primary px-5 py-3 text-darkmode
              transition duration-300 ease-in-out
              hover:bg-transparent hover:text-primary
              border-primary border
              disabled:opacity-60 disabled:cursor-not-allowed
            "
          >
            Masuk {loading && <Loader />}
          </button>
        </div>
      </form>

      <Link
        href="/forgot-password"
        className="mb-2 inline-block text-sm text-white/80 hover:text-primary"
      >
        Lupa kata sandi?
      </Link>

      <p className="text-body-secondary text-white text-sm">
        Belum punya akun?{" "}
        <Link href="/signup" className="text-primary hover:underline">
          Daftar
        </Link>
      </p>
    </>
  );
};

export default Signin;