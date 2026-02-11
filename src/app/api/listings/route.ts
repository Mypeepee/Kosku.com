import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

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
        poin: true,
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
      | 'PABRIK';

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
      if (body.harga == null || Number(body.harga) <= 0) {
        return NextResponse.json(
          { error: 'Harga wajib diisi untuk tipe non-LELANG' },
          { status: 400 }
        );
      }
    }

    // Set harga
    const harga =
      jenis_transaksi === 'LELANG'
        ? Number(body.nilai_limit_lelang)
        : Number(body.harga);

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

    // Create listing
    const listing = await prisma.listing.create({
      data: {
        id_agent: agent.id_agent,
        judul: body.judul,
        slug: body.slug,
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
      },
    });

    console.log('✅ Listing created:', listing.id_property.toString());

    // Tambah poin
    const newPoin = agent.poin + 10;
    await prisma.agent.update({
      where: { id_agent: agent.id_agent },
      data: { poin: newPoin },
    });

    await prisma.riwayatPoin.create({
      data: {
        id_agent: agent.id_agent,
        jenis_aktivitas: 'Tambah Listing',
        deskripsi: `Menambahkan listing: ${body.judul}`,
        poin: 10,
        tipe_transaksi: 'DAPAT',
        id_referensi: listing.id_property.toString(),
        tabel_referensi: 'listing',
        saldo_sebelum: agent.poin,
        saldo_sesudah: newPoin,
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
