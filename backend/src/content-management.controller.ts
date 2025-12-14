import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UploadedFile,
  UseInterceptors,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, ILike } from 'typeorm';
import { ContentListing } from './database/entities';
import { SupabaseService } from './storage/supabase.service';
import * as crypto from 'crypto';

interface UploadContentDto {
  title: string;
  description: string;
  category: string;
  price: string;
  credentialType: string;
  tags: string;
  creatorAddress: string;
  encryptionKey: string;
  iv: string;
}

interface DecryptContentDto {
  decryptionKey: string;
}

@Controller('api/content')
export class ContentManagementController {
  private readonly logger = new Logger(ContentManagementController.name);

  constructor(
    @InjectRepository(ContentListing)
    private readonly contentRepository: Repository<ContentListing>,
    private readonly supabaseService: SupabaseService,
  ) {}

  /**
   * POST /api/content/upload
   * Upload encrypted content to Supabase
   */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadContent(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UploadContentDto,
  ) {
    this.logger.log(`Upload request from: ${body.creatorAddress}`);

    if (!file) {
      throw new HttpException('No file uploaded', HttpStatus.BAD_REQUEST);
    }

    try {
      // Generate content ID from hash
      const contentHash = crypto
        .createHash('sha256')
        .update(file.buffer)
        .digest();
      const contentIdHash = contentHash.toString('hex');

      // Upload encrypted file to Supabase
      const timestamp = Date.now();
      const filePath = `${body.creatorAddress}/${contentIdHash}_${timestamp}.enc`;
      
      const { path, url } = await this.supabaseService.uploadFile(
        filePath,
        file.buffer,
        'application/octet-stream'
      );

      this.logger.log(`File uploaded to Supabase: ${path}`);

      // Calculate prices in lamports (assuming USDC with 6 decimals)
      const priceDefault = Math.floor(parseFloat(body.price) * 1_000_000).toString();
      const priceJournalist = body.credentialType !== 'none' 
        ? Math.floor(parseFloat(body.price) * 0.5 * 1_000_000).toString()
        : null;

      // Store metadata in database
      const content = this.contentRepository.create({
        contentIdHash: Buffer.from(contentIdHash, 'hex'),
        creatorPubkey: body.creatorAddress,
        priceDefault,
        priceJournalist,
        tokenMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC on Solana
        recipientPubkey: body.creatorAddress,
        credentialPolicy: body.credentialType === 'none' ? 0 : 1,
        storageCid: path,
        encryptionKeyHash: crypto
          .createHash('sha256')
          .update(body.encryptionKey)
          .digest('hex'),
        metadata: {
          title: body.title,
          description: body.description,
          category: body.category,
          tags: body.tags.split(',').map(t => t.trim()),
          credentialType: body.credentialType,
          iv: body.iv,
          fileSize: file.size,
          fileName: file.originalname,
        },
      });

      await this.contentRepository.save(content);

      this.logger.log(`Content saved to database: ${content.id}`);

      return {
        contentId: content.id,
        ipfsHash: contentIdHash, // Using content hash as identifier
        encryptionKey: body.encryptionKey,
        storagePath: path,
      };
    } catch (error) {
      this.logger.error('Upload failed:', error);
      throw new HttpException(
        `Upload failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /api/content
   * List all content with filters
   */
  @Get()
  async listContent(
    @Query('category') category?: string,
    @Query('credentialType') credentialType?: string,
    @Query('search') search?: string,
  ) {
    this.logger.log(`List content - category: ${category}, credential: ${credentialType}, search: ${search}`);

    try {
      const query = this.contentRepository.createQueryBuilder('content');

      // Filter by category
      if (category && category !== 'All Categories') {
        query.andWhere("metadata->>'category' = :category", { category });
      }

      // Filter by credential type
      if (credentialType && credentialType !== 'All Credentials') {
        const credType = credentialType.toLowerCase();
        query.andWhere("metadata->>'credentialType' = :credType", { credType });
      }

      // Search in title, description, tags
      if (search) {
        query.andWhere(
          "(metadata->>'title' ILIKE :search OR metadata->>'description' ILIKE :search OR metadata->>'tags' ILIKE :search)",
          { search: `%${search}%` }
        );
      }

      const contents = await query.getMany();

      // Transform to frontend format
      return contents.map(content => ({
        id: content.id,
        title: content.metadata?.title || 'Untitled',
        creator: content.creatorPubkey.substring(0, 8) + '...',
        price: parseFloat(content.priceDefault) / 1_000_000,
        discountedPrice: content.priceJournalist
          ? parseFloat(content.priceJournalist) / 1_000_000
          : parseFloat(content.priceDefault) / 1_000_000,
        credentialType: content.metadata?.credentialType || 'none',
        category: content.metadata?.category || 'Uncategorized',
        description: content.metadata?.description || '',
        createdAt: content.createdAt.toISOString(),
        tags: content.metadata?.tags || [],
      }));
    } catch (error) {
      this.logger.error('Failed to list content:', error);
      throw new HttpException(
        'Failed to fetch content',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /api/content/:contentId
   * Get specific content details
   */
  @Get(':contentId')
  async getContent(@Param('contentId') contentId: string) {
    this.logger.log(`Get content: ${contentId}`);

    try {
      const content = await this.contentRepository.findOne({
        where: { id: contentId },
      });

      if (!content) {
        throw new HttpException('Content not found', HttpStatus.NOT_FOUND);
      }

      return {
        id: content.id,
        title: content.metadata?.title || 'Untitled',
        creator: content.creatorPubkey,
        price: parseFloat(content.priceDefault) / 1_000_000,
        discountedPrice: content.priceJournalist
          ? parseFloat(content.priceJournalist) / 1_000_000
          : parseFloat(content.priceDefault) / 1_000_000,
        credentialType: content.metadata?.credentialType || 'none',
        category: content.metadata?.category || 'Uncategorized',
        description: content.metadata?.description || '',
        createdAt: content.createdAt.toISOString(),
        tags: content.metadata?.tags || [],
        contentHash: content.contentIdHash.toString('hex'),
        encrypted: true,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Failed to get content:', error);
      throw new HttpException(
        'Failed to fetch content',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /api/content/creator/:address
   * Get all content by creator
   */
  @Get('creator/:address')
  async getCreatorContent(@Param('address') address: string) {
    this.logger.log(`Get creator content: ${address}`);

    try {
      const contents = await this.contentRepository.find({
        where: { creatorPubkey: address },
        order: { createdAt: 'DESC' },
      });

      // TODO: Get actual view and purchase stats from analytics
      return contents.map(content => ({
        id: content.id,
        title: content.metadata?.title || 'Untitled',
        category: content.metadata?.category || 'Uncategorized',
        price: parseFloat(content.priceDefault) / 1_000_000,
        views: 0, // TODO: Implement analytics
        purchases: 0, // TODO: Count from PaymentSession
        earnings: 0, // TODO: Calculate from confirmed payments
        createdAt: content.createdAt.toISOString(),
        status: 'active',
      }));
    } catch (error) {
      this.logger.error('Failed to get creator content:', error);
      throw new HttpException(
        'Failed to fetch creator content',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * POST /api/content/:contentId/decrypt
   * Decrypt content with key (after payment verified)
   */
  @Post(':contentId/decrypt')
  async decryptContent(
    @Param('contentId') contentId: string,
    @Body() body: DecryptContentDto,
  ) {
    this.logger.log(`Decrypt content: ${contentId}`);

    try {
      const content = await this.contentRepository.findOne({
        where: { id: contentId },
      });

      if (!content) {
        throw new HttpException('Content not found', HttpStatus.NOT_FOUND);
      }

      // Verify decryption key hash
      const providedKeyHash = crypto
        .createHash('sha256')
        .update(body.decryptionKey)
        .digest('hex');

      if (providedKeyHash !== content.encryptionKeyHash) {
        throw new HttpException('Invalid decryption key', HttpStatus.FORBIDDEN);
      }

      if (!content.storageCid) {
        throw new HttpException('Content file not found', HttpStatus.NOT_FOUND);
      }

      // Download encrypted file from Supabase
      const encryptedData = await this.supabaseService.downloadFile(
        content.storageCid,
      );

      // For now, return the encrypted data and let client decrypt
      // In production, you might decrypt server-side for additional security
      return {
        content: encryptedData.toString('base64'),
        ipfsHash: content.contentIdHash.toString('hex'),
        iv: content.metadata?.iv,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Decryption failed:', error);
      throw new HttpException(
        'Decryption failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
