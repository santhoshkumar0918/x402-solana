import { Controller, Get, Request, Param } from '@nestjs/common';

@Controller('api/content')
export class ContentController {
  
  @Get(':contentId')
  async getContent(@Param('contentId') contentId: string, @Request() req: any) {
    // If we reach here, x402 middleware passed (payment verified)
    // Content should be attached to request by middleware
    if (req.unlockedContent) {
      return {
        success: true,
        content: req.unlockedContent,
        access_granted: true,
      };
    }
    
    // This should not happen if middleware works correctly
    return {
      error: 'Content access verification failed',
      content_id: contentId,
    };
  }
}