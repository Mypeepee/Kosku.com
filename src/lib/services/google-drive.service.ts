import { google } from 'googleapis';

export class GoogleDriveService {
  private drive;
  private rootFolderId = process.env.GOOGLE_DRIVE_FOLDER || '1kuYnWDVAhnCKSDmggY0feZerMTsD62BC';

  constructor() {
    // Validate environment variables
    const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error('Google Drive credentials are missing in environment variables');
    }

    console.log('✅ Google Drive OAuth2 credentials loaded');

    try {
      // Setup OAuth2 client
      const oauth2Client = new google.auth.OAuth2(
        clientId,
        clientSecret,
        'https://developers.google.com/oauthplayground' // redirect URI
      );

      // Set credentials with refresh token
      oauth2Client.setCredentials({
        refresh_token: refreshToken,
      });

      this.drive = google.drive({ version: 'v3', auth: oauth2Client });
      
      console.log('✅ Google Drive client initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Google Drive:', error);
      throw error;
    }
  }

  async getOrCreateFolder(folderName: string, parentId: string): Promise<string> {
    try {
      // Sanitize folder name (remove special chars)
      const sanitizedName = folderName.replace(/[<>:"/\\|?*]/g, '-');

      // Check if folder exists
      const response = await this.drive.files.list({
        q: `name='${sanitizedName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name)',
        spaces: 'drive',
      });

      if (response.data.files && response.data.files.length > 0) {
        console.log(`✅ Folder "${sanitizedName}" already exists`);
        return response.data.files[0].id!;
      }

      // Create folder if not exists
      console.log(`📁 Creating folder: ${sanitizedName}`);
      const folderMetadata = {
        name: sanitizedName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId],
      };

      const folder = await this.drive.files.create({
        requestBody: folderMetadata,
        fields: 'id',
      });

      console.log(`✅ Folder created: ${sanitizedName} (${folder.data.id})`);
      return folder.data.id!;
    } catch (error) {
      console.error('❌ Error in getOrCreateFolder:', error);
      throw error;
    }
  }

  async uploadFile(
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    folderId: string
  ): Promise<string> {
    try {
      const { Readable } = require('stream');
      
      // Sanitize filename
      const sanitizedFileName = fileName.replace(/[<>:"/\\|?*]/g, '-');
      
      const fileMetadata = {
        name: sanitizedFileName,
        parents: [folderId],
      };

      const media = {
        mimeType: mimeType,
        body: Readable.from(fileBuffer),
      };

      console.log(`📤 Uploading: ${sanitizedFileName} (${(fileBuffer.length / 1024).toFixed(2)} KB)`);

      const response = await this.drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id, webViewLink, webContentLink',
      });

      const fileId = response.data.id!;

      // Make file publicly accessible
      await this.drive.permissions.create({
        fileId: fileId,
        requestBody: {
          role: 'reader',
          type: 'anyone',
        },
      });

      console.log(`✅ Uploaded: ${sanitizedFileName} (ID: ${fileId})`);

      // Return direct image URL (better for thumbnails)
      return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
    } catch (error) {
      console.error('❌ Error uploading file:', fileName, error);
      throw error;
    }
  }

  async uploadPropertyImages(
    images: Array<{ buffer: Buffer; name: string; mimeType: string }>,
    kota: string,
    alamat: string,
    coverIndex?: number
  ): Promise<string[]> {
    try {
      console.log(`📁 Creating folder structure: ${kota} > ${alamat}`);
      console.log(`📁 Root folder ID: ${this.rootFolderId}`);

      // Create folder structure: Root -> Kota -> Alamat
      const folderKota = await this.getOrCreateFolder(kota, this.rootFolderId);
      const folderAlamat = await this.getOrCreateFolder(alamat, folderKota);

      const imageUrls: string[] = [];
      let coverUrl: string | null = null;

      console.log(`📸 Uploading ${images.length} images to folder: ${folderAlamat}`);

      // Upload all images
      for (let i = 0; i < images.length; i++) {
        const image = images[i];
        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substring(7);
        const uniqueName = `${timestamp}_${randomId}_${image.name}`;
        
        try {
          const url = await this.uploadFile(
            image.buffer,
            uniqueName,
            image.mimeType,
            folderAlamat
          );

          // If this is the cover image, store it separately
          if (coverIndex !== undefined && i === coverIndex) {
            coverUrl = url;
            console.log(`📌 Cover image: ${uniqueName}`);
          } else {
            imageUrls.push(url);
          }
        } catch (uploadError) {
          console.error(`❌ Failed to upload image ${i + 1}:`, uploadError);
          throw new Error(`Failed to upload image: ${image.name}`);
        }
      }

      // Put cover image first if exists
      if (coverUrl) {
        imageUrls.unshift(coverUrl);
      }

      console.log(`✅ All ${images.length} images uploaded successfully!`);
      console.log(`📸 Image URLs:`, imageUrls);
      
      return imageUrls;
    } catch (error) {
      console.error('❌ Error uploading property images:', error);
      throw error;
    }
  }

  // Helper: Get file info
  async getFileInfo(fileId: string) {
    try {
      const response = await this.drive.files.get({
        fileId: fileId,
        fields: 'id, name, mimeType, size, webViewLink, thumbnailLink',
      });
      return response.data;
    } catch (error) {
      console.error('❌ Error getting file info:', error);
      throw error;
    }
  }

  // Helper: Delete file
  async deleteFile(fileId: string) {
    try {
      await this.drive.files.delete({
        fileId: fileId,
      });
      console.log(`🗑️ Deleted file: ${fileId}`);
    } catch (error) {
      console.error('❌ Error deleting file:', error);
      throw error;
    }
  }
}
