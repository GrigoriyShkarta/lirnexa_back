import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StreamClient } from '@stream-io/node-sdk';
import { StorageService } from '../../storage/storage.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class StreamService {
  private client: StreamClient;

  private readonly logger = new Logger(StreamService.name);

  constructor(
    private configService: ConfigService,
    private storageService: StorageService,
    private prisma: PrismaService,
  ) {
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
    return this.client.generateUserToken({ user_id: userId, validity_in_seconds: validity, role: 'admin' });
  }

  async handleWebhook(payload: any) {
    const { type, cid, call_cid, call_recording } = payload;
    const effectiveCid = call_cid || cid;
    
    this.logger.log(`Received Stream webhook: ${type} for CID: ${effectiveCid}`);

    if (type === 'call.recording_ready') {
      if (!effectiveCid) {
        this.logger.warn('[Stream] Missing CID in recording_ready payload');
        return;
      }

      const [callType, callId] = effectiveCid.split(':');
      this.logger.log(`[Stream] Processing recording for lesson ID: ${callId} (CallType: ${callType})`);
      
      const lesson = await this.prisma.subscriptionLesson.findUnique({
        where: { id: callId },
        include: {
          subscription: {
            select: {
              student: { select: { id: true, name: true, is_recording_enabled: true } },
            },
          },
        },
      });

      if (!lesson) {
        this.logger.warn(`[Stream] Lesson ${callId} not found in database`);
        return;
      }

      const isRecordingEnabled = lesson.subscription.student.is_recording_enabled;
      this.logger.log(`[Stream] Lesson found for student ${lesson.subscription.student.name} (${lesson.subscription.student.id}). Recording enabled: ${isRecordingEnabled}`);

      if (isRecordingEnabled && call_recording?.url) {
        try {
          this.logger.log(`[Stream] Attempting to download and upload recording for lesson ${callId}`);
          await this.downloadAndUploadRecording(call_recording.url, callId);
          this.logger.log(`[Stream] Successfully processed permanent recording for lesson ${callId}`);
        } catch (error) {
          this.logger.error(`[Stream] Permanent upload failed for ${callId}, saving temporary link:`, error);
          await this.prisma.subscriptionLesson.update({
            where: { id: callId },
            data: { recording_url: call_recording.url }
          });
        }
      } else if (call_recording?.url) {
        this.logger.log(`[Stream] Saving temporary link for lesson ${callId} (recording permanent storage disabled)`);
        await this.prisma.subscriptionLesson.update({
          where: { id: callId },
          data: { recording_url: call_recording.url }
        });
      } else {
        this.logger.warn(`[Stream] No recording URL found in payload for lesson ${callId}`);
      }
    }
  }

  private async downloadAndUploadRecording(recordingUrl: string, lessonId: string) {
    this.logger.log(`[Stream] Downloading recording from ${recordingUrl}`);
    const response = await fetch(recordingUrl);
    if (!response.ok) {
        this.logger.error(`[Stream] Failed to download recording: ${response.status} ${response.statusText}`);
        throw new Error(`Failed to download recording from ${recordingUrl}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const fileName = `recording-${lessonId}.mp4`;
    const mimetype = 'video/mp4';
    
    const cloudflareUrl = await this.storageService.uploadBuffer(
      buffer,
      `lessons/${lessonId}/recordings`,
      fileName,
      mimetype
    );
    
    await this.prisma.subscriptionLesson.update({
      where: { id: lessonId },
      data: { recording_url: cloudflareUrl }
    });
  }

  async configureDefaultCallTypeCustomLayout() {
    if (!this.client) throw new Error('Stream client not initialized');

    const recorderToken = this.client.generateUserToken({ 
      user_id: 'recorder-bot', 
      role: 'admin' 
    });

    const baseUrl = 'https://stream-recording-layout.vercel.app/';
    const appUrlWithToken = `${baseUrl}?token=${recorderToken}&user_id=recorder-bot`;

    await this.client.video.updateCallType({
      name: 'default',
      settings: {
        recording: {
          mode: 'available',
          quality: '1080p',
          layout: {
            name: "grid",
            options: {
              "grid.columns": 2,
              "grid.gap": 0,
              "grid.size_percentage": 100,
              "participant.aspect_ratio": "1/1",
              "layout.background_color": "#000000",
              "video.scale_mode": "fit"
            }
          }
        },
      },
    });
    
    this.logger.log(`CallType updated. URL with token: ${appUrlWithToken}`);
  }
}
