import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

@Injectable()
export class StorageService {
  private s3Client: S3Client;
  private bucket: string;
  private publicUrl: string;

  constructor(private configService: ConfigService) {
    this.s3Client = new S3Client({
      region: 'auto',
      endpoint: this.configService.get<string>('R2_ENDPOINT')!,
      credentials: {
        accessKeyId: this.configService.get<string>('R2_ACCESS_KEY')!,
        secretAccessKey: this.configService.get<string>('R2_SECRET_KEY')!,
      },
    });
    this.bucket = this.configService.get<string>('R2_BUCKET')!;
    this.publicUrl = this.configService.get<string>('R2_PUBLIC_URL') || '';
    console.log('StorageService initialized with PUBLIC_URL:', this.publicUrl);
  }

  /**
   * Uploads a file to Cloudflare R2.
   * @param file The file to upload.
   * @param path The path (key) under which to store the file.
   * @returns The full public URL of the uploaded file.
   */
  async uploadFile(file: Express.Multer.File, path: string): Promise<string> {
    const fileName = `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`;
    const key = `${path}/${fileName}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    });

    await this.s3Client.send(command);

    const publicUrl = this.publicUrl || this.configService.get<string>('R2_PUBLIC_URL') || process.env.R2_PUBLIC_URL || '';
    
    console.log('Final check for PUBLIC_URL in uploadFile:', publicUrl);

    // Return full URL if publicUrl is configured, otherwise return the key
    if (publicUrl) {
      const baseUrl = publicUrl.endsWith('/') ? publicUrl.slice(0, -1) : publicUrl;
      const sanitizedKey = key.split('/').map(part => encodeURIComponent(part)).join('/');
      const fullUrl = `${baseUrl}/${sanitizedKey}`;
      console.log('Constructed full URL:', fullUrl);
      return fullUrl;
    }

    return key;
  }

  /**
   * Deletes a file from Cloudflare R2.
   * @param keyOrUrl The key or full URL of the file to delete.
   */
  async deleteFile(keyOrUrl: string): Promise<void> {
    let key = keyOrUrl;

    // If a full URL is passed, extract the key part
    if (this.publicUrl && keyOrUrl.startsWith(this.publicUrl)) {
      const baseUrl = this.publicUrl.endsWith('/') ? this.publicUrl : `${this.publicUrl}/`;
      key = keyOrUrl.replace(baseUrl, '');
      // DecodeURIComponent because the URL was stored encoded
      key = decodeURIComponent(key);
    }

    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    try {
      await this.s3Client.send(command);
    } catch (error) {
      console.error(`Failed to delete file with key: ${key}`, error);
      // We don't throw here to avoid failing the whole request if deletion fails 
      // (e.g. if the file was already deleted manually or doesn't exist)
    }
  }
}
