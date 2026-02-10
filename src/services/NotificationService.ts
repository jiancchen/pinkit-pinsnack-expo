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

export class NotificationService {
  private static configured = false;

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
}
