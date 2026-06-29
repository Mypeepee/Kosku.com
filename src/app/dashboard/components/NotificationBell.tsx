"use client";

/* ════════════════════════════════════════════════════════════════════
   NotificationBell — topbar notification dropdown
   ────────────────────────────────────────────────────────────────────
   Saat ini sumber notif: titip-jual masuk yang masih PENDING untuk
   agent ini. Ke depan bisa di-extend ke source lain (sistem, transaksi,
   pengingat). Bell tampil di setiap halaman dashboard via topbar.tsx.
   ════════════════════════════════════════════════════════════════════ */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  countdownText,
  formatDateTimeID,
  readDismissedIds,
  writeDismissedIds,
  JENIS_META,
  type TitipItem,
  type JenisProperti,
} from "@/app/dashboard/components/agent/premium/titipLeads";

/* ── Pembayaran Project — investor belum bayar komitmen ── */
interface PembayaranItem {
  id_project: string;
  nama_project: string;
  lokasi: string;
  status_project: string;
  nominal_komitmen: number;
}

/* ── Survei Lokasi — booking dari halaman properti ── */
interface SurveiItem {
  id_booking: string;
  id_property: string;
  id_lead: string | null;
  judul: string;
  slug: string;
  nama_klien: string;
  nomor_telepon: string;
  tanggal_survei: string; // ISO
  catatan: string | null;
  tanggal_dibuat: string; // ISO
}

/* ── Penawaran Harga — dari halaman properti ── */
interface PenawaranItem {
  id_lead: string;
  id_property: string;
  judul: string | null;
  slug: string | null;
  gambar: string | null;
  harga_listing: number | null;
  client_name: string | null;
  client_phone: string | null;
  offer_amount: number | null;
  notes: string | null;
  verified: boolean;
  created_at: string; // ISO
}

/* ── Notifikasi sistem (agent baru, referral, dll) ── */
interface SysNotif {
  id_notifikasi: string;
  tipe: "AGENT_BARU" | "AGENT_REFERRAL" | "CO_BROKE_SUBMITTED" | "CO_BROKE_ACCEPTED" | "CO_BROKE_REJECTED";
  judul: string;
  pesan: string;
  link: string | null;
  id_agent_ref: string | null;
  dibaca: boolean;
  dibuat_pada: string; // ISO
}

function formatRupiah(n: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatSurveiDate(iso: string): string {
  // tanggal_survei disimpan UTC → konversi ke WIB (UTC+7) sebelum ditampilkan
  const wib = new Date(new Date(iso).getTime() + 7 * 3600 * 1000);
  const days = ["Min","Sen","Sel","Rab","Kam","Jum","Sab"];
  const months = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
  const day  = days[wib.getUTCDay()];
  const date = String(wib.getUTCDate()).padStart(2, "0");
  const mon  = months[wib.getUTCMonth()];
  const hh   = String(wib.getUTCHours()).padStart(2, "0");
  const mm   = String(wib.getUTCMinutes()).padStart(2, "0");
  return `${day}, ${date} ${mon} • ${hh}:${mm} WIB`;
}

/* Item dengan tambahan metadata "locked" — saat ada agent lain yang
   sudah klaim, item tidak langsung dihapus; dia ditandai locked supaya
   agent ini dapat closure ("Diambil oleh X pada tanggal jam"),
   lalu fade out otomatis setelah cukup waktu untuk dibaca. */
type NotifItem = TitipItem & {
  locked?: { by_nama: string; at: number; persistent?: boolean };
};

// Cukup panjang untuk closure tanpa bikin dropdown menumpuk notif
// "yang sudah lewat". 30 detik = waktu yang masuk akal untuk baca + recover
// dari kekalahan tanpa mengganggu workflow.
const LOCKED_TTL_MS = 30_000;

/** Bentuk minimum TitipItem untuk represent missed lead di notif —
 *  sebagian field tidak relevan (kedaluwarsa, masked phone, dll) jadi
 *  diisi placeholder safe. Yang penting locked metadata-nya. */
function buildMissedNotifItem(m: {
  id_titip: string;
  jenis_properti: JenisProperti;
  alamat_lengkap: string;
  kota: string;
  kecamatan: string | null;
  by_agent_nama: string;
  diklaim_pada: string | null;
}): NotifItem {
  return {
    id_titip: m.id_titip,
    jenis_properti: m.jenis_properti,
    alamat_lengkap: m.alamat_lengkap,
    provinsi: "",
    kota: m.kota,
    kecamatan: m.kecamatan,
    kelurahan: null,
    estimasi_harga: null,
    pengirim_nama_masked: "",
    pengirim_phone_masked: "",
    status_kepemilikan: "PRIBADI",
    kedaluwarsa_pada: new Date().toISOString(),
    dibuat_pada: m.diklaim_pada || new Date().toISOString(),
    locked: {
      by_nama: m.by_agent_nama,
      at: m.diklaim_pada ? new Date(m.diklaim_pada).getTime() : Date.now(),
      persistent: true,
    },
  };
}

export default function NotificationBell() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();
  const agentId = (session?.user as any)?.agentId as string | null | undefined;
  const idPengguna = (session?.user as any)?.id as string | null | undefined;
  const [items, setItems] = useState<NotifItem[]>([]);
  const [surveiItems, setSurveiItems] = useState<SurveiItem[]>([]);
  const [penawaranItems, setPenawaranItems] = useState<PenawaranItem[]>([]);
  const [pembayaranItems, setPembayaranItems] = useState<PembayaranItem[]>([]);
  const [sysNotifs, setSysNotifs] = useState<SysNotif[]>([]);
  const [surveiActing, setSurveiActing] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const seenCountRef = useRef<number>(0);
  const seenSurveiCountRef = useRef<number>(0);
  const seenPenawaranCountRef = useRef<number>(0);
  const seenSysCountRef = useRef<number>(0);
  const seenPembayaranCountRef = useRef<number>(0);
  const [pulse, setPulse] = useState(false);
  // Track timer per id supaya cleanup rapi dan tidak double-schedule
  const dismissTimersRef = useRef<Map<string, number>>(new Map());

  // Tutup dropdown saat klik di luar
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  // Load + Pusher realtime
  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const res = await fetch("/api/leads/titip-jual/inbox", {
          cache: "no-store",
        });
        if (!res.ok) return;
        const json = await res.json();
        if (!active || !json?.ok) return;

        const pending = (json.items as TitipItem[]) || [];

        // Hydrate missed: lead yang sudah dimenangkan agent lain (status
        // terklaim) dan belum di-acknowledge user. Filter via localStorage.
        const dismissed = readDismissedIds();
        const missedRaw: Array<{
          id_titip: string;
          jenis_properti: JenisProperti;
          alamat_lengkap: string;
          kota: string;
          kecamatan: string | null;
          by_agent_nama: string;
          diklaim_pada: string | null;
        }> = json.missed_items || [];
        const missed = missedRaw
          .filter((m) => !dismissed.has(m.id_titip))
          .map(buildMissedNotifItem);

        // Susunan: pending dulu (actionable), missed di bawah (closure).
        const next: NotifItem[] = [...pending, ...missed];

        // Pulse animation hanya kalau ada lead baru (actionable) — bukan
        // missed. Pakai count pending saja untuk hindari false-positive
        // pulse saat user pertama kali open page setelah lama offline.
        if (
          pending.length > seenCountRef.current &&
          seenCountRef.current > 0
        ) {
          setPulse(true);
          window.setTimeout(() => setPulse(false), 2200);
        }
        seenCountRef.current = pending.length;
        setItems(next);
      } catch {
        // ignore
      }
    }

    load();
    const onFocus = () => load();
    const onVis = () => {
      if (!document.hidden) load();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    const intv = window.setInterval(load, 90_000);

    let cleanupPusher: (() => void) | null = null;
    (async () => {
      try {
        const mod = await import("@/lib/pusher-client");
        const pc = mod.pusherClient;
        const ch = pc.subscribe("titip-broadcast");
        const onNew = () => load();
        const onLocked = (data: {
          id_titip: string;
          by_agent_nama?: string;
          at_iso?: string;
        }) => {
          const by_nama = data.by_agent_nama || "Agent lain";
          const at = data.at_iso ? new Date(data.at_iso).getTime() : Date.now();
          setItems((prev) => {
            // Hanya transform jika item-nya memang ada di list ini
            const exists = prev.some((x) => x.id_titip === data.id_titip);
            if (!exists) return prev;
            return prev.map((x) =>
              x.id_titip === data.id_titip
                ? { ...x, locked: { by_nama, at } }
                : x,
            );
          });
          // Jadwalkan auto-dismiss — tapi skip kalau item-nya berubah jadi
          // persistent (mis. setelah refresh, di-hydrate dari missed_items).
          const existing = dismissTimersRef.current.get(data.id_titip);
          if (existing) window.clearTimeout(existing);
          const t = window.setTimeout(() => {
            setItems((prev) => {
              const target = prev.find((x) => x.id_titip === data.id_titip);
              if (target?.locked?.persistent) return prev; // jangan buang
              return prev.filter((x) => x.id_titip !== data.id_titip);
            });
            dismissTimersRef.current.delete(data.id_titip);
          }, LOCKED_TTL_MS);
          dismissTimersRef.current.set(data.id_titip, t);
        };
        ch.bind("titip:new", onNew);
        ch.bind("titip:locked", onLocked);
        cleanupPusher = () => {
          ch.unbind("titip:new", onNew);
          ch.unbind("titip:locked", onLocked);
          pc.unsubscribe("titip-broadcast");
        };
      } catch {
        /* fallback polling jalan */
      }
    })();

    return () => {
      active = false;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
      window.clearInterval(intv);
      if (cleanupPusher) cleanupPusher();
      // Clear semua pending fade-out timer
      dismissTimersRef.current.forEach((t) => window.clearTimeout(t));
      dismissTimersRef.current.clear();
    };
  }, []);

  // Load survei + penawaran secara paralel — keduanya butuh agentId
  useEffect(() => {
    if (!agentId) return;
    let active = true;

    async function loadAgentInboxes() {
      try {
        const [surveiRes, penawaranRes, pembayaranRes] = await Promise.allSettled([
          fetch("/api/survei/inbox", { cache: "no-store" }),
          fetch("/api/leads/penawaran/inbox", { cache: "no-store" }),
          fetch("/api/project/pembayaran-pending", { cache: "no-store" }),
        ]);
        if (!active) return;

        if (surveiRes.status === "fulfilled" && surveiRes.value.ok) {
          const json = await surveiRes.value.json().catch(() => null);
          if (active && json?.ok) {
            const list = (json.items as SurveiItem[]) || [];
            if (list.length > seenSurveiCountRef.current && seenSurveiCountRef.current > 0) {
              setPulse(true);
              window.setTimeout(() => setPulse(false), 2200);
            }
            seenSurveiCountRef.current = list.length;
            setSurveiItems(list);
          }
        }

        if (penawaranRes.status === "fulfilled" && penawaranRes.value.ok) {
          const json = await penawaranRes.value.json().catch(() => null);
          if (active && json?.ok) {
            const list = (json.items as PenawaranItem[]) || [];
            if (list.length > seenPenawaranCountRef.current && seenPenawaranCountRef.current > 0) {
              setPulse(true);
              window.setTimeout(() => setPulse(false), 2200);
            }
            seenPenawaranCountRef.current = list.length;
            setPenawaranItems(list);
          }
        }

        if (pembayaranRes.status === "fulfilled" && pembayaranRes.value.ok) {
          const json = await pembayaranRes.value.json().catch(() => null);
          if (active && json?.ok) {
            const list = (json.items as PembayaranItem[]) || [];
            if (list.length > seenPembayaranCountRef.current && seenPembayaranCountRef.current > 0) {
              setPulse(true);
              window.setTimeout(() => setPulse(false), 2200);
            }
            seenPembayaranCountRef.current = list.length;
            setPembayaranItems(list);
          }
        }
      } catch {
        // ignore
      }
    }

    loadAgentInboxes();
    const onFocus = () => loadAgentInboxes();
    const onVis = () => { if (!document.hidden) loadAgentInboxes(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    const intv = window.setInterval(loadAgentInboxes, 90_000);

    const cleanupFns: Array<() => void> = [];
    (async () => {
      try {
        const mod = await import("@/lib/pusher-client");
        const pc = mod.pusherClient;

        const surveiCh = pc.subscribe(`survei-agent-${agentId}`);
        const onSurvei = () => loadAgentInboxes();
        surveiCh.bind("survei:new", onSurvei);
        cleanupFns.push(() => {
          surveiCh.unbind("survei:new", onSurvei);
          pc.unsubscribe(`survei-agent-${agentId}`);
        });

        const penawaranCh = pc.subscribe(`lead-agent-${agentId}`);
        const onPenawaran = () => loadAgentInboxes();
        penawaranCh.bind("penawaran:new", onPenawaran);
        cleanupFns.push(() => {
          penawaranCh.unbind("penawaran:new", onPenawaran);
          pc.unsubscribe(`lead-agent-${agentId}`);
        });

        // Real-time: hapus notif pembayaran begitu project creator menandai lunas
        const pembayaranCh = pc.subscribe(`project-investor-${agentId}`);
        const onLunas = (data: { id_project: string }) => {
          setPembayaranItems((prev) =>
            prev.filter((x) => x.id_project !== data.id_project)
          );
          seenPembayaranCountRef.current = Math.max(0, seenPembayaranCountRef.current - 1);
        };
        pembayaranCh.bind("pembayaran:lunas", onLunas);
        cleanupFns.push(() => {
          pembayaranCh.unbind("pembayaran:lunas", onLunas);
          pc.unsubscribe(`project-investor-${agentId}`);
        });
      } catch {
        /* fallback polling jalan */
      }
    })();

    return () => {
      active = false;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
      window.clearInterval(intv);
      cleanupFns.forEach((fn) => fn());
    };
  }, [agentId]);

  // Load notifikasi sistem (agent baru, referral, dll)
  useEffect(() => {
    if (!idPengguna) return;
    let active = true;

    async function loadSysNotifs() {
      try {
        const res = await fetch("/api/notifications", { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        if (!active || !json?.ok) return;

        const list = ((json.items as SysNotif[]) || []).filter((n) => !n.dibaca);
        if (list.length > seenSysCountRef.current && seenSysCountRef.current > 0) {
          setPulse(true);
          window.setTimeout(() => setPulse(false), 2200);
        }
        seenSysCountRef.current = list.length;
        setSysNotifs(list);
      } catch {
        // ignore
      }
    }

    loadSysNotifs();
    const onFocus = () => loadSysNotifs();
    const onVis = () => { if (!document.hidden) loadSysNotifs(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    const intv = window.setInterval(loadSysNotifs, 90_000);

    let cleanupPusher: (() => void) | null = null;
    (async () => {
      try {
        const mod = await import("@/lib/pusher-client");
        const pc = mod.pusherClient;
        const ch = pc.subscribe(`notif-pengguna-${idPengguna}`);
        const onNew = () => loadSysNotifs();
        ch.bind("notif:new", onNew);
        cleanupPusher = () => {
          ch.unbind("notif:new", onNew);
          pc.unsubscribe(`notif-pengguna-${idPengguna}`);
        };
      } catch {
        /* fallback polling jalan */
      }
    })();

    return () => {
      active = false;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
      window.clearInterval(intv);
      if (cleanupPusher) cleanupPusher();
    };
  }, [idPengguna]);

  // Klik notifikasi sistem: tandai dibaca, lalu arahkan ke link tujuan
  const handleSysNotifClick = async (n: SysNotif) => {
    setOpen(false);
    setSysNotifs((prev) => prev.filter((x) => x.id_notifikasi !== n.id_notifikasi));
    seenSysCountRef.current = Math.max(0, seenSysCountRef.current - 1);
    fetch(`/api/notifications/${n.id_notifikasi}`, { method: "PATCH" }).catch(() => {});
    if (!n.link) return;

    // Notifikasi yang menuju Hot Leads (mis. pengajuan co-broke baru) —
    // scroll otomatis ke card lalu highlight item lead-nya
    const idLeadMatch = n.link.match(/id_lead=([^&#]+)/);
    if (idLeadMatch) {
      goToLead(idLeadMatch[1]);
      return;
    }

    router.push(n.link);
  };

  // Acc / tolak booking survei
  const handleSurveiAction = async (id_booking: string, status: "CONFIRMED" | "CANCELLED") => {
    setSurveiActing((prev) => new Set(prev).add(id_booking));
    try {
      const res = await fetch(`/api/survei/booking/${id_booking}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setSurveiItems((prev) => prev.filter((it) => it.id_booking !== id_booking));
        seenSurveiCountRef.current = Math.max(0, seenSurveiCountRef.current - 1);
        // Sinkronkan Hot Leads di dashboard — status booking & lead barusan berubah
        window.dispatchEvent(new CustomEvent("hot-leads:refresh"));
      }
    } catch {
      // ignore
    } finally {
      setSurveiActing((prev) => {
        const next = new Set(prev);
        next.delete(id_booking);
        return next;
      });
    }
  };

  // Hanya item yang masih bisa di-klaim yang dihitung sebagai notif aktif.
  // Item locked tetap visible (untuk closure) tapi tidak menambah counter
  // merah, karena sudah tidak actionable.
  const count =
    items.filter((x) => !x.locked).length +
    surveiItems.length +
    penawaranItems.length +
    pembayaranItems.length +
    sysNotifs.length;

  /** Dismiss notif locked. Kalau persistent (dari API missed_items),
   *  ID-nya disimpan ke localStorage supaya tidak muncul lagi
   *  setelah refresh halaman. */
  const dismissNotif = (id: string) => {
    setItems((prev) => {
      const target = prev.find((x) => x.id_titip === id);
      if (target?.locked?.persistent) {
        const ids = readDismissedIds();
        ids.add(id);
        writeDismissedIds(ids);
      }
      return prev.filter((x) => x.id_titip !== id);
    });
    // Bersihkan timer auto-dismiss kalau ada
    const t = dismissTimersRef.current.get(id);
    if (t) {
      window.clearTimeout(t);
      dismissTimersRef.current.delete(id);
    }
  };

  const goToTitip = (id?: string) => {
    setOpen(false);
    if (pathname === "/dashboard") {
      // already on dashboard — scroll ke card
      const el = document.getElementById("hot-leads-card");
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
      window.dispatchEvent(new CustomEvent("hot-leads:focus"));
    } else {
      router.push("/dashboard#hot-leads-card");
    }
  };

  // Navigasi ke halaman project lalu auto-scroll ke kartu project tertentu
  const goToProject = (idProject: string) => {
    setOpen(false);
    const targetId = `project-card-${idProject}`;
    if (pathname === "/dashboard/project") {
      // Sudah di halaman project — langsung scroll
      const el = document.getElementById(targetId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("ring-2", "ring-amber-400/70");
        window.setTimeout(() => el.classList.remove("ring-2", "ring-amber-400/70"), 2500);
      }
    } else {
      router.push(`/dashboard/project?scrollTo=${idProject}`);
    }
  };

  // Buka Hot Leads lalu auto-scroll + highlight sampai ke item lead tertentu
  const goToLead = (idLead?: string | null) => {
    setOpen(false);
    if (pathname === "/dashboard") {
      const el = document.getElementById("hot-leads-card");
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
      window.setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent("hot-leads:focus-item", { detail: { id_lead: idLead } }),
        );
      }, 350);
    } else {
      sessionStorage.setItem("hot-leads:focus-item", idLead || "");
      router.push("/dashboard#hot-leads-card");
    }
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className={`relative flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full border transition-all ${
          open
            ? "border-emerald-400/40 bg-emerald-500/15"
            : "border-white/10 bg-[#050608] hover:bg-white/5"
        }`}
        title={count > 0 ? `${count} notifikasi baru` : "Notifikasi"}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <Icon
          icon={count > 0 ? "solar:bell-bing-bold-duotone" : "solar:bell-linear"}
          className={`h-4 w-4 ${count > 0 ? "text-emerald-300" : "text-slate-200"}`}
        />
        {count > 0 && (
          <motion.span
            key={count}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 480, damping: 22 }}
            className="absolute -top-1 -right-1 inline-flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-extrabold text-white ring-2 ring-[#050608]"
          >
            {count > 99 ? "99+" : count}
          </motion.span>
        )}
        {/* pulse ring saat ada item baru */}
        <AnimatePresence>
          {pulse && (
            <motion.span
              aria-hidden
              initial={{ opacity: 0.6, scale: 0.8 }}
              animate={{ opacity: 0, scale: 1.8 }}
              transition={{ duration: 1.6, repeat: 1 }}
              exit={{ opacity: 0 }}
              className="pointer-events-none absolute inset-0 rounded-full border-2 border-emerald-400/70"
            />
          )}
        </AnimatePresence>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 460, damping: 30 }}
            className="fixed left-3 right-3 top-[61px] sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-[380px] max-h-[80dvh] sm:max-h-[480px] flex flex-col rounded-2xl border border-white/10 bg-[#0A0D14] shadow-[0_24px_70px_rgba(0,0,0,0.7),0_0_0_1px_rgba(255,255,255,0.04)] overflow-hidden z-50"
          >
            <div className="h-px bg-gradient-to-r from-transparent via-emerald-400/45 to-transparent" />

            <div className="px-4 py-3 flex items-center justify-between border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <Icon
                  icon="solar:bell-bing-bold-duotone"
                  className="text-emerald-300 text-lg"
                />
                <span className="text-[13px] font-bold text-white">
                  Notifikasi
                </span>
                {count > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-rose-500/20 border border-rose-400/40 px-1 text-[10px] font-extrabold text-rose-200">
                    {count}
                  </span>
                )}
              </div>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-[0.18em] uppercase text-emerald-300/70">
                <span className="relative inline-flex h-1.5 w-1.5">
                  <span className="absolute inset-0 rounded-full bg-emerald-400/60 animate-ping" />
                  <span className="absolute inset-0 rounded-full bg-emerald-400" />
                </span>
                Live
              </span>
            </div>

            <div className="flex-1 overflow-y-auto">
              {items.length === 0 && surveiItems.length === 0 && penawaranItems.length === 0 && pembayaranItems.length === 0 && sysNotifs.length === 0 ? (
                <div className="px-6 py-10 text-center">
                  <div className="mx-auto h-12 w-12 rounded-2xl border border-white/10 bg-white/[0.025] flex items-center justify-center">
                    <Icon
                      icon="solar:inbox-bold-duotone"
                      className="text-white/30 text-2xl"
                    />
                  </div>
                  <p className="mt-3 text-[12.5px] font-semibold text-white/70">
                    Tidak ada notifikasi
                  </p>
                  <p className="mt-1 text-[11px] text-white/35">
                    Notifikasi titip jual, survei lokasi & penawaran baru akan muncul di sini.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-white/[0.05]">
                  <AnimatePresence initial={false}>
                    {sysNotifs.map((it) => (
                      <SysNotifRow
                        key={it.id_notifikasi}
                        item={it}
                        onClick={() => handleSysNotifClick(it)}
                      />
                    ))}
                    {pembayaranItems.map((it) => (
                      <PembayaranRow
                        key={it.id_project}
                        item={it}
                        onClick={() => goToProject(it.id_project)}
                      />
                    ))}
                    {surveiItems.map((it) => (
                      <SurveiRow
                        key={it.id_booking}
                        item={it}
                        acting={surveiActing.has(it.id_booking)}
                        onClick={() => goToLead(it.id_lead)}
                        onAcc={() => handleSurveiAction(it.id_booking, "CONFIRMED")}
                        onTolak={() => handleSurveiAction(it.id_booking, "CANCELLED")}
                      />
                    ))}
                    {penawaranItems.map((it) => (
                      <OfferRow
                        key={it.id_lead}
                        item={it}
                        onClick={() => goToLead(it.id_lead)}
                      />
                    ))}
                    {items.map((it) => (
                      <NotifRow
                        key={it.id_titip}
                        item={it}
                        onClick={() => goToTitip(it.id_titip)}
                        onDismiss={dismissNotif}
                      />
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </div>

            {surveiItems.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  router.push("/dashboard/survei");
                }}
                className="border-t border-white/[0.06] px-4 py-2.5 text-[11.5px] font-bold text-amber-300 hover:bg-amber-500/[0.06] flex items-center justify-center gap-1.5 transition-colors"
              >
                Buka Jadwal Survei
                <Icon icon="solar:arrow-right-bold" className="text-sm" />
              </button>
            )}

            {pembayaranItems.length > 0 && (
              <button
                type="button"
                onClick={() => { setOpen(false); router.push("/dashboard/project"); }}
                className="border-t border-white/[0.06] px-4 py-2.5 text-[11.5px] font-bold text-violet-300 hover:bg-violet-500/[0.06] flex items-center justify-center gap-1.5 transition-colors"
              >
                Lihat Semua Project
                <Icon icon="solar:arrow-right-bold" className="text-sm" />
              </button>
            )}

            {items.length > 0 && (
              <button
                type="button"
                onClick={() => goToTitip()}
                className="border-t border-white/[0.06] px-4 py-2.5 text-[11.5px] font-bold text-emerald-300 hover:bg-emerald-500/[0.06] flex items-center justify-center gap-1.5 transition-colors"
              >
                Buka Hot Leads
                <Icon icon="solar:arrow-right-bold" className="text-sm" />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NotifRow({
  item,
  onClick,
  onDismiss,
}: {
  item: NotifItem;
  onClick: () => void;
  onDismiss: (id: string) => void;
}) {
  const meta = JENIS_META[item.jenis_properti] || JENIS_META.RUMAH;
  const cd = countdownText(item.kedaluwarsa_pada);
  const urgent = cd.hoursLeft < 6;
  const lokasi = item.kecamatan || item.kota || item.provinsi || "area kamu";
  const locked = !!item.locked;

  const headline = locked
    ? "Lead ini telah diterima agent lain"
    : urgent
      ? "Klaim sebelum hangus!"
      : "Hey, ada yang titip jual nih";
  const subline = locked
    ? `Diambil oleh ${item.locked!.by_nama} · ${formatDateTimeID(item.locked!.at)}`
    : `${meta.label} di ${lokasi}`;

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 12, height: 0, marginTop: 0, marginBottom: 0 }}
      transition={{ duration: 0.25 }}
      className="relative"
    >
      {/* Dismiss X (hanya untuk locked) — di-render terpisah dari button utama
          supaya tidak jadi nested-button (invalid HTML). */}
      {locked && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDismiss(item.id_titip);
          }}
          aria-label="Tutup notifikasi"
          className="absolute top-2.5 right-2.5 z-10 h-6 w-6 rounded-md border border-white/[0.07] bg-white/[0.025] text-white/35 hover:text-white/80 hover:border-white/15 hover:bg-white/[0.08] flex items-center justify-center transition"
        >
          <Icon icon="solar:close-circle-bold" className="text-[12px]" />
        </button>
      )}

      <button
        type="button"
        onClick={locked ? undefined : onClick}
        disabled={locked}
        className={`group relative w-full text-left px-4 py-3 flex items-start gap-3 transition-colors ${
          locked
            ? "cursor-default opacity-65"
            : "hover:bg-emerald-500/[0.05]"
        }`}
      >
        {/* left accent — urgent (rose) atau locked (slate) */}
        {(urgent || locked) && (
          <span
            aria-hidden
            className={`absolute inset-y-2 left-0 w-[2px] rounded-full ${
              locked
                ? "bg-white/15"
                : "bg-gradient-to-b from-rose-400 to-amber-400 shadow-[0_0_8px_rgba(244,63,94,0.5)]"
            }`}
          />
        )}

        {/* Icon */}
        <div className="relative shrink-0">
          <div
            className={`absolute inset-0 rounded-xl blur-[6px] ${
              locked
                ? "bg-white/[0.04]"
                : urgent
                  ? "bg-gradient-to-br from-rose-400/30 to-amber-500/10"
                  : "bg-gradient-to-br from-emerald-400/25 to-teal-500/10"
            }`}
          />
          <div
            className={`relative h-10 w-10 rounded-xl border flex items-center justify-center ${
              locked
                ? "border-white/10 bg-white/[0.03]"
                : urgent
                  ? "border-rose-400/35 bg-rose-500/[0.08]"
                  : "border-emerald-400/30 bg-emerald-500/[0.08]"
            }`}
          >
            <Icon
              icon={
                locked
                  ? "solar:check-circle-bold-duotone"
                  : urgent
                    ? "solar:fire-bold-duotone"
                    : "solar:home-add-bold-duotone"
              }
              className={`text-xl ${
                locked
                  ? "text-white/40"
                  : urgent
                    ? "text-rose-300"
                    : "text-emerald-300"
              }`}
            />
          </div>
        </div>

        {/* Message */}
        <div className={`min-w-0 flex-1 ${locked ? "pr-7" : ""}`}>
          <p
            className={`text-[13px] font-bold leading-tight truncate ${
              locked
                ? "text-white/65"
                : urgent
                  ? "text-rose-100"
                  : "text-white"
            }`}
          >
            {headline}
          </p>
          <p
            className={`mt-0.5 text-[11.5px] truncate ${
              locked ? "text-white/45" : "text-white/55"
            }`}
          >
            {subline}
          </p>
          {locked && (
            <p className="mt-1 inline-flex items-center gap-1 text-[10.5px] italic text-emerald-300/65 leading-snug">
              <Icon
                icon="solar:hand-stars-bold-duotone"
                className="text-[12px] shrink-0"
              />
              Tetap semangat — lead berikutnya bisa milik Anda.
            </p>
          )}
        </div>

        {/* Right side: state-dependent */}
        <div className="flex shrink-0 flex-col items-end gap-1">
          {locked ? null : (
            <>
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-[2px] text-[9.5px] font-extrabold uppercase tracking-wider tabular-nums ${
                  urgent
                    ? "border-rose-400/40 bg-rose-500/15 text-rose-200"
                    : "border-white/10 bg-white/[0.03] text-white/55"
                }`}
              >
                <Icon icon="solar:clock-circle-bold-duotone" className="text-[11px]" />
                {cd.text}
              </span>
              <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-emerald-300 opacity-70 transition-opacity group-hover:opacity-100">
                Lihat
                <Icon
                  icon="solar:arrow-right-linear"
                  className="text-[12px] transition-transform group-hover:translate-x-0.5"
                />
              </span>
            </>
          )}
        </div>
      </button>
    </motion.li>
  );
}

function SurveiRow({
  item,
  acting,
  onClick,
  onAcc,
  onTolak,
}: {
  item: SurveiItem;
  acting: boolean;
  onClick: () => void;
  onAcc: () => void;
  onTolak: () => void;
}) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 12, height: 0, marginTop: 0, marginBottom: 0 }}
      transition={{ duration: 0.25 }}
      className="relative px-4 py-3"
    >
      {/* left accent */}
      <span
        aria-hidden
        className="absolute inset-y-2 left-0 w-[2px] rounded-full bg-gradient-to-b from-amber-300 to-orange-500 shadow-[0_0_8px_rgba(251,191,36,0.5)]"
      />

      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="relative shrink-0">
          <div className="absolute inset-0 rounded-xl blur-[6px] bg-gradient-to-br from-amber-400/30 to-orange-500/15 animate-pulse" />
          <div className="relative h-10 w-10 rounded-xl border border-amber-400/35 bg-amber-500/[0.08] flex items-center justify-center">
            <Icon icon="solar:map-point-wave-bold-duotone" className="text-xl text-amber-300" />
          </div>
        </div>

        {/* Message */}
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={onClick}
            className="block w-full text-left"
          >
            <p className="text-[13px] font-bold leading-tight text-amber-100 flex items-center gap-1">
              <Icon icon="solar:fire-bold-duotone" className="text-amber-300 text-[14px]" />
              Ada yang mau survei lokasi nih!
            </p>
            <p className="mt-0.5 text-[11.5px] font-semibold text-white truncate">
              {item.nama_klien} · {item.nomor_telepon}
            </p>
            <p className="mt-0.5 text-[11.5px] text-white/55 truncate">
              {item.judul}
            </p>
            <p className="mt-1 inline-flex items-center gap-1 text-[10.5px] font-bold text-amber-300/80">
              <Icon icon="solar:calendar-bold-duotone" className="text-[12px]" />
              {formatSurveiDate(item.tanggal_survei)}
            </p>
            {item.catatan && (
              <p className="mt-1 text-[10.5px] italic text-white/40 truncate">
                "{item.catatan}"
              </p>
            )}
          </button>

          {/* Actions */}
          <div className="mt-2.5 flex items-center gap-2">
            <button
              type="button"
              disabled={acting}
              onClick={onAcc}
              className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg border border-emerald-400/30 bg-emerald-500/15 px-3 py-1.5 text-[11px] font-extrabold text-emerald-200 transition hover:bg-emerald-500/25 disabled:opacity-50"
            >
              <Icon icon="solar:check-circle-bold" className="text-[13px]" />
              Terima
            </button>
            <button
              type="button"
              disabled={acting}
              onClick={onTolak}
              className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] font-extrabold text-white/55 transition hover:bg-white/[0.08] hover:text-white/80 disabled:opacity-50"
            >
              <Icon icon="solar:close-circle-bold" className="text-[13px]" />
              Tolak
            </button>
          </div>
        </div>
      </div>
    </motion.li>
  );
}

function OfferRow({ item, onClick }: { item: PenawaranItem; onClick: () => void }) {
  const diffPct =
    item.offer_amount && item.harga_listing
      ? Math.round(((item.harga_listing - item.offer_amount) / item.harga_listing) * 100)
      : null;

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 12, height: 0, marginTop: 0, marginBottom: 0 }}
      transition={{ duration: 0.25 }}
      className="relative"
    >
      <span
        aria-hidden
        className="absolute inset-y-2 left-0 w-[2px] rounded-full bg-gradient-to-b from-emerald-300 to-teal-500 shadow-[0_0_8px_rgba(52,211,153,0.5)]"
      />
      <button type="button" onClick={onClick} className="group w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-emerald-500/[0.05] transition-colors">
        <div className="relative shrink-0">
          <div className="absolute inset-0 rounded-xl blur-[6px] bg-gradient-to-br from-emerald-400/30 to-teal-500/15 animate-pulse" />
          <div className="relative h-10 w-10 rounded-xl border border-emerald-400/35 bg-emerald-500/[0.08] flex items-center justify-center">
            <Icon icon="solar:tag-price-bold-duotone" className="text-xl text-emerald-300" />
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold leading-tight text-emerald-100 flex items-center gap-1">
            <Icon icon="solar:hand-money-bold-duotone" className="text-emerald-300 text-[14px]" />
            Ada penawaran harga baru!
          </p>
          <p className="mt-0.5 text-[11.5px] font-semibold text-white truncate flex items-center gap-1.5">
            {item.client_name || "Klien"}
            {item.verified && (
              <Icon icon="solar:verified-check-bold" className="text-emerald-400 text-[13px]" title="Akun terverifikasi" />
            )}
          </p>
          <p className="mt-0.5 text-[11.5px] text-white/55 truncate">{item.judul}</p>
          {item.offer_amount != null && (
            <p className="mt-1 inline-flex items-center gap-1 text-[10.5px] font-bold text-emerald-300/80">
              <Icon icon="solar:wallet-money-bold-duotone" className="text-[12px]" />
              {formatRupiah(item.offer_amount)}
              {diffPct !== null && diffPct !== 0 && (
                <span className="text-white/35 font-medium">
                  ({diffPct > 0 ? `${diffPct}% di bawah listing` : `${Math.abs(diffPct)}% di atas listing`})
                </span>
              )}
            </p>
          )}
          {item.notes && (
            <p className="mt-1 text-[10.5px] italic text-white/40 truncate">"{item.notes}"</p>
          )}
        </div>

        <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-emerald-300 opacity-70 transition-opacity group-hover:opacity-100 shrink-0">
          Lihat
          <Icon icon="solar:arrow-right-linear" className="text-[12px] transition-transform group-hover:translate-x-0.5" />
        </span>
      </button>
    </motion.li>
  );
}

function formatRelativeTimeID(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "Baru saja";
  if (min < 60) return `${min} menit lalu`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} jam lalu`;
  const day = Math.floor(hour / 24);
  return `${day} hari lalu`;
}

function SysNotifRow({ item, onClick }: { item: SysNotif; onClick: () => void }) {
  const isReferral = item.tipe === "AGENT_REFERRAL";

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 12, height: 0, marginTop: 0, marginBottom: 0 }}
      transition={{ duration: 0.25 }}
      className="relative"
    >
      <span
        aria-hidden
        className="absolute inset-y-2 left-0 w-[2px] rounded-full bg-gradient-to-b from-sky-300 to-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]"
      />
      <button
        type="button"
        onClick={onClick}
        className="group w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-sky-500/[0.05] transition-colors"
      >
        <div className="relative shrink-0">
          <div className="absolute inset-0 rounded-xl blur-[6px] bg-gradient-to-br from-sky-400/30 to-indigo-500/15 animate-pulse" />
          <div className="relative h-10 w-10 rounded-xl border border-sky-400/35 bg-sky-500/[0.08] flex items-center justify-center">
            <Icon
              icon={isReferral ? "solar:gift-bold-duotone" : "solar:user-plus-bold-duotone"}
              className="text-xl text-sky-300"
            />
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold leading-tight text-sky-100">{item.judul}</p>
          <p className="mt-0.5 text-[11.5px] text-white/55 truncate">{item.pesan}</p>
          <p className="mt-1 inline-flex items-center gap-1 text-[10.5px] font-bold text-sky-300/70">
            <Icon icon="solar:clock-circle-bold-duotone" className="text-[12px]" />
            {formatRelativeTimeID(item.dibuat_pada)}
          </p>
        </div>

        <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-sky-300 opacity-70 transition-opacity group-hover:opacity-100 shrink-0">
          Lihat
          <Icon icon="solar:arrow-right-linear" className="text-[12px] transition-transform group-hover:translate-x-0.5" />
        </span>
      </button>
    </motion.li>
  );
}

function formatRupiahCompact(n: number): string {
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} M`;
  if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 0 })} Jt`;
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
}

function PembayaranRow({ item, onClick }: { item: PembayaranItem; onClick: () => void }) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 12, height: 0, marginTop: 0, marginBottom: 0 }}
      transition={{ duration: 0.25 }}
      className="relative"
    >
      <span
        aria-hidden
        className="absolute inset-y-2 left-0 w-[2px] rounded-full bg-gradient-to-b from-violet-400 to-purple-600 shadow-[0_0_8px_rgba(167,139,250,0.5)]"
      />
      <button
        type="button"
        onClick={onClick}
        className="group w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-violet-500/[0.05] transition-colors"
      >
        <div className="relative shrink-0">
          <div className="absolute inset-0 rounded-xl blur-[6px] bg-gradient-to-br from-violet-400/30 to-purple-600/15 animate-pulse" />
          <div className="relative h-10 w-10 rounded-xl border border-violet-400/35 bg-violet-500/[0.08] flex items-center justify-center">
            <Icon icon="solar:wallet-money-bold-duotone" className="text-xl text-violet-300" />
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold leading-tight text-violet-100 flex items-center gap-1.5">
            <Icon icon="solar:clock-circle-bold-duotone" className="text-violet-300 text-[14px] shrink-0" />
            Pembayaran Menunggu
          </p>
          <p className="mt-0.5 text-[11.5px] font-semibold text-white truncate">{item.nama_project}</p>
          <p className="mt-0.5 text-[11px] text-white/50 truncate flex items-center gap-1">
            <Icon icon="solar:map-point-linear" className="h-3 w-3 shrink-0" />
            {item.lokasi}
          </p>
          <p className="mt-1 inline-flex items-center gap-1 text-[10.5px] font-bold text-violet-300/80">
            <Icon icon="solar:banknote-bold-duotone" className="text-[12px]" />
            Komitmen: {formatRupiahCompact(item.nominal_komitmen)}
          </p>
        </div>

        <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-violet-300 opacity-70 transition-opacity group-hover:opacity-100 shrink-0 pt-0.5">
          Bayar
          <Icon icon="solar:arrow-right-linear" className="text-[12px] transition-transform group-hover:translate-x-0.5" />
        </span>
      </button>
    </motion.li>
  );
}
