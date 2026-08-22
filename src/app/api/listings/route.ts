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
} from './_lib/sewa-write';
import { semaiBlokAwal } from './_lib/sewa-availability-write';
import { buatSlugListing, buatSlugUnik } from '@/lib/listingSlug';

// Helper: konversi BigInt ke string
const serializeBigInt = (obj: any): any =>
  JSON.parse(
    JSON.stringify(obj, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    )
  );

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    const agentId = (session.user as any).agentId;
    if (!agentId) {
      return NextResponse.json(
        { error: 'User is not an agent or agentId missing in session' },
        { status: 400 }
      );
    }

    // Fetch agent + nama_kantor
    const agent = await prisma.agent.findUnique({
      where: { id_agent: agentId },
      select: {
        id_agent: true,
        nama_kantor: true,
        pengguna: {
          select: {
            nama_lengkap: true,
            email: true,
          },
        },
      },
    });

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // Basic validation
    if (
      !body.judul ||
      !body.slug ||
      !body.kota ||
      !body.jenis_transaksi ||
      !body.kategori
    ) {
      return NextResponse.json(
        {
          error:
            'Missing required fields (judul, slug, kota, jenis_transaksi, kategori)',
        },
        { status: 400 }
      );
    }

    const jenis_transaksi = body.jenis_transaksi as
      | 'PRIMARY'
      | 'SECONDARY'
      | 'LELANG'
      | 'SEWA';
    const kategori = body.kategori as
      | 'RUMAH'
      | 'APARTEMEN'
      | 'RUKO'
      | 'TANAH'
      | 'GUDANG'
      | 'HOTEL_DAN_VILLA'
      | 'TOKO'
      | 'PABRIK'
      | 'KOS';

    // Tipe kamar kos. Daftar dari klien dibersihkan dulu (baris tanpa nama /
    // tanpa harga dibuang, sisa kamar di-clamp) karena semua angka agregat di
    // bawah dihitung ULANG dari daftar ini — angka kiriman klien tidak dipakai.
    const kamarTipe: KamarTipe[] =
      kategori === 'KOS' ? bersihkanTipeKamar(body.kamar_tipe) : [];
    const pakaiTipeKamar = kamarTipe.length > 0;
    // Durasi & harga sewa dinormalkan terhadap kategori: durasi yang tidak sah
    // untuk kategori ini dibuang, dan durasi utama dipilih ulang dari yang
    // tersisa. Satu fungsi yang sama dipakai buildSewaDetailData di bawah, jadi
    // `Listing.harga` dan `listing_sewa_detail` mustahil menunjuk durasi yang
    // berbeda. Durasi utama juga boleh tidak dikirim klien saat pakai tipe
    // kamar — ia disimpulkan dari harga tiap tipe.
    const sewa =
      jenis_transaksi === 'SEWA'
        ? normalisasiSewaTulis(body, kategori, kamarTipe)
        : null;
    const durasiSewa: string | null = sewa?.durasiUtama ?? null;

    // Kategori KOS hanya sah untuk transaksi SEWA. Seluruh detail kos
    // (tipe kamar, sisa kamar, gender, harga per durasi) disimpan di
    // listing_sewa_detail, dan baris itu hanya dibuat untuk SEWA — kombinasi
    // lain akan tersimpan sebagai listing kos tanpa satupun detail kosnya.
    // Form sudah menyembunyikan pilihannya; ini penjaga untuk kiriman langsung.
    if (kategori === 'KOS' && jenis_transaksi !== 'SEWA') {
      return NextResponse.json(
        { error: 'Kategori KOS hanya berlaku untuk transaksi SEWA' },
        { status: 400 }
      );
    }

    // Conditional validation
    if (jenis_transaksi === 'LELANG') {
      if (!body.nilai_limit_lelang || Number(body.nilai_limit_lelang) <= 0) {
        return NextResponse.json(
          { error: 'Nilai limit lelang wajib diisi untuk tipe LELANG' },
          { status: 400 }
        );
      }
      if (!body.uang_jaminan || Number(body.uang_jaminan) <= 0) {
        return NextResponse.json(
          { error: 'Uang jaminan wajib diisi untuk tipe LELANG' },
          { status: 400 }
        );
      }
      if (!body.tanggal_lelang) {
        return NextResponse.json(
          { error: 'Tanggal lelang wajib diisi untuk tipe LELANG' },
          { status: 400 }
        );
      }
    } else {
      // SEWA: harga listing SELALU turunan dari harga per durasi yang lolos
      // aturan kategori — bukan `body.harga`, yang bisa saja masih memegang
      // angka dari durasi yang barusan dibuang. Kos bertipe kamar: angkanya
      // harga termurah antar tipe.
      const hargaEfektif = sewa ? sewa.hargaUtama : body.harga;
      if (hargaEfektif == null || Number(hargaEfektif) <= 0) {
        return NextResponse.json(
          { error: 'Harga wajib diisi untuk tipe non-LELANG' },
          { status: 400 }
        );
      }
    }

    if (jenis_transaksi === 'SEWA' && sewa) {
      // Harga yang dihitung SETELAH penyaringan kategori. Gudang yang hanya
      // mengirim harga harian sampai di sini tanpa satu pun durasi tersisa —
      // dan pesannya menyebut durasi mana yang sebenarnya boleh, bukan sekadar
      // "harga wajib diisi".
      if (!durasiSewa) {
        return NextResponse.json(
          {
            error:
              sewa.dibuang.length > 0
                ? `${pesanDurasiTidakSah(kategori)} Isi harga ${kalimatDurasiDiizinkan(kategori)}.`
                : `Isi minimal 1 harga sewa berdasarkan durasi (${kalimatDurasiDiizinkan(kategori)})`,
          },
          { status: 400 }
        );
      }
      if (kategori === 'KOS' && !body.kos_gender) {
        return NextResponse.json(
          { error: 'Gender kos wajib diisi untuk kategori Kos' },
          { status: 400 }
        );
      }
    }

    // Set harga. Kos bertipe kamar → harga termurah pada durasi utama, supaya
    // sort & filter harga generik tetap menemukan kos yang tipe termurahnya
    // masuk anggaran pencari.
    const harga =
      jenis_transaksi === 'LELANG'
        ? Number(body.nilai_limit_lelang)
        : Number(sewa ? sewa.hargaUtama ?? 0 : body.harga);

    // Auto vendor
    const vendor =
      jenis_transaksi === 'LELANG'
        ? `Balai Lelang Solusindo - ${agent.pengguna.nama_lengkap}`
        : `${agent.nama_kantor || 'Premier'} - ${agent.pengguna.nama_lengkap}`;

    // Field khusus lelang
    let uangJaminan: number | null = null;
    let tanggalLelang: Date | null = null;
    let nilaiLimitLelang: number | null = null;

    if (jenis_transaksi === 'LELANG') {
      nilaiLimitLelang = Number(body.nilai_limit_lelang);
      uangJaminan = Number(body.uang_jaminan);

      if (body.tanggal_lelang) {
        tanggalLelang = new Date(body.tanggal_lelang);
      } else {
        const defaultDate = new Date();
        defaultDate.setDate(defaultDate.getDate() + 30);
        tanggalLelang = defaultDate;
      }
    }

    // Slug SEO — DISUSUN dari kategori + judul + lokasi, bukan disalin mentah
    // dari judul. Lihat alasan lengkapnya di @/lib/listingSlug.
    //
    // `body.slug` kiriman klien sengaja DIABAIKAN. Slug adalah alamat publik
    // yang menentukan bagaimana listing ini ditemukan di Google; membiarkannya
    // ditentukan ketikan bebas adalah persis yang menghasilkan URL seperti
    // /Sewa/nnfrscdsvsvgs-mij10k-iactg-122317. Judulnya sendiri tetap milik
    // agent sepenuhnya — yang diambil alih hanya alamatnya.
    const uniqueSlug = await buatSlugUnik(
      buatSlugListing({
        judul: body.judul,
        kategori,
        kecamatan: body.kecamatan,
        kota: body.kota,
        alamat: body.alamat_lengkap,
      }),
      async (kandidat) =>
        (await prisma.listing.count({ where: { slug: kandidat } })) > 0,
    );

    // Create listing
    const listing = await prisma.listing.create({
      data: {
        id_agent: agent.id_agent,
        judul: body.judul,
        slug: uniqueSlug,
        deskripsi: body.deskripsi || null,
        jenis_transaksi,
        kategori,
        vendor,
        status_tayang: body.status_tayang || 'TERSEDIA',
        harga,
        harga_promo:
          jenis_transaksi !== 'LELANG' && body.harga_promo != null
            ? Number(body.harga_promo)
            : null,
        tanggal_lelang: tanggalLelang,
        uang_jaminan: uangJaminan,
        nilai_limit_lelang: nilaiLimitLelang,
        link: body.link || null,
        alamat_lengkap: body.alamat_lengkap || null,
        provinsi: body.provinsi || null,
        kota: body.kota,
        kecamatan: body.kecamatan || null,
        kelurahan: body.kelurahan || null,
        latitude: body.latitude != null ? Number(body.latitude) : null,
        longitude: body.longitude != null ? Number(body.longitude) : null,
        akses_terdekat:
          Array.isArray(body.akses_terdekat) && body.akses_terdekat.length > 0
            ? body.akses_terdekat
            : undefined,
        luas_tanah:
          body.luas_tanah != null ? Number(body.luas_tanah) : null,
        luas_bangunan:
          body.luas_bangunan != null ? Number(body.luas_bangunan) : null,
        jumlah_lantai: body.jumlah_lantai || 1,
        kamar_tidur: body.kamar_tidur ?? null,
        kamar_mandi: body.kamar_mandi ?? null,
        daya_listrik: body.daya_listrik ?? null,
        sumber_air: body.sumber_air || null,
        hadap_bangunan: body.hadap_bangunan || null,
        kondisi_interior: body.kondisi_interior || null,
        legalitas: body.legalitas || null,
        nomor_legalitas: body.nomor_legalitas || null,
        gambar: body.gambar || null,
        lampiran: body.lampiran || null,
        is_hot_deal: body.is_hot_deal || false,
        ...(jenis_transaksi === 'SEWA' && {
          sewaDetail: { create: buildSewaDetailData(body, kategori, kamarTipe) },
        }),
        ...(pakaiTipeKamar && {
          kamarTipe: { create: kamarTipe.map(toKamarTipeRow) },
        }),
      },
      include: { sewaDetail: true, kamarTipe: { orderBy: { urutan: 'asc' } } },
    });

    console.log('✅ Listing created:', listing.id_property.toString());

    // Terjemahkan "kamar kosong sekarang" dari wizard jadi blok awal di
    // kalender ketersediaan. Tanpa ini kolom cache berkata "sisa 3" sementara
    // halaman detail — yang menghitung dari blok — menyatakan semua kosong.
    // Dibungkus try sendiri: listingnya sudah tersimpan, dan menggagalkan
    // seluruh permintaan karena penyemaian kalender berarti agent kehilangan
    // pekerjaan yang sebetulnya sudah berhasil.
    if (jenis_transaksi === 'SEWA') {
      try {
        await semaiBlokAwal(prisma, listing.id_property, agent.id_agent);
      } catch (e) {
        console.error(
          `⚠️ Gagal menyemai ketersediaan awal listing #${listing.id_property}:`,
          e,
        );
      }
    }

    // Tambah poin secara atomic (cegah race condition jika ada request bersamaan)
    const updatedAgent = await prisma.agent.update({
      where: { id_agent: agent.id_agent },
      data: { poin: { increment: 10 } },
      select: { poin: true },
    });

    await prisma.riwayatPoin.create({
      data: {
        id_agent: agent.id_agent,
        jenis_aktivitas: 'Tambah Listing',
        deskripsi: `Menambahkan listing: ${body.judul}`,
        poin: 10,
        tipe_transaksi: 'DAPAT',
        // BigInt langsung, bukan .toString(): kolomnya memang `BigInt?`.
        // Prisma kebetulan menerima string juga, jadi tidak ada data yang
        // hilang selama ini — yang hilang cuma jaminan tipenya.
        id_referensi: listing.id_property,
        tabel_referensi: 'listing',
        saldo_sebelum: updatedAgent.poin - 10,
        saldo_sesudah: updatedAgent.poin,
      },
    });

    const serializedListing = serializeBigInt(listing);

    return NextResponse.json({
      success: true,
      data: serializedListing,
      message: 'Listing berhasil dibuat dan poin ditambahkan (+10)',
    });
  } catch (error: any) {
    console.error('❌ Error creating listing:', error);

    if (error?.code === 'P2002') {
      return NextResponse.json(
        {
          error: 'Data duplikat terdeteksi',
          details: error.meta?.target
            ? `Field ${error.meta.target.join(', ')} sudah ada`
            : 'Constraint violation',
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to create listing',
        details: error?.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const skip = (page - 1) * limit;

    const kota = searchParams.get('kota');
    const jenis_transaksi = searchParams.get('jenis_transaksi');
    const kategori = searchParams.get('kategori');
    const status_tayang = searchParams.get('status_tayang');

    const where: any = {};
    if (kota) where.kota = kota;
    if (jenis_transaksi) where.jenis_transaksi = jenis_transaksi;
    if (kategori) where.kategori = kategori;
    if (status_tayang) where.status_tayang = status_tayang;

    const [listings, total] = await Promise.all([
      prisma.listing.findMany({
        skip,
        take: limit,
        where,
        include: {
          agent: {
            include: {
              pengguna: {
                select: {
                  nama_lengkap: true,
                  email: true,
                },
              },
            },
          },
        },
        orderBy: {
          tanggal_dibuat: 'desc',
        },
      }),
      prisma.listing.count({ where }),
    ]);

    const serializedListings = serializeBigInt(listings);

    return NextResponse.json({
      success: true,
      data: serializedListings,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('❌ Error fetching listings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch listings', details: error?.message },
      { status: 500 }
    );
  }
}
