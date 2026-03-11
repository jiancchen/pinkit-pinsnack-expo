import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppColors } from '../constants/AppColors';
import { AppStorageService, StoredApp } from '../services/AppStorageService';
import { useUISettingsStore } from '../stores/UISettingsStore';
import AppThemeBackground from '../components/AppThemeBackground';
import { MODEL_INFO, resolveSupportedClaudeModel } from '../types/ClaudeApi';
import { createLogger } from '../utils/Logger';

const log = createLogger('AppRevisions');

type RevisionRecord = NonNullable<StoredApp['revisions']>[number];
type RevisionTreeRow = RevisionRecord & {
  depth: number;
  parentAt?: number;
  parentModel?: string;
};

function normalizeRevisionsWithParents(revisions: RevisionRecord[]): RevisionRecord[] {
  const idSet = new Set(revisions.map((rev) => rev.id));
  return revisions.map((rev, index) => {
    const parentRevisionId =
      typeof rev.parentRevisionId === 'string' && idSet.has(rev.parentRevisionId)
        ? rev.parentRevisionId
        : revisions[index + 1]?.id || null;
    return {
      ...rev,
      parentRevisionId,
    };
  });
}

function buildRootRevision(app: StoredApp): RevisionRecord | null {
  const htmlSnapshot = typeof app.html === 'string' ? app.html : '';
  if (!htmlSnapshot.trim()) return null;
  const createdAt = new Date(app.timestamp).getTime();
  return {
    id: `root_${app.id}`,
    at: Number.isFinite(createdAt) ? createdAt : Date.now(),
    operation: 'create',
    status: 'completed',
    model: resolveSupportedClaudeModel(app.model || undefined),
    updatedPrompt: (app.prompt || app.description || '').trim(),
    userNotes: 'Initial generated version',
    fixSummary: ['Initial generated version'],
    parentRevisionId: null,
    htmlSnapshot,
  };
}

function buildRevisionHistory(app: StoredApp | null): RevisionRecord[] {
  if (!app) return [];
  if (app.revisions?.length) return normalizeRevisionsWithParents(app.revisions);
  if (app.lastRevision) {
    return [
      {
        id: `last_${app.lastRevision.at}`,
        at: app.lastRevision.at,
        operation: 'app_revision',
        status: 'completed',
        model: app.lastRevision.model,
        updatedPrompt: app.lastRevision.updatedPrompt,
        userNotes: app.lastRevision.userNotes,
        fixSummary: app.lastRevision.fixSummary,
        parentRevisionId: app.lastRevision.parentRevisionId || null,
        htmlSnapshot: app.html || '',
      },
    ];
  }
  const rootRevision = buildRootRevision(app);
  if (rootRevision) return [rootRevision];
  return [];
}

function buildRevisionTreeRows(revisions: RevisionRecord[]): RevisionTreeRow[] {
  const byId = new Map(revisions.map((rev) => [rev.id, rev]));
  const childrenByParent = new Map<string | null, RevisionRecord[]>();

  for (const rev of revisions) {
    const rawParentId = rev.parentRevisionId || null;
    const parentId = rawParentId && byId.has(rawParentId) ? rawParentId : null;
    const bucket = childrenByParent.get(parentId);
    if (bucket) {
      bucket.push(rev);
    } else {
      childrenByParent.set(parentId, [rev]);
    }
  }

  childrenByParent.forEach((bucket) => {
    bucket.sort((a, b) => b.at - a.at);
  });

  const orderedRows: RevisionTreeRow[] = [];
  const visited = new Set<string>();

  const visit = (parentId: string | null, depth: number) => {
    const children = childrenByParent.get(parentId) || [];
    for (const child of children) {
      if (visited.has(child.id)) continue;
      visited.add(child.id);
      const parent = child.parentRevisionId ? byId.get(child.parentRevisionId) : undefined;
      orderedRows.push({
        ...child,
        depth,
        parentAt: parent?.at,
        parentModel: parent?.model,
      });
      visit(child.id, depth + 1);
    }
  };

  visit(null, 0);

  if (visited.size < revisions.length) {
    const leftovers = revisions.filter((rev) => !visited.has(rev.id)).sort((a, b) => b.at - a.at);
    for (const rev of leftovers) {
      const parent = rev.parentRevisionId ? byId.get(rev.parentRevisionId) : undefined;
      orderedRows.push({
        ...rev,
        depth: 0,
        parentAt: parent?.at,
        parentModel: parent?.model,
      });
    }
  }

  return orderedRows;
}

export default function AppRevisionsPage() {
  const router = useRouter();
  const { appId } = useLocalSearchParams<{ appId?: string }>();
  const appTheme = useUISettingsStore((s) => s.appTheme);
  const isUniverseTheme = appTheme === 'universe';

  const [app, setApp] = useState<StoredApp | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [applyingRevisionId, setApplyingRevisionId] = useState<string | null>(null);

  const safeGoBack = () => {
    const canGoBack = (router as any)?.canGoBack?.();
    if (canGoBack) {
      router.back();
      return;
    }
    router.replace('/(tabs)');
  };

  useEffect(() => {
    const id = typeof appId === 'string' ? appId : '';
    if (!id) {
      Alert.alert('Error', 'Missing app id.', [{ text: 'OK', onPress: safeGoBack }]);
      return;
    }
    void loadApp(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appId]);

  const loadApp = async (id: string) => {
    try {
      setIsLoading(true);
      const storedApp = await AppStorageService.getApp(id);
      if (!storedApp) {
        Alert.alert('Error', 'App not found.', [{ text: 'OK', onPress: safeGoBack }]);
        return;
      }
      setApp(storedApp);
    } catch (error) {
      log.error('Error loading revisions:', error);
      Alert.alert('Error', 'Failed to load revisions.', [{ text: 'OK', onPress: safeGoBack }]);
    } finally {
      setIsLoading(false);
    }
  };

  const revisionHistory = useMemo(() => buildRevisionHistory(app), [app]);
  const revisionTreeRows = useMemo(() => buildRevisionTreeRows(revisionHistory), [revisionHistory]);
  const latestRevisionId = useMemo(() => {
    if (!revisionHistory.length) return null;
    return [...revisionHistory].sort((a, b) => b.at - a.at)[0]?.id || null;
  }, [revisionHistory]);

  const activeMainRevisionId = useMemo(() => {
    if (!revisionHistory.length) return null;
    if (app?.mainRevisionId && revisionHistory.some((rev) => rev.id === app.mainRevisionId)) {
      return app.mainRevisionId;
    }
    const lastCompleted = revisionHistory.find((rev) => rev.status === 'completed');
    return lastCompleted?.id || revisionHistory[0]?.id || null;
  }, [app?.mainRevisionId, revisionHistory]);

  const setRevisionAsMain = async (revision: RevisionRecord) => {
    if (!app) return;
    if (revision.status !== 'completed') {
      Alert.alert('Revision not ready', 'Only completed revisions can be marked as main.');
      return;
    }

    const htmlSnapshot = revision.htmlSnapshot;
    if (!htmlSnapshot || !htmlSnapshot.trim()) {
      Alert.alert(
        'Snapshot unavailable',
        'This older revision was created before snapshot support. Regenerate from this revision first.'
      );
      return;
    }

    setApplyingRevisionId(revision.id);
    const model = resolveSupportedClaudeModel(revision.model);
    const nextLastRevision = {
      at: revision.at,
      model,
      updatedPrompt: revision.updatedPrompt,
      userNotes: revision.userNotes || '',
      fixSummary: revision.fixSummary,
      parentRevisionId: revision.parentRevisionId || null,
    };

    try {
      await AppStorageService.updateApp(app.id, {
        html: htmlSnapshot,
        prompt: revision.updatedPrompt,
        request: {
          description: revision.updatedPrompt,
          style: (app.style as any) || 'modern',
          platform: 'mobile',
        },
        status: 'completed',
        model,
        mainRevisionId: revision.id,
        lastRevision: nextLastRevision,
      });

      setApp((prev) =>
        prev
          ? {
              ...prev,
              html: htmlSnapshot,
              prompt: revision.updatedPrompt,
              status: 'completed',
              model,
              mainRevisionId: revision.id,
              lastRevision: nextLastRevision,
            }
          : prev
      );

      router.push(`/app-view?appId=${app.id}`);
    } catch (error) {
      log.error('Error setting main revision:', error);
      Alert.alert('Error', 'Failed to set revision as main.');
    } finally {
      setApplyingRevisionId(null);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, isUniverseTheme ? styles.containerUniverse : undefined]}>
        {Platform.OS === 'android' ? (
          <StatusBar
            translucent
            backgroundColor="transparent"
            barStyle={isUniverseTheme ? 'light-content' : 'dark-content'}
          />
        ) : null}
        <AppThemeBackground />
        <View style={[styles.center, isUniverseTheme ? styles.centerUniverse : undefined]}>
          <ActivityIndicator size="large" color={AppColors.FABMain} />
          <Text style={[styles.centerText, isUniverseTheme ? styles.centerTextUniverse : undefined]}>
            Loading revisions...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!app) {
    return (
      <SafeAreaView style={[styles.container, isUniverseTheme ? styles.containerUniverse : undefined]}>
        {Platform.OS === 'android' ? (
          <StatusBar
            translucent
            backgroundColor="transparent"
            barStyle={isUniverseTheme ? 'light-content' : 'dark-content'}
          />
        ) : null}
        <AppThemeBackground />
        <View style={[styles.center, isUniverseTheme ? styles.centerUniverse : undefined]}>
          <Text style={[styles.centerText, isUniverseTheme ? styles.centerTextUniverse : undefined]}>
            App not found.
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={safeGoBack}>
            <Text style={styles.primaryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, isUniverseTheme ? styles.containerUniverse : undefined]}
      edges={['top', 'bottom']}
    >
      {Platform.OS === 'android' ? (
        <StatusBar
          translucent
          backgroundColor="transparent"
          barStyle={isUniverseTheme ? 'light-content' : 'dark-content'}
        />
      ) : null}
      <AppThemeBackground />

      <View style={[styles.header, isUniverseTheme ? styles.headerUniverse : undefined]}>
        <TouchableOpacity
          style={[styles.headerIconButton, isUniverseTheme ? styles.headerIconButtonUniverse : undefined]}
          onPress={safeGoBack}
          accessibilityLabel="Back"
        >
          <Ionicons
            name="chevron-back"
            size={22}
            color={isUniverseTheme ? 'rgba(226, 240, 255, 0.92)' : 'rgba(0, 0, 0, 0.8)'}
          />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, isUniverseTheme ? styles.headerTitleUniverse : undefined]}>
            Revision Tree
          </Text>
          <Text style={[styles.headerSubtitle, isUniverseTheme ? styles.headerSubtitleUniverse : undefined]}>
            {app.title}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.headerActionButton, isUniverseTheme ? styles.headerActionButtonUniverse : undefined]}
          onPress={() =>
            router.push({
              pathname: '/app-recreate',
              params: { appId: app.id, mode: 'recreate', showHistory: '1' },
            } as any)
          }
        >
          <Text style={styles.headerActionText}>Edit</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={[styles.body, isUniverseTheme ? styles.bodyUniverse : undefined]}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.infoCard, isUniverseTheme ? styles.infoCardUniverse : undefined]}>
          <Ionicons
            name="git-branch-outline"
            size={18}
            color={isUniverseTheme ? 'rgba(210, 233, 255, 0.9)' : 'rgba(0, 0, 0, 0.7)'}
          />
          <Text style={[styles.infoText, isUniverseTheme ? styles.infoTextUniverse : undefined]}>
            Hierarchy view: parent revisions are shown above their children. The newest revision is marked "Latest".
          </Text>
        </View>

        {revisionTreeRows.length === 0 ? (
          <View style={[styles.emptyCard, isUniverseTheme ? styles.emptyCardUniverse : undefined]}>
            <Text style={[styles.emptyText, isUniverseTheme ? styles.emptyTextUniverse : undefined]}>
              No revisions yet.
            </Text>
          </View>
        ) : (
          <View style={styles.treeContainer}>
            {revisionTreeRows.map((rev) => {
              const when = new Date(rev.at).toLocaleString();
              const parentLabel = rev.parentAt
                ? `Forked from ${new Date(rev.parentAt).toLocaleString()}`
                : 'Root revision';
              const isMain = activeMainRevisionId === rev.id;
              const isLatest = latestRevisionId === rev.id;
              const canSetMain =
                rev.status === 'completed' &&
                typeof rev.htmlSnapshot === 'string' &&
                rev.htmlSnapshot.trim().length > 0;
              const isApplying = applyingRevisionId === rev.id;
              const depth = Math.min(6, rev.depth);
              const modelName = MODEL_INFO[rev.model as keyof typeof MODEL_INFO]?.name || rev.model;
              const statusIcon =
                rev.status === 'completed'
                  ? 'checkmark-circle-outline'
                  : rev.status === 'error'
                    ? 'close-circle-outline'
                    : 'time-outline';
              const statusColor =
                rev.status === 'completed' ? '#16A34A' : rev.status === 'error' ? '#EF4444' : '#F59E0B';
              const statusLabel =
                rev.status === 'completed' ? 'Completed' : rev.status === 'error' ? 'Error' : 'Generating';
              const treePrefix = depth === 0 ? '●' : `${'│ '.repeat(depth - 1)}└─`;

              return (
                <View
                  key={rev.id}
                  style={[
                    styles.treeRow,
                    isUniverseTheme ? styles.treeRowUniverse : undefined,
                    { marginLeft: depth * 14 },
                    isMain ? styles.treeRowMain : undefined,
                    isMain && isUniverseTheme ? styles.treeRowMainUniverse : undefined,
                  ]}
                >
                  <View style={styles.treeTopRow}>
                    <Text style={[styles.treePrefix, isUniverseTheme ? styles.treePrefixUniverse : undefined]}>
                      {treePrefix}
                    </Text>
                    <Ionicons
                      name={isMain ? 'folder-open-outline' : 'folder-outline'}
                      size={18}
                      color={isUniverseTheme ? 'rgba(211, 232, 255, 0.88)' : 'rgba(0, 0, 0, 0.66)'}
                    />
                    <View style={styles.treeContent}>
                      <Text style={[styles.treeTitle, isUniverseTheme ? styles.treeTitleUniverse : undefined]}>
                        {when}
                      </Text>
                      <Text style={[styles.treeMeta, isUniverseTheme ? styles.treeMetaUniverse : undefined]}>
                        {modelName}
                      </Text>
                      <Text style={[styles.treeMeta, isUniverseTheme ? styles.treeMetaUniverse : undefined]}>
                        {parentLabel}
                      </Text>
                      {!!rev.fixSummary?.length && (
                        <Text style={[styles.treeMeta, isUniverseTheme ? styles.treeMetaUniverse : undefined]}>
                          Fixes: {rev.fixSummary.join(' · ')}
                        </Text>
                      )}

                      <View style={styles.treeFlagsRow}>
                        {isLatest ? (
                          <View style={[styles.latestBadge, isUniverseTheme ? styles.latestBadgeUniverse : undefined]}>
                            <Text
                              style={[
                                styles.latestBadgeText,
                                isUniverseTheme ? styles.latestBadgeTextUniverse : undefined,
                              ]}
                            >
                              Latest
                            </Text>
                          </View>
                        ) : null}

                        <View style={styles.treeStatusInline}>
                          <Ionicons name={statusIcon as any} size={16} color={statusColor} />
                          <Text style={[styles.treeStatusInlineText, { color: statusColor }]}>
                            {statusLabel}
                          </Text>
                        </View>
                      </View>

                      <TouchableOpacity
                        style={[
                          styles.mainButton,
                          isUniverseTheme ? styles.mainButtonUniverse : undefined,
                          !canSetMain ? styles.mainButtonDisabled : undefined,
                          isMain ? styles.mainButtonActive : undefined,
                        ]}
                        disabled={!canSetMain || isApplying || !!applyingRevisionId}
                        onPress={() => void setRevisionAsMain(rev)}
                      >
                        {isApplying ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={styles.mainButtonText}>{isMain ? 'Main' : 'Set as Main'}</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
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
  containerUniverse: {
    backgroundColor: 'transparent',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 10,
  },
  centerUniverse: {
    backgroundColor: 'rgba(4, 14, 30, 0.88)',
  },
  centerText: {
    fontSize: 14,
    color: 'rgba(0, 0, 0, 0.7)',
    textAlign: 'center',
  },
  centerTextUniverse: {
    color: 'rgba(214, 233, 253, 0.9)',
  },
  primaryButton: {
    marginTop: 10,
    backgroundColor: AppColors.FABMain,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  primaryButtonText: {
    color: 'white',
    fontWeight: '700',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    backgroundColor: '#FFE59A',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.12)',
  },
  headerUniverse: {
    backgroundColor: '#081B33',
    borderBottomColor: 'rgba(123, 169, 220, 0.4)',
  },
  headerIconButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
  },
  headerIconButtonUniverse: {
    backgroundColor: 'rgba(10, 34, 61, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(140, 185, 235, 0.3)',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: 'rgba(0, 0, 0, 0.85)',
  },
  headerTitleUniverse: {
    color: 'rgba(233, 246, 255, 0.95)',
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: 'rgba(0, 0, 0, 0.55)',
  },
  headerSubtitleUniverse: {
    color: 'rgba(190, 216, 244, 0.86)',
  },
  headerActionButton: {
    minWidth: 62,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppColors.FABMain,
    paddingHorizontal: 12,
  },
  headerActionButtonUniverse: {
    backgroundColor: '#0f7cff',
  },
  headerActionText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
  },
  body: {
    flex: 1,
    paddingHorizontal: 12,
  },
  bodyUniverse: {
    backgroundColor: 'transparent',
  },
  bodyContent: {
    gap: 12,
    paddingTop: 10,
    paddingBottom: 20,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.14)',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  infoCardUniverse: {
    borderColor: 'rgba(123, 169, 220, 0.3)',
    backgroundColor: 'rgba(8, 26, 48, 0.86)',
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: 'rgba(0, 0, 0, 0.72)',
  },
  infoTextUniverse: {
    color: 'rgba(205, 226, 248, 0.9)',
  },
  emptyCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    padding: 14,
  },
  emptyCardUniverse: {
    borderColor: 'rgba(123, 169, 220, 0.3)',
    backgroundColor: 'rgba(8, 26, 48, 0.86)',
  },
  emptyText: {
    fontSize: 13,
    color: 'rgba(0, 0, 0, 0.66)',
  },
  emptyTextUniverse: {
    color: 'rgba(205, 226, 248, 0.9)',
  },
  treeContainer: {
    gap: 8,
  },
  treeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    padding: 10,
  },
  treeRowUniverse: {
    borderColor: 'rgba(123, 169, 220, 0.36)',
    backgroundColor: 'rgba(7, 24, 45, 0.9)',
  },
  treeRowMain: {
    borderColor: 'rgba(15, 124, 255, 0.45)',
    backgroundColor: 'rgba(15, 124, 255, 0.08)',
  },
  treeRowMainUniverse: {
    borderColor: 'rgba(145, 196, 255, 0.45)',
    backgroundColor: 'rgba(16, 52, 90, 0.64)',
  },
  treeTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    flex: 1,
  },
  treeContent: {
    flex: 1,
  },
  treePrefix: {
    minWidth: 18,
    fontSize: 12,
    lineHeight: 18,
    color: 'rgba(0, 0, 0, 0.45)',
  },
  treePrefixUniverse: {
    color: 'rgba(176, 208, 240, 0.75)',
  },
  treeTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: 'rgba(0, 0, 0, 0.82)',
  },
  treeTitleUniverse: {
    color: 'rgba(224, 240, 255, 0.94)',
  },
  treeMeta: {
    marginTop: 2,
    fontSize: 11,
    lineHeight: 15,
    color: 'rgba(0, 0, 0, 0.58)',
  },
  treeMetaUniverse: {
    color: 'rgba(190, 216, 244, 0.84)',
  },
  treeFlagsRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  treeStatusInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  treeStatusInlineText: {
    fontSize: 11,
    fontWeight: '700',
  },
  latestBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: 'rgba(95, 15, 64, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(95, 15, 64, 0.34)',
  },
  latestBadgeUniverse: {
    backgroundColor: 'rgba(22, 74, 126, 0.52)',
    borderColor: 'rgba(140, 185, 235, 0.44)',
  },
  latestBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: AppColors.FABMain,
  },
  latestBadgeTextUniverse: {
    color: 'rgba(225, 241, 255, 0.95)',
  },
  mainButton: {
    minWidth: 92,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f7cff',
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  mainButtonUniverse: {
    backgroundColor: '#0f7cff',
  },
  mainButtonActive: {
    backgroundColor: '#0a56b7',
  },
  mainButtonDisabled: {
    opacity: 0.5,
  },
  mainButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
});
