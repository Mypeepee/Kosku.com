import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('image') as File[];

    if (files.length === 0) {
      return NextResponse.json(
        { error: 'No files uploaded' },
        { status: 400 }
      );
    }

    const uploadedUrls: string[] = [];

    for (const file of files) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // Generate unique filename
      const filename = `${Date.now()}-${Math.random().toString(36).substring(7)}-${file.name}`;
      const filepath = path.join(process.cwd(), 'public', 'uploads', 'listings', filename);

      // Save file
      await writeFile(filepath, buffer);

      // Return public URL
      uploadedUrls.push(`/uploads/listings/${filename}`);
    }

    return NextResponse.json({
      success: true,
      urls: uploadedUrls,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload files' },
      { status: 500 }
    );
  }
}
