// src/app/asisten/kirim/page.tsx
// ---------------------------------------------------------------------------
// HALAMAN ANTARA: dari tombol di email menuju WhatsApp.
//
// ── KENAPA ADA HALAMAN INI, PADAHAL IA MENAMBAH SATU KETUKAN ─────────────
// Versi pertama membiarkan tombol email menunjuk langsung ke sebuah GET yang
// MENCATAT kiriman lalu mengalihkan ke wa.me. Satu ketukan, dan salah.
//
// Gerbang keamanan email — Outlook Safe Links, Proofpoint, Mimecast, dan
// hampir semua gateway korporat — MENGAMBIL setiap tautan di dalam email untuk
// dipindai, tanpa ada manusia yang mengetuk apa pun. Setiap pengambilan itu
// akan mencatat sebuah kiriman yang tidak pernah terjadi. Akibatnya bukan
// sekadar angka yang meleset: aset yang tercatat terkirim LENYAP dari daftar
// "Cocok" (memang begitu perilakunya, dan itu benar), sehingga agent tidak
// akan pernah mengirimkannya. Kerusakan senyap — tidak ada galat, tidak ada
// keluhan, hanya aset yang menguap.
//
// Aturan lamanya sederhana dan berlaku di sini: GET tidak boleh mengubah
// keadaan. Pencatatannya dipindah ke POST, dan pemindai tidak mengirimkan
// formulir.
//
// Ketukan tambahannya pun bukan murni ongkos: halaman ini menampilkan apa yang
// akan dikirim ke siapa, tepat sebelum dikirim — kesempatan terakhir menyadari
// bahwa aset ini ternyata untuk klien yang lain.
// ---------------------------------------------------------------------------

import { prisma } from "@/lib/prisma";
import { bacaTiket } from "@/lib/asistenToken";
import { hargaEfektif, fotoPertama } from "@/lib/klienMatch";
import { rapikanAlamat } from "@/lib/klienRingkas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const rupiah = (n: number) => `Rp ${Math.round(n).toLocaleString("id-ID")}`;

function Bingkai({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#000510] px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-white/[0.08] bg-[#05160e] p-6 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)]">
        {children}
      </div>
    </main>
  );
}

export default async function Halaman({
  searchParams,
}: {
  searchParams: { t?: string };
}) {
  const isi = bacaTiket(searchParams.t);

  if (!isi) {
    return (
      <Bingkai>
        <h1 className="text-lg font-extrabold text-white">Tautan sudah tidak berlaku</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-[#a7c7b9]">
          Tautan dari email hanya berlaku tujuh hari. Buka daftar asetnya langsung di CRM —
          isinya selalu yang terbaru.
        </p>
        <a
          href="/dashboard/crm"
          className="mt-5 block rounded-xl bg-[#99e39e] py-3 text-center text-[14px] font-extrabold text-[#03130c]"
        >
          Buka CRM
        </a>
      </Bingkai>
    );
  }

  /* Klien DAN agent diperiksa bersama: tiket berumur seminggu bisa mengalami
     klien yang keburu dihapus atau agent yang dinonaktifkan. */
  const [klien, aset] = await Promise.all([
    prisma.klien.findFirst({
      where: { id_klien: isi.k, id_agent: isi.a },
      select: { nama: true, nomor_whatsapp: true },
    }),
    prisma.listing.findMany({
      where: { id_property: { in: isi.p.map(BigInt) }, status_tayang: "TERSEDIA" },
      select: {
        id_property: true, judul: true, gambar: true, kota: true, kecamatan: true,
        alamat_lengkap: true, harga: true, harga_promo: true, harga_efektif: true,
        nilai_limit_lelang: true, jenis_transaksi: true,
      },
    }),
  ]);

  if (!klien || aset.length === 0) {
    return (
      <Bingkai>
        <h1 className="text-lg font-extrabold text-white">Asetnya sudah tidak tersedia</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-[#a7c7b9]">
          Aset di email ini sudah terjual atau ditarik sejak emailnya dikirim. Buka CRM untuk
          melihat aset lain yang cocok — daftarnya sudah diperbarui.
        </p>
        <a
          href={`/dashboard/crm${klien ? `?klien=${encodeURIComponent(isi.k)}` : ""}`}
          className="mt-5 block rounded-xl bg-[#99e39e] py-3 text-center text-[14px] font-extrabold text-[#03130c]"
        >
          Buka CRM
        </a>
      </Bingkai>
    );
  }

  const nama = klien.nama.split(/\s+/)[0];

  return (
    <Bingkai>
      <p className="text-[10px] font-extrabold uppercase tracking-[2px] text-[#99e39e]">
        Asisten Aset
      </p>
      <h1 className="mt-2 text-[19px] font-extrabold leading-snug text-[#eaf6ef]">
        Kirim {aset.length} aset ke {klien.nama}?
      </h1>
      <p className="mt-2 text-[12.5px] leading-relaxed text-[#a7c7b9]">
        WhatsApp akan terbuka dengan pesannya sudah tersusun. Anda tetap yang menekan kirim di sana.
      </p>

      <ul className="mt-4 space-y-2">
        {aset.map((l) => {
          const foto = fotoPertama(l.gambar);
          return (
            <li
              key={l.id_property.toString()}
              className="flex gap-3 rounded-2xl border border-[#1c5640] bg-[#0a2117] p-2.5"
            >
              {foto ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={`/api/foto/${l.id_property}?w=118`}
                  alt=""
                  className="h-[58px] w-[58px] shrink-0 rounded-lg object-cover"
                />
              ) : null}
              <div className="min-w-0">
                <p className="line-clamp-2 text-[12px] font-bold leading-snug text-[#eaf6ef]">
                  {l.judul}
                </p>
                <p className="mt-1 text-[13px] font-extrabold text-[#99e39e]">
                  {rupiah(hargaEfektif(l))}
                </p>
                <p className="mt-0.5 line-clamp-1 text-[11px] text-[#7c9a8c]">
                  {rapikanAlamat(l.alamat_lengkap) ||
                    [rapikanAlamat(l.kecamatan), rapikanAlamat(l.kota)].filter(Boolean).join(", ")}
                </p>
              </div>
            </li>
          );
        })}
      </ul>

      {/* POST, bukan tautan. Inilah seluruh alasan halaman ini ada: pemindai
          keamanan email mengambil tautan, tapi tidak mengirimkan formulir. */}
      <form action="/api/asisten/kirim" method="POST" className="mt-5">
        <input type="hidden" name="t" value={searchParams.t ?? ""} />
        <button
          type="submit"
          className="w-full rounded-xl bg-[#99e39e] py-3.5 text-[15px] font-extrabold text-[#03130c] transition-opacity hover:opacity-90"
        >
          {klien.nomor_whatsapp ? `Buka WhatsApp ke ${nama}` : "Catat & buka di CRM"}
        </button>
      </form>

      <a
        href={`/dashboard/crm?klien=${encodeURIComponent(isi.k)}`}
        className="mt-3 block text-center text-[12px] font-semibold text-[#7c9a8c] hover:text-[#a7c7b9]"
      >
        Lihat semua aset untuk {nama} di CRM
      </a>
    </Bingkai>
  );
}
