import { Injectable } from '@nestjs/common';
// Placeholder analytics service — wire up prom-client counters/histograms here

@Injectable()
export class AnalyticsService {
  recordPttEvent(channelId: string, type: 'start' | 'stop'): void {
    // TODO: increment Prometheus counter
    void channelId;
    void type;
  }

  recordChannelJoin(channelId: string): void {
    void channelId;
  }

  recordChannelLeave(channelId: string): void {
    void channelId;
  }
}
