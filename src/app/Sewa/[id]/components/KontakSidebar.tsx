"use client";

/**
 * Kolom kanan halaman detail sewa untuk kategori bermode NEGOSIASI —
 * gudang, ruko, toko, pabrik, tanah, dan rumah sewa.
 *
 * ── KENAPA PANEL INI ADA ──────────────────────────────────────────────────
 *
 * Sebelumnya seluruh halaman /Sewa memakai satu panel: panel pemesanan, dengan
 * tab durasi, kalender masuk–keluar, penghitung penghuni, voucher, dan tombol
 * "Ajukan Sewa". Untuk kos & apartemen itu tepat. Untuk sebuah gudang, isinya
 * menanyakan hal yang tidak ada jawabannya: berapa orang yang akan menghuni
 * gudang, tanggal berapa "check-in"-nya, dan voucher apa yang berlaku untuk
 * kontrak yang harganya justru masih akan dirundingkan. Panel itu bukan cuma
 * berlebihan — ia menjanjikan proses instan yang tidak pernah ada. Pemilik
 * gudang tidak menyewakan lewat tombol; ia menyewakan lewat percakapan.
 *
 * Maka kategori NEGOSIASI mendapat panel yang jujur menyebut apa yang benar-
 * benar bisa dilakukan pengunjung hari ini: bicara dengan agent, mengajukan
 * angka, dan datang melihat. Tiga hal yang sama persis dengan halaman detail
 * Jual & Lelang, karena memang persoalannya sama.
 *
 * Yang memutuskan panel mana yang dipakai bukan berkas ini, melainkan
 * `data.modeSewa` yang lahir dari tabel di @/lib/sewaKapabilitas.
 *
 * ── SUSUNAN ───────────────────────────────────────────────────────────────
 *
 * Desktop: kartu sticky, urut sesuai pertanyaan yang muncul di kepala pembaca
 * — berapa harganya → syaratnya apa → siapa yang saya hubungi → apa yang bisa
 * saya lakukan.
 *
 * Ponsel: kartunya tidak ikut mengalir ke dasar halaman (di sana tidak ada
 * yang akan menemukannya). Yang tampil adalah bilah harga + tombol di tepi
 * bawah layar, dan isinya yang sama muncul sebagai sheet begitu ditekan —
 * pola yang sama dengan panel pemesanan, supaya berpindah antar kategori
 * tidak terasa seperti berpindah situs.
 */

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { Icon } from "@iconify/react";

import { DURASI_META, formatRupiah } from "@/lib/kosDetail";
import { trackLeadClick } from "@/lib/leadTracking";
import { LABEL_DURASI } from "@/lib/sewaKapabilitas";
import SurveiModal from "./SurveiModal";
import PenawaranSewaModal from "./PenawaranSewaModal";
import { AKSEN, KILAU_PANEL, LINE, SURFACE } from "./sewaTheme";
import type { SewaDetailData } from "../types";

interface Props {
  data: SewaDetailData;
  /**
   * Pembacanya pemegang listing ini. Tombol kontak disembunyikan — semuanya
   * bermuara ke nomor WhatsApp-nya sendiri, dan penawaran atas listing sendiri
   * mengotori persis angka yang dia pakai menilai listing itu. Alat kerjanya
   * ada di Panel Kontrol Agent di atas halaman.
   */
  bolehKelola: boolean;
  /** Sesi belum selesai dibaca — jangan menebak peran pembacanya dulu. */
  menunggu: boolean;
}

const nomorWa = (telepon: string) =>
  telepon.replace(/^0/, "62").replace(/\D/g, "");

export default function KontakSidebar({ data, bolehKelola, menunggu }: Props) {
  const [survei, setSurvei] = useState(false);
  const [penawaran, setPenawaran] = useState(false);
  const [sheet, setSheet] = useState(false);

  // Sheet mengunci scroll halaman di belakangnya — tanpa ini, menggeser di
  // dalam sheet ikut menggerakkan halaman dan sheet terasa "lepas".
  useEffect(() => {
    if (!sheet) return;
    const asal = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = asal;
    };
  }, [sheet]);

  const tersewa = data.statusTayang !== "TERSEDIA";
  const durasi = data.durasiUtama;
  const suffix = durasi ? DURASI_META[durasi].suffix : "";
  const hargaTampil = data.hargaPromo ?? data.harga;

  const ringkasanProperti = [
    data.judul,
    [data.kecamatan, data.kota].filter(Boolean).join(", "),
  ]
    .filter(Boolean)
    .join(" — ");

  const chatWa = () => {
    void trackLeadClick({
      id_property: data.idProperty,
      id_agent: data.agent.idAgent,
      source: "whatsapp",
    });

    // Pesan pembuka sudah membawa properti & harganya. "Halo" kosong memaksa
    // agent bertanya balik "properti yang mana ya?" — satu putaran percakapan
    // yang hilang begitu saja, dan justru di titik paling rawan ditinggalkan.
    const pesan =
      `Halo ${data.agent.nama}, saya tertarik menyewa properti:\n` +
      `*${data.judul}*\n` +
      `📍 ${[data.kecamatan, data.kota].filter(Boolean).join(", ")}\n` +
      (durasi
        ? `💰 ${formatRupiah(hargaTampil)} ${suffix}\n`
        : "") +
      `🔗 Kode ${data.idProperty}\n\n` +
      `Boleh minta informasi lebih lanjut?`;

    window.open(
      `https://wa.me/${nomorWa(data.agent.telepon)}?text=${encodeURIComponent(pesan)}`,
      "_blank",
    );
  };

  // ───────────────────────────────────────────────────────────────────────
  // POTONGAN ISI
  // ───────────────────────────────────────────────────────────────────────

  const renderHarga = () => (
    <div className="px-5 pb-4 pt-5">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-[2rem] font-extrabold leading-none tracking-tight text-white">
          {formatRupiah(hargaTampil)}
        </span>
        {suffix && (
          <span className="text-sm font-bold text-white/40">{suffix}</span>
        )}
      </div>

      {/* Harga sebelum promo — hanya kalau promonya nyata. */}
      {data.hargaPromo != null && data.hargaPromo < data.harga && (
        <div className="mt-1.5 flex items-center gap-2">
          <span className="text-sm font-semibold text-white/30 line-through">
            {formatRupiah(data.harga)}
          </span>
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${AKSEN.mint.chip}`}
          >
            Promo
          </span>
        </div>
      )}

      {/* Kalimat yang menjelaskan MENGAPA tidak ada tombol pesan di sini.
          Tanpa ini, pengunjung yang baru saja melihat halaman kos akan
          mengira panelnya gagal dimuat. */}
      <p className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-white/45">
        <Icon
          icon="solar:hand-shake-bold-duotone"
          className={`mt-px shrink-0 text-sm ${AKSEN.sky.ikon}`}
        />
        <span>
          Harga sewa {durasi ? LABEL_DURASI[durasi] : "properti ini"} masih bisa
          dirundingkan langsung dengan agent.
        </span>
      </p>
    </div>
  );

  const renderSyarat = () => {
    const baris: { label: string; nilai: string; ikon: string }[] = [];

    if (data.minimalSewaJumlah && data.minimalSewaSatuan) {
      baris.push({
        label: "Minimal sewa",
        nilai: `${data.minimalSewaJumlah} ${DURASI_META[data.minimalSewaSatuan].satuan}`,
        ikon: "solar:clock-circle-bold-duotone",
      });
    }
    if (data.deposit != null && data.deposit > 0) {
      baris.push({
        label: "Deposit",
        nilai: formatRupiah(data.deposit),
        ikon: "solar:shield-check-bold-duotone",
      });
    }
    if (data.luasBangunan != null && data.luasBangunan > 0) {
      baris.push({
        label: "Luas bangunan",
        nilai: `${data.luasBangunan.toLocaleString("id-ID")} m²`,
        ikon: "solar:ruler-cross-pen-bold-duotone",
      });
    }

    if (baris.length === 0) return null;

    return (
      <div className={`border-t px-5 py-4 ${LINE.row}`}>
        <div className="space-y-3">
          {baris.map((b) => (
            <div key={b.label} className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 text-xs font-semibold text-white/45">
                <Icon icon={b.ikon} className="text-base text-white/30" />
                {b.label}
              </span>
              <span className="text-sm font-bold text-white">{b.nilai}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderAgent = () => (
    <div className={`border-t px-5 py-4 ${LINE.row}`}>
      <div className="flex items-center gap-3">
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/[0.06]">
          {data.agent.foto ? (
            <Image
              src={data.agent.foto}
              alt={data.agent.nama}
              fill
              sizes="48px"
              className="object-cover"
            />
          ) : (
            <span className="grid h-full w-full place-items-center text-base font-black text-white/50">
              {data.agent.nama.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-white">
            {data.agent.nama}
          </p>
          <p className="truncate text-[11px] font-semibold text-white/40">
            {data.agent.kantor}
          </p>
        </div>
        {data.agent.jumlahClosing > 0 && (
          <span
            className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${AKSEN.mint.chip}`}
          >
            {data.agent.jumlahClosing}× closing
          </span>
        )}
      </div>
    </div>
  );

  const renderAksi = () => {
    if (menunggu) {
      // Rangka diam selama sesi dibaca. Menampilkan tombol dulu lalu
      // menghilangkannya sepersekian detik kemudian jauh lebih mengganggu
      // daripada menunggu sebentar.
      return (
        <div className="px-5 pb-5 pt-4">
          <div className="h-[52px] animate-pulse rounded-2xl bg-white/[0.05]" />
        </div>
      );
    }

    if (bolehKelola) return null;

    if (tersewa) {
      return (
        <div className="px-5 pb-5 pt-4">
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-4 text-center">
            <p className="text-sm font-bold text-white/80">
              Properti ini sudah tersewa
            </p>
            <p className="mt-1 text-[11px] text-white/40">
              Hubungi agent kalau ingin dicarikan yang serupa.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-2.5 px-5 pb-5 pt-4">
        {/* Urutan tombol = urutan kesiapan pembacanya. Yang paling banyak
            ditekan (dan paling ringan konsekuensinya) di atas. */}
        <button
          onClick={chatWa}
          className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-[#86efac] px-4 py-3.5 text-[13px] font-extrabold text-black shadow-[0_10px_30px_-10px_rgba(134,239,172,0.75)] transition-all duration-200 hover:bg-[#a7f3c4] hover:shadow-[0_14px_38px_-10px_rgba(134,239,172,0.9)] active:scale-[0.985] motion-reduce:transition-none"
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/45 to-transparent transition-transform duration-700 group-hover:translate-x-full motion-reduce:hidden"
          />
          <Icon icon="ic:baseline-whatsapp" className="relative text-lg" />
          <span className="relative">Chat agent</span>
        </button>

        <div className="grid grid-cols-2 gap-2.5">
          <button
            onClick={() => setPenawaran(true)}
            className="flex items-center justify-center gap-1.5 rounded-2xl border border-white/[0.12] px-2 py-3.5 text-[11px] font-bold text-white transition-all duration-200 hover:border-white/30 hover:bg-white/[0.06] active:scale-[0.985] motion-reduce:transition-none"
          >
            <Icon
              icon="solar:tag-price-bold-duotone"
              className="shrink-0 text-base"
            />
            Ajukan penawaran
          </button>
          <button
            onClick={() => setSurvei(true)}
            className="flex items-center justify-center gap-1.5 rounded-2xl border border-white/[0.12] px-2 py-3.5 text-[11px] font-bold text-white transition-all duration-200 hover:border-white/30 hover:bg-white/[0.06] active:scale-[0.985] motion-reduce:transition-none"
          >
            <Icon
              icon="solar:calendar-add-bold-duotone"
              className="shrink-0 text-base"
            />
            Jadwalkan survei
          </button>
        </div>
      </div>
    );
  };

  const renderIsi = () => (
    <>
      {renderHarga()}
      {renderSyarat()}
      {renderAgent()}
      {renderAksi()}
      <div
        className={`flex items-center justify-center gap-2 border-t px-5 py-2.5 ${LINE.row}`}
      >
        <Icon
          icon="solar:shield-check-bold"
          className={`text-sm ${AKSEN.mint.ikon}`}
        />
        <span className="text-[10px] font-bold uppercase tracking-wider text-white/35">
          Agent terverifikasi Solusindo
        </span>
      </div>
    </>
  );

  // ───────────────────────────────────────────────────────────────────────
  // RENDER
  // ───────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ══════════ DESKTOP ══════════ */}
      <aside className="sticky top-[88px] hidden w-[360px] shrink-0 self-start lg:block">
        <div
          className="relative rounded-[1.75rem] p-px"
          style={{
            background:
              "linear-gradient(160deg, rgba(255,255,255,0.14), rgba(255,255,255,0.03) 38%, rgba(134,239,172,0.10))",
            boxShadow: KILAU_PANEL,
          }}
        >
          <div
            className="relative overflow-hidden rounded-[calc(1.75rem-1px)] backdrop-blur-xl"
            style={{ background: SURFACE.panel }}
          >
            {renderIsi()}
          </div>
        </div>
      </aside>

      {/* ══════════ PONSEL — BILAH BAWAH ══════════
          Ditempelkan ke tepi bawah layar, bukan ke dasar halaman: keputusan
          "hubungi" bisa muncul kapan saja saat membaca, dan menyuruh orang
          menggulir kembali untuk menemukan tombolnya adalah cara termudah
          kehilangan dia. */}
      {!bolehKelola && (
        <div
          className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.07] px-4 py-3 backdrop-blur-xl lg:hidden"
          style={{
            background: "rgba(12,16,23,0.92)",
            paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))",
          }}
        >
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-extrabold leading-tight text-white">
                {formatRupiah(hargaTampil)}
                {suffix && (
                  <span className="ml-1 text-xs font-bold text-white/40">
                    {suffix}
                  </span>
                )}
              </p>
              <p className="truncate text-[10px] font-bold uppercase tracking-wider text-white/35">
                {tersewa ? "Tersewa" : "Harga bisa dirundingkan"}
              </p>
            </div>
            <button
              onClick={() => setSheet(true)}
              className="shrink-0 rounded-2xl bg-[#86efac] px-5 py-3 text-[13px] font-extrabold text-black shadow-[0_10px_30px_-10px_rgba(134,239,172,0.75)] transition-all active:scale-95"
            >
              Hubungi agent
            </button>
          </div>
        </div>
      )}

      {/* ══════════ PONSEL — SHEET ══════════
          Isinya persis sama dengan panel desktop, lewat renderIsi() yang sama.
          Dua salinan markup yang "harusnya sama" selalu berakhir berbeda. */}
      {sheet && (
        <div className="fixed inset-0 z-50 flex items-end lg:hidden">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setSheet(false)}
            aria-hidden
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Hubungi agent"
            className="relative max-h-[85vh] w-full overflow-y-auto rounded-t-[1.75rem] border-t border-white/[0.08]"
            style={{ background: SURFACE.panel }}
          >
            <div className="sticky top-0 z-10 flex justify-center py-2.5 backdrop-blur-xl">
              <button
                onClick={() => setSheet(false)}
                aria-label="Tutup"
                className="h-1.5 w-10 rounded-full bg-white/20"
              />
            </div>
            {renderIsi()}
          </div>
        </div>
      )}

      <SurveiModal
        buka={survei}
        onTutup={() => setSurvei(false)}
        idProperty={data.idProperty}
        idAgent={data.agent.idAgent}
        namaAgent={data.agent.nama}
        teleponAgent={data.agent.telepon}
        judulProperti={ringkasanProperti}
      />

      <PenawaranSewaModal
        buka={penawaran}
        onTutup={() => setPenawaran(false)}
        idProperty={data.idProperty}
        idAgent={data.agent.idAgent}
        namaAgent={data.agent.nama}
        teleponAgent={data.agent.telepon}
        judulProperti={data.judul}
        hargaListing={hargaTampil}
        durasi={durasi}
      />
    </>
  );
}
