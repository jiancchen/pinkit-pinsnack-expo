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
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
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

const FOCUSED_PANEL_HEIGHT_FRACTION = 0.75;

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

export default function UniversePage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const [apps, setApps] = useState<StoredApp[]>([]);
  const [customTopics, setCustomTopics] = useState<string[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [isTopicFocused, setIsTopicFocused] = useState(false);
  const [showTopicManager, setShowTopicManager] = useState(false);
  const [newCustomTopic, setNewCustomTopic] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isUpdatingTopics, setIsUpdatingTopics] = useState(false);
  const [rotationPhaseDeg, setRotationPhaseDeg] = useState(0);
  const backfillTriggeredRef = useRef(false);

  const screenBottomPadding = getLiquidGlassTabBarContentPaddingBottom(insets.bottom, 12);

  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const panStartX = useSharedValue(0);
  const panStartY = useSharedValue(0);
  const pinchStartScale = useSharedValue(1);

  React.useEffect(() => {
    if (isTopicFocused) return;

    const interval = setInterval(() => {
      setRotationPhaseDeg((prev) => (prev + 0.45) % 360);
    }, 40);
    return () => clearInterval(interval);
  }, [isTopicFocused]);

  const resetViewport = () => {
    scale.value = withTiming(1, { duration: 240 });
    translateX.value = withTiming(0, { duration: 240 });
    translateY.value = withTiming(0, { duration: 240 });
  };

  const panGesture = Gesture.Pan()
    .enabled(!isTopicFocused)
    .minDistance(12)
    .onStart(() => {
      panStartX.value = translateX.value;
      panStartY.value = translateY.value;
    })
    .onUpdate((event) => {
      const nextX = panStartX.value + event.translationX;
      const nextY = panStartY.value + event.translationY;
      if (!Number.isFinite(nextX) || !Number.isFinite(nextY)) return;
      translateX.value = nextX;
      translateY.value = nextY;
    });

  const pinchGesture = Gesture.Pinch()
    .enabled(!isTopicFocused)
    .onStart(() => {
      pinchStartScale.value = scale.value;
    })
    .onUpdate((event) => {
      const next = pinchStartScale.value * event.scale;
      if (!Number.isFinite(next)) return;
      scale.value = clamp(next, 0.65, 2.6);
    });

  const mapGesture = Gesture.Simultaneous(panGesture, pinchGesture);

  const mapTransformStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateX: translateX.value }, { translateY: translateY.value }],
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

  const mapWidth = Math.max(screenWidth - 24, 340);
  const availableHeight = screenHeight - insets.top - screenBottomPadding;
  const mapHeight = clamp(availableHeight - 210, 280, 620);
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

  const focusOnTopic = React.useCallback(
    (topic: string) => {
      const orbit = orbits.find((item) => item.topic === topic);
      if (!orbit) return;

      const targetRotationPhase = ((-orbit.phaseDeg / orbit.speed) % 360 + 360) % 360;
      setRotationPhaseDeg(targetRotationPhase);

      const angleDeg = orbit.phaseDeg + targetRotationPhase * orbit.speed;
      const angle = (angleDeg * Math.PI) / 180;
      const planetX = centerX + Math.sin(angle) * orbit.radius;
      const planetY = centerY - Math.cos(angle) * orbit.radius;
      const targetScale = 1.55;
      const targetX = mapWidth / 2;

      // Keep the selected planet centered inside the top 25% viewport band.
      const topBandHeight = mapHeight * (1 - FOCUSED_PANEL_HEIGHT_FRACTION);
      const targetY = topBandHeight / 2;

      scale.value = withTiming(targetScale, { duration: 280 });
      translateX.value = withTiming(targetX - planetX * targetScale, { duration: 280 });
      translateY.value = withTiming(targetY - planetY * targetScale, { duration: 280 });
    },
    [centerX, centerY, mapHeight, mapWidth, orbits, scale, translateX, translateY]
  );

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
    setIsTopicFocused(true);
    focusOnTopic(topic);
  };

  const closeTopicFocus = (): void => {
    setIsTopicFocused(false);
    resetViewport();
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
      <LinearGradient
        colors={['#01030a', '#040919', '#06122a', '#071a34', '#08142a']}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={styles.nebulaGlowTop} />
      <View pointerEvents="none" style={styles.nebulaGlowBottom} />

      <View
        style={[
          styles.screenContent,
          { paddingTop: insets.top + 10, paddingBottom: screenBottomPadding },
        ]}
      >
        <View style={styles.headerCard}>
          <View style={styles.headerMain}>
            <Text style={styles.title}>Galaxy Universe</Text>
            <Text style={styles.subtitle}>
              {topicGroups.length} orbiting topic planets. Tap a topic to lock focus and open moons.
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.iconButton} onPress={() => setShowTopicManager(true)}>
              <Ionicons name="planet-outline" size={19} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={closeTopicFocus}>
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
          <View style={[styles.loadingState, { height: mapHeight }]}>
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
                      colors={['#8FE3FF', '#38A3FF', '#2B5ECF']}
                      start={{ x: 0.15, y: 0.12 }}
                      end={{ x: 0.82, y: 0.92 }}
                      style={styles.coreSunGradient}
                    >
                      <Ionicons name="apps" size={20} color="#eaf7ff" />
                    </LinearGradient>
                  </View>

                  {orbits.map((orbit) => {
                    const angleDeg = orbit.phaseDeg + rotationPhaseDeg * orbit.speed;
                    const angle = (angleDeg * Math.PI) / 180;
                    const planetX = centerX + Math.sin(angle) * orbit.radius;
                    const planetY = centerY - Math.cos(angle) * orbit.radius;
                    const isSelected = selectedGroup?.topic === orbit.topic;

                    return (
                      <React.Fragment key={orbit.topic}>
                        <View
                          pointerEvents="none"
                          style={[
                            styles.orbitRing,
                            {
                              width: orbit.radius * 2,
                              height: orbit.radius * 2,
                              borderColor: `${orbit.color}${isSelected ? '99' : '44'}`,
                              left: centerX - orbit.radius,
                              top: centerY - orbit.radius,
                              opacity: isSelected ? 0.92 : 0.58,
                            },
                          ]}
                        />

                        <TouchableOpacity
                          activeOpacity={0.9}
                          style={[
                            styles.planet,
                            {
                              width: orbit.size,
                              height: orbit.size,
                              borderRadius: orbit.size / 2,
                              left: planetX - orbit.size / 2,
                              top: planetY - orbit.size / 2,
                              borderColor: isSelected ? '#ffffff' : `${orbit.color}BB`,
                            },
                          ]}
                          onPress={() => handleTopicPress(orbit.topic)}
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

                        <View
                          pointerEvents="none"
                          style={[
                            styles.orbitLabel,
                            {
                              left: planetX - 56,
                              top: planetY - orbit.size / 2 - 28,
                              borderColor: `${orbit.color}88`,
                              backgroundColor: isSelected ? 'rgba(255,255,255,0.14)' : 'rgba(2,12,27,0.55)',
                            },
                          ]}
                        >
                          <Text style={styles.orbitLabelText} numberOfLines={1}>
                            {formatTopicLabel(orbit.topic)}
                          </Text>
                        </View>
                      </React.Fragment>
                    );
                  })}
                </Animated.View>
              </GestureDetector>

              {isTopicFocused && selectedGroup ? (
                <View style={styles.focusedTopicPanel}>
                  <View style={styles.focusedTopicHeader}>
                    <View style={styles.focusedTopicHeaderMain}>
                      <Text style={styles.focusedTopicTitle}>
                        {formatTopicLabel(selectedGroup.topic)} Moons
                      </Text>
                      <Text style={styles.focusedTopicSubtitle}>
                        {selectedGroup.apps.length} projects in orbit
                      </Text>
                    </View>
                    <TouchableOpacity style={styles.focusedTopicClose} onPress={closeTopicFocus}>
                      <Ionicons name="close" size={18} color="#d7eaff" />
                    </TouchableOpacity>
                  </View>

                  <ScrollView style={styles.focusedTopicList} showsVerticalScrollIndicator={false}>
                    {selectedGroup.apps.length > 0 ? (
                      selectedGroup.apps.slice(0, 30).map((app, index) => (
                        <TouchableOpacity key={app.id} style={styles.moonRow} onPress={() => openProject(app.id)}>
                          <View style={styles.moonBullet}>
                            <Text style={styles.moonBulletText}>{index + 1}</Text>
                          </View>
                          <View style={styles.moonTextWrap}>
                            <Text style={styles.moonTitle} numberOfLines={1}>
                              {app.title}
                            </Text>
                            <Text style={styles.moonMeta} numberOfLines={1}>
                              Uses {app.accessCount || 0} • {app.status}
                            </Text>
                          </View>
                          <Ionicons name="chevron-forward" size={17} color="rgba(255,255,255,0.7)" />
                        </TouchableOpacity>
                      ))
                    ) : (
                      <Text style={styles.emptyText}>No moons in this orbit yet.</Text>
                    )}
                  </ScrollView>
                </View>
              ) : null}
            </View>

            <Text style={styles.legendHint}>
              {isTopicFocused
                ? 'Focus locked. Tap X to zoom back out.'
                : 'Pinch to zoom, pan to move, tap any planet to lock focus.'}
            </Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.topicSelectorScroll}
              contentContainerStyle={styles.topicSelectorRow}
            >
              {topicGroups.map((group) => (
                <TouchableOpacity
                  key={group.topic}
                  style={[
                    styles.topicChip,
                    {
                      borderColor: `${group.color}AA`,
                      backgroundColor:
                        selectedGroup?.topic === group.topic ? `${group.color}66` : 'rgba(255,255,255,0.08)',
                    },
                  ]}
                  onPress={() => handleTopicPress(group.topic)}
                >
                  <Text style={styles.topicChipText}>
                    {formatTopicLabel(group.topic)} ({group.apps.length})
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}
      </View>

      <Modal
        visible={showTopicManager}
        animationType="slide"
        transparent
        onRequestClose={() => setShowTopicManager(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowTopicManager(false)} />
          <View style={styles.modalCard}>
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
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#01030a',
  },
  nebulaGlowTop: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    top: -120,
    right: -90,
    backgroundColor: 'rgba(66, 141, 255, 0.2)',
  },
  nebulaGlowBottom: {
    position: 'absolute',
    width: 340,
    height: 340,
    borderRadius: 170,
    bottom: -150,
    left: -90,
    backgroundColor: 'rgba(166, 76, 255, 0.18)',
  },
  screenContent: {
    flex: 1,
    paddingHorizontal: 12,
    gap: 14,
  },
  headerCard: {
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: 'rgba(9, 20, 42, 0.74)',
    borderWidth: 1,
    borderColor: 'rgba(145,187,222,0.35)',
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
    backgroundColor: 'rgba(14,41,69,0.96)',
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
    borderColor: 'rgba(112,165,223,0.48)',
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
    shadowColor: '#38a3ff',
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
  legendHint: {
    marginTop: -2,
    fontSize: 12,
    color: 'rgba(219, 236, 255, 0.76)',
    textAlign: 'center',
  },
  topicSelectorScroll: {
    maxHeight: 44,
  },
  topicSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 10,
  },
  topicChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    justifyContent: 'center',
  },
  topicChipText: {
    color: '#f8fbff',
    fontSize: 12,
    fontWeight: '700',
  },
  focusedTopicPanel: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    height: `${FOCUSED_PANEL_HEIGHT_FRACTION * 100}%`,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(129,178,233,0.44)',
    backgroundColor: 'rgba(7, 18, 40, 0.94)',
    padding: 10,
    gap: 8,
  },
  focusedTopicHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  focusedTopicHeaderMain: {
    flex: 1,
  },
  focusedTopicTitle: {
    color: '#f4f9ff',
    fontSize: 16,
    fontWeight: '900',
  },
  focusedTopicSubtitle: {
    color: 'rgba(204,228,252,0.82)',
    fontSize: 11,
    marginTop: 1,
  },
  focusedTopicClose: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(192,219,250,0.35)',
    backgroundColor: 'rgba(12, 36, 67, 0.95)',
  },
  focusedTopicList: {
    flex: 1,
  },
  moonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    height: 56,
    borderWidth: 1,
    borderColor: 'rgba(110,160,219,0.26)',
    borderRadius: 12,
    paddingHorizontal: 9,
    marginBottom: 8,
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
    justifyContent: 'center',
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
