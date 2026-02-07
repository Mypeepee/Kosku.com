import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

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
      data: listing,
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

    // Check if listing exists
    const existing = await prisma.listing.findUnique({
      where: { id_property: id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Listing not found' },
        { status: 404 }
      );
    }

    // Update listing
    const updated = await prisma.listing.update({
      where: { id_property: id },
      data: {
        judul: body.judul,
        slug: body.slug,
        deskripsi: body.deskripsi,
        jenis_transaksi: body.jenis_transaksi,
        kategori: body.kategori,
        vendor: body.vendor,
        status_tayang: body.status_tayang,
        harga: body.harga,
        harga_promo: body.harga_promo,
        tanggal_lelang: body.tanggal_lelang ? new Date(body.tanggal_lelang) : null,
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
      },
    });

    return NextResponse.json({
      success: true,
      data: updated,
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

    // Check if listing exists
    const existing = await prisma.listing.findUnique({
      where: { id_property: id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Listing not found' },
        { status: 404 }
      );
    }

    // Delete listing (cascade will handle related records)
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
      { error: 'Failed to delete listing' },
      { status: 500 }
    );
  }
}
