import { Injectable, Logger } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);
  private supabase: SupabaseClient;
  private readonly bucketName = 'encrypted-content';

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      this.logger.warn('Supabase credentials not found. File uploads will fail.');
    } else {
      this.supabase = createClient(supabaseUrl, supabaseKey);
      this.initializeBucket();
    }
  }

  private async initializeBucket() {
    try {
      // Check if bucket exists, create if not
      const { data: buckets } = await this.supabase.storage.listBuckets();
      const bucketExists = buckets?.some(b => b.name === this.bucketName);

      if (!bucketExists) {
        const { error } = await this.supabase.storage.createBucket(this.bucketName, {
          public: false,
          fileSizeLimit: 104857600, // 100MB
        });
        if (error) {
          this.logger.error(`Failed to create bucket: ${error.message}`);
        } else {
          this.logger.log(`Created bucket: ${this.bucketName}`);
        }
      }
    } catch (error) {
      this.logger.error('Failed to initialize bucket:', error);
    }
  }

  private async ensureBucketExists(): Promise<void> {
    try {
      const { data: buckets } = await this.supabase.storage.listBuckets();
      const bucketExists = buckets?.some(b => b.name === this.bucketName);

      if (!bucketExists) {
        this.logger.log(`Creating bucket: ${this.bucketName}`);
        const { error } = await this.supabase.storage.createBucket(this.bucketName, {
          public: false,
        });
        if (error) {
          this.logger.error(`Failed to create bucket: ${error.message}`);
          throw new Error(`Failed to create storage bucket: ${error.message}`);
        }
        this.logger.log(`✓ Created storage bucket: ${this.bucketName}`);
      }
    } catch (err) {
      this.logger.error(`Bucket check failed: ${err.message}`);
      throw err;
    }
  }

  async uploadFile(
    filePath: string,
    fileBuffer: Buffer,
    contentType: string = 'application/octet-stream'
  ): Promise<{ path: string; url: string }> {
    // Ensure bucket exists before upload
    await this.ensureBucketExists();
    
    const { data, error } = await this.supabase.storage
      .from(this.bucketName)
      .upload(filePath, fileBuffer, {
        contentType,
        upsert: false,
      });

    if (error) {
      this.logger.error(`Upload failed: ${error.message}`);
      throw new Error(`Failed to upload file: ${error.message}`);
    }

    // Get public URL (signed URL for private bucket)
    const { data: urlData } = await this.supabase.storage
      .from(this.bucketName)
      .createSignedUrl(data.path, 3600 * 24 * 365); // 1 year expiry

    return {
      path: data.path,
      url: urlData?.signedUrl || '',
    };
  }

  async downloadFile(filePath: string): Promise<Buffer> {
    const { data, error } = await this.supabase.storage
      .from(this.bucketName)
      .download(filePath);

    if (error) {
      this.logger.error(`Download failed: ${error.message}`);
      throw new Error(`Failed to download file: ${error.message}`);
    }

    return Buffer.from(await data.arrayBuffer());
  }

  async deleteFile(filePath: string): Promise<void> {
    const { error } = await this.supabase.storage
      .from(this.bucketName)
      .remove([filePath]);

    if (error) {
      this.logger.error(`Delete failed: ${error.message}`);
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  async getSignedUrl(filePath: string, expiresIn: number = 3600): Promise<string> {
    const { data, error } = await this.supabase.storage
      .from(this.bucketName)
      .createSignedUrl(filePath, expiresIn);

    if (error) {
      throw new Error(`Failed to generate signed URL: ${error.message}`);
    }

    return data?.signedUrl || '';
  }
}
