import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StreamClient } from '@stream-io/node-sdk';

@Injectable()
export class StreamService {
  private client: StreamClient;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('STREAM_API_KEY');
    const apiSecret = this.configService.get<string>('STREAM_API_SECRET');
    
    if (apiKey && apiSecret) {
      this.client = new StreamClient(apiKey, apiSecret);
    }
  }

  generateToken(userId: string): string {
    if (!this.client) return '';
    
    // Token valid for 24 hours
    const validity = 24 * 60 * 60;
    return this.client.generateUserToken({ user_id: userId, validity_in_seconds: validity });
  }

  async configureDefaultCallTypeCustomLayout() {
    if (!this.client) {
      throw new Error('Stream client is not initialized');
    }
  
    await this.client.video.updateCallType({
      name: 'default',
      settings: {
        recording: {
          mode: 'available',        // или твой режим
          quality: '1080p',          // или твоя текущая
          layout: {
            name: 'custom',
            external_app_url: 'https://stream-recording-layout.vercel.app/',
            // external_css_url: 'https://stream-recording-layout.vercel.app/layout.css', // если захочешь вынести CSS
          },
        },
      },
    });
  }
}
