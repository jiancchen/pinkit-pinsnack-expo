import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  Platform,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppColors } from '../constants/AppColors';
import { getLiquidGlassTabBarContentPaddingBottom } from '../constants/LiquidGlassTabBarLayout';
import {
  RuntimeLogEntry,
  RuntimeLogLevel,
  RuntimeLogService,
} from '../services/RuntimeLogService';
import { createLogger } from '../utils/Logger';

const log = createLogger('RuntimeLogs');

type RuntimeLogFilter = 'ALL' | 'ERRORS' | 'WARN' | 'INFO' | 'DEBUG';

const FILTER_OPTIONS: Array<{ key: RuntimeLogFilter; label: string }> = [
  { key: 'ALL', label: 'All' },
  { key: 'ERRORS', label: 'Errors' },
  { key: 'WARN', label: 'Warn' },
  { key: 'INFO', label: 'Info' },
  { key: 'DEBUG', label: 'Debug' },
];

const FILTER_LEVELS: Record<RuntimeLogFilter, RuntimeLogLevel[] | null> = {
  ALL: null,
  ERRORS: ['ERROR', 'FATAL'],
  WARN: ['WARN'],
  INFO: ['INFO'],
  DEBUG: ['DEBUG', 'VERBOSE'],
};

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
}

function levelColor(level: RuntimeLogLevel): string {
  switch (level) {
    case 'FATAL':
      return '#C81D25';
    case 'ERROR':
      return '#E63946';
    case 'WARN':
      return '#D97706';
    case 'INFO':
      return '#2563EB';
    case 'DEBUG':
      return '#0D9488';
    case 'VERBOSE':
      return '#475569';
    default:
      return '#475569';
  }
}

export default function RuntimeLogsPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [entries, setEntries] = useState<RuntimeLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSharing, setIsSharing] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<RuntimeLogFilter>('ALL');

  const contentBottomPadding = getLiquidGlassTabBarContentPaddingBottom(insets.bottom, 24);

  const loadLogs = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const next = await RuntimeLogService.list(350);
      setEntries(next);
    } catch (error) {
      log.error('Failed to load runtime logs:', error);
      Alert.alert('Error', 'Unable to load runtime logs.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      void loadLogs();
    }, [loadLogs])
  );

  const activeLevels = FILTER_LEVELS[selectedFilter];
  const filteredEntries = useMemo(() => {
    if (!activeLevels || activeLevels.length === 0) {
      return entries;
    }
    return entries.filter((entry) => activeLevels.includes(entry.level));
  }, [activeLevels, entries]);

  const handleShare = async () => {
    if (filteredEntries.length === 0) return;

    try {
      setIsSharing(true);
      const text = await RuntimeLogService.exportText(
        350,
        activeLevels ?? undefined
      );
      await Share.share({
        title: 'Runtime Logs',
        message: text,
      });
    } catch (error) {
      log.error('Failed to share runtime logs:', error);
      Alert.alert('Error', 'Unable to share runtime logs.');
    } finally {
      setIsSharing(false);
    }
  };

  const clearLogs = () => {
    Alert.alert(
      'Clear Runtime Logs',
      'Delete all stored runtime logs on this device?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsClearing(true);
              await RuntimeLogService.clear();
              setEntries([]);
            } catch (error) {
              log.error('Failed to clear runtime logs:', error);
              Alert.alert('Error', 'Unable to clear runtime logs.');
            } finally {
              setIsClearing(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      {Platform.OS === 'android' ? <StatusBar translucent backgroundColor="transparent" /> : null}

      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color="#111827" />
        </TouchableOpacity>

        <View style={styles.headerText}>
          <Text style={styles.title}>Runtime Logs</Text>
          <Text style={styles.subtitle}>Crash and debug logs saved on-device</Text>
        </View>

        <TouchableOpacity
          style={[styles.headerButton, isLoading ? styles.disabledButton : undefined]}
          onPress={() => void loadLogs()}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#111827" />
          ) : (
            <Ionicons name="refresh" size={18} color="#111827" />
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.controls}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {FILTER_OPTIONS.map((option) => {
            const isActive = option.key === selectedFilter;
            return (
              <TouchableOpacity
                key={option.key}
                style={[styles.filterChip, isActive ? styles.filterChipActive : undefined]}
                onPress={() => setSelectedFilter(option.key)}
              >
                <Text style={[styles.filterChipText, isActive ? styles.filterChipTextActive : undefined]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              (isSharing || filteredEntries.length === 0) ? styles.disabledButton : undefined,
            ]}
            onPress={() => void handleShare()}
            disabled={isSharing || filteredEntries.length === 0}
          >
            {isSharing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="share-outline" size={16} color="#fff" />
                <Text style={styles.actionButtonText}>Share</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.clearButton,
              (isClearing || entries.length === 0) ? styles.disabledButton : undefined,
            ]}
            onPress={clearLogs}
            disabled={isClearing || entries.length === 0}
          >
            {isClearing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="trash-outline" size={16} color="#fff" />
                <Text style={styles.actionButtonText}>Clear</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.logList}
        contentContainerStyle={[styles.logListContent, { paddingBottom: contentBottomPadding }]}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.emptyStateText}>Loading runtime logs...</Text>
          </View>
        ) : filteredEntries.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={22} color="rgba(255, 255, 255, 0.7)" />
            <Text style={styles.emptyStateText}>No logs for this filter yet.</Text>
          </View>
        ) : (
          filteredEntries.map((entry) => (
            <View key={entry.id} style={styles.logCard}>
              <View style={styles.logHeader}>
                <View style={[styles.levelBadge, { backgroundColor: levelColor(entry.level) }]}>
                  <Text style={styles.levelBadgeText}>{entry.level}</Text>
                </View>
                <Text style={styles.logTag}>{entry.tag}</Text>
                <Text style={styles.logTime}>{formatTimestamp(entry.timestamp)}</Text>
              </View>
              <Text style={styles.logMessage}>{entry.message}</Text>
              {entry.details ? <Text style={styles.logDetails}>{entry.details}</Text> : null}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.Primary,
  },
  header: {
    paddingTop: 58,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    fontSize: 12,
    color: 'rgba(0, 0, 0, 0.72)',
  },
  controls: {
    marginTop: 16,
    paddingHorizontal: 14,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 4,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.15)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  filterChipActive: {
    borderColor: '#111827',
    backgroundColor: '#111827',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1F2937',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#111827',
    flex: 1,
  },
  clearButton: {
    backgroundColor: '#991B1B',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.55,
  },
  logList: {
    flex: 1,
    marginTop: 14,
  },
  logListContent: {
    paddingHorizontal: 14,
    gap: 10,
    paddingBottom: 24,
  },
  logCard: {
    borderRadius: 12,
    backgroundColor: 'rgba(2, 6, 23, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 12,
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  levelBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  levelBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  logTag: {
    fontSize: 12,
    fontWeight: '700',
    color: '#E2E8F0',
    flex: 1,
  },
  logTime: {
    fontSize: 10,
    color: '#94A3B8',
  },
  logMessage: {
    fontSize: 13,
    color: '#F8FAFC',
    fontWeight: '600',
  },
  logDetails: {
    marginTop: 6,
    color: '#CBD5E1',
    fontSize: 12,
  },
  emptyState: {
    marginTop: 72,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  emptyStateText: {
    color: 'rgba(255,255,255,0.86)',
    fontSize: 14,
  },
});
