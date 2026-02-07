import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma'; // ✅ Ubah dari { prisma } menjadi default import
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Get agent ID from session
    const agent = await prisma.agent.findUnique({
      where: { id_pengguna: session.user.id },
    });

    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Validate required fields
    if (!body.judul || !body.kota || !body.harga || !body.jenis_transaksi || !body.kategori) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create listing
    const listing = await prisma.listing.create({
      data: {
        id_agent: agent.id_agent,
        judul: body.judul,
        slug: body.slug,
        deskripsi: body.deskripsi || null,
        jenis_transaksi: body.jenis_transaksi,
        kategori: body.kategori,
        vendor: body.vendor || null,
        status_tayang: body.status_tayang || 'TERSEDIA',
        harga: body.harga,
        harga_promo: body.harga_promo || null,
        tanggal_lelang: body.tanggal_lelang ? new Date(body.tanggal_lelang) : null,
        uang_jaminan: body.uang_jaminan || null,
        nilai_limit_lelang: body.nilai_limit_lelang || null,
        link: body.link || null,
        alamat_lengkap: body.alamat_lengkap || null,
        provinsi: body.provinsi || null,
        kota: body.kota,
        kecamatan: body.kecamatan || null,
        kelurahan: body.kelurahan || null,
        latitude: body.latitude || null,
        longitude: body.longitude || null,
        luas_tanah: body.luas_tanah || null,
        luas_bangunan: body.luas_bangunan || null,
        jumlah_lantai: body.jumlah_lantai || 1,
        kamar_tidur: body.kamar_tidur || null,
        kamar_mandi: body.kamar_mandi || null,
        daya_listrik: body.daya_listrik || null,
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

    // Award points to agent
    await prisma.agent.update({
      where: { id_agent: agent.id_agent },
      data: {
        poin: { increment: 10 }, // Award 10 points for new listing
      },
    });

    // Create point history
    await prisma.riwayatPoin.create({
      data: {
        id_agent: agent.id_agent,
        jenis_aktivitas: 'Tambah Listing',
        deskripsi: `Menambahkan listing: ${body.judul}`,
        poin: 10,
        tipe_transaksi: 'DAPAT',
        id_referensi: listing.id_property,
        tabel_referensi: 'listing',
        saldo_sebelum: agent.poin,
        saldo_sesudah: agent.poin + 10,
      },
    });

    return NextResponse.json({
      success: true,
      data: listing,
      message: 'Listing berhasil dibuat',
    });
  } catch (error) {
    console.error('Error creating listing:', error);
    
    if (error instanceof Error) {
      return NextResponse.json(
        { 
          error: 'Failed to create listing',
          details: error.message 
        },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to create listing' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const skip = (page - 1) * limit;

    // Optional filters
    const kota = searchParams.get('kota');
    const jenis_transaksi = searchParams.get('jenis_transaksi');
    const kategori = searchParams.get('kategori');
    const status_tayang = searchParams.get('status_tayang');

    // Build where clause
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

    return NextResponse.json({
      success: true,
      data: listings,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching listings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch listings' },
      { status: 500 }
    );
  }
}
