import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppColors } from '../../src/constants/AppColors';
import { getLiquidGlassTabBarContentPaddingBottom } from '../../src/constants/LiquidGlassTabBarLayout';
import { AppStorageService, StoredApp } from '../../src/services/AppStorageService';
import { TopicClassificationService } from '../../src/services/TopicClassificationService';
import { createLogger } from '../../src/utils/Logger';

const log = createLogger('UniverseScreen');

const TOPIC_COLORS = [
  '#ff6f61',
  '#2a9d8f',
  '#e76f51',
  '#457b9d',
  '#f4a261',
  '#3a86ff',
  '#588157',
  '#bc6c25',
  '#ffb703',
  '#6d597a',
];

type TopicGroup = {
  topic: string;
  apps: StoredApp[];
  color: string;
};

type TopicNode = {
  topic: string;
  x: number;
  y: number;
  color: string;
  apps: StoredApp[];
  angle: number;
};

type ProjectNode = {
  key: string;
  app: StoredApp;
  x: number;
  y: number;
  topic: string;
  color: string;
};

type Edge = {
  key: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

function formatTopicLabel(topic: string): string {
  return topic
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function getPrimaryTopic(app: StoredApp): string {
  if (app.primaryTopic && app.primaryTopic.trim()) return app.primaryTopic.trim();
  if (Array.isArray(app.topics) && app.topics.length > 0) return app.topics[0];
  if (app.category && app.category.trim()) return app.category.trim().toLowerCase();
  return 'other';
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export default function UniversePage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  const [apps, setApps] = useState<StoredApp[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const backfillTriggeredRef = useRef(false);

  const scrollContentPaddingBottom = getLiquidGlassTabBarContentPaddingBottom(insets.bottom, 28);

  const loadApps = React.useCallback(async (showLoading = true): Promise<void> => {
    if (showLoading) {
      setIsLoading(true);
    }

    try {
      const storedApps = await AppStorageService.getAllApps();
      const sorted = [...storedApps].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      setApps(sorted);

      if (sorted.length > 0) {
        setSelectedTopic((current) => current || getPrimaryTopic(sorted[0]));
      }

      const needsBackfill = sorted.some(
        (app) => !app.primaryTopic || !Array.isArray(app.topics) || app.topics.length === 0
      );

      if (!backfillTriggeredRef.current && needsBackfill) {
        backfillTriggeredRef.current = true;
        void TopicClassificationService.classifyAllApps({ reason: 'universe_backfill' })
          .then(() => loadApps(false))
          .catch((error: unknown) => {
            log.warn('Universe backfill failed:', error);
          });
      }
    } catch (error) {
      log.error('Failed to load apps for universe:', error);
      Alert.alert('Error', 'Failed to load projects.');
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      void loadApps();
    }, [loadApps])
  );

  const topicGroups = useMemo<TopicGroup[]>(() => {
    const buckets = new Map<string, StoredApp[]>();

    for (const app of apps) {
      const topic = getPrimaryTopic(app);
      const existing = buckets.get(topic) || [];
      existing.push(app);
      buckets.set(topic, existing);
    }

    return [...buckets.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .map(([topic, groupedApps], index) => ({
        topic,
        apps: groupedApps,
        color: TOPIC_COLORS[index % TOPIC_COLORS.length],
      }));
  }, [apps]);

  const graphWidth = Math.max(900, Math.round(screenWidth * 1.45));
  const graphHeight = 700;

  const graph = useMemo(() => {
    const topics = topicGroups.slice(0, 14);
    const centerX = graphWidth / 2;
    const centerY = graphHeight / 2;
    const orbitX = Math.min(300, graphWidth * 0.3);
    const orbitY = Math.min(250, graphHeight * 0.28);

    const topicNodes: TopicNode[] = topics.map((group, index) => {
      const angle = (index / Math.max(1, topics.length)) * Math.PI * 2 - Math.PI / 2;
      return {
        topic: group.topic,
        apps: group.apps,
        color: group.color,
        angle,
        x: centerX + Math.cos(angle) * orbitX,
        y: centerY + Math.sin(angle) * orbitY,
      };
    });

    const projectNodes: ProjectNode[] = [];
    const edges: Edge[] = [];

    for (const topicNode of topicNodes) {
      const projects = topicNode.apps.slice(0, 4);
      for (let index = 0; index < projects.length; index += 1) {
        const app = projects[index];
        const fanOffset = (index - (projects.length - 1) / 2) * 0.48;
        const distance = 110 + (index % 2) * 28;
        const angle = topicNode.angle + fanOffset;
        const x = clamp(topicNode.x + Math.cos(angle) * distance, 48, graphWidth - 48);
        const y = clamp(topicNode.y + Math.sin(angle) * distance, 48, graphHeight - 48);

        projectNodes.push({
          key: `${topicNode.topic}-${app.id}`,
          app,
          x,
          y,
          topic: topicNode.topic,
          color: topicNode.color,
        });

        edges.push({
          key: `edge-${topicNode.topic}-${app.id}`,
          x1: topicNode.x,
          y1: topicNode.y,
          x2: x,
          y2: y,
        });
      }
    }

    return { topicNodes, projectNodes, edges };
  }, [graphHeight, graphWidth, topicGroups]);

  const selectedGroup = useMemo(
    () => topicGroups.find((group) => group.topic === selectedTopic) || topicGroups[0] || null,
    [topicGroups, selectedTopic]
  );

  const handleSyncTopics = async () => {
    try {
      setIsSyncing(true);
      const result = await TopicClassificationService.classifyAllApps({
        force: true,
        reason: 'universe_manual_sync',
      });
      await loadApps(false);
      Alert.alert(
        'Topics Synced',
        `Processed ${result.processed} projects.\nUpdated ${result.updated}, skipped ${result.skipped}.`
      );
    } catch (error) {
      log.error('Failed to sync topics:', error);
      Alert.alert('Sync failed', 'Unable to reclassify topics right now.');
    } finally {
      setIsSyncing(false);
    }
  };

  const openProject = (appId: string): void => {
    router.push(`/app-view?appId=${appId}`);
  };

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <StatusBar translucent backgroundColor="transparent" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollContentPaddingBottom }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerCard}>
          <View>
            <Text style={styles.title}>Project Universe</Text>
            <Text style={styles.subtitle}>
              {apps.length} projects mapped into {topicGroups.length} topics
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => void loadApps(false)}
              disabled={isLoading || isSyncing}
            >
              <Ionicons name="refresh-outline" size={20} color="#111" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.syncButton, isSyncing ? styles.syncButtonDisabled : undefined]}
              onPress={handleSyncTopics}
              disabled={isSyncing}
            >
              {isSyncing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="sparkles-outline" size={16} color="#fff" />
              )}
              <Text style={styles.syncButtonText}>{isSyncing ? 'Syncing' : 'Sync Topics'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {isLoading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color="#111" />
            <Text style={styles.loadingText}>Building universe map...</Text>
          </View>
        ) : (
          <>
            <ScrollView
              horizontal
              style={styles.graphScroll}
              contentContainerStyle={styles.graphScrollContent}
              showsHorizontalScrollIndicator={false}
            >
              <View style={[styles.graphBoard, { width: graphWidth, height: graphHeight }]}>
                <View style={styles.centerNode}>
                  <Ionicons name="apps-outline" size={24} color="#111" />
                  <Text style={styles.centerNodeText}>All Projects</Text>
                </View>

                {graph.edges.map((edge) => {
                  const dx = edge.x2 - edge.x1;
                  const dy = edge.y2 - edge.y1;
                  const length = Math.sqrt(dx * dx + dy * dy);
                  const angle = Math.atan2(dy, dx);
                  return (
                    <View
                      key={edge.key}
                      style={[
                        styles.edge,
                        {
                          width: length,
                          left: (edge.x1 + edge.x2) / 2 - length / 2,
                          top: (edge.y1 + edge.y2) / 2,
                          transform: [{ rotate: `${angle}rad` }],
                        },
                      ]}
                    />
                  );
                })}

                {graph.topicNodes.map((node) => (
                  <TouchableOpacity
                    key={node.topic}
                    style={[
                      styles.topicNode,
                      {
                        left: node.x - 52,
                        top: node.y - 32,
                        borderColor: node.color,
                        backgroundColor: selectedGroup?.topic === node.topic ? node.color : '#fff8e3',
                      },
                    ]}
                    onPress={() => setSelectedTopic(node.topic)}
                  >
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.topicNodeLabel,
                        { color: selectedGroup?.topic === node.topic ? '#fff' : '#111' },
                      ]}
                    >
                      {formatTopicLabel(node.topic)}
                    </Text>
                    <Text
                      style={[
                        styles.topicNodeCount,
                        { color: selectedGroup?.topic === node.topic ? 'rgba(255,255,255,0.92)' : '#444' },
                      ]}
                    >
                      {node.apps.length}
                    </Text>
                  </TouchableOpacity>
                ))}

                {graph.projectNodes.map((node) => (
                  <TouchableOpacity
                    key={node.key}
                    style={[
                      styles.projectNode,
                      {
                        left: node.x - 58,
                        top: node.y - 24,
                        borderColor: node.color,
                        backgroundColor: 'rgba(255,255,255,0.96)',
                      },
                    ]}
                    onPress={() => openProject(node.app.id)}
                  >
                    <Text numberOfLines={1} style={styles.projectNodeTitle}>
                      {node.app.title}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={styles.topicSelectorRow}>
              {topicGroups.map((group) => (
                <TouchableOpacity
                  key={group.topic}
                  style={[
                    styles.topicChip,
                    {
                      borderColor: group.color,
                      backgroundColor: selectedGroup?.topic === group.topic ? group.color : 'transparent',
                    },
                  ]}
                  onPress={() => setSelectedTopic(group.topic)}
                >
                  <Text
                    style={[
                      styles.topicChipText,
                      { color: selectedGroup?.topic === group.topic ? '#fff' : '#111' },
                    ]}
                  >
                    {formatTopicLabel(group.topic)} ({group.apps.length})
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.topicListCard}>
              <Text style={styles.topicListTitle}>
                {selectedGroup ? formatTopicLabel(selectedGroup.topic) : 'No Topics'}
              </Text>
              {selectedGroup?.apps.map((app) => (
                <TouchableOpacity key={app.id} style={styles.projectRow} onPress={() => openProject(app.id)}>
                  <View style={styles.projectRowMain}>
                    <Text style={styles.projectRowTitle}>{app.title}</Text>
                    <Text style={styles.projectRowMeta}>
                      {formatTopicLabel(getPrimaryTopic(app))} • {app.status}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#222" />
                </TouchableOpacity>
              ))}
              {!selectedGroup && <Text style={styles.emptyText}>No projects to show.</Text>}
            </View>
          </>
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 56,
    paddingHorizontal: 16,
    gap: 16,
  },
  headerCard: {
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  title: {
    fontSize: 23,
    fontWeight: '900',
    color: '#111',
  },
  subtitle: {
    marginTop: 3,
    fontSize: 13,
    color: '#444',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    height: 36,
    width: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    backgroundColor: '#fff',
  },
  syncButton: {
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#1f6feb',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  syncButtonDisabled: {
    opacity: 0.7,
  },
  syncButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#fff',
  },
  loadingState: {
    minHeight: 220,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  graphScroll: {
    marginHorizontal: -4,
  },
  graphScrollContent: {
    paddingHorizontal: 4,
  },
  graphBoard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    backgroundColor: '#fff7db',
    overflow: 'hidden',
  },
  centerNode: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: -56,
    marginTop: -34,
    width: 112,
    height: 68,
    borderRadius: 20,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  centerNodeText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '700',
  },
  edge: {
    position: 'absolute',
    height: 1,
    backgroundColor: 'rgba(17,17,17,0.26)',
  },
  topicNode: {
    position: 'absolute',
    minWidth: 104,
    maxWidth: 126,
    minHeight: 64,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
  },
  topicNodeLabel: {
    fontSize: 12,
    fontWeight: '800',
  },
  topicNodeCount: {
    fontSize: 12,
    fontWeight: '700',
  },
  projectNode: {
    position: 'absolute',
    width: 116,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 7,
    justifyContent: 'center',
  },
  projectNodeTitle: {
    fontSize: 11,
    color: '#111',
    fontWeight: '700',
  },
  topicSelectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  topicChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  topicChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  topicListCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    backgroundColor: 'rgba(255,255,255,0.9)',
    overflow: 'hidden',
  },
  topicListTitle: {
    fontSize: 18,
    fontWeight: '900',
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#111',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  projectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  projectRowMain: {
    flex: 1,
    paddingRight: 12,
  },
  projectRowTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#141414',
  },
  projectRowMeta: {
    marginTop: 2,
    fontSize: 12,
    color: '#505050',
  },
  emptyText: {
    fontSize: 13,
    color: '#555',
    padding: 14,
  },
});
