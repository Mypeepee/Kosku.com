import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Get listing by slug (untuk SEO-friendly URLs)
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const listing = await prisma.listing.findUnique({
      where: { slug: params.slug },
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
      where: { slug: params.slug },
      data: { dilihat: { increment: 1 } },
    });

    return NextResponse.json({
      success: true,
      data: listing,
    });

  } catch (error) {
    console.error('Error fetching listing by slug:', error);
    return NextResponse.json(
      { error: 'Failed to fetch listing' },
      { status: 500 }
    );
  }
}
