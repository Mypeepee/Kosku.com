import { NextRequest, NextResponse } from 'next/server';
import { GoogleDriveService } from '@/lib/services/google-drive.service';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    
    // Get data from form
    const kota = formData.get('kota') as string;
    const alamat = formData.get('alamat') as string;
    const coverImageIndex = formData.get('cover_image_index') 
      ? parseInt(formData.get('cover_image_index') as string) 
      : 0;

    if (!kota || !alamat) {
      return NextResponse.json(
        { error: 'Kota dan alamat harus diisi' },
        { status: 400 }
      );
    }

    // Collect all images
    const images: Array<{ buffer: Buffer; name: string; mimeType: string }> = [];
    let imageIndex = 0;

    while (true) {
      const file = formData.get(`images[${imageIndex}]`) as File | null;
      if (!file) break;

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      images.push({
        buffer,
        name: file.name,
        mimeType: file.type,
      });

      imageIndex++;
    }

    if (images.length === 0) {
      return NextResponse.json(
        { error: 'Minimal 1 gambar harus diupload' },
        { status: 400 }
      );
    }

    // Upload to Google Drive
    const driveService = new GoogleDriveService();
    const imageUrls = await driveService.uploadPropertyImages(
      images,
      kota,
      alamat,
      coverImageIndex
    );

    return NextResponse.json({
      success: true,
      imageUrls,
      message: `${images.length} gambar berhasil diupload`,
    });
  } catch (error) {
    console.error('Upload error:', error);
    
    if (error instanceof Error) {
      return NextResponse.json(
        { 
          error: 'Failed to upload images',
          details: error.message 
        },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to upload images' },
      { status: 500 }
    );
  }
}
