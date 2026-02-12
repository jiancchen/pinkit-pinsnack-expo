import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import { useGenerationStatusStore } from '../stores/GenerationStatusStore';
import { useUISettingsStore } from '../stores/UISettingsStore';
import { buildGenerationLiveActivityVariants } from '../liveActivities/GenerationLiveActivity';
import { createLogger } from '../utils/Logger';

const log = createLogger('GenLiveActivity');

const ACTIVITY_ID = 'droplets-generation';
const DEEP_LINK_URL = '/(tabs)';

export default function GenerationLiveActivityController() {
  const queue = useGenerationStatusStore((s) => s.queue);
  const tintColor = useUISettingsStore((s) => s.tabBar.tintColor);
  const [isInForeground, setIsInForeground] = useState<boolean>(() => {
    if (Platform.OS !== 'ios') return true;
    return AppState.currentState !== 'background';
  });

  const pendingJobs = useMemo(
    () => queue.filter((j) => j.status === 'queued' || j.status === 'running'),
    [queue]
  );

  const pendingCount = pendingJobs.length;
  const queuedCount = pendingJobs.filter((j) => j.status === 'queued').length;
  const isRunning = pendingJobs.some((j) => j.status === 'running');

  const phase: 'queued' | 'running' = isRunning ? 'running' : 'queued';

  const lastUpdatedJobStatus = useMemo(() => {
    if (queue.length === 0) return null;
    const latest = queue.reduce((best, current) =>
      current.updatedAt > best.updatedAt ? current : best
    );
    return latest.status;
  }, [queue]);

  const prevPendingCountRef = useRef<number>(pendingCount);
  const opSequenceRef = useRef(Promise.resolve());

  const latestRef = useRef({
    pendingCount,
    queuedCount,
    tintColor,
    phase,
    lastUpdatedJobStatus,
    isInForeground,
  });

  useEffect(() => {
    latestRef.current = { pendingCount, queuedCount, tintColor, phase, lastUpdatedJobStatus, isInForeground };
  }, [pendingCount, queuedCount, tintColor, phase, lastUpdatedJobStatus, isInForeground]);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;

    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      setIsInForeground(nextState !== 'background');
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;

    const prevPendingCount = prevPendingCountRef.current;
    prevPendingCountRef.current = pendingCount;

    opSequenceRef.current = opSequenceRef.current.then(async () => {
      let voltraClient: any;
      try {
        voltraClient = await import('voltra/client');
      } catch (error) {
        // Likely running in Expo Go / no native module yet.
        return;
      }

      const {
        isLiveActivityActive,
        startLiveActivity,
        updateLiveActivity,
        stopLiveActivity,
      } = voltraClient as {
        isLiveActivityActive: (activityName: string) => boolean;
        startLiveActivity: (variants: any, options?: any) => Promise<string>;
        updateLiveActivity: (targetId: string, variants: any, options?: any) => Promise<void>;
        stopLiveActivity: (targetId: string, options?: any) => Promise<void>;
      };

      try {
        const latest = latestRef.current;

        if (!latest.isInForeground) {
          if (isLiveActivityActive(ACTIVITY_ID)) {
            await stopLiveActivity(ACTIVITY_ID, { dismissalPolicy: 'immediate' });
          }
          return;
        }

        if (latest.pendingCount > 0) {
          const variants = await buildGenerationLiveActivityVariants({
            phase: latest.phase,
            pendingCount: latest.pendingCount,
            queuedCount: latest.queuedCount,
            tintColor: latest.tintColor,
          });
          if (!variants) return;

          if (!isLiveActivityActive(ACTIVITY_ID)) {
            await startLiveActivity(variants, {
              activityName: ACTIVITY_ID,
              deepLinkUrl: DEEP_LINK_URL,
              relevanceScore: 1.0,
            });
          } else {
            await updateLiveActivity(ACTIVITY_ID, variants, { relevanceScore: 1.0 });
          }

          return;
        }

        if (!isLiveActivityActive(ACTIVITY_ID)) return;

        if (prevPendingCount > 0) {
          const phaseForCompletion =
            latest.lastUpdatedJobStatus === 'failed' || latest.lastUpdatedJobStatus === 'canceled'
              ? 'failed'
              : 'completed';

          const variants = await buildGenerationLiveActivityVariants({
            phase: phaseForCompletion,
            pendingCount: 0,
            queuedCount: 0,
            tintColor: latest.tintColor,
          });
          if (!variants) return;

          await updateLiveActivity(ACTIVITY_ID, variants, { relevanceScore: 0.2 });
          await stopLiveActivity(ACTIVITY_ID, { dismissalPolicy: 'immediate' });
        } else {
          await stopLiveActivity(ACTIVITY_ID, { dismissalPolicy: 'immediate' });
        }
      } catch (error) {
        log.warn('Live Activity sync failed:', error);
      }
    });
  }, [pendingCount, queuedCount, phase, tintColor, lastUpdatedJobStatus, isInForeground]);

  return null;
}
