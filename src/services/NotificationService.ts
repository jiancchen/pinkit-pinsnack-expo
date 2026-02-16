import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { createLogger } from '../utils/Logger';

const log = createLogger('NotificationService');

export type GenerationNotificationData = {
  type: 'generation';
  appId: string;
  jobId: string;
  status: 'started' | 'completed' | 'failed';
};

type GenerationNotificationFilter = Partial<Pick<GenerationNotificationData, 'appId' | 'jobId' | 'status'>>;

export class NotificationService {
  private static configured = false;

  private static parseGenerationNotificationData(raw: unknown): GenerationNotificationData | null {
    let value: unknown = raw;
    if (typeof value === 'string') {
      try {
        value = JSON.parse(value);
      } catch {
        return null;
      }
    }

    if (!value || typeof value !== 'object') return null;
    const candidate = value as Record<string, unknown>;
    if (candidate.type !== 'generation') return null;
    if (typeof candidate.appId !== 'string' || typeof candidate.jobId !== 'string') return null;
    if (candidate.status !== 'started' && candidate.status !== 'completed' && candidate.status !== 'failed') {
      return null;
    }

    return candidate as GenerationNotificationData;
  }

  private static matchesGenerationFilter(
    data: GenerationNotificationData,
    filter: GenerationNotificationFilter
  ): boolean {
    if (filter.appId && data.appId !== filter.appId) return false;
    if (filter.jobId && data.jobId !== filter.jobId) return false;
    if (filter.status && data.status !== filter.status) return false;
    return true;
  }

  private static async clearGenerationNotifications(filter: GenerationNotificationFilter): Promise<void> {
    try {
      const presented = await Notifications.getPresentedNotificationsAsync();
      const presentedToDismiss = presented.filter((notification) => {
        const data = this.parseGenerationNotificationData(notification.request.content.data);
        return data ? this.matchesGenerationFilter(data, filter) : false;
      });

      await Promise.all(
        presentedToDismiss.map((notification) =>
          Notifications.dismissNotificationAsync(notification.request.identifier).catch(() => undefined)
        )
      );
    } catch (error) {
      log.warn('Failed to clear presented generation notifications:', error);
    }

    try {
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      const scheduledToCancel = scheduled.filter((notification) => {
        const data = this.parseGenerationNotificationData(notification.content.data);
        return data ? this.matchesGenerationFilter(data, filter) : false;
      });

      await Promise.all(
        scheduledToCancel.map((notification) =>
          Notifications.cancelScheduledNotificationAsync(notification.identifier).catch(() => undefined)
        )
      );
    } catch (error) {
      log.warn('Failed to clear scheduled generation notifications:', error);
    }
  }

  static configureForegroundBehavior(): void {
    if (this.configured) return;
    this.configured = true;

    if (Platform.OS === 'android') {
      void Notifications.setNotificationChannelAsync('generation', {
        name: 'Generation',
        importance: Notifications.AndroidImportance.DEFAULT,
      }).catch((error) => log.warn('Failed to set Android notification channel:', error));
    }

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
  }

  static async ensurePermissions(): Promise<boolean> {
    try {
      const settings = await Notifications.getPermissionsAsync();
      if (settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
        return true;
      }

      const requested = await Notifications.requestPermissionsAsync();
      return Boolean(
        requested.granted || requested.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
      );
    } catch (error) {
      log.warn('Failed to request notification permissions:', error);
      return false;
    }
  }

  static async notifyGenerationStarted(params: {
    appId: string;
    jobId: string;
    title: string;
  }): Promise<void> {
    const allowed = await this.ensurePermissions();
    if (!allowed) return;

    try {
      // Keep only one generation notification stream per app to avoid stacking.
      await this.clearGenerationNotifications({ appId: params.appId });

      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Generating app…',
          body: params.title || 'Your app is generating in the background.',
          sound: false,
          data: {
            type: 'generation',
            appId: params.appId,
            jobId: params.jobId,
            status: 'started',
          } satisfies GenerationNotificationData,
        },
        trigger: Platform.OS === 'android' ? { channelId: 'generation' } : null,
      });
    } catch (error) {
      log.warn('Failed to schedule start notification:', error);
    }
  }

  static async notifyGenerationCompleted(params: {
    appId: string;
    jobId: string;
    title: string;
  }): Promise<void> {
    const allowed = await this.ensurePermissions();
    if (!allowed) return;

    try {
      // Remove any lingering "Generating..." alerts for this app/job.
      await this.clearGenerationNotifications({ appId: params.appId, jobId: params.jobId });

      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'App ready',
          body: params.title || 'Your app finished generating.',
          sound: false,
          data: {
            type: 'generation',
            appId: params.appId,
            jobId: params.jobId,
            status: 'completed',
          } satisfies GenerationNotificationData,
        },
        trigger: Platform.OS === 'android' ? { channelId: 'generation' } : null,
      });
    } catch (error) {
      log.warn('Failed to schedule completion notification:', error);
    }
  }

  static async notifyGenerationFailed(params: {
    appId: string;
    jobId: string;
    title: string;
    errorMessage: string;
  }): Promise<void> {
    const allowed = await this.ensurePermissions();
    if (!allowed) return;

    try {
      // Ensure in-progress notification does not linger after failure.
      await this.clearGenerationNotifications({ appId: params.appId, jobId: params.jobId });

      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Generation failed',
          body: params.errorMessage || params.title || 'Tap to review.',
          sound: false,
          data: {
            type: 'generation',
            appId: params.appId,
            jobId: params.jobId,
            status: 'failed',
          } satisfies GenerationNotificationData,
        },
        trigger: Platform.OS === 'android' ? { channelId: 'generation' } : null,
      });
    } catch (error) {
      log.warn('Failed to schedule failure notification:', error);
    }
  }

  static async clearAllInProgressGenerationNotifications(): Promise<void> {
    await this.clearGenerationNotifications({ status: 'started' });
  }
}
