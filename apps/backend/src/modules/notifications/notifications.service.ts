import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  // Placeholder for push notification integration (FCM, APNs, etc.)
  async sendPushNotification(userId: string, title: string, body: string): Promise<void> {
    this.logger.log(`[Push] To ${userId}: ${title} — ${body}`);
    // TODO: integrate FCM / APNs
  }
}
