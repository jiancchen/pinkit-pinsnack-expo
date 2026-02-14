import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { AppColors } from '../../src/constants/AppColors';
import { getLiquidGlassTabBarContentPaddingBottom } from '../../src/constants/LiquidGlassTabBarLayout';
import { AppStorageService, StoredApp } from '../../src/services/AppStorageService';
import { TopicClassificationService } from '../../src/services/TopicClassificationService';
import { TopicPreferencesService } from '../../src/services/TopicPreferencesService';
import { createLogger } from '../../src/utils/Logger';

const log = createLogger('UniverseScreen');

const TOPIC_COLORS = [
  '#53D8FB',
  '#F95738',
  '#F0B429',
  '#4CD3C2',
  '#9FD356',
  '#FB6B90',
  '#53A2BE',
  '#F08A5D',
  '#9B5DE5',
  '#7BD389',
  '#F46036',
  '#00A8E8',
];

type TopicGroup = {
  topic: string;
  apps: StoredApp[];
  color: string;
};

type OrbitConfig = {
  topic: string;
  color: string;
  appCount: number;
  radius: number;
  speed: number;
  phaseDeg: number;
  size: number;
};

type Star = {
  x: number;
  y: number;
  size: number;
  opacity: number;
};

function formatTopicLabel(topic: string): string {
  return topic
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatSortTime(timestamp?: number): string {
  if (!timestamp) return 'never';
  return new Date(timestamp).toLocaleString();
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

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function sortMoons(apps: StoredApp[]): StoredApp[] {
  return [...apps].sort((a, b) => {
    const accessDiff = (b.accessCount || 0) - (a.accessCount || 0);
    if (accessDiff !== 0) return accessDiff;

    const favoriteDiff = Number(b.favorite === true) - Number(a.favorite === true);
    if (favoriteDiff !== 0) return favoriteDiff;

    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });
}

type OrbitPlanetProps = {
  centerX: number;
  centerY: number;
  orbit: OrbitConfig;
  isSelected: boolean;
  rotationProgress: SharedValue<number>;
  onPress: (topic: string) => void;
};

function OrbitPlanet({
  centerX,
  centerY,
  orbit,
  isSelected,
  rotationProgress,
  onPress,
}: OrbitPlanetProps) {
  const orbitAnimatedStyle = useAnimatedStyle(() => {
    const angle = orbit.phaseDeg + rotationProgress.value * 360 * orbit.speed;
    return {
      transform: [{ rotate: `${angle}deg` }],
    };
  });

  const ringAnimatedStyle = useAnimatedStyle(() => {
    const pulse = isSelected ? 1 + Math.sin(rotationProgress.value * Math.PI * 2) * 0.02 : 1;
    return {
      transform: [{ scale: pulse }],
      opacity: isSelected ? 0.9 : 0.55,
    };
  });

  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.orbitRing,
          {
            width: orbit.radius * 2,
            height: orbit.radius * 2,
            borderColor: `${orbit.color}${isSelected ? '99' : '44'}`,
            left: centerX - orbit.radius,
            top: centerY - orbit.radius,
          },
          ringAnimatedStyle,
        ]}
      />

      <Animated.View style={[styles.orbitLayer, orbitAnimatedStyle]} pointerEvents="box-none">
        <TouchableOpacity
          activeOpacity={0.9}
          style={[
            styles.planet,
            {
              width: orbit.size,
              height: orbit.size,
              borderRadius: orbit.size / 2,
              left: centerX - orbit.size / 2,
              top: centerY - orbit.radius - orbit.size / 2,
              borderColor: isSelected ? '#ffffff' : `${orbit.color}BB`,
            },
          ]}
          onPress={() => onPress(orbit.topic)}
        >
          <LinearGradient
            colors={[orbit.color, '#101820']}
            start={{ x: 0.15, y: 0.1 }}
            end={{ x: 0.9, y: 0.9 }}
            style={styles.planetGradient}
          >
            <Text style={styles.planetCount}>{orbit.appCount}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>

      <Animated.View style={[styles.orbitLabelContainer, orbitAnimatedStyle]} pointerEvents="none">
        <View
          style={[
            styles.orbitLabel,
            {
              left: centerX - 56,
              top: centerY - orbit.radius - orbit.size / 2 - 28,
              borderColor: `${orbit.color}88`,
              backgroundColor: isSelected ? 'rgba(255,255,255,0.14)' : 'rgba(2,12,27,0.55)',
            },
          ]}
        >
          <Text style={styles.orbitLabelText} numberOfLines={1}>
            {formatTopicLabel(orbit.topic)}
          </Text>
        </View>
      </Animated.View>
    </>
  );
}

export default function UniversePage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  const [apps, setApps] = useState<StoredApp[]>([]);
  const [customTopics, setCustomTopics] = useState<string[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [modalTopic, setModalTopic] = useState<string | null>(null);
  const [showTopicManager, setShowTopicManager] = useState(false);
  const [newCustomTopic, setNewCustomTopic] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isUpdatingTopics, setIsUpdatingTopics] = useState(false);
  const backfillTriggeredRef = useRef(false);

  const scrollContentPaddingBottom = getLiquidGlassTabBarContentPaddingBottom(insets.bottom, 28);

  const rotationProgress = useSharedValue(0);
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const panStartX = useSharedValue(0);
  const panStartY = useSharedValue(0);
  const pinchStartScale = useSharedValue(1);

  React.useEffect(() => {
    rotationProgress.value = withRepeat(
      withTiming(1, {
        duration: 28000,
        easing: Easing.linear,
      }),
      -1,
      false
    );
  }, [rotationProgress]);

  const resetViewport = () => {
    scale.value = withTiming(1, { duration: 240 });
    translateX.value = withTiming(0, { duration: 240 });
    translateY.value = withTiming(0, { duration: 240 });
  };

  const panGesture = Gesture.Pan()
    .onStart(() => {
      panStartX.value = translateX.value;
      panStartY.value = translateY.value;
    })
    .onUpdate((event) => {
      translateX.value = panStartX.value + event.translationX;
      translateY.value = panStartY.value + event.translationY;
    });

  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      pinchStartScale.value = scale.value;
    })
    .onUpdate((event) => {
      const next = pinchStartScale.value * event.scale;
      scale.value = clamp(next, 0.65, 2.6);
    });

  const mapGesture = Gesture.Simultaneous(panGesture, pinchGesture);

  const mapTransformStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }, { scale: scale.value }],
  }));

  const loadApps = React.useCallback(async (showLoading = true): Promise<void> => {
    if (showLoading) {
      setIsLoading(true);
    }

    try {
      const [storedApps, topicConfig] = await Promise.all([
        AppStorageService.getAllApps(),
        TopicPreferencesService.getCustomTopics(),
      ]);

      const sorted = [...storedApps].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      setApps(sorted);
      setCustomTopics(topicConfig);

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
        apps: sortMoons(groupedApps),
        color: TOPIC_COLORS[index % TOPIC_COLORS.length],
      }));
  }, [apps]);

  const selectedGroup = useMemo(
    () => topicGroups.find((group) => group.topic === selectedTopic) || topicGroups[0] || null,
    [topicGroups, selectedTopic]
  );

  const modalGroup = useMemo(
    () => topicGroups.find((group) => group.topic === modalTopic) || null,
    [topicGroups, modalTopic]
  );

  const mapWidth = Math.max(screenWidth - 24, 340);
  const mapHeight = Math.max(480, Math.min(660, 320 + topicGroups.length * 22));
  const centerX = mapWidth / 2;
  const centerY = mapHeight / 2;

  const orbits = useMemo<OrbitConfig[]>(() => {
    if (topicGroups.length === 0) return [];

    const minRadius = 72;
    const maxRadius = Math.max(minRadius + 28, Math.min(mapWidth, mapHeight) / 2 - 42);
    const step = topicGroups.length > 1 ? (maxRadius - minRadius) / (topicGroups.length - 1) : 0;

    return topicGroups.map((group, index) => {
      const normalizedCount = clamp(group.apps.length, 1, 20);
      const size = clamp(26 + normalizedCount * 2.2, 28, 62);
      return {
        topic: group.topic,
        color: group.color,
        appCount: group.apps.length,
        radius: minRadius + step * index,
        speed: 0.58 + index * 0.16,
        phaseDeg: (360 / topicGroups.length) * index,
        size,
      };
    });
  }, [mapWidth, mapHeight, topicGroups]);

  const stars = useMemo<Star[]>(() => {
    const count = 180;
    return Array.from({ length: count }, (_, index) => {
      const sx = seededRandom(index * 17 + mapWidth * 0.11) * mapWidth;
      const sy = seededRandom(index * 19 + mapHeight * 0.07) * mapHeight;
      const size = 0.8 + seededRandom(index * 23 + 8) * 2.2;
      const opacity = 0.25 + seededRandom(index * 29 + 13) * 0.7;
      return { x: sx, y: sy, size, opacity };
    });
  }, [mapHeight, mapWidth]);

  const handleSyncTopics = async (reason = 'universe_manual_sync') => {
    try {
      setIsSyncing(true);
      const result = await TopicClassificationService.classifyAllApps({
        force: true,
        reason,
      });
      await loadApps(false);
      Alert.alert(
        'Planetary Map Updated',
        `Processed ${result.processed} projects. Updated ${result.updated}, skipped ${result.skipped}.`
      );
    } catch (error) {
      log.error('Failed to sync topics:', error);
      Alert.alert('Sync failed', 'Unable to reclassify topics right now.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleTopicPress = (topic: string): void => {
    setSelectedTopic(topic);
    setModalTopic(topic);
  };

  const openProject = (appId: string): void => {
    router.push(`/app-view?appId=${appId}`);
  };

  const addCustomTopic = async () => {
    if (!newCustomTopic.trim()) {
      return;
    }

    setIsUpdatingTopics(true);
    try {
      const result = await TopicPreferencesService.addCustomTopic(newCustomTopic);
      if (!result.ok) {
        Alert.alert('Invalid topic', result.reason || 'Could not add this topic.');
        return;
      }

      setNewCustomTopic('');
      await handleSyncTopics('custom_topic_added');
      const nextCustomTopics = await TopicPreferencesService.getCustomTopics();
      setCustomTopics(nextCustomTopics);
    } catch (error) {
      log.error('Failed to add custom topic:', error);
      Alert.alert('Error', 'Unable to add custom topic.');
    } finally {
      setIsUpdatingTopics(false);
    }
  };

  const removeCustomTopic = async (topic: string) => {
    Alert.alert(
      'Remove Topic Planet',
      `Remove "${formatTopicLabel(topic)}" and re-sort all projects?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setIsUpdatingTopics(true);
            try {
              await TopicPreferencesService.removeCustomTopic(topic);
              await handleSyncTopics('custom_topic_removed');
              const nextCustomTopics = await TopicPreferencesService.getCustomTopics();
              setCustomTopics(nextCustomTopics);
            } catch (error) {
              log.error('Failed to remove custom topic:', error);
              Alert.alert('Error', 'Unable to remove topic.');
            } finally {
              setIsUpdatingTopics(false);
            }
          },
        },
      ]
    );
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
          <View style={styles.headerMain}>
            <Text style={styles.title}>Galaxy Universe</Text>
            <Text style={styles.subtitle}>
              {topicGroups.length} orbiting topic planets around your project core
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.iconButton} onPress={() => setShowTopicManager(true)}>
              <Ionicons name="planet-outline" size={19} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={resetViewport}>
              <Ionicons name="locate-outline" size={19} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.syncButton, isSyncing ? styles.syncButtonDisabled : undefined]}
              onPress={() => void handleSyncTopics()}
              disabled={isSyncing}
            >
              {isSyncing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="sparkles-outline" size={15} color="#fff" />
              )}
              <Text style={styles.syncButtonText}>{isSyncing ? 'Sorting...' : 'AI Sort'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {isLoading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.loadingText}>Spinning up your planetary system...</Text>
          </View>
        ) : (
          <>
            <View style={[styles.galaxyCard, { height: mapHeight }]}> 
              <LinearGradient
                colors={['#020b1f', '#041a33', '#07223f', '#0b1d2e']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />

              {stars.map((star, index) => (
                <View
                  key={`star-${index}`}
                  pointerEvents="none"
                  style={[
                    styles.star,
                    {
                      left: star.x,
                      top: star.y,
                      width: star.size,
                      height: star.size,
                      borderRadius: star.size / 2,
                      opacity: star.opacity,
                    },
                  ]}
                />
              ))}

              <GestureDetector gesture={mapGesture}>
                <Animated.View style={[styles.galaxyScene, mapTransformStyle]}>
                  <View style={[styles.coreSun, { left: centerX - 34, top: centerY - 34 }]}>
                    <LinearGradient
                      colors={['#FFE27A', '#FF9F1C', '#FB5607']}
                      start={{ x: 0.15, y: 0.12 }}
                      end={{ x: 0.82, y: 0.92 }}
                      style={styles.coreSunGradient}
                    >
                      <Ionicons name="apps" size={20} color="#111" />
                    </LinearGradient>
                  </View>

                  {orbits.map((orbit) => (
                    <OrbitPlanet
                      key={orbit.topic}
                      centerX={centerX}
                      centerY={centerY}
                      orbit={orbit}
                      isSelected={selectedGroup?.topic === orbit.topic}
                      rotationProgress={rotationProgress}
                      onPress={handleTopicPress}
                    />
                  ))}
                </Animated.View>
              </GestureDetector>
            </View>

            <View style={styles.topicSelectorRow}>
              {topicGroups.map((group) => (
                <TouchableOpacity
                  key={group.topic}
                  style={[
                    styles.topicChip,
                    {
                      borderColor: `${group.color}AA`,
                      backgroundColor: selectedGroup?.topic === group.topic ? `${group.color}66` : 'rgba(255,255,255,0.08)',
                    },
                  ]}
                  onPress={() => handleTopicPress(group.topic)}
                >
                  <Text style={styles.topicChipText}>
                    {formatTopicLabel(group.topic)} ({group.apps.length})
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.selectedPanel}>
              <Text style={styles.selectedPanelTitle}>
                {selectedGroup ? `${formatTopicLabel(selectedGroup.topic)} Moons` : 'No Topic Selected'}
              </Text>
              {selectedGroup && selectedGroup.apps.length > 0 ? (
                selectedGroup.apps.slice(0, 6).map((app, index) => (
                  <TouchableOpacity
                    key={app.id}
                    style={styles.moonRow}
                    onPress={() => openProject(app.id)}
                  >
                    <View style={styles.moonBullet}>
                      <Text style={styles.moonBulletText}>{index + 1}</Text>
                    </View>
                    <View style={styles.moonTextWrap}>
                      <Text style={styles.moonTitle}>{app.title}</Text>
                      <Text style={styles.moonMeta}>Uses {app.accessCount || 0} • {app.status}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={17} color="rgba(255,255,255,0.7)" />
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={styles.emptyText}>No moons in this orbit yet.</Text>
              )}
            </View>
          </>
        )}
      </ScrollView>

      <Modal visible={!!modalGroup} animationType="slide" transparent onRequestClose={() => setModalTopic(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setModalTopic(null)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {modalGroup ? formatTopicLabel(modalGroup.topic) : 'Topic Orbit'}
                </Text>
                <Text style={styles.modalSubtitle}>Moons sorted by what you use most</Text>
              </View>
              <TouchableOpacity style={styles.modalClose} onPress={() => setModalTopic(null)}>
                <Ionicons name="close" size={22} color="#e7eef6" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
              {modalGroup?.apps.map((app, index) => {
                const history = (app.topicSortHistory || []).slice(0, 5);
                return (
                  <View key={app.id} style={styles.modalMoonCard}>
                    <View style={styles.modalMoonHeader}>
                      <View style={styles.modalMoonRank}>
                        <Text style={styles.modalMoonRankText}>{index + 1}</Text>
                      </View>
                      <View style={styles.modalMoonMain}>
                        <Text style={styles.modalMoonTitle}>{app.title}</Text>
                        <Text style={styles.modalMoonMeta}>
                          Uses {app.accessCount || 0} • {app.favorite ? 'Favorite' : 'Standard'}
                        </Text>
                      </View>
                      <TouchableOpacity style={styles.modalOpenButton} onPress={() => openProject(app.id)}>
                        <Ionicons name="open-outline" size={16} color="#fff" />
                      </TouchableOpacity>
                    </View>

                    <Text style={styles.modalMoonSummary}>
                      Latest sort: {formatSortTime(app.topicClassification?.classifiedAt)} • confidence{' '}
                      {Math.round((app.topicClassification?.confidence || 0) * 100)}%
                    </Text>

                    {history.length > 0 && (
                      <View style={styles.historyWrap}>
                        <Text style={styles.historyTitle}>Last 5 sorts</Text>
                        {history.map((entry, entryIndex) => (
                          <Text key={`${app.id}-sort-${entryIndex}`} style={styles.historyLine}>
                            {entryIndex + 1}. {formatTopicLabel(entry.primaryTopic)} • {Math.round(entry.confidence * 100)}% •{' '}
                            {formatSortTime(entry.sortedAt)}
                          </Text>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={showTopicManager}
        animationType="slide"
        transparent
        onRequestClose={() => setShowTopicManager(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowTopicManager(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Planet Builder</Text>
                <Text style={styles.modalSubtitle}>Create custom topic planets and re-sort with AI</Text>
              </View>
              <TouchableOpacity style={styles.modalClose} onPress={() => setShowTopicManager(false)}>
                <Ionicons name="close" size={22} color="#e7eef6" />
              </TouchableOpacity>
            </View>

            <View style={styles.inputRow}>
              <TextInput
                value={newCustomTopic}
                onChangeText={setNewCustomTopic}
                placeholder="e.g. startup-research"
                placeholderTextColor="rgba(255,255,255,0.45)"
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.topicInput}
              />
              <TouchableOpacity
                style={[styles.addButton, isUpdatingTopics ? styles.syncButtonDisabled : undefined]}
                onPress={() => void addCustomTopic()}
                disabled={isUpdatingTopics}
              >
                {isUpdatingTopics ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="add" size={18} color="#fff" />
                )}
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
              <Text style={styles.sectionLabel}>Custom Planets</Text>
              {customTopics.length === 0 ? (
                <Text style={styles.emptyText}>No custom planets yet.</Text>
              ) : (
                <View style={styles.customTopicList}>
                  {customTopics.map((topic) => (
                    <View key={topic} style={styles.customTopicRow}>
                      <Text style={styles.customTopicText}>{formatTopicLabel(topic)}</Text>
                      <TouchableOpacity onPress={() => void removeCustomTopic(topic)}>
                        <Ionicons name="trash-outline" size={18} color="#ff6b6b" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              <Text style={styles.sectionLabel}>Built-in Planets</Text>
              <Text style={styles.builtInText}>
                Productivity, Education, Finance, Health, Lifestyle, Social, Entertainment, Gaming, Travel,
                Shopping, Business, Utilities, Creative, Developer Tools, Other
              </Text>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
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
    paddingHorizontal: 12,
    gap: 14,
  },
  headerCard: {
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#081526',
    borderWidth: 1,
    borderColor: 'rgba(145,187,222,0.22)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  headerMain: {
    flex: 1,
  },
  title: {
    color: '#f7fbff',
    fontSize: 24,
    fontWeight: '900',
  },
  subtitle: {
    marginTop: 2,
    color: 'rgba(224,242,255,0.82)',
    fontSize: 12,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(200,230,255,0.36)',
    backgroundColor: 'rgba(14,41,69,0.9)',
  },
  syncButton: {
    borderRadius: 17,
    paddingHorizontal: 11,
    paddingVertical: 8,
    backgroundColor: '#0f7cff',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  syncButtonDisabled: {
    opacity: 0.65,
  },
  syncButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#fff',
  },
  loadingState: {
    minHeight: 220,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(56,115,179,0.45)',
    backgroundColor: '#0a1b31',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  loadingText: {
    color: '#e8f4ff',
    fontSize: 13,
  },
  galaxyCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(112,165,223,0.35)',
    overflow: 'hidden',
  },
  galaxyScene: {
    ...StyleSheet.absoluteFillObject,
  },
  star: {
    position: 'absolute',
    backgroundColor: '#fff',
  },
  orbitRing: {
    position: 'absolute',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 999,
  },
  orbitLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  orbitLabelContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  orbitLabel: {
    position: 'absolute',
    width: 112,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'center',
  },
  orbitLabelText: {
    color: '#f5fbff',
    fontSize: 10,
    fontWeight: '700',
  },
  coreSun: {
    position: 'absolute',
    width: 68,
    height: 68,
    borderRadius: 34,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.45)',
    shadowColor: '#FFC857',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 14,
    elevation: 9,
  },
  coreSunGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planet: {
    position: 'absolute',
    overflow: 'hidden',
    borderWidth: 2,
  },
  planetGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planetCount: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '900',
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
    color: '#f8fbff',
    fontSize: 12,
    fontWeight: '700',
  },
  selectedPanel: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(121,169,224,0.35)',
    backgroundColor: '#091a2f',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  selectedPanelTitle: {
    color: '#f7fbff',
    fontSize: 17,
    fontWeight: '900',
  },
  moonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderWidth: 1,
    borderColor: 'rgba(110,160,219,0.26)',
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 8,
    backgroundColor: 'rgba(10,35,62,0.9)',
  },
  moonBullet: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#0f7cff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moonBulletText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 11,
  },
  moonTextWrap: {
    flex: 1,
  },
  moonTitle: {
    color: '#f7fbff',
    fontSize: 14,
    fontWeight: '700',
  },
  moonMeta: {
    color: 'rgba(204,228,252,0.85)',
    marginTop: 1,
    fontSize: 11,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.52)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    maxHeight: '88%',
    backgroundColor: '#071426',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(121,169,224,0.45)',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10,
  },
  modalTitle: {
    color: '#f4f9ff',
    fontSize: 21,
    fontWeight: '900',
  },
  modalSubtitle: {
    color: 'rgba(203,227,249,0.8)',
    fontSize: 12,
    marginTop: 2,
  },
  modalClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(182,215,247,0.3)',
    backgroundColor: 'rgba(10,36,63,0.95)',
  },
  modalList: {
    flex: 1,
  },
  modalMoonCard: {
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(113,160,214,0.33)',
    backgroundColor: 'rgba(8,33,58,0.94)',
    padding: 11,
    marginBottom: 9,
    gap: 8,
  },
  modalMoonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modalMoonRank: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f7cff',
  },
  modalMoonRankText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  modalMoonMain: {
    flex: 1,
  },
  modalMoonTitle: {
    color: '#f3faff',
    fontSize: 14,
    fontWeight: '800',
  },
  modalMoonMeta: {
    color: 'rgba(197,223,248,0.88)',
    fontSize: 11,
    marginTop: 1,
  },
  modalOpenButton: {
    width: 29,
    height: 29,
    borderRadius: 14.5,
    backgroundColor: '#0f7cff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalMoonSummary: {
    color: 'rgba(204,228,252,0.85)',
    fontSize: 11,
  },
  historyWrap: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(102,150,201,0.35)',
    paddingTop: 8,
    gap: 4,
  },
  historyTitle: {
    color: '#e7f3ff',
    fontSize: 11,
    fontWeight: '800',
  },
  historyLine: {
    color: 'rgba(197,223,248,0.8)',
    fontSize: 10,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  topicInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(114,161,213,0.48)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#f7fbff',
    backgroundColor: 'rgba(5,25,46,0.95)',
  },
  addButton: {
    width: 44,
    borderRadius: 12,
    backgroundColor: '#0f7cff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    color: '#eff7ff',
    fontSize: 13,
    fontWeight: '900',
    marginTop: 6,
    marginBottom: 8,
  },
  customTopicList: {
    gap: 8,
    marginBottom: 8,
  },
  customTopicRow: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(110,158,211,0.4)',
    backgroundColor: 'rgba(6,31,55,0.93)',
    paddingHorizontal: 11,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  customTopicText: {
    color: '#f3faff',
    fontSize: 14,
    fontWeight: '700',
  },
  builtInText: {
    color: 'rgba(197,223,248,0.83)',
    fontSize: 12,
    lineHeight: 18,
  },
  emptyText: {
    color: 'rgba(197,223,248,0.83)',
    fontSize: 12,
  },
});
