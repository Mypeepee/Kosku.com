"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Icon } from "@iconify/react";
import Image from "next/image";
import Link from "next/link";
import { useSession } from "next-auth/react";
import Signin from "@/components/Auth/SignIn";
import SignUp from "@/components/Auth/SignUp";
import { trackLeadClick } from "@/lib/leadTracking";
import { getOfferFeedback } from "@/lib/offerFeedback";
import { PAYMENT_METHODS, PaymentMethod } from "@/lib/paymentMethods";
import { pusherClient } from "@/lib/pusher-client";
import CobrokeModal, { CobrokeClaimSummary } from "@/components/PropertyDetail/CobrokeModal";
import { downloadPropertyImages } from "@/lib/downloadPropertyImages";
import { buildJualPosterData, downloadJualPoster } from "@/lib/jualPoster";
import { SITE_URL } from "@/lib/site";

// ─────────────────────────────────────────────────────────────────────────────
// PENAWARAN — status penawaran milik user untuk properti ini
// ─────────────────────────────────────────────────────────────────────────────
interface ExistingOffer {
  id_lead: string;
  penawaran: number | null;
  diskon?: number | null;
  pembayaran?: PaymentMethod | null;
  catatan?: string | null;
  status_penawaran: "pending" | "diterima" | "ditolak";
  catatan_agent?: string | null;
  tanggal_keputusan?: string | null;
  created_at?: string;
}

interface DecisionPayload {
  id_lead: string;
  id_property: string;
  status_penawaran: "diterima" | "ditolak";
  catatan_agent: string | null;
  penawaran: number | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// SURVEY MODAL — 4-step smart booking (premium animated)
// ─────────────────────────────────────────────────────────────────────────────
interface SlotInfo { label: string; hour: number; blocked: boolean }

interface SurveyModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentName: string;
  propertyTitle: string;
  agentPhone: string;
  idProperty: string | number;
  idAgent: string;
}

function fmtPhoneDigits(d: string) {
  const s = d.replace(/\D/g, "").slice(0, 12);
  if (s.length <= 4)  return s;
  if (s.length <= 8)  return `${s.slice(0,4)}-${s.slice(4)}`;
  return `${s.slice(0,4)}-${s.slice(4,8)}-${s.slice(8)}`;
}

function SurveyModal({ isOpen, onClose, agentName, propertyTitle, agentPhone, idProperty, idAgent }: SurveyModalProps) {
  const { data: session } = useSession();

  const [step,         setStep]         = useState<1|2|3|4>(1);
  const [selectedDate, setSelectedDate] = useState<Date|null>(null);
  const [selectedTime, setSelectedTime] = useState<string|null>(null);
  const [currentMonth, setCurrentMonth] = useState<Date>(() => { const d=new Date(); d.setDate(1); return d; });
  const [slots,        setSlots]        = useState<SlotInfo[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [namaKlien,    setNamaKlien]    = useState("");
  const [phoneDigits,  setPhoneDigits]  = useState(""); // digits after +62, no dashes
  const [catatan,      setCatatan]      = useState("");
  const [formError,    setFormError]    = useState("");
  const [submitting,   setSubmitting]   = useState(false);
  const [submitError,  setSubmitError]  = useState("");
  // Two-phase animation: mounted keeps DOM alive during exit
  const [mounted,      setMounted]      = useState(false);
  const [visible,      setVisible]      = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStep(1); setSelectedDate(null); setSelectedTime(null);
      setSlots([]); setCatatan("Saya siap hadir sesuai jadwal. Mohon konfirmasi ketersediaan terlebih dahulu. Terima kasih.");
      setFormError(""); setSubmitError("");
      const d = new Date(); d.setDate(1); setCurrentMonth(d);
      setMounted(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));

      // Prefill dari session jika sudah login
      if (session?.user) {
        setNamaKlien(session.user.name || "");
        fetch("/api/profile")
          .then(r => r.ok ? r.json() : null)
          .then(data => {
            const raw: string = data?.pengguna?.nomor_telepon || "";
            let digits = raw.replace(/\D/g, "");
            if (digits.startsWith("62")) digits = digits.slice(2);
            if (digits.startsWith("0"))  digits = digits.slice(1);
            setPhoneDigits(digits.slice(0, 12));
          })
          .catch(() => {});
      } else {
        setNamaKlien("");
        setPhoneDigits("");
      }
    } else {
      setVisible(false);
      const t = setTimeout(() => setMounted(false), 420);
      return () => clearTimeout(t);
    }
  }, [isOpen, session]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  const handleClose = useCallback(() => {
    setVisible(false);
    setTimeout(onClose, 420);
  }, [onClose]);

  // Phone helpers
  const handlePhoneInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.replace(/[-\s]/g, "").replace(/\D/g, "");
    if (v.startsWith("62")) v = v.slice(2);
    if (v.startsWith("0"))  v = v.slice(1);
    setPhoneDigits(v.slice(0, 12));
    setFormError("");
  };
  const fullPhone = `+62${phoneDigits}`;

  // Fetch availability
  const goToStep2 = useCallback(async (date: Date) => {
    setSelectedDate(date); setSelectedTime(null); setStep(2); setSlotsLoading(true);
    const yyyy = date.getFullYear();
    const mm   = String(date.getMonth()+1).padStart(2,"0");
    const dd   = String(date.getDate()).padStart(2,"0");
    try {
      const res  = await fetch(`/api/survei/availability?agentId=${idAgent}&date=${yyyy}-${mm}-${dd}`);
      const json = await res.json();
      setSlots(json.blockedSlots ?? []);
    } catch { setSlots([]); }
    finally   { setSlotsLoading(false); }
  }, [idAgent]);

  const today       = new Date(); today.setHours(0,0,0,0);
  const yr          = currentMonth.getFullYear();
  const mo          = currentMonth.getMonth();
  const firstDay    = new Date(yr, mo, 1).getDay();
  const daysInMonth = new Date(yr, mo+1, 0).getDate();
  const atMin       = yr===today.getFullYear() && mo===today.getMonth();

  const MONTHS = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
  const DAYS   = ["Min","Sen","Sel","Rab","Kam","Jum","Sab"];

  const isPast     = (d: number) => { const dt=new Date(yr,mo,d); dt.setHours(0,0,0,0); return dt<today; };
  const isSelected = (d: number) => !!selectedDate && selectedDate.getDate()===d && selectedDate.getMonth()===mo && selectedDate.getFullYear()===yr;
  const isToday    = (d: number) => { const dt=new Date(yr,mo,d); dt.setHours(0,0,0,0); return dt.getTime()===today.getTime(); };
  const navMonth   = (dir: -1|1) => { if(dir===-1&&atMin) return; setCurrentMonth(new Date(yr,mo+dir,1)); };
  const fmtDate    = () => selectedDate?.toLocaleDateString("id-ID",{weekday:"long",day:"numeric",month:"long",year:"numeric"}) ?? "";
  const goBack     = () => setStep(s => (s>1 ? (s-1) as 1|2|3|4 : s));

  const validateBiodata = () => {
    if (!namaKlien.trim()) { setFormError("Nama lengkap wajib diisi"); return false; }
    if (phoneDigits.length < 7) { setFormError("Nomor telepon tidak valid"); return false; }
    setFormError(""); return true;
  };

  const handleBook = async () => {
    if (!selectedDate || !selectedTime) return;
    setSubmitting(true); setSubmitError("");
    const [hh] = selectedTime.split(":").map(Number);
    const surveiUTC = new Date(Date.UTC(
      selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(),
      hh - 7, 0, 0, 0,
    ));
    // Buat/lengkapi lead dulu supaya bisa di-link ke booking survei
    const leadRes = await trackLeadClick({
      id_property: idProperty, id_agent: idAgent, source: "survei",
      client_name: namaKlien.trim(), client_phone: fullPhone,
    });

    try {
      const res = await fetch("/api/survei/booking", {
        method: "POST", headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ id_property:idProperty, id_agent:idAgent, nama_klien:namaKlien.trim(), nomor_telepon:fullPhone, tanggal_survei:surveiUTC.toISOString(), catatan:catatan.trim()||undefined, id_lead:leadRes.id_lead }),
      });
      if (!res.ok) { const err=await res.json(); setSubmitError(err.error||"Gagal menyimpan."); setSubmitting(false); return; }
    } catch { setSubmitError("Koneksi gagal."); setSubmitting(false); return; }

    const wa  = agentPhone.replace(/^0/,"62").replace(/\D/g,"");
    const msg = `Halo ${agentName}, saya ingin menjadwalkan *Survei Lokasi* untuk properti:\n*${propertyTitle}*\n\n📅 Tanggal: ${fmtDate()}\n🕐 Waktu: ${selectedTime} WIB\n👤 Nama: ${namaKlien}\n📱 No. Telp: ${fullPhone}${catatan.trim()?`\n📝 Catatan: ${catatan.trim()}`:""}\n\nMohon konfirmasi jadwalnya. Terima kasih!`;
    window.open(`https://wa.me/${wa}?text=${encodeURIComponent(msg)}`, "_blank");
    setSubmitting(false);
    handleClose();
  };

  if (!mounted) return null;

  const TOTAL = 4;
  const TITLES = ["Pilih Tanggal","Pilih Waktu","Data Diri","Konfirmasi"];
  const subtitles: Record<number,string> = {
    1: propertyTitle,
    2: fmtDate(),
    3: `${fmtDate()} · ${selectedTime} WIB`,
    4: `${fmtDate()} · ${selectedTime} WIB`,
  };

  // Shared bottom-row: [Kembali] + [CTA]
  const BottomRow = ({ onNext, nextLabel, nextDisabled = false }: { onNext:()=>void; nextLabel:string; nextDisabled?:boolean }) => (
    <div className="flex gap-2 pt-2">
      <button onClick={goBack}
        className="flex-1 py-3.5 rounded-2xl font-bold text-sm transition-all duration-200 flex items-center justify-center gap-1.5 text-white/40 hover:text-white/80"
        style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.07)" }}>
        <Icon icon="solar:alt-arrow-left-bold" className="text-[11px]"/>
        Kembali
      </button>
      <button onClick={onNext} disabled={nextDisabled}
        className="flex-[2.2] py-3.5 rounded-2xl font-extrabold text-sm transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-20 disabled:cursor-not-allowed active:scale-[0.98]"
        style={!nextDisabled ? { background:"#ffffff", color:"#000000" } : { background:"rgba(255,255,255,0.06)", color:"rgba(255,255,255,0.2)" }}>
        {nextLabel}
        <Icon icon="solar:alt-arrow-right-bold" className="text-[11px]"/>
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center sm:px-4">
      {/* Backdrop */}
      <div onClick={handleClose} className="absolute inset-0 bg-black/75 backdrop-blur-[8px]"
        style={{ opacity:visible?1:0, transition:"opacity 0.35s ease" }} />

      {/* Panel */}
      <div className="relative w-full sm:max-w-[440px] sm:mx-auto rounded-t-[2.25rem] sm:rounded-[2rem] overflow-hidden max-h-[92dvh] sm:max-h-[85vh] flex flex-col"
        style={{
          background: "linear-gradient(160deg,#141417 0%,#0d0d10 100%)",
          boxShadow: "0 -32px 80px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.055), inset 0 1px 0 rgba(255,255,255,0.045)",
          transform: visible ? "translateY(0) scale(1)" : "translateY(48px) scale(0.96)",
          opacity:   visible ? 1 : 0,
          transition: visible
            ? "transform 0.45s cubic-bezier(0.22,1.2,0.36,1), opacity 0.3s ease"
            : "transform 0.32s cubic-bezier(0.55,0,1,0.45), opacity 0.25s ease",
        }}>

        {/* Pull bar */}
        <div className="sm:hidden flex justify-center pt-3 pb-0.5">
          <div className="w-9 h-[3px] rounded-full bg-white/10"/>
        </div>

        {/* ── HEADER ── */}
        <div className="px-5 pt-4 pb-4">
          {/* Step pills */}
          <div className="flex items-center gap-1.5 mb-3.5">
            {Array.from({length:TOTAL}).map((_,i) => (
              <div key={i} className="h-[3px] rounded-full"
                style={{
                  width: step===i+1 ? 28 : 16,
                  background: step===i+1 ? "#86efac" : step>i+1 ? "rgba(134,239,172,0.35)" : "rgba(255,255,255,0.1)",
                  transition: "all 0.4s cubic-bezier(0.22,1.2,0.36,1)",
                }}/>
            ))}
            <span className="ml-auto text-[10px] font-bold text-white/20 tabular-nums">{step}/{TOTAL}</span>
          </div>

          {/* Title + close */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-[1.2rem] font-extrabold text-white leading-tight tracking-tight">{TITLES[step-1]}</h2>
              <p className="text-[11px] text-white/30 mt-0.5 truncate font-medium capitalize">{subtitles[step]}</p>
            </div>
            <button onClick={handleClose}
              className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 mt-0.5 hover:bg-white/10"
              style={{ background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.07)" }}>
              <Icon icon="solar:close-circle-bold" className="text-white/35 text-[15px]"/>
            </button>
          </div>
        </div>

        <div className="h-px shrink-0" style={{ background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.06),transparent)" }}/>

        {/* ── SCROLLABLE CONTENT ── */}
        <div className="flex-1 overflow-y-auto min-h-0">

        {/* ── STEP 1: CALENDAR ── */}
        {step===1 && (
          <div className="px-5 py-4">
            <div className="flex items-center justify-between mb-4">
              <button onClick={()=>navMonth(-1)} disabled={atMin}
                className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:bg-white/10 disabled:opacity-20"
                style={{ background:"rgba(255,255,255,0.05)" }}>
                <Icon icon="solar:alt-arrow-left-bold" className="text-white/60 text-sm"/>
              </button>
              <span className="text-sm font-extrabold text-white tracking-wide">{MONTHS[mo]} {yr}</span>
              <button onClick={()=>navMonth(1)}
                className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:bg-white/10"
                style={{ background:"rgba(255,255,255,0.05)" }}>
                <Icon icon="solar:alt-arrow-right-bold" className="text-white/60 text-sm"/>
              </button>
            </div>

            <div className="grid grid-cols-7 mb-1">
              {DAYS.map(d => <div key={d} className="text-center text-[9px] font-black uppercase tracking-widest text-white/15 py-1">{d}</div>)}
            </div>

            <div className="grid grid-cols-7 gap-0.5">
              {Array.from({length:firstDay}).map((_,i)=><div key={`e${i}`}/>)}
              {Array.from({length:daysInMonth}).map((_,i) => {
                const d=i+1, past=isPast(d), sel=isSelected(d), tod=isToday(d);
                return (
                  <button key={d} onClick={()=>!past&&goToStep2(new Date(yr,mo,d))} disabled={past}
                    className={`relative h-9 rounded-xl text-sm font-bold transition-all duration-150 ${
                      sel  ?"bg-[#86efac] text-black shadow-[0_0_18px_rgba(134,239,172,0.35)]"
                      :past?"cursor-not-allowed"
                      :tod ?"text-[#86efac] ring-1 ring-[#86efac]/35 hover:bg-[#86efac]/10"
                            :"hover:text-white hover:bg-white/[0.07]"}`}
                    style={sel?{}:past?{color:"rgba(255,255,255,0.15)"}:tod?{}:{color:"rgba(255,255,255,0.7)"}}>
                    {d}
                    {tod&&!sel&&<span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#86efac]"/>}
                  </button>
                );
              })}
            </div>
            <p className="text-center text-[10px] text-white/15 mt-3.5 font-medium">Ketuk tanggal untuk lanjut pilih waktu</p>
          </div>
        )}

        {/* ── STEP 2: TIME SLOTS ── */}
        {step===2 && (
          <div className="px-5 py-4">
            <div className="flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5 mb-4"
              style={{ background:"rgba(134,239,172,0.06)", border:"1px solid rgba(134,239,172,0.12)" }}>
              <Icon icon="solar:calendar-date-bold" className="text-[#86efac] text-sm shrink-0"/>
              <p className="text-[#86efac] font-bold text-[13px] capitalize truncate">{fmtDate()}</p>
            </div>

            <p className="text-[9px] font-black text-white/20 uppercase tracking-widest mb-2.5">
              {slotsLoading ? "Memuat jadwal agent..." : "Pilih Slot Waktu"}
            </p>

            <div className="grid grid-cols-3 gap-2">
              {slotsLoading
                ? Array.from({length:9}).map((_,i) => (
                    <div key={i} className="h-[52px] rounded-xl animate-pulse" style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.05)"}}/>
                  ))
                : (() => {
                  const nowHourWIB = (new Date().getUTCHours() + 7) % 24;
                  const isToday2 = !!selectedDate &&
                    selectedDate.getFullYear() === today.getFullYear() &&
                    selectedDate.getMonth()    === today.getMonth()    &&
                    selectedDate.getDate()     === today.getDate();
                  return slots.map(slot => {
                    const sel     = selectedTime === slot.label;
                    const isPast  = isToday2 && slot.hour <= nowHourWIB;
                    const blocked = slot.blocked || isPast;
                    return (
                      <button key={slot.label} onClick={()=>!blocked&&setSelectedTime(slot.label)} disabled={blocked}
                        className={`relative overflow-hidden flex flex-col items-center justify-center gap-0.5 py-3 rounded-xl text-[13px] font-extrabold transition-all duration-150 ${
                          sel     ? "bg-[#86efac] text-black scale-[1.04] shadow-[0_0_22px_rgba(134,239,172,0.3)]"
                          : blocked ? "cursor-not-allowed"
                                    : "hover:bg-white/[0.08] hover:text-white"}`}
                        style={sel ? {} : blocked
                          ? isPast
                            ? { background:"rgba(234,179,8,0.05)", border:"1px solid rgba(234,179,8,0.12)", color:"rgba(255,255,255,0.22)" }
                            : { background:"rgba(239,68,68,0.05)",  border:"1px solid rgba(239,68,68,0.14)",  color:"rgba(255,255,255,0.22)" }
                          : { background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", color:"rgba(255,255,255,0.6)" }}>

                        {/* diagonal stripe overlay for blocked */}
                        {blocked && (
                          <span className="absolute inset-0 rounded-xl pointer-events-none" style={{
                            backgroundImage: "repeating-linear-gradient(-45deg, transparent, transparent 5px, rgba(255,255,255,0.018) 5px, rgba(255,255,255,0.018) 6px)"
                          }} />
                        )}

                        <span className="relative leading-none">{slot.label}</span>

                        {blocked && (
                          <span className="relative flex items-center gap-0.5" style={{
                            fontSize: 7, fontWeight: 800, letterSpacing: "0.13em", textTransform: "uppercase",
                            color: isPast ? "rgba(234,179,8,0.55)" : "rgba(239,68,68,0.55)",
                          }}>
                            <Icon icon={isPast ? "solar:clock-circle-bold" : "solar:lock-bold"} style={{ fontSize: 8 }} />
                            {isPast ? "Lewat" : "Penuh"}
                          </span>
                        )}
                      </button>
                    );
                  });
                })()}
            </div>

            <div className="mt-4">
              <BottomRow onNext={()=>setStep(3)} nextLabel="Isi Data Diri" nextDisabled={!selectedTime||slotsLoading}/>
            </div>
          </div>
        )}

        {/* ── STEP 3: BIODATA ── */}
        {step===3 && (
          <div className="px-5 py-4 space-y-3.5">
            {/* Jadwal chip */}
            <div className="flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5"
              style={{ background:"rgba(134,239,172,0.06)", border:"1px solid rgba(134,239,172,0.12)" }}>
              <Icon icon="solar:clock-circle-bold" className="text-[#86efac] text-sm shrink-0"/>
              <p className="text-[#86efac] font-bold text-[13px] truncate capitalize">{fmtDate()} · {selectedTime} WIB</p>
            </div>

            {/* Nama */}
            <div>
              <label className="text-[9px] font-black text-white/25 uppercase tracking-widest block mb-1.5">
                Nama Lengkap <span className="text-rose-400/70">*</span>
              </label>
              <input type="text" value={namaKlien}
                onChange={e=>{setNamaKlien(e.target.value);setFormError("");}}
                placeholder="Masukkan nama lengkap Anda"
                className="w-full rounded-2xl px-4 py-3.5 text-white text-[13px] font-medium outline-none placeholder:text-white/15 transition-colors"
                style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)" }}
                onFocus={e=>e.currentTarget.style.borderColor="rgba(134,239,172,0.3)"}
                onBlur={e=>e.currentTarget.style.borderColor="rgba(255,255,255,0.08)"}
              />
            </div>

            {/* Nomor telepon — +62 prefix block */}
            <div>
              <label className="text-[9px] font-black text-white/25 uppercase tracking-widest block mb-1.5">
                Nomor Telepon <span className="text-rose-400/70">*</span>
              </label>
              <div className="flex items-stretch rounded-2xl overflow-hidden transition-colors"
                style={{ border:"1px solid rgba(255,255,255,0.08)" }}
                onFocusCapture={e=>(e.currentTarget as HTMLElement).style.borderColor="rgba(134,239,172,0.3)"}
                onBlurCapture={e=>(e.currentTarget as HTMLElement).style.borderColor="rgba(255,255,255,0.08)"}>
                {/* +62 prefix pill */}
                <div className="flex items-center px-4 shrink-0 select-none"
                  style={{ background:"rgba(134,239,172,0.08)", borderRight:"1px solid rgba(255,255,255,0.08)" }}>
                  <span className="text-[13px] font-extrabold text-[#86efac] tracking-wide">+62</span>
                </div>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={fmtPhoneDigits(phoneDigits)}
                  onChange={handlePhoneInput}
                  placeholder="8xxx-xxxx-xxxx"
                  className="flex-1 bg-transparent text-white text-[13px] font-medium outline-none px-4 py-3.5 placeholder:text-white/15 tabular-nums min-w-0"
                />
              </div>
            </div>

            {/* Catatan */}
            <div>
              <label className="text-[9px] font-black text-white/25 uppercase tracking-widest block mb-1.5">
                Catatan <span className="text-white/15 normal-case font-normal tracking-normal">(opsional)</span>
              </label>
              <textarea value={catatan} onChange={e=>setCatatan(e.target.value)}
                placeholder="Tulis catatan untuk agent..."
                rows={2} className="w-full rounded-2xl px-4 py-3 text-white text-[13px] font-medium outline-none placeholder:text-white/15 resize-none transition-colors"
                style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)" }}
                onFocus={e=>e.currentTarget.style.borderColor="rgba(134,239,172,0.3)"}
                onBlur={e=>e.currentTarget.style.borderColor="rgba(255,255,255,0.08)"}
              />
            </div>

            {formError && <p className="text-[11px] text-rose-400 font-medium">{formError}</p>}

            <BottomRow onNext={()=>{if(validateBiodata())setStep(4);}} nextLabel="Konfirmasi"/>
          </div>
        )}

        {/* ── STEP 4: CONFIRM ── */}
        {step===4 && (
          <div className="px-5 py-4">
            <div className="space-y-2 mb-4">
              {[
                {icon:"solar:calendar-date-bold", label:"Tanggal", value:fmtDate()},
                {icon:"solar:clock-circle-bold",  label:"Waktu",   value:`${selectedTime} WIB`},
                {icon:"solar:user-bold",          label:"Nama",    value:namaKlien},
                {icon:"solar:phone-bold",         label:"Telepon", value:fullPhone},
                ...(catatan.trim()?[{icon:"solar:notes-bold",label:"Catatan",value:catatan.trim()}]:[]),
              ].map(item=>(
                <div key={item.label} className="flex items-center gap-3 rounded-2xl px-3.5 py-2.5"
                  style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.05)" }}>
                  <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background:"rgba(134,239,172,0.1)" }}>
                    <Icon icon={item.icon} className="text-[#86efac] text-sm"/>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9px] font-black text-white/20 uppercase tracking-widest">{item.label}</p>
                    <p className="text-white font-semibold text-[13px] truncate">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>

            {submitError && <p className="text-[11px] text-rose-400 font-medium mb-3 text-center">{submitError}</p>}

            <p className="text-center text-[10px] text-white/18 mb-3 font-medium">
              Jadwal dicatat otomatis &amp; konfirmasi dikirim via WhatsApp
            </p>

            <div className="flex gap-2">
              <button onClick={goBack} disabled={submitting}
                className="flex-1 py-3.5 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-1.5 text-white/40 hover:text-white/80 disabled:opacity-30"
                style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.07)" }}>
                <Icon icon="solar:alt-arrow-left-bold" className="text-[11px]"/>
                Ubah
              </button>
              <button onClick={handleBook} disabled={submitting}
                className="flex-[2.2] py-3.5 rounded-2xl bg-[#25D366] hover:bg-[#1dbd5a] active:scale-[0.98] text-black font-extrabold text-[13px] transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-[0_8px_28px_rgba(37,211,102,0.22)]">
                {submitting
                  ? <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"/>
                  : <Icon icon="ic:baseline-whatsapp" className="text-lg"/>}
                {submitting ? "Menyimpan..." : "Konfirmasi & Chat WA"}
              </button>
            </div>
          </div>
        )}

        {/* iOS safe area */}
        <div className="safe-area-bottom"/>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OFFER MODAL — ajukan penawaran harga
// ─────────────────────────────────────────────────────────────────────────────
interface MyOfferSummary {
  status: "pending" | "diterima" | "ditolak";
  penawaran: number | null;
}

interface OfferModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentName: string;
  propertyTitle: string;
  agentPhone: string;
  askingPrice: number;
  idProperty: string | number;
  idAgent: string | number | undefined;
  onOfferChange?: (offer: MyOfferSummary | null) => void;
}

function OfferModal({
  isOpen, onClose, agentName, propertyTitle, agentPhone, askingPrice, idProperty, idAgent, onOfferChange,
}: OfferModalProps) {
  const { data: session, status: sessionStatus } = useSession();
  const [offerRaw, setOfferRaw] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">("");
  const [notes,    setNotes]    = useState("");
  const [visible,  setVisible]  = useState(false);
  const [error,    setError]    = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [profile, setProfile] = useState<{ name: string; phone: string; email: string } | null>(null);
  const [authView, setAuthView] = useState<"gate" | "signin" | "signup">("gate");
  const [justAuthenticated, setJustAuthenticated] = useState(false);
  const [successVisible, setSuccessVisible] = useState(false);
  const [existingOffer, setExistingOffer] = useState<ExistingOffer | null>(null);
  const [loadingOffer, setLoadingOffer] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setOfferRaw(""); setNotes(""); setPaymentMethod(""); setError(""); setSubmitting(false); setAuthView("gate"); setJustAuthenticated(false);
      requestAnimationFrame(() => setVisible(true));

      if (session?.user) {
        fetch("/api/profile")
          .then(r => r.ok ? r.json() : null)
          .then(data => {
            setProfile({
              name: data?.pengguna?.nama_lengkap || session.user?.name || "",
              phone: data?.pengguna?.nomor_telepon || "",
              email: data?.pengguna?.email || session.user?.email || "",
            });
          })
          .catch(() => setProfile(null));

        setLoadingOffer(true);
        fetch(`/api/leads/penawaran/mine?id_property=${idProperty}`)
          .then(r => r.ok ? r.json() : null)
          .then(data => {
            const offer = data?.offer ?? null;
            setExistingOffer(offer);
            onOfferChange?.(offer ? { status: offer.status_penawaran, penawaran: offer.penawaran } : null);
          })
          .catch(() => setExistingOffer(null))
          .finally(() => setLoadingOffer(false));
      } else {
        setProfile(null);
        setExistingOffer(null);
      }
    } else { setVisible(false); }
  }, [isOpen, session, idProperty]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  // ── Transisi mulus setelah login berhasil di dalam modal ──
  const needsLoginNow = sessionStatus !== "loading" && sessionStatus !== "authenticated";
  useEffect(() => {
    if (!justAuthenticated) { setSuccessVisible(false); return; }
    requestAnimationFrame(() => setSuccessVisible(true));
    if (!needsLoginNow) {
      const t = setTimeout(() => {
        setSuccessVisible(false);
        setTimeout(() => setJustAuthenticated(false), 200);
      }, 1100);
      return () => clearTimeout(t);
    }
  }, [justAuthenticated, needsLoginNow]);

  const handleClose = useCallback(() => {
    setVisible(false); setTimeout(onClose, 250);
  }, [onClose]);

  const offerNum = parseInt(offerRaw || "0", 10);
  const displayVal = offerRaw ? new Intl.NumberFormat("id-ID").format(offerNum) : "";

  const fmt = (n: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

  const diffPct = offerNum > 0 && askingPrice > 0
    ? Math.round(((askingPrice - offerNum) / askingPrice) * 100)
    : 0;

  const offerFeedback = offerNum > 0 ? getOfferFeedback(diffPct, "harga listing") : null;

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setOfferRaw(e.target.value.replace(/\D/g, ""));
    setError("");
  };

  const handleSubmit = async () => {
    if (!offerRaw || offerNum < 1_000_000) {
      setError("Tawaran minimal Rp 1.000.000"); return;
    }
    if (!paymentMethod) {
      setError("Pilih cara bayar terlebih dahulu"); return;
    }
    setSubmitting(true); setError("");

    const paymentLabel = PAYMENT_METHODS.find(p => p.value === paymentMethod)?.waLabel;
    const leadNotes = [paymentLabel ? `Cara bayar: ${paymentLabel}` : "", notes.trim()].filter(Boolean).join("\n");

    const result = await trackLeadClick({
      id_property: idProperty, id_agent: idAgent, source: "penawaran",
      offer_amount: offerNum, discount_pct: diffPct, payment_method: paymentMethod,
      notes: leadNotes || undefined,
    });
    if (!result.ok) {
      if (result.error === "PENDING_OFFER_EXISTS" && result.existing) {
        setExistingOffer({
          id_lead: result.existing.id_lead,
          penawaran: result.existing.penawaran,
          status_penawaran: "pending",
          created_at: result.existing.created_at,
        });
        onOfferChange?.({ status: "pending", penawaran: result.existing.penawaran });
      } else {
        setError("Gagal mengirim penawaran. Silakan coba lagi.");
      }
      setSubmitting(false);
      return;
    }

    onOfferChange?.({ status: "pending", penawaran: offerNum });

    const phone = agentPhone.replace(/^0/, "62").replace(/\D/g, "");
    let msg =
      `Halo ${agentName}, saya ingin mengajukan penawaran untuk properti:\n` +
      `*${propertyTitle}*\n\n` +
      `💰 Harga Listing: ${fmt(askingPrice)}\n` +
      `🤝 Tawaran Saya: *${fmt(offerNum)}*`;
    if (diffPct > 0)       msg += ` (${diffPct}% di bawah harga listing)`;
    if (offerNum > askingPrice) msg += ` (melebihi harga listing)`;
    if (paymentLabel)      msg += `\n💳 Cara Bayar: ${paymentLabel}`;
    if (notes.trim())      msg += `\n\n📝 Catatan: ${notes.trim()}`;
    msg += `\n\nMohon pertimbangan dan konfirmasinya. Terima kasih!`;

    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
    setSubmitting(false);
    handleClose();
  };

  if (!isOpen) return null;

  const needsLogin = needsLoginNow && !justAuthenticated;

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center">
      <div
        onClick={handleClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-md transition-opacity duration-250"
        style={{ opacity: visible ? 1 : 0 }}
      />
      <div
        className="relative w-full sm:max-w-[420px] sm:mx-auto bg-[#0C0C0C] border border-white/[0.07] rounded-t-[2.5rem] sm:rounded-[2rem] overflow-hidden shadow-[0_-24px_80px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.04)] transition-all duration-300 ease-out max-h-[92dvh] sm:max-h-[85vh] flex flex-col"
        style={{ transform: visible ? "translateY(0)" : "translateY(24px)", opacity: visible ? 1 : 0 }}
      >
        {/* Pull bar */}
        <div className="sm:hidden flex justify-center pt-3.5 pb-1 shrink-0">
          <div className="w-8 h-[3px] rounded-full bg-white/15" />
        </div>

        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-white/[0.06] shrink-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-black text-[#86efac]/60 uppercase tracking-widest">
              Negosiasi Harga
            </span>
            <button onClick={handleClose} className="w-7 h-7 rounded-full bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center transition-colors">
              <Icon icon="solar:close-circle-bold" className="text-white/50 text-base" />
            </button>
          </div>
          <h2 className="text-[1.25rem] font-extrabold text-white leading-tight tracking-tight">
            Ajukan Penawaran
          </h2>
          <p className="text-[11px] text-white/30 mt-0.5 truncate font-medium">{propertyTitle}</p>
        </div>

        <div className="px-6 py-5 space-y-4 overflow-y-auto min-h-0 flex-1">
          {justAuthenticated ? (
            <div
              className="flex flex-col items-center text-center gap-4 py-10 transition-all duration-500 ease-out"
              style={{ opacity: successVisible ? 1 : 0, transform: successVisible ? "translateY(0) scale(1)" : "translateY(8px) scale(0.96)" }}
            >
              <div className="relative w-20 h-20 rounded-full bg-[#86efac]/10 border border-[#86efac]/20 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-[#86efac]/20 animate-ping" />
                <Icon icon="solar:check-circle-bold" className="text-4xl text-[#86efac] relative z-10" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Berhasil masuk!</h3>
                <p className="text-[12px] text-white/40 mt-1.5 leading-relaxed">
                  Menyiapkan formulir penawaran kamu...
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#86efac] animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-[#86efac] animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-[#86efac] animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          ) : needsLogin ? (
            authView === "signin" ? (
              <div className="auth-embed">
                <Signin
                  closeModal={() => setAuthView("gate")}
                  openSignupModal={() => setAuthView("signup")}
                  skipRedirect
                  onSuccess={() => setJustAuthenticated(true)}
                />
              </div>
            ) : authView === "signup" ? (
              <div className="auth-embed">
                <SignUp
                  closeModal={() => setAuthView("gate")}
                  openSigninModal={() => setAuthView("signin")}
                />
              </div>
            ) : (
            <>
              <div className="flex flex-col items-center text-center gap-3 py-2">
                <div className="w-14 h-14 rounded-2xl bg-[#86efac]/10 border border-[#86efac]/20 flex items-center justify-center">
                  <Icon icon="solar:shield-keyhole-bold-duotone" className="text-2xl text-[#86efac]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Masuk untuk mengajukan penawaran</h3>
                  <p className="text-[12px] text-white/40 mt-1.5 leading-relaxed">
                    Demi keamanan transaksi, penawaran hanya bisa diajukan oleh akun terdaftar —
                    agar identitas Anda jelas dan agent bisa menghubungi balik dengan tenang.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setAuthView("signin")}
                className="w-full bg-[#86efac] hover:bg-[#6ee7a8] active:scale-[0.98] text-black font-extrabold py-3.5 rounded-2xl transition-all text-sm flex items-center justify-center gap-2"
              >
                <Icon icon="solar:login-3-bold" className="text-lg" />
                Masuk
              </button>
              <button
                onClick={() => setAuthView("signup")}
                className="w-full bg-white/[0.05] hover:bg-white/[0.09] active:scale-[0.98] text-white font-bold py-3.5 rounded-2xl transition-all text-sm border border-white/[0.08]"
              >
                Daftar Akun Baru
              </button>
            </>
            )
          ) : loadingOffer && !existingOffer ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <div className="w-9 h-9 rounded-full border-2 border-white/10 border-t-[#86efac] animate-spin" />
              <p className="text-[12px] text-white/30 font-medium">Memeriksa status penawaran...</p>
            </div>
          ) : existingOffer?.status_penawaran === "pending" ? (
            <div className="flex flex-col items-center text-center gap-4 py-6">
              <div className="relative w-16 h-16 rounded-full bg-amber-400/10 border border-amber-400/20 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-amber-400/15 animate-ping" />
                <Icon icon="solar:hourglass-line-bold-duotone" className="text-3xl text-amber-300 relative z-10" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Menunggu Respon Agent</h3>
                <p className="text-[12px] text-white/40 mt-1.5 leading-relaxed">
                  Penawaran Anda sedang dipertimbangkan oleh agent. Anda akan diberi tahu begitu ada keputusan.
                </p>
              </div>
              <div className="w-full bg-white/[0.03] border border-white/[0.06] rounded-2xl px-4 py-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-white/40 font-medium">Tawaran Anda</span>
                  <span className="text-sm font-extrabold text-white">
                    {existingOffer.penawaran != null ? fmt(existingOffer.penawaran) : "-"}
                  </span>
                </div>
                {existingOffer.pembayaran && (
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-white/40 font-medium">Cara Bayar</span>
                    <span className="text-[12px] font-bold text-white/80">
                      {PAYMENT_METHODS.find(p => p.value === existingOffer.pembayaran)?.label}
                    </span>
                  </div>
                )}
              </div>
              <button
                onClick={handleClose}
                className="w-full bg-white/[0.05] hover:bg-white/[0.09] active:scale-[0.98] text-white font-bold py-3.5 rounded-2xl transition-all text-sm border border-white/[0.08]"
              >
                Tutup
              </button>
            </div>
          ) : (
            <>
              {/* Hasil keputusan penawaran sebelumnya */}
              {existingOffer && existingOffer.status_penawaran !== "pending" && (
                <div className={`flex items-start gap-2.5 rounded-2xl border p-3 ${existingOffer.status_penawaran === "diterima" ? "border-[#86efac]/20 bg-[#86efac]/[0.06]" : "border-rose-400/20 bg-rose-500/[0.06]"}`}>
                  <Icon
                    icon={existingOffer.status_penawaran === "diterima" ? "solar:check-circle-bold" : "solar:close-circle-bold"}
                    className={`text-base mt-0.5 shrink-0 ${existingOffer.status_penawaran === "diterima" ? "text-[#86efac]" : "text-rose-400"}`}
                  />
                  <div className="min-w-0">
                    <p className={`text-[12px] font-bold ${existingOffer.status_penawaran === "diterima" ? "text-[#86efac]" : "text-rose-300"}`}>
                      {existingOffer.status_penawaran === "diterima" ? "Penawaran sebelumnya diterima!" : "Penawaran sebelumnya ditolak"}
                    </p>
                    {existingOffer.catatan_agent && (
                      <p className="text-[11px] text-white/50 mt-1 italic">"{existingOffer.catatan_agent}"</p>
                    )}
                  </div>
                </div>
              )}

              {/* Harga listing reference */}
              <div className="flex items-center justify-between bg-white/[0.03] border border-white/[0.06] rounded-2xl px-4 py-3">
                <span className="text-[11px] text-white/40 font-medium">Harga Listing</span>
                <span className="text-sm font-extrabold text-white">{fmt(askingPrice)}</span>
              </div>

              {/* Identitas pengaju */}
              {profile && (
                <div className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.06] rounded-2xl px-4 py-2.5">
                  <Icon icon="solar:user-check-bold-duotone" className="text-[#86efac] text-base shrink-0" />
                  <p className="text-[11px] text-white/45 font-medium truncate">
                    Mengajukan sebagai <span className="text-white/80 font-bold">{profile.name}</span>
                    {profile.phone ? ` · ${profile.phone}` : ""}
                  </p>
                </div>
              )}

              {/* Offer input */}
              <div>
                <label className="text-[9px] font-black text-white/30 uppercase tracking-widest block mb-2">
                  Tawaran Anda
                </label>
                <div className={`flex items-center gap-2 rounded-2xl px-4 py-3.5 transition-colors border ${error ? "border-rose-500/40 bg-rose-500/[0.04]" : "border-white/[0.08] bg-white/[0.04] focus-within:border-[#86efac]/30"}`}>
                  <span className="text-sm font-bold text-white/30 shrink-0">Rp</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={displayVal}
                    onChange={handleInput}
                    placeholder="0"
                    className="flex-1 bg-transparent text-white font-extrabold text-lg outline-none placeholder:text-white/15 tabular-nums"
                  />
                </div>
                {error ? (
                  <p className="text-[10px] text-rose-400 mt-1.5 font-medium">{error}</p>
                ) : offerFeedback ? (
                  <div key={offerFeedback.tier} className="mt-2 animate-offerFeedbackIn">
                    {offerFeedback.gaugePct > 0 && (
                      <div className="relative h-1 rounded-full bg-white/[0.06] overflow-hidden mb-1.5">
                        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-[#86efac] via-amber-400 to-rose-500 opacity-25" />
                        <div
                          className={`absolute inset-y-0 left-0 rounded-full transition-all duration-300 ease-out ${offerFeedback.barClass}`}
                          style={{ width: `${offerFeedback.gaugePct}%` }}
                        />
                      </div>
                    )}
                    <p className={`text-[10px] font-medium flex items-center gap-1 transition-colors duration-300 ${offerFeedback.textClass}`}>
                      <Icon icon={offerFeedback.icon} className="text-[11px] shrink-0" />
                      <span>{offerFeedback.message}</span>
                    </p>
                  </div>
                ) : null}
              </div>

              {/* Cara Bayar */}
              <div>
                <label className="text-[9px] font-black text-white/30 uppercase tracking-widest block mb-2">
                  Cara Bayar
                </label>
                <div className="relative grid grid-cols-2 p-1 rounded-2xl border border-white/[0.08] bg-white/[0.03]">
                  <div
                    className="absolute top-1 bottom-1 left-1 rounded-xl bg-[#86efac]/[0.10] border border-[#86efac]/25 transition-transform duration-300 ease-out"
                    style={{
                      width: "calc(50% - 4px)",
                      transform: paymentMethod === "kpr" ? "translateX(calc(100% + 4px))" : "translateX(0)",
                      opacity: paymentMethod ? 1 : 0,
                    }}
                  />
                  {PAYMENT_METHODS.map(pm => {
                    const active = paymentMethod === pm.value;
                    return (
                      <button
                        key={pm.value}
                        type="button"
                        onClick={() => setPaymentMethod(pm.value)}
                        className={`relative z-10 flex items-center justify-center gap-2 rounded-xl py-3 transition-colors duration-200 active:scale-[0.97] ${
                          active ? "text-white" : "text-white/40 hover:text-white/60"
                        }`}
                      >
                        <Icon icon={pm.icon} className={`text-base transition-colors duration-200 ${active ? "text-[#86efac]" : ""}`} />
                        <span className="text-[11px] font-bold">{pm.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-[9px] font-black text-white/30 uppercase tracking-widest block mb-2">
                  Catatan <span className="text-white/15 normal-case font-normal tracking-normal">(opsional)</span>
                </label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Contoh: Siap KPR, bisa survey minggu ini..."
                  rows={2}
                  className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-[#86efac]/30 rounded-2xl px-4 py-3 text-white text-[13px] font-medium outline-none placeholder:text-white/15 resize-none transition-colors"
                />
              </div>

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full bg-[#25D366] hover:bg-[#1dbd5a] active:scale-[0.98] text-black font-extrabold py-4 rounded-2xl transition-all text-sm flex items-center justify-center gap-2 shadow-[0_8px_24px_rgba(37,211,102,0.2)] disabled:opacity-60"
              >
                <Icon icon={submitting ? "solar:refresh-bold" : "ic:baseline-whatsapp"} className={`text-lg ${submitting ? "animate-spin" : ""}`} />
                {submitting ? "Mengirim..." : "Kirim Penawaran via WhatsApp"}
              </button>

              <p className="text-center text-[10px] text-white/20 font-medium">
                Penawaran dikirim langsung ke agent untuk dipertimbangkan
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SIDEBAR
// ─────────────────────────────────────────────────────────────────────────────
interface AgentSidebarProps {
  data: any;
  onShareOpen?: () => void;
}

export default function AgentSidebar({ data, onShareOpen }: AgentSidebarProps) {
  const { data: session } = useSession();
  const [surveyOpen,   setSurveyOpen]   = useState(false);
  const [offerOpen,    setOfferOpen]    = useState(false);
  const [cobrokeOpen,  setCobrokeOpen]  = useState(false);
  const [displayPrice, setDisplayPrice] = useState<number>(0);
  const [decisionToast, setDecisionToast] = useState<DecisionPayload | null>(null);
  const [myOffer, setMyOffer] = useState<MyOfferSummary | null>(null);
  const [myCobroke, setMyCobroke] = useState<CobrokeClaimSummary | null>(null);
  const [isDownloadingBrosur, setIsDownloadingBrosur] = useState(false);
  const [isBuildingPoster, setIsBuildingPoster] = useState(false);

  // ── Cek status penawaran milik user untuk properti ini (mewarnai tombol CTA) ──
  useEffect(() => {
    const uid = (session?.user as any)?.id;
    if (!uid || !data.id_property) return;
    fetch(`/api/leads/penawaran/mine?id_property=${data.id_property}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const offer = d?.offer;
        setMyOffer(offer ? { status: offer.status_penawaran, penawaran: offer.penawaran } : null);
      })
      .catch(() => {});
  }, [session, data.id_property]);

  // ── Toast real-time saat agent memutuskan penawaran / co-broke ──
  useEffect(() => {
    const uid = (session?.user as any)?.id;
    if (!uid) return;
    const channel = pusherClient.subscribe(`user-${uid}`);
    const handler = (payload: DecisionPayload) => {
      if (String(payload.id_property) === String(data.id_property)) {
        setDecisionToast(payload);
        setMyOffer({ status: payload.status_penawaran, penawaran: payload.penawaran });
      }
    };
    const cobrokeHandler = (payload: DecisionPayload) => {
      if (String(payload.id_property) === String(data.id_property)) {
        setMyCobroke({ status: payload.status_penawaran });
      }
    };
    channel.bind("penawaran:decision", handler);
    channel.bind("cobroke:decision", cobrokeHandler);
    return () => {
      channel.unbind("penawaran:decision", handler);
      channel.unbind("cobroke:decision", cobrokeHandler);
      pusherClient.unsubscribe(`user-${uid}`);
    };
  }, [session, data.id_property]);

  useEffect(() => {
    if (!decisionToast) return;
    const t = setTimeout(() => setDecisionToast(null), 6000);
    return () => clearTimeout(t);
  }, [decisionToast]);

  // ── Resolve agent ID (fallback chain: owner → listing's own id_agent field) ──
  const owner   = data.owner || {};
  const effectiveAgentId: string = String(owner.id_agent || data.id_agent || "");

  // ── Co-broke mode: viewer adalah agent lain (bukan pemilik listing) ──
  const viewerAgentId: string | undefined = (session?.user as any)?.agentId;
  const isCobrokeViewer = !!viewerAgentId && viewerAgentId !== effectiveAgentId;
  // ── Owner mode: viewer adalah pemilik listing sendiri ──
  const isOwnerViewer = !!viewerAgentId && viewerAgentId === effectiveAgentId;
  const editPropertyHref = `/tambah-property?id=${data.id_property}&mode=edit`;

  // ── Listing sudah terjual/tersewa: lead-gen (WA, penawaran, survei, co-broke,
  // poster) dikunci — transaksinya sudah selesai. Edit & bagikan tetap dibuka
  // untuk owner supaya listing masih bisa dikelola.
  const isSold = String(data.status_tayang || "").toUpperCase() === "TERJUAL";
  const soldLabel =
    String(data.jenis_transaksi || "").toUpperCase() === "SEWA"
      ? "Tersewa"
      : "Terjual";
  const browseMoreHref =
    String(data.jenis_transaksi || "").toUpperCase() === "SEWA" ? "/Sewa" : "/Jual";

  useEffect(() => {
    if (!isCobrokeViewer || !data.id_property) return;
    fetch(`/api/leads/cobroke/mine?id_property=${data.id_property}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const claim = d?.claim;
        setMyCobroke(claim ? { status: claim.status_penawaran } : null);
      })
      .catch(() => {});
  }, [isCobrokeViewer, data.id_property]);

  const handleDownloadBrosur = () => downloadPropertyImages(data.foto_list || [], setIsDownloadingBrosur);

  const handleDownloadPoster = () => {
    const payload = buildJualPosterData(data, { agentCode: viewerAgentId, selfAgent: data.agent });
    return downloadJualPoster(payload, setIsBuildingPoster);
  };

  // ── Avatar ──
  const rawAvatar: string = owner.avatar || "";
  const avatarSrc =
    rawAvatar.startsWith("http") || rawAvatar.startsWith("/")
      ? rawAvatar
      : rawAvatar ? `https://drive.google.com/thumbnail?id=${rawAvatar}&sz=w200` : "";
  const hasAvatar = !!avatarSrc;

  const agent = {
    name:   owner.name   || "Agent Premier",
    phone:  owner.phone  || "628123456789",
    office: owner.office || "Solusindo Aset",
    rating: Number(owner.rating ?? 5),
    area:   owner.area   || "Indonesia",
  };

  // ── Pricing ──
  const harga: number      = data.harga || data.priceRates?.monthly || 0;
  const hargaPromo: number | null = (data.harga_promo && data.harga_promo < harga) ? data.harga_promo : null;
  const discountPct = hargaPromo ? Math.round(((harga - hargaPromo) / harga) * 100) : 0;

  const fmt = (n: number) =>
    new Intl.NumberFormat("id-ID", { style:"currency", currency:"IDR", maximumFractionDigits:0 }).format(n);

  const fmtShort = (n: number) => {
    if (n >= 1_000_000_000) return `${(n/1_000_000_000).toFixed(n%1_000_000_000===0?0:1)} M`;
    if (n >= 1_000_000)     return `${Math.round(n/1_000_000)} Jt`;
    return fmt(n);
  };

  // ── Price roll: harga → hargaPromo, cubic ease-out, 1.6s ──
  useEffect(() => {
    if (!hargaPromo) { setDisplayPrice(harga); return; }
    setDisplayPrice(harga);
    const STEPS = 55, DUR = 1600;
    const diff  = harga - hargaPromo;
    let step    = 0;
    const id    = setInterval(() => {
      step++;
      const eased = 1 - Math.pow(1 - step / STEPS, 3);
      setDisplayPrice(Math.round(harga - diff * eased));
      if (step >= STEPS) { clearInterval(id); setDisplayPrice(hargaPromo); }
    }, DUR / STEPS);
    return () => clearInterval(id);
  }, [harga, hargaPromo]);

  // ── Contact ──
  const call = (type: "wa"|"call") => {
    const phone = agent.phone.replace(/^0/,"62").replace(/\D/g,"");
    trackLeadClick({ id_property: data.id_property, id_agent: effectiveAgentId, source: type==="wa"?"whatsapp":"telepon" });
    if (type==="call") { window.open(`tel:${phone}`); return; }
    const lokasi = data.area_lokasi || [data.kecamatan, data.kota].filter(Boolean).join(", ") || data.kota || "";
    const propertyUrl = `${SITE_URL}/Jual/${data.slug ? `${data.slug}-${data.id_property}` : data.id_property}`;
    const msg =
      `Halo ${agent.name} 👋\n\n` +
      `Saya tertarik dengan properti berikut, apakah masih tersedia?\n\n` +
      `🏠 *${data.title}*\n` +
      (lokasi ? `📍 ${lokasi}\n` : "") +
      `💰 *${fmt(hargaPromo ?? harga)}*\n` +
      `🔖 Kode: ${data.id_property}\n` +
      `\n🔗 Detail lengkap:\n${propertyUrl}\n\n` +
      `Mohon infonya, terima kasih! 🙏`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`,"_blank");
  };

  // ── Sub-components ──
  const Avatar = ({ size = 56 }: { size?: number }) => (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div className="w-full h-full rounded-full overflow-hidden" style={{ padding: 2, background: "linear-gradient(135deg, #86efac 0%, #34d399 100%)" }}>
        <div className="w-full h-full rounded-full overflow-hidden relative bg-[#1A1A1A] flex items-center justify-center">
          {hasAvatar ? (
            <Image src={avatarSrc} alt={agent.name} fill className="object-cover" sizes={`${size}px`} />
          ) : (
            <span className="font-black text-white" style={{ fontSize: size * 0.36 }}>
              {agent.name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
      </div>
      <div className="absolute -bottom-0.5 -right-0.5 rounded-full flex items-center justify-center" style={{ width: size*0.3, height: size*0.3, background:"#0C0C0C", padding: 1.5 }}>
        <div className="w-full h-full rounded-full bg-blue-500 flex items-center justify-center">
          <Icon icon="solar:verified-check-bold" className="text-white" style={{ fontSize: size * 0.18 }} />
        </div>
      </div>
    </div>
  );

  return (
    <>
      <SurveyModal
        isOpen={surveyOpen} onClose={() => setSurveyOpen(false)}
        agentName={agent.name} propertyTitle={data.title || data.judul || ""}
        agentPhone={agent.phone} idProperty={data.id_property} idAgent={effectiveAgentId}
      />
      <OfferModal
        isOpen={offerOpen} onClose={() => setOfferOpen(false)}
        agentName={agent.name} propertyTitle={data.title || data.judul || ""}
        agentPhone={agent.phone} askingPrice={hargaPromo ?? harga}
        idProperty={data.id_property} idAgent={effectiveAgentId}
        onOfferChange={setMyOffer}
      />
      <CobrokeModal
        isOpen={cobrokeOpen} onClose={() => setCobrokeOpen(false)}
        agentName={agent.name} agentOffice={agent.office} agentPhone={agent.phone}
        propertyTitle={data.title || data.judul || ""} askingPrice={hargaPromo ?? harga}
        idProperty={data.id_property} idAgent={effectiveAgentId}
        onClaimChange={setMyCobroke}
      />

      {/* ── Toast real-time: keputusan penawaran ── */}
      {decisionToast && (
        <div className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:right-4 sm:w-[380px] z-[10000] animate-offerFeedbackIn">
          <div className={`flex items-start gap-3 rounded-2xl border p-4 shadow-[0_16px_48px_rgba(0,0,0,0.6)] backdrop-blur-xl ${decisionToast.status_penawaran === "diterima" ? "border-[#86efac]/25 bg-[#0C0C0C]/95" : "border-rose-400/25 bg-[#0C0C0C]/95"}`}>
            <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${decisionToast.status_penawaran === "diterima" ? "bg-[#86efac]/10" : "bg-rose-500/10"}`}>
              <Icon
                icon={decisionToast.status_penawaran === "diterima" ? "solar:check-circle-bold" : "solar:close-circle-bold"}
                className={`text-lg ${decisionToast.status_penawaran === "diterima" ? "text-[#86efac]" : "text-rose-400"}`}
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className={`text-[12px] font-bold ${decisionToast.status_penawaran === "diterima" ? "text-[#86efac]" : "text-rose-300"}`}>
                {decisionToast.status_penawaran === "diterima" ? "Penawaran Anda Diterima!" : "Penawaran Anda Ditolak"}
              </p>
              {decisionToast.catatan_agent && (
                <p className="text-[11px] text-white/50 mt-1 italic line-clamp-2">"{decisionToast.catatan_agent}"</p>
              )}
              <button
                onClick={() => { setOfferOpen(true); setDecisionToast(null); }}
                className="mt-2 text-[11px] font-bold text-white/70 hover:text-white underline underline-offset-2"
              >
                Lihat Detail
              </button>
            </div>
            <button onClick={() => setDecisionToast(null)} className="shrink-0 text-white/30 hover:text-white/60">
              <Icon icon="solar:close-circle-bold" className="text-base" />
            </button>
          </div>
        </div>
      )}

      {/* ════════════════════ DESKTOP ════════════════════ */}
      <div className="hidden lg:flex flex-col w-[360px] shrink-0 sticky top-[max(6rem,_calc(50vh-320px))] h-fit rounded-[1.75rem] overflow-hidden"
        style={{ background:"#0C0C0C", boxShadow:"0 0 0 1px rgba(255,255,255,0.06), 0 32px 80px rgba(0,0,0,0.7)" }}>

        {/* ── PRICE SECTION ── */}
        <div className="px-6 pt-6 pb-5">
          {hargaPromo ? (
            <div>
              {/* Top row: label + badge */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black text-[#86efac]/70 uppercase tracking-[0.18em]">
                  Harga Promo
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black text-white/40 border border-white/[0.1] px-2 py-0.5 rounded-full">
                    Hemat {discountPct}%
                  </span>
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                </div>
              </div>

              {/* Original price — struck through */}
              <p className="text-sm text-white/30 font-medium line-through mb-1 tracking-wide">
                {fmt(harga)}
              </p>

              {/* Promo price — animated roll, stays green */}
              <p className="text-[2rem] font-black leading-none tracking-tight tabular-nums" style={{ color: "#86efac" }}>
                {fmt(displayPrice || hargaPromo)}
              </p>

              {/* Savings line */}
              <div className="flex items-center gap-1.5 mt-2.5 pt-2.5 border-t border-white/[0.05]">
                <Icon icon="solar:tag-price-bold" className="text-[#86efac]/60 text-sm shrink-0" />
                <span className="text-[11px] text-white/40 font-medium">
                  Efisiensi harga{" "}
                  <span className="text-[#86efac]/80 font-bold">{fmt(harga - hargaPromo)}</span>
                </span>
              </div>
            </div>
          ) : (
            <div>
              <span className="text-[10px] font-black text-[#86efac]/70 uppercase tracking-[0.18em] block mb-2">
                Harga Penawaran
              </span>
              <p className="text-[2rem] font-black text-white leading-none tracking-tight">
                {fmt(harga)}
              </p>
              <div className="flex items-center gap-1.5 mt-2.5">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] font-bold text-white/35 uppercase tracking-widest">
                  Tersedia
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ── DIVIDER ── */}
        <div className="mx-0 h-px" style={{ background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.06),transparent)" }} />

        {/* ── AGENT CARD ── */}
        <div className="px-6 py-5">
          <div className="flex items-center gap-4">
            <Avatar size={52} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <h4 className="text-white font-extrabold text-[0.95rem] truncate leading-tight">
                  {agent.name}
                </h4>
              </div>
              <p className="text-[11px] text-white/35 truncate mb-2">{agent.office}</p>
              <span className="inline-flex items-center gap-1 text-[9px] font-black text-emerald-400 border border-emerald-500/20 bg-emerald-500/[0.07] px-2.5 py-1 rounded-full uppercase tracking-widest">
                <Icon icon="solar:verified-check-bold" className="text-[10px]" />
                Official Agent
              </span>
            </div>
          </div>
        </div>

        {/* ── DIVIDER ── */}
        <div className="mx-0 h-px" style={{ background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.06),transparent)" }} />

        {/* ── STATS ── */}
        <div className="grid grid-cols-3">
          {[
            { icon:"solar:star-bold",             iconCls:"text-amber-400",   val: agent.rating.toFixed(1), label:"Rating" },
            { icon:"solar:bolt-circle-bold",       iconCls:"text-[#86efac]",   val: "Fast",                  label:"Respon" },
            { icon:"solar:map-point-bold",         iconCls:"text-rose-400",    val: agent.area,              label:"Area"   },
          ].map((s, i) => (
            <div key={s.label} className={`flex flex-col items-center justify-center gap-1.5 py-4 ${i<2?"border-r border-white/[0.05]":""}`}>
              <Icon icon={s.icon} className={`${s.iconCls} text-base`} />
              <span className="text-[11px] font-black text-white/80 leading-none text-center">{s.val}</span>
              <span className="text-[8px] font-black text-white/20 uppercase tracking-[0.18em]">{s.label}</span>
            </div>
          ))}
        </div>

        {/* ── DIVIDER ── */}
        <div className="mx-0 h-px" style={{ background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.06),transparent)" }} />

        {/* ── SAFETY ── */}
        <div className="px-6 py-4 flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center shrink-0">
            <Icon icon="solar:shield-check-bold" className="text-white/40 text-sm" />
          </div>
          <p className="text-[10px] text-white/30 leading-snug font-medium">
            Hati-hati penipuan. Jangan transfer ke rekening pribadi agent.
          </p>
        </div>

        {/* ── DIVIDER ── */}
        <div className="mx-0 h-px" style={{ background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.06),transparent)" }} />

        {/* ── CTA ── */}
        <div className="px-6 py-5 space-y-2.5">
          {isOwnerViewer ? (
            <>
              <div className="flex gap-2">
                {onShareOpen && (
                  <button onClick={onShareOpen}
                    className="shrink-0 w-[52px] rounded-xl flex items-center justify-center transition-all active:scale-95 hover:scale-105"
                    style={{ background:"rgba(134,239,172,0.08)", border:"1px solid rgba(134,239,172,0.3)" }}>
                    <Icon icon="solar:share-bold-duotone" style={{ color:"#86efac", fontSize:20 }} />
                  </button>
                )}
                <Link href={editPropertyHref}
                  className="flex-1 bg-[#86efac] hover:bg-[#6ee7a8] active:scale-[0.98] text-black font-extrabold text-sm py-3.5 rounded-xl transition-all flex justify-center items-center gap-2.5"
                  style={{ boxShadow:"0 8px 32px rgba(134,239,172,0.22)" }}>
                  <Icon icon="solar:pen-2-bold-duotone" className="text-xl" />
                  Edit Properti
                </Link>
              </div>
              {isSold ? (
                <div className="w-full rounded-xl border border-red-500/25 bg-red-500/[0.06] py-3 px-3.5 flex items-center gap-2.5">
                  <Icon icon="solar:lock-keyhole-minimalistic-bold-duotone" className="text-red-400 text-lg shrink-0" />
                  <span className="text-[11px] text-red-300/80 font-semibold leading-snug">
                    Listing sudah {soldLabel.toLowerCase()} — poster tidak tersedia.
                  </span>
                </div>
              ) : (
                <button onClick={handleDownloadPoster} disabled={isBuildingPoster}
                  className="btn-lux btn-lux--poster w-full py-3 rounded-xl flex justify-center items-center gap-2.5 disabled:opacity-60">
                  <span className="btn-lux__chip w-7 h-7">
                    <Icon icon={isBuildingPoster ? "solar:refresh-bold" : "solar:gallery-wide-bold-duotone"} className={`lux-ico text-[15px] text-sky-100 ${isBuildingPoster ? "animate-spin" : ""}`} />
                  </span>
                  <span className="font-extrabold text-[13px] tracking-wide text-white">
                    {isBuildingPoster ? "Membuat poster…" : "Download Poster"}
                  </span>
                </button>
              )}
            </>
          ) : isSold ? (
            <div className="rounded-2xl border border-red-500/25 bg-red-500/[0.06] p-4 text-center">
              <Icon icon="solar:lock-keyhole-minimalistic-bold-duotone" className="text-2xl text-red-400 mx-auto mb-2" />
              <p className="text-red-300 font-bold text-sm">Properti ini sudah {soldLabel}</p>
              <Link href={browseMoreHref}
                className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-bold text-[#86efac] hover:text-[#6ee7a8] transition-colors">
                Lihat properti lainnya
                <Icon icon="solar:arrow-right-linear" className="text-sm" />
              </Link>
            </div>
          ) : (
          <>
          <button onClick={()=>call("wa")}
            className="w-full bg-[#25D366] hover:bg-[#1dbd5a] active:scale-[0.98] text-black font-extrabold text-sm py-3.5 rounded-xl transition-all flex justify-center items-center gap-2.5"
            style={{ boxShadow:"0 8px 32px rgba(37,211,102,0.22)" }}>
            <Icon icon="ic:baseline-whatsapp" className="text-xl" />
            {isCobrokeViewer ? "Hubungi Agent" : "Chat WhatsApp"}
          </button>
          {isCobrokeViewer ? (
            <div className="grid grid-cols-2 gap-2.5">
              {myCobroke?.status === "pending" ? (
                <button onClick={()=>setCobrokeOpen(true)}
                  className="btn-premium-pending w-full font-bold text-sm py-3 px-2 rounded-xl transition-all flex justify-center items-center gap-2 active:scale-[0.98]">
                  <span className="pp-glow" />
                  <Icon icon="solar:hourglass-line-bold-duotone" className="text-base relative z-10 animate-pulse shrink-0" />
                  <span className="relative z-10 text-shimmer-amber whitespace-nowrap">Menunggu</span>
                </button>
              ) : myCobroke?.status === "diterima" ? (
                <button onClick={()=>setCobrokeOpen(true)}
                  className="w-full bg-[#86efac]/[0.08] border border-[#86efac]/25 text-[#86efac] font-bold text-sm py-3 rounded-xl transition-all flex justify-center items-center gap-2">
                  <Icon icon="solar:medal-ribbons-star-bold-duotone" className="text-base" />
                  Co-Broke Aktif
                </button>
              ) : (
                <button onClick={()=>setCobrokeOpen(true)}
                  className="btn-cobroke w-full font-bold text-sm py-3 px-2 rounded-xl transition-all flex justify-center items-center gap-2 active:scale-[0.98]">
                  <span className="pp-glow-green" />
                  <Icon icon="solar:users-group-two-rounded-bold-duotone" className="text-base relative z-10 shrink-0" />
                  <span className="relative z-10 whitespace-nowrap">Ajukan Co-Broke</span>
                </button>
              )}
              <button onClick={handleDownloadBrosur} disabled={isDownloadingBrosur}
                className="btn-lux btn-lux--brosur w-full py-3 rounded-xl flex justify-center items-center gap-2 disabled:opacity-60">
                <Icon icon={isDownloadingBrosur ? "solar:refresh-bold" : "solar:gallery-download-bold-duotone"} className={`lux-ico text-[15px] text-amber-100 ${isDownloadingBrosur ? "animate-spin" : ""}`} />
                <span className="font-extrabold text-[12.5px] tracking-wide text-amber-50">
                  {isDownloadingBrosur ? "..." : "Brosur"}
                </span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              {myOffer?.status === "pending" ? (
                <button onClick={()=>setOfferOpen(true)}
                  className="btn-premium-pending w-full font-bold text-sm py-3 px-2 rounded-xl transition-all flex justify-center items-center gap-2 active:scale-[0.98]">
                  <span className="pp-glow" />
                  <Icon icon="solar:hourglass-line-bold-duotone" className="text-base relative z-10 animate-pulse shrink-0" />
                  <span className="relative z-10 text-shimmer-amber whitespace-nowrap">Menunggu</span>
                </button>
              ) : (
                <button onClick={()=>setOfferOpen(true)}
                  className="w-full bg-white/[0.04] border border-white/[0.09] hover:bg-white/[0.08] text-white/70 hover:text-white font-bold text-sm py-3 rounded-xl transition-all flex justify-center items-center gap-2">
                  <Icon icon="solar:hand-money-bold" className="text-base" />
                  Penawaran
                </button>
              )}
              <button onClick={()=>setSurveyOpen(true)}
                className="w-full bg-white/[0.04] border border-white/[0.09] hover:bg-white/[0.08] text-white/70 hover:text-white font-bold text-sm py-3 rounded-xl transition-all flex justify-center items-center gap-2">
                <Icon icon="solar:calendar-date-bold" className="text-base" />
                Survei
              </button>
            </div>
          )}
          </>
          )}
        </div>
      </div>

      {/* ════════════════════ MOBILE ════════════════════ */}
      <div
        className="lg:hidden fixed bottom-0 left-0 right-0 z-50"
        style={{
          background: "#0C0C0C",
          borderTop: "1px solid rgba(255,255,255,0.07)",
          boxShadow: "0 -24px 60px rgba(0,0,0,0.85)",
        }}
      >
        <div className="px-4 pt-3 pb-3">

          {/* ── Row 1: Agent info + Price ── */}
          <div className="flex items-center gap-3 mb-3">
            <Avatar size={38} />

            {/* Name + stats */}
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-[13px] truncate leading-tight">
                {agent.name}
              </p>
              <div className="flex items-center gap-1.5 mt-[3px]">
                <Icon icon="solar:star-bold" className="text-amber-400 text-[9px]" />
                <span className="text-[10px] font-extrabold text-white/55">
                  {agent.rating.toFixed(1)}
                </span>
                <span className="text-white/20 text-[10px]">·</span>
                <span className="text-[10px] text-white/35 truncate">{agent.area}</span>
              </div>
            </div>

            {/* Price block — no orphan "Rp" */}
            <div className="shrink-0 text-right">
              {hargaPromo ? (
                <>
                  <p className="text-[9px] text-white/25 line-through leading-none whitespace-nowrap tabular-nums">
                    Rp {fmtShort(harga)}
                  </p>
                  <p
                    className="text-[1.05rem] font-black leading-tight whitespace-nowrap tabular-nums"
                    style={{ color: "#86efac" }}
                  >
                    Rp {fmtShort(displayPrice || hargaPromo)}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-[8px] font-bold text-white/30 uppercase tracking-widest leading-none">
                    Harga
                  </p>
                  <p className="text-[1.05rem] font-black text-white leading-tight whitespace-nowrap tabular-nums">
                    Rp {fmtShort(harga)}
                  </p>
                </>
              )}
            </div>
          </div>

          {/* ── Row 2: CTAs ── */}
          <div className="flex gap-2">
            {isOwnerViewer ? (
              <>
                {/* Edit Properti — primary, wider */}
                <Link
                  href={editPropertyHref}
                  className="flex-[2] flex items-center justify-center gap-2 bg-[#86efac] hover:bg-[#6ee7a8] active:scale-[0.98] text-black font-extrabold text-[13px] py-3 rounded-2xl transition-all"
                  style={{ boxShadow: "0 6px 20px rgba(134,239,172,0.22)" }}
                >
                  <Icon icon="solar:pen-2-bold-duotone" className="text-[18px] shrink-0" />
                  Edit Properti
                </Link>

                {/* Download Poster */}
                {isSold ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-[3px] py-2 rounded-2xl border border-red-500/25 bg-red-500/[0.06]">
                    <Icon icon="solar:lock-keyhole-minimalistic-bold-duotone" className="text-red-400 text-[17px]" />
                    <span className="text-[8px] font-black text-red-300/70 uppercase tracking-widest">Poster</span>
                  </div>
                ) : (
                  <button
                    onClick={handleDownloadPoster}
                    disabled={isBuildingPoster}
                    className="btn-lux btn-lux--poster flex-1 flex flex-col items-center justify-center gap-[3px] py-2 rounded-2xl disabled:opacity-60"
                  >
                    <Icon icon={isBuildingPoster ? "solar:refresh-bold" : "solar:gallery-wide-bold-duotone"} className={`lux-ico text-sky-100 text-[17px] ${isBuildingPoster ? "animate-spin" : ""}`} />
                    <span className="text-[8px] font-black text-sky-100/80 uppercase tracking-widest">Poster</span>
                  </button>
                )}

                {/* Bagikan */}
                {onShareOpen && (
                  <button
                    onClick={onShareOpen}
                    className="flex-1 flex flex-col items-center justify-center gap-[3px] rounded-2xl transition-all active:scale-[0.96]"
                    style={{ background: "rgba(134,239,172,0.07)", border: "1px solid rgba(134,239,172,0.25)" }}
                  >
                    <Icon icon="solar:share-bold-duotone" style={{ color:"#86efac", fontSize:17 }} />
                    <span className="text-[8px] font-black uppercase tracking-widest" style={{ color:"rgba(134,239,172,0.6)" }}>Bagikan</span>
                  </button>
                )}
              </>
            ) : isSold ? (
              <div className="flex-1 flex items-center gap-2.5 rounded-2xl border border-red-500/25 bg-red-500/[0.06] py-3 px-3.5">
                <Icon icon="solar:lock-keyhole-minimalistic-bold-duotone" className="text-red-400 text-lg shrink-0" />
                <div className="min-w-0">
                  <p className="text-red-300 font-bold text-[11px] leading-tight">
                    Sudah {soldLabel}
                  </p>
                  <Link href={browseMoreHref} className="text-[10px] font-semibold text-[#86efac] hover:text-[#6ee7a8] transition-colors">
                    Lihat properti lainnya →
                  </Link>
                </div>
              </div>
            ) : (
            <>
            {/* WhatsApp — primary, wider */}
            <button
              onClick={() => call("wa")}
              className="flex-[2] flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1dbd5a] active:scale-[0.98] text-black font-extrabold text-[13px] py-3 rounded-2xl transition-all"
              style={{ boxShadow: "0 6px 20px rgba(37,211,102,0.22)" }}
            >
              <Icon icon="ic:baseline-whatsapp" className="text-[18px] shrink-0" />
              WhatsApp
            </button>

            {isCobrokeViewer ? (
              <>
                {/* Ajukan Co-Broke */}
                {myCobroke?.status === "pending" ? (
                  <button
                    onClick={() => setCobrokeOpen(true)}
                    className="btn-premium-pending flex-1 flex flex-col items-center justify-center gap-[3px] rounded-2xl transition-all active:scale-[0.96]"
                  >
                    <span className="pp-glow" />
                    <Icon icon="solar:hourglass-line-bold-duotone" className="text-[17px] relative z-10 animate-pulse" />
                    <span className="text-[8px] font-black uppercase tracking-widest relative z-10 text-shimmer-amber">
                      Menunggu
                    </span>
                  </button>
                ) : myCobroke?.status === "diterima" ? (
                  <button
                    onClick={() => setCobrokeOpen(true)}
                    className="flex-1 flex flex-col items-center justify-center gap-[3px] rounded-2xl transition-all active:scale-[0.96]"
                    style={{ background: "rgba(134,239,172,0.08)", border: "1px solid rgba(134,239,172,0.25)" }}
                  >
                    <Icon icon="solar:medal-ribbons-star-bold-duotone" className="text-[#86efac] text-[17px]" />
                    <span className="text-[8px] font-black text-[#86efac] uppercase tracking-widest">
                      Co-Broke Aktif
                    </span>
                  </button>
                ) : (
                  <button
                    onClick={() => setCobrokeOpen(true)}
                    className="btn-cobroke flex-1 flex flex-col items-center justify-center gap-[3px] rounded-2xl transition-all active:scale-[0.96]"
                  >
                    <span className="pp-glow-green" />
                    <Icon icon="solar:users-group-two-rounded-bold-duotone" className="text-[17px] relative z-10" />
                    <span className="text-[8px] font-black uppercase tracking-widest relative z-10">
                      Co-Broke
                    </span>
                  </button>
                )}

                {/* Download Brosur */}
                <button
                  onClick={handleDownloadBrosur}
                  disabled={isDownloadingBrosur}
                  className="btn-lux btn-lux--brosur flex-1 flex flex-col items-center justify-center gap-[3px] py-2 rounded-2xl disabled:opacity-60"
                >
                  <Icon icon={isDownloadingBrosur ? "solar:refresh-bold" : "solar:gallery-download-bold-duotone"} className={`lux-ico text-amber-100 text-[17px] ${isDownloadingBrosur ? "animate-spin" : ""}`} />
                  <span className="text-[8px] font-black text-amber-100/80 uppercase tracking-widest">
                    Brosur
                  </span>
                </button>
              </>
            ) : (
              <>
                {/* Ajukan Penawaran */}
                {myOffer?.status === "pending" ? (
                  <button
                    onClick={() => setOfferOpen(true)}
                    className="btn-premium-pending flex-1 flex flex-col items-center justify-center gap-[3px] rounded-2xl transition-all active:scale-[0.96]"
                  >
                    <span className="pp-glow" />
                    <Icon icon="solar:hourglass-line-bold-duotone" className="text-[17px] relative z-10 animate-pulse" />
                    <span className="text-[8px] font-black uppercase tracking-widest relative z-10 text-shimmer-amber">
                      Menunggu
                    </span>
                  </button>
                ) : (
                  <button
                    onClick={() => setOfferOpen(true)}
                    className="flex-1 flex flex-col items-center justify-center gap-[3px] rounded-2xl transition-all active:scale-[0.96]"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}
                  >
                    <Icon icon="solar:hand-money-bold" className="text-white/70 text-[17px]" />
                    <span className="text-[8px] font-black text-white/35 uppercase tracking-widest">
                      Penawaran
                    </span>
                  </button>
                )}

                {/* Survei */}
                <button
                  onClick={() => setSurveyOpen(true)}
                  className="flex-1 flex flex-col items-center justify-center gap-[3px] rounded-2xl transition-all active:scale-[0.96]"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}
                >
                  <Icon icon="solar:calendar-date-bold" className="text-white/70 text-[17px]" />
                  <span className="text-[8px] font-black text-white/35 uppercase tracking-widest">
                    Survei
                  </span>
                </button>
              </>
            )}
            </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
