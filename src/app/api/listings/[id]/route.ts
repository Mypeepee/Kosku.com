import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions';
import { bersihkanTipeKamar, type KamarTipe } from '@/lib/kosRoomTypes';
import {
  kalimatDurasiDiizinkan,
  pesanDurasiTidakSah,
} from '@/lib/sewaKapabilitas';
import {
  buildSewaDetailData,
  normalisasiSewaTulis,
  toKamarTipeRow,
} from '../_lib/sewa-write';
import { hitungUlangKamarTersedia } from '../_lib/sewa-availability-write';
import { buatSlugListing, buatSlugUnik } from '@/lib/listingSlug';

// Helper untuk konversi BigInt → string
function serializeBigInt<T>(data: T): T {
  return JSON.parse(
    JSON.stringify(data, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    )
  );
}

/**
 * Pastikan pemanggil adalah agent PEMILIK listing ini.
 *
 * GET boleh publik (halaman detail memakainya), tapi PUT & DELETE mengubah
 * atau menghapus data — tanpa penjagaan ini siapa pun yang tahu id_property
 * bisa menyunting atau menghapus listing agent lain hanya dengan satu request.
 * Peran di sistem ini cuma USER & AGENT (tidak ada admin), jadi aturannya
 * sesederhana: yang boleh mengubah hanya agent yang memilikinya.
 */
async function pastikanPemilik(id: number) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const agentId = (session.user as any).agentId as string | null | undefined;
  if (!agentId) {
    return {
      error: NextResponse.json(
        { error: 'Akun ini bukan agent' },
        { status: 403 }
      ),
    };
  }

  const existing = await prisma.listing.findUnique({
    where: { id_property: id },
  });
  if (!existing) {
    return {
      error: NextResponse.json({ error: 'Listing not found' }, { status: 404 }),
    };
  }
  if (existing.id_agent !== agentId) {
    return {
      error: NextResponse.json(
        { error: 'Listing ini bukan milik Anda' },
        { status: 403 }
      ),
    };
  }

  return { existing };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);

    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid listing ID' },
        { status: 400 }
      );
    }

    const listing = await prisma.listing.findUnique({
      where: { id_property: id },
      include: {
        agent: {
          include: {
            pengguna: {
              select: {
                nama_lengkap: true,
                email: true,
                nomor_telepon: true,
              },
            },
          },
        },
        sewaDetail: true,
        // Urut sesuai susunan agent — form edit harus menampilkannya sama
        // seperti saat disimpan.
        kamarTipe: { orderBy: { urutan: 'asc' } },
      },
    });

    if (!listing) {
      return NextResponse.json(
        { error: 'Listing not found' },
        { status: 404 }
      );
    }

    // Increment view count
    await prisma.listing.update({
      where: { id_property: id },
      data: { dilihat: { increment: 1 } },
    });

    return NextResponse.json({
      success: true,
      data: serializeBigInt(listing),
    });
  } catch (error) {
    console.error('Error fetching listing:', error);
    return NextResponse.json(
      { error: 'Failed to fetch listing' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    const body = await request.json();

    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid listing ID' },
        { status: 400 }
      );
    }

    const izin = await pastikanPemilik(id);
    if (izin.error) return izin.error;
    const existing = izin.existing!;

    // TENTUKAN harga sesuai jenis_transaksi (tidak boleh null)
    const jenisTransaksi = body.jenis_transaksi as
      | 'PRIMARY'
      | 'SECONDARY'
      | 'LELANG'
      | 'SEWA';

    // Kategori KOS hanya sah untuk SEWA — detail kosnya hidup di
    // listing_sewa_detail, yang hanya dibuat untuk transaksi SEWA. Penjaga
    // yang sama ada di POST; keduanya wajib, karena sebuah listing bisa
    // dipindahkan kategorinya lewat edit tanpa pernah melewati create.
    if (body.kategori === 'KOS' && jenisTransaksi !== 'SEWA') {
      return NextResponse.json(
        { error: 'Kategori KOS hanya berlaku untuk transaksi SEWA' },
        { status: 400 }
      );
    }

    // Tipe kamar kos — dibersihkan & dihitung ulang di server, sama seperti
    // saat create. Daftar kosong = kembali ke mode "semua kamar sama", dan
    // baris tipe yang lama harus ikut terhapus (lihat deleteMany di bawah).
    const kamarTipe: KamarTipe[] =
      body.kategori === 'KOS' ? bersihkanTipeKamar(body.kamar_tipe) : [];
    const pakaiTipeKamar = kamarTipe.length > 0;

    /**
     * Durasi & harga sewa disaring terhadap kategori BARU, bukan kategori lama.
     *
     * Inilah jalur yang paling rawan di seluruh sistem: sebuah listing bisa
     * dipindah kategorinya lewat edit tanpa pernah melewati create. Kos yang
     * diubah jadi Gudang membawa serta harga harian & mingguannya, dan tanpa
     * penyaringan di sini keduanya akan tersimpan rapi di baris yang kategorinya
     * sudah tidak mengenal durasi itu.
     */
    const sewa =
      jenisTransaksi === 'SEWA'
        ? normalisasiSewaTulis(body, body.kategori, kamarTipe)
        : null;
    const durasiSewa = sewa?.durasiUtama ?? null;

    let harga: number;

    if (jenisTransaksi === 'LELANG') {
      // Untuk lelang, harga = nilai_limit_lelang
      harga = Number(body.nilai_limit_lelang || 0);
    } else if (sewa) {
      // SEWA: harga listing = harga pada durasi utama yang sudah lolos aturan
      // kategori (kos bertipe kamar: harga termurah antar tipe).
      harga = Number(sewa.hargaUtama || 0);
    } else {
      harga = Number(body.harga || 0);
    }

    if (!harga || harga <= 0) {
      return NextResponse.json(
        {
          error:
            jenisTransaksi === 'LELANG'
              ? 'Nilai limit lelang wajib diisi dan > 0'
              : sewa && sewa.dibuang.length > 0
              ? `${pesanDurasiTidakSah(body.kategori)} Isi harga ${kalimatDurasiDiizinkan(body.kategori)}.`
              : 'Harga wajib diisi dan > 0',
        },
        { status: 400 }
      );
    }

    const sewaDetailData = buildSewaDetailData(body, body.kategori, kamarTipe);

    // Slug wajib unik (ada unique index di DB). Tanpa penjaga ini, mengganti
    // judul jadi mirip listing lain menabrak constraint dan agent cuma dapat
    // pesan "Failed to update listing" — pekerjaannya hilang tanpa penjelasan.
    // Baris milik listing ini sendiri tentu tidak dihitung tabrakan.
    const dasarSlug = buatSlugListing({
      judul: body.judul || existing.judul,
      kategori: body.kategori || existing.kategori,
      kecamatan: body.kecamatan ?? existing.kecamatan,
      kota: body.kota || existing.kota,
      alamat: body.alamat_lengkap ?? existing.alamat_lengkap,
    });

    // Slug lama DIPERTAHANKAN kalau ia cuma varian tabrakan dari dasar yang
    // sama ("kos-putri-surabaya-2" vs "kos-putri-surabaya").
    //
    // Tanpa penjaga ini, setiap penyuntingan yang tidak menyentuh judul pun
    // akan menarik slug kembali ke bentuk dasarnya — URL listing berubah,
    // Google harus mengindeks ulang, dan link yang sudah tersebar di WhatsApp
    // ikut berpindah. Semuanya demi perubahan yang tidak diminta siapa pun.
    const varianDariDasar =
      existing.slug === dasarSlug ||
      new RegExp(`^${dasarSlug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-\\d+$`).test(
        existing.slug,
      );

    const slug = varianDariDasar
      ? existing.slug
      : await buatSlugUnik(
          dasarSlug,
          async (kandidat) =>
            (await prisma.listing.count({
              where: { slug: kandidat, id_property: { not: BigInt(id) } },
            })) > 0,
        );

    // Listing yang pindah dari SEWA ke jual/lelang meninggalkan baris
    // listing_sewa_detail yang tidak lagi punya arti. Kalau dibiarkan, suatu
    // saat listing itu dikembalikan ke SEWA dan langsung mewarisi harga sewa,
    // gender kos, dan sisa kamar milik data lama. Dibersihkan eksplisit —
    // deleteMany (bukan delete) supaya aman walau barisnya memang tidak ada.
    if (jenisTransaksi !== 'SEWA') {
      await prisma.listingSewaDetail.deleteMany({ where: { id_property: id } });
    }

    /**
     * Selamatkan kalender ketersediaan dari penulisan ulang tipe kamar.
     *
     * Tipe kamar diganti utuh di bawah (`deleteMany` lalu `create`), dan
     * `listing_ketersediaan.id_tipe` ber-`ON DELETE CASCADE` — artinya tanpa
     * langkah ini, agent yang cuma memperbaiki typo di judul akan kehilangan
     * SELURUH periode blokir tipe kamarnya, tanpa peringatan apa pun.
     *
     * Dipetakan lewat NAMA tipe, bukan id: id-nya memang lahir baru setiap
     * penyimpanan, sedangkan nama adalah identitas yang dipakai agent sendiri
     * ("Standard", "Kamar Mandi Dalam"). Tipe yang namanya benar-benar hilang
     * dari form berarti tipe itu dihapus, dan bloknya memang harus ikut hilang.
     */
    const blokTipeSebelum = pakaiTipeKamar
      ? await prisma.listingKetersediaan.findMany({
          where: { id_property: BigInt(id), id_tipe: { not: null } },
          select: {
            tanggal_mulai: true,
            tanggal_selesai: true,
            jumlah_kamar: true,
            alasan: true,
            catatan: true,
            dibuat_oleh: true,
            dibuat_pada: true,
            tipe: { select: { nama: true } },
          },
        })
      : [];

    // Update listing + pilih field yang dibutuhkan untuk redirect
    const updated = await prisma.listing.update({
      where: { id_property: id },
      data: {
        judul: body.judul,
        slug,
        deskripsi: body.deskripsi,
        jenis_transaksi: jenisTransaksi,
        kategori: body.kategori,
        vendor: body.vendor,
        status_tayang: body.status_tayang,
        harga,
        harga_promo: body.harga_promo,
        tanggal_lelang: body.tanggal_lelang
          ? new Date(body.tanggal_lelang)
          : null,
        uang_jaminan: body.uang_jaminan,
        nilai_limit_lelang: body.nilai_limit_lelang,
        link: body.link,
        alamat_lengkap: body.alamat_lengkap,
        provinsi: body.provinsi,
        kota: body.kota,
        kecamatan: body.kecamatan,
        kelurahan: body.kelurahan,
        latitude: body.latitude,
        longitude: body.longitude,
        akses_terdekat: Array.isArray(body.akses_terdekat)
          ? body.akses_terdekat
          : undefined,
        luas_tanah: body.luas_tanah,
        luas_bangunan: body.luas_bangunan,
        jumlah_lantai: body.jumlah_lantai,
        kamar_tidur: body.kamar_tidur,
        kamar_mandi: body.kamar_mandi,
        daya_listrik: body.daya_listrik,
        sumber_air: body.sumber_air,
        hadap_bangunan: body.hadap_bangunan,
        kondisi_interior: body.kondisi_interior,
        legalitas: body.legalitas,
        nomor_legalitas: body.nomor_legalitas,
        gambar: body.gambar,
        lampiran: body.lampiran,
        is_hot_deal: body.is_hot_deal,
        tanggal_diupdate: new Date(),
        ...(jenisTransaksi === 'SEWA' && {
          sewaDetail: {
            upsert: {
              create: sewaDetailData,
              update: sewaDetailData,
            },
          },
        }),
        // Tipe kamar diganti utuh (hapus lalu tulis ulang), bukan di-diff per
        // baris. Baris tipe tidak dirujuk tabel lain — tidak ada booking atau
        // transaksi yang menempel padanya — jadi tidak ada yang hilang, dan
        // urutan yang disusun agent tetap persis seperti di form. Daftar
        // kosong berarti listing kembali ke mode "semua kamar sama".
        kamarTipe: {
          deleteMany: {},
          ...(pakaiTipeKamar && { create: kamarTipe.map(toKamarTipeRow) }),
        },
      },
      select: {
        id_property: true,
        slug: true,
        jenis_transaksi: true,
        id_agent: true,
        kamarTipe: { select: { id: true, nama: true } },
        // kalau perlu field lain bisa tambahkan di sini
      },
    });

    // Kembalikan blok ke tipe bernama sama, lalu segarkan kolom turunan.
    //
    // Sengaja di luar update di atas dan dibungkus try sendiri: listing-nya
    // sudah tersimpan, dan menggagalkan seluruh permintaan karena pemulihan
    // kalender bermasalah akan membuat agent kehilangan suntingan yang justru
    // sudah berhasil. Kegagalannya dicatat keras supaya tidak lewat diam-diam.
    try {
      if (blokTipeSebelum.length > 0) {
        const idPerNama = new Map(
          updated.kamarTipe.map((t) => [t.nama, t.id] as const),
        );

        const dipulihkan = blokTipeSebelum
          .map((b) => {
            const idBaru = b.tipe ? idPerNama.get(b.tipe.nama) : undefined;
            if (!idBaru) return null;
            return {
              id_property: BigInt(id),
              id_tipe: idBaru,
              tanggal_mulai: b.tanggal_mulai,
              tanggal_selesai: b.tanggal_selesai,
              jumlah_kamar: b.jumlah_kamar,
              alasan: b.alasan,
              catatan: b.catatan,
              dibuat_oleh: b.dibuat_oleh,
              dibuat_pada: b.dibuat_pada,
            };
          })
          .filter((b): b is NonNullable<typeof b> => b !== null);

        if (dipulihkan.length > 0) {
          await prisma.listingKetersediaan.createMany({ data: dipulihkan });
        }

        const hilang = blokTipeSebelum.length - dipulihkan.length;
        if (hilang > 0) {
          console.info(
            `[listing-edit] #${id}: ${hilang} blok ketersediaan ikut terhapus bersama tipe kamarnya.`,
          );
        }
      }

      // Kapasitas tipe bisa saja berubah di form ini, jadi sisa kamar wajib
      // dihitung ulang — juga untuk listing yang tipenya baru saja dihapus
      // seluruhnya.
      if (jenisTransaksi === 'SEWA') {
        await hitungUlangKamarTersedia(prisma, BigInt(id));
      }
    } catch (e) {
      console.error(
        `⚠️ Gagal memulihkan ketersediaan listing #${id} setelah edit:`,
        e,
      );
    }

    /**
     * Buang cache "apa yang ada di sekitar" bila titiknya berubah.
     *
     * Tanpa ini, agent yang menggeser pin atau membetulkan alamat tetap
     * mendapat daftar warung & sekolah milik titik LAMA — selamanya, karena
     * baris cache-nya hanya dikunci id_property dan tidak pernah tahu
     * lokasinya sudah pindah. Salah yang tidak akan pernah ketahuan sendiri.
     *
     * Alamat ikut diperiksa karena listing tanpa koordinat memakai titik hasil
     * geocode alamatnya; alamat berubah = titik itu tidak lagi berlaku.
     *
     * Sengaja HANYA MENGHAPUS, tidak memindai ulang di sini: pemindaian
     * berikutnya terjadi saat halamannya dibuka, dan kalau titik barunya sudah
     * ada di cache titik (mis. baru saja dipindai agent di form) biayanya nol.
     */
    try {
      const angka = (v: unknown) => (v == null ? null : Number(v));
      const pindahTitik =
        angka(existing.latitude) !== angka(body.latitude) ||
        angka(existing.longitude) !== angka(body.longitude);
      const pindahAlamat =
        (existing.alamat_lengkap ?? null) !== (body.alamat_lengkap ?? null) ||
        (existing.kelurahan ?? null) !== (body.kelurahan ?? null) ||
        (existing.kecamatan ?? null) !== (body.kecamatan ?? null) ||
        (existing.kota ?? null) !== (body.kota ?? null);

      if (pindahTitik || pindahAlamat) {
        await prisma.listingSekitar.deleteMany({
          where: { id_property: BigInt(id) },
        });
      }
    } catch (e) {
      // Tabelnya boleh belum ada (migrasinya manual per environment) — dan
      // gagal membuang cache bukan alasan menggagalkan suntingan yang sudah
      // tersimpan.
      console.warn(`[listing-edit] #${id}: gagal membuang cache sekitar:`, e);
    }

    return NextResponse.json({
      success: true,
      data: serializeBigInt(updated),
      message: 'Listing berhasil diupdate',
    });
  } catch (error) {
    console.error('Error updating listing:', error);
    return NextResponse.json(
      { error: 'Failed to update listing' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);

    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid listing ID' },
        { status: 400 }
      );
    }

    const izin = await pastikanPemilik(id);
    if (izin.error) return izin.error;

    // Delete listing
    await prisma.listing.delete({
      where: { id_property: id },
    });

    return NextResponse.json({
      success: true,
      message: 'Listing berhasil dihapus',
    });
  } catch (error) {
    console.error('Error deleting listing:', error);
    return NextResponse.json(
      { error: 'Failed to delete listing', },
      { status: 500 }
    );
  }
}
