import React, { useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppColors } from '../src/constants/AppColors';
import { getLiquidGlassTabBarContentPaddingBottom } from '../src/constants/LiquidGlassTabBarLayout';
import AppThemeBackground from '../src/components/AppThemeBackground';
import { AppStorageService } from '../src/services/AppStorageService';
import { PromptHistoryService } from '../src/services/PromptHistoryService';
import { TokenStats, TokenTrackingService } from '../src/services/TokenTrackingService';
import { ScreenshotService } from '../src/services/ScreenshotService';
import { WebViewScreenshotService } from '../src/services/WebViewScreenshotService';
import { MODEL_INFO } from '../src/types/ClaudeApi';
import { useUISettingsStore } from '../src/stores/UISettingsStore';
import { createLogger } from '../src/utils/Logger';

const log = createLogger('Stats');

type StorageStats = { totalApps: number; favorites: number; estimatedSizeKB: number };
type PromptStats = { total: number; estimatedSizeKB: number };
type ScreenshotStats = { totalScreenshots: number; estimatedSizeKB: number };

type ChartDatum = {
  label: string;
  value: number;
  color: string;
  formattedValue?: string;
};

function formatSize(kb: number): string {
  if (!Number.isFinite(kb) || kb <= 0) return '0 KB';
  if (kb < 1024) return `${kb.toLocaleString()} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
}

function formatUsd(value: number): string {
  if (!Number.isFinite(value)) return '$—';
  if (value <= 0) return '$0.00';
  if (value < 0.01) return `$${value.toFixed(4)}`;
  if (value < 1) return `$${value.toFixed(3)}`;
  return `$${value.toFixed(2)}`;
}

interface MetricChipProps {
  label: string;
  value: string;
  isUniverseTheme: boolean;
}

function MetricChip({ label, value, isUniverseTheme }: MetricChipProps) {
  return (
    <View style={[styles.metricChip, isUniverseTheme ? styles.metricChipUniverse : undefined]}>
      <Text style={[styles.metricValue, isUniverseTheme ? styles.metricValueUniverse : undefined]}>{value}</Text>
      <Text style={[styles.metricLabel, isUniverseTheme ? styles.metricLabelUniverse : undefined]}>{label}</Text>
    </View>
  );
}

interface HorizontalBarChartProps {
  title: string;
  data: ChartDatum[];
  emptyLabel: string;
  isUniverseTheme: boolean;
}

function HorizontalBarChart({ title, data, emptyLabel, isUniverseTheme }: HorizontalBarChartProps) {
  const max = data.reduce((largest, item) => (item.value > largest ? item.value : largest), 0);

  return (
    <View style={styles.chartSection}>
      <Text style={[styles.chartTitle, isUniverseTheme ? styles.chartTitleUniverse : undefined]}>{title}</Text>
      {data.length === 0 || max <= 0 ? (
        <Text style={[styles.emptyText, isUniverseTheme ? styles.emptyTextUniverse : undefined]}>{emptyLabel}</Text>
      ) : (
        data.map((item) => {
          const widthPercent = Math.max(4, Math.round((item.value / max) * 100));
          return (
            <View key={item.label} style={styles.chartRow}>
              <View style={styles.chartRowHeader}>
                <View style={styles.chartLabelWrap}>
                  <View style={[styles.chartDot, { backgroundColor: item.color }]} />
                  <Text style={[styles.chartLabel, isUniverseTheme ? styles.chartLabelUniverse : undefined]}>
                    {item.label}
                  </Text>
                </View>
                <Text style={[styles.chartValue, isUniverseTheme ? styles.chartValueUniverse : undefined]}>
                  {item.formattedValue ?? item.value.toLocaleString()}
                </Text>
              </View>
              <View style={[styles.chartTrack, isUniverseTheme ? styles.chartTrackUniverse : undefined]}>
                <View style={[styles.chartFill, { width: `${widthPercent}%`, backgroundColor: item.color }]} />
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}

export default function StatsPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const appTheme = useUISettingsStore((s) => s.appTheme);
  const isUniverseTheme = appTheme === 'universe';

  const [appsStorageStats, setAppsStorageStats] = useState<StorageStats | null>(null);
  const [promptHistoryStats, setPromptHistoryStats] = useState<PromptStats | null>(null);
  const [screenshotStats, setScreenshotStats] = useState<ScreenshotStats | null>(null);
  const [webviewScreenshotStats, setWebviewScreenshotStats] = useState<ScreenshotStats | null>(null);
  const [tokenStats, setTokenStats] = useState<TokenStats | null>(null);
  const [estimatedCost, setEstimatedCost] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isClearingTokenHistory, setIsClearingTokenHistory] = useState(false);

  const scrollContentPaddingBottom = getLiquidGlassTabBarContentPaddingBottom(insets.bottom, 32);

  const loadStats = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const [apps, prompts, screenshots, webviewShots, tokens, cost] = await Promise.all([
        AppStorageService.getStorageStats(),
        PromptHistoryService.getStats(),
        ScreenshotService.getStorageStats(),
        WebViewScreenshotService.getStorageStats(),
        TokenTrackingService.getTokenStats(),
        TokenTrackingService.getTotalEstimatedCost(),
      ]);
      setAppsStorageStats(apps);
      setPromptHistoryStats(prompts);
      setScreenshotStats(screenshots);
      setWebviewScreenshotStats(webviewShots);
      setTokenStats(tokens);
      setEstimatedCost(cost);
    } catch (error) {
      log.error('Error loading statistics:', error);
      setAppsStorageStats(null);
      setPromptHistoryStats(null);
      setScreenshotStats(null);
      setWebviewScreenshotStats(null);
      setTokenStats(null);
      setEstimatedCost(0);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadStats();
  }, [loadStats]);

  useFocusEffect(
    React.useCallback(() => {
      void loadStats();
    }, [loadStats])
  );

  const getModelDisplayName = (model: string): string => MODEL_INFO[model]?.name || model;

  const totalStorageKB = useMemo(
    () =>
      (appsStorageStats?.estimatedSizeKB ?? 0) +
      (promptHistoryStats?.estimatedSizeKB ?? 0) +
      (screenshotStats?.estimatedSizeKB ?? 0) +
      (webviewScreenshotStats?.estimatedSizeKB ?? 0),
    [appsStorageStats, promptHistoryStats, screenshotStats, webviewScreenshotStats]
  );

  const storageBreakdown = useMemo<ChartDatum[]>(
    () => [
      {
        label: 'Apps',
        value: appsStorageStats?.estimatedSizeKB ?? 0,
        color: '#f97316',
        formattedValue: formatSize(appsStorageStats?.estimatedSizeKB ?? 0),
      },
      {
        label: 'Screenshots',
        value: (screenshotStats?.estimatedSizeKB ?? 0) + (webviewScreenshotStats?.estimatedSizeKB ?? 0),
        color: '#38bdf8',
        formattedValue: formatSize(
          (screenshotStats?.estimatedSizeKB ?? 0) + (webviewScreenshotStats?.estimatedSizeKB ?? 0)
        ),
      },
      {
        label: 'Prompt History',
        value: promptHistoryStats?.estimatedSizeKB ?? 0,
        color: '#22c55e',
        formattedValue: formatSize(promptHistoryStats?.estimatedSizeKB ?? 0),
      },
    ],
    [appsStorageStats, promptHistoryStats, screenshotStats, webviewScreenshotStats]
  );

  const ioBreakdown = useMemo<ChartDatum[]>(
    () => [
      {
        label: 'Input Tokens',
        value: tokenStats?.totalInputTokens ?? 0,
        color: '#06b6d4',
        formattedValue: (tokenStats?.totalInputTokens ?? 0).toLocaleString(),
      },
      {
        label: 'Output Tokens',
        value: tokenStats?.totalOutputTokens ?? 0,
        color: '#a855f7',
        formattedValue: (tokenStats?.totalOutputTokens ?? 0).toLocaleString(),
      },
    ],
    [tokenStats]
  );

  const usageByModel = useMemo<ChartDatum[]>(() => {
    if (!tokenStats) return [];
    return Object.entries(tokenStats.usageByModel)
      .map(([model, usage], index) => ({
        label: getModelDisplayName(model),
        value: usage.inputTokens + usage.outputTokens,
        color: ['#22d3ee', '#f59e0b', '#4ade80', '#8b5cf6', '#f43f5e', '#3b82f6'][index % 6],
        formattedValue: `${(usage.inputTokens + usage.outputTokens).toLocaleString()} tokens`,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [tokenStats]);

  const usageByOperation = useMemo<ChartDatum[]>(() => {
    if (!tokenStats) return [];
    return Object.entries(tokenStats.usageByOperation)
      .map(([operation, usage], index) => ({
        label: operation.replace(/_/g, ' '),
        value: usage.requests,
        color: ['#60a5fa', '#34d399', '#f97316', '#e879f9', '#f43f5e'][index % 5],
        formattedValue: `${usage.requests} requests`,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [tokenStats]);

  const handleClearTokenHistory = () => {
    Alert.alert(
      'Clear Token History',
      'Delete all token usage history on this device? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsClearingTokenHistory(true);
              await TokenTrackingService.clearTokenHistory();
              await loadStats();
            } catch (error) {
              log.error('Error clearing token history:', error);
              Alert.alert('Error', 'Failed to clear token history.');
            } finally {
              setIsClearingTokenHistory(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.container, isUniverseTheme ? styles.containerUniverse : undefined]} edges={[]}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle={isUniverseTheme ? 'light-content' : 'dark-content'}
      />
      <AppThemeBackground />

      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.backButton, isUniverseTheme ? styles.backButtonUniverse : undefined]}
          onPress={() => router.back()}
          accessibilityLabel="Back"
        >
          <Ionicons
            name="chevron-back"
            size={18}
            color={isUniverseTheme ? 'rgba(226, 240, 255, 0.95)' : 'rgba(0, 0, 0, 0.72)'}
          />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isUniverseTheme ? styles.headerTitleUniverse : undefined]}>
          App Stats
        </Text>
        <TouchableOpacity
          style={[styles.refreshButton, isUniverseTheme ? styles.refreshButtonUniverse : undefined]}
          onPress={() => void loadStats()}
          disabled={isLoading}
          accessibilityRole="button"
          accessibilityLabel="Refresh statistics"
        >
          <Ionicons
            name="refresh"
            size={16}
            color={isUniverseTheme ? 'rgba(226, 240, 255, 0.95)' : 'rgba(0, 0, 0, 0.72)'}
          />
          <Text style={[styles.refreshButtonText, isUniverseTheme ? styles.refreshButtonTextUniverse : undefined]}>
            Refresh
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollContentPaddingBottom }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.card, isUniverseTheme ? styles.cardUniverse : undefined]}>
          <Text style={[styles.cardTitle, isUniverseTheme ? styles.cardTitleUniverse : undefined]}>Overview</Text>
          <View style={styles.metricsGrid}>
            <MetricChip
              label="Apps"
              value={isLoading ? '…' : `${appsStorageStats?.totalApps ?? 0}`}
              isUniverseTheme={isUniverseTheme}
            />
            <MetricChip
              label="Favorites"
              value={isLoading ? '…' : `${appsStorageStats?.favorites ?? 0}`}
              isUniverseTheme={isUniverseTheme}
            />
            <MetricChip
              label="Requests"
              value={isLoading ? '…' : `${tokenStats?.totalRequests ?? 0}`}
              isUniverseTheme={isUniverseTheme}
            />
            <MetricChip
              label="Total Cost"
              value={isLoading ? '…' : formatUsd(estimatedCost)}
              isUniverseTheme={isUniverseTheme}
            />
          </View>
        </View>

        <View style={[styles.card, isUniverseTheme ? styles.cardUniverse : undefined]}>
          <Text style={[styles.cardTitle, isUniverseTheme ? styles.cardTitleUniverse : undefined]}>
            App Statistics
          </Text>
          <Text style={[styles.cardSubtitle, isUniverseTheme ? styles.cardSubtitleUniverse : undefined]}>
            Estimated storage total: {isLoading ? '…' : formatSize(totalStorageKB)}
          </Text>
          <HorizontalBarChart
            title="Storage Breakdown"
            data={storageBreakdown}
            emptyLabel="No storage usage data yet."
            isUniverseTheme={isUniverseTheme}
          />
        </View>

        <View style={[styles.card, isUniverseTheme ? styles.cardUniverse : undefined]}>
          <Text style={[styles.cardTitle, isUniverseTheme ? styles.cardTitleUniverse : undefined]}>
            Token Usage & Costs
          </Text>
          <Text style={[styles.cardSubtitle, isUniverseTheme ? styles.cardSubtitleUniverse : undefined]}>
            {isLoading
              ? 'Loading token usage...'
              : `${(tokenStats?.totalTokens ?? 0).toLocaleString()} tokens across ${tokenStats?.totalRequests ?? 0} requests`}
          </Text>
          <HorizontalBarChart
            title="Input vs Output"
            data={ioBreakdown}
            emptyLabel="No token usage found."
            isUniverseTheme={isUniverseTheme}
          />
          <TouchableOpacity
            style={[styles.dangerButton, isClearingTokenHistory ? styles.dangerButtonDisabled : undefined]}
            onPress={handleClearTokenHistory}
            disabled={isClearingTokenHistory}
          >
            <Ionicons name="trash-outline" size={16} color="white" style={{ marginRight: 8 }} />
            <Text style={styles.dangerButtonText}>
              {isClearingTokenHistory ? 'Clearing...' : 'Clear Token History'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.card, isUniverseTheme ? styles.cardUniverse : undefined]}>
          <HorizontalBarChart
            title="Usage by Model"
            data={usageByModel}
            emptyLabel="No model usage yet."
            isUniverseTheme={isUniverseTheme}
          />
          <HorizontalBarChart
            title="Usage by Operation"
            data={usageByOperation}
            emptyLabel="No operation data yet."
            isUniverseTheme={isUniverseTheme}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.Primary,
  },
  containerUniverse: {
    backgroundColor: 'transparent',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.68)',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  backButtonUniverse: {
    backgroundColor: 'rgba(11, 37, 65, 0.84)',
    borderColor: 'rgba(155, 196, 239, 0.34)',
  },
  headerTitle: {
    flex: 1,
    fontSize: 24,
    fontWeight: '900',
    color: 'rgba(0, 0, 0, 0.84)',
  },
  headerTitleUniverse: {
    color: 'rgba(234, 246, 255, 0.95)',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.68)',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  refreshButtonUniverse: {
    backgroundColor: 'rgba(11, 37, 65, 0.84)',
    borderColor: 'rgba(155, 196, 239, 0.34)',
  },
  refreshButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(0, 0, 0, 0.72)',
  },
  refreshButtonTextUniverse: {
    color: 'rgba(226, 240, 255, 0.95)',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
    gap: 14,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    padding: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardUniverse: {
    backgroundColor: 'rgba(8, 22, 42, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(123, 169, 220, 0.42)',
    shadowOpacity: 0.22,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: 'rgba(0, 0, 0, 0.84)',
  },
  cardTitleUniverse: {
    color: 'rgba(226, 240, 255, 0.95)',
  },
  cardSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: 'rgba(0, 0, 0, 0.62)',
  },
  cardSubtitleUniverse: {
    color: 'rgba(190, 216, 244, 0.86)',
  },
  metricsGrid: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricChip: {
    width: '48%',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: 'rgba(255, 245, 210, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  metricChipUniverse: {
    backgroundColor: 'rgba(10, 32, 58, 0.92)',
    borderColor: 'rgba(123, 169, 220, 0.3)',
  },
  metricValue: {
    fontSize: 17,
    fontWeight: '900',
    color: 'rgba(0, 0, 0, 0.86)',
  },
  metricValueUniverse: {
    color: 'rgba(232, 245, 255, 0.96)',
  },
  metricLabel: {
    marginTop: 2,
    fontSize: 11,
    color: 'rgba(0, 0, 0, 0.58)',
  },
  metricLabelUniverse: {
    color: 'rgba(190, 216, 244, 0.86)',
  },
  chartSection: {
    marginTop: 12,
  },
  chartTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: 'rgba(0, 0, 0, 0.78)',
    marginBottom: 8,
  },
  chartTitleUniverse: {
    color: 'rgba(224, 240, 255, 0.93)',
  },
  chartRow: {
    marginBottom: 10,
  },
  chartRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    gap: 8,
  },
  chartLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    gap: 6,
  },
  chartDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chartLabel: {
    fontSize: 12,
    color: 'rgba(0, 0, 0, 0.68)',
    textTransform: 'capitalize',
  },
  chartLabelUniverse: {
    color: 'rgba(200, 223, 248, 0.9)',
  },
  chartValue: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(0, 0, 0, 0.7)',
  },
  chartValueUniverse: {
    color: 'rgba(225, 241, 255, 0.9)',
  },
  chartTrack: {
    width: '100%',
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
    overflow: 'hidden',
  },
  chartTrackUniverse: {
    backgroundColor: 'rgba(140, 185, 235, 0.2)',
  },
  chartFill: {
    height: '100%',
    borderRadius: 999,
  },
  emptyText: {
    fontSize: 12,
    color: 'rgba(0, 0, 0, 0.55)',
  },
  emptyTextUniverse: {
    color: 'rgba(190, 216, 244, 0.84)',
  },
  dangerButton: {
    marginTop: 14,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#dc3545',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerButtonDisabled: {
    opacity: 0.6,
  },
  dangerButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
});
