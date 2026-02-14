import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppColors } from '../src/constants/AppColors';
import { AppStorageService, StoredApp } from '../src/services/AppStorageService';
import { ClaudeApiService } from '../src/services/ClaudeApiService';
import { PromptGenerator } from '../src/services/PromptGenerator';
import { SecureStorageService } from '../src/services/SecureStorageService';
import { createLogger } from '../src/utils/Logger';
import {
  CLAUDE_MODEL_PICKER_OPTIONS,
  MODEL_INFO,
  PRICING_AS_OF_DISPLAY,
  formatModelPricingShort,
  resolveSupportedClaudeModel,
} from '../src/types/ClaudeApi';

const log = createLogger('AppRecreate');

type Mode = 'recreate' | 'fix';

export default function AppRecreatePage() {
  const router = useRouter();
  const { appId, mode } = useLocalSearchParams<{ appId?: string; mode?: string }>();

  const safeGoBack = () => {
    const canGoBack = (router as any)?.canGoBack?.();
    if (canGoBack) {
      router.back();
      return;
    }
    router.replace('/(tabs)');
  };

  const resolvedMode: Mode = mode === 'fix' ? 'fix' : 'recreate';

  const [app, setApp] = useState<StoredApp | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRecreating, setIsRecreating] = useState(false);

  const [newPrompt, setNewPrompt] = useState('');
  const [fixNotes, setFixNotes] = useState('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [showRevisionHistory, setShowRevisionHistory] = useState(resolvedMode === 'fix');

  const newPromptRef = useRef<TextInput>(null);
  const fixNotesRef = useRef<TextInput>(null);

  useEffect(() => {
    const id = typeof appId === 'string' ? appId : '';
    if (!id) {
      Alert.alert('Error', 'Missing app id.', [{ text: 'OK', onPress: safeGoBack }]);
      return;
    }
    void loadApp(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appId]);

  useEffect(() => {
    if (!app) return;
    if (resolvedMode === 'fix') {
      setTimeout(() => fixNotesRef.current?.focus(), 250);
    } else {
      setTimeout(() => newPromptRef.current?.focus(), 250);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app?.id]);

  const loadApp = async (id: string) => {
    try {
      setIsLoading(true);
      const storedApp = await AppStorageService.getApp(id);
      if (!storedApp) {
        Alert.alert('Error', 'App not found.', [{ text: 'OK', onPress: safeGoBack }]);
        return;
      }

      setApp(storedApp);
      setNewPrompt(storedApp.prompt || '');
      setFixNotes('');

      try {
        const config = await SecureStorageService.getConfig();
        const preferred = storedApp.model ? resolveSupportedClaudeModel(storedApp.model) : config.model;
        setSelectedModel(preferred);
      } catch {
        if (storedApp.model) setSelectedModel(resolveSupportedClaudeModel(storedApp.model));
      }
    } catch (error) {
      log.error('Error loading app for recreate:', error);
      Alert.alert('Error', 'Failed to load app.', [{ text: 'OK', onPress: safeGoBack }]);
    } finally {
      setIsLoading(false);
    }
  };

  const revisionHistory = useMemo(() => {
    if (!app) return [];
    if (app.revisions?.length) return app.revisions.slice(0, 12);
    if (app.lastRevision) {
      return [
        {
          id: `last_${app.lastRevision.at}`,
          at: app.lastRevision.at,
          operation: 'app_revision' as const,
          status: 'completed' as const,
          model: app.lastRevision.model,
          updatedPrompt: app.lastRevision.updatedPrompt,
          userNotes: app.lastRevision.userNotes,
          fixSummary: app.lastRevision.fixSummary,
        },
      ];
    }
    return [];
  }, [app]);

  const onRecreate = async () => {
    if (!app || isRecreating) return;
    const updatedPrompt = newPrompt.trim();
    if (!updatedPrompt) {
      Alert.alert('Error', 'Please enter a prompt.');
      return;
    }

    const notes = fixNotes.trim();

    Alert.alert(
      'Recreate App',
      'This will regenerate the HTML using your updated prompt and notes, using the current HTML as context. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Recreate',
          onPress: async () => {
            const revisionId = `rev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            const startedAt = Date.now();
            try {
              Keyboard.dismiss();
              setIsRecreating(true);

              const config = await SecureStorageService.getConfig();
              const model = resolveSupportedClaudeModel(selectedModel || config.model);

              const nextRevision = {
                id: revisionId,
                at: startedAt,
                operation: 'app_revision' as const,
                status: 'generating' as const,
                model,
                updatedPrompt,
                userNotes: notes,
              };
              const nextRevisions = [nextRevision, ...(app.revisions || [])].slice(0, 25);

              await AppStorageService.updateApp(app.id, {
                prompt: updatedPrompt,
                request: {
                  description: updatedPrompt,
                  style: (app.style as any) || 'modern',
                  platform: 'mobile',
                },
                status: 'generating',
                model,
                lastRevision: {
                  at: startedAt,
                  model,
                  updatedPrompt,
                  userNotes: notes,
                },
                revisions: nextRevisions,
              });

              setApp((prev) =>
                prev
                  ? {
                      ...prev,
                      prompt: updatedPrompt,
                      status: 'generating',
                      model,
                      lastRevision: {
                        at: startedAt,
                        model,
                        updatedPrompt,
                        userNotes: notes,
                      },
                      revisions: nextRevisions,
                    }
                  : prev
              );

              const prompt = PromptGenerator.generateHtmlRevisionPrompt({
                originalPrompt: app.prompt || '',
                updatedPrompt,
                userNotes: notes,
                originalHtml: app.html || '',
              });

              const claudeService = ClaudeApiService.getInstance();
              await claudeService.initialize();

              const response = await claudeService.generateAppConcept(prompt, {
                model,
                maxTokens: config.maxTokens,
                temperature: config.temperature,
                operation: 'app_revision',
                appId: app.id,
              });

              let fixSummary: string[] | undefined;
              try {
                const match = response?.html?.match(
                  /<script[^>]*id=["']droplets_debug["'][^>]*>([\s\S]*?)<\/script>/i
                );
                if (match?.[1]) {
                  const parsed = JSON.parse(match[1]);
                  if (Array.isArray(parsed?.fixSummary)) {
                    fixSummary = parsed.fixSummary.filter((x: any) => typeof x === 'string').slice(0, 6);
                  }
                }
              } catch {
                // ignore
              }

              const completedRevisions = nextRevisions.map((rev) =>
                rev.id === revisionId ? { ...rev, status: 'completed' as const, fixSummary } : rev
              );

              await AppStorageService.updateApp(app.id, {
                html: response.html,
                status: 'completed',
                model,
                lastRevision: {
                  at: Date.now(),
                  model,
                  updatedPrompt,
                  userNotes: notes,
                  fixSummary,
                },
                revisions: completedRevisions,
              });

              setApp((prev) =>
                prev
                  ? {
                      ...prev,
                      html: response.html,
                      status: 'completed',
                      model,
                      lastRevision: {
                        at: Date.now(),
                        model,
                        updatedPrompt,
                        userNotes: notes,
                        fixSummary,
                      },
                      revisions: completedRevisions,
                    }
                  : prev
              );

              Alert.alert('Success', 'App recreated successfully.', [{ text: 'OK', onPress: safeGoBack }]);
            } catch (error: any) {
              log.error('Error recreating app:', error);
              const errorMessage = typeof error?.message === 'string' ? error.message : 'Failed to recreate app';
              try {
                const existing = await AppStorageService.getApp(app.id);
                const revisions = existing?.revisions || app.revisions || [];
                const updatedRevisions = revisions.map((rev) =>
                  rev.id === revisionId ? { ...rev, status: 'error' as const, errorMessage } : rev
                );
                await AppStorageService.updateApp(app.id, { status: 'error', revisions: updatedRevisions });
              } catch {
                // ignore
              }
              setApp((prev) => {
                if (!prev) return prev;
                const updatedRevisions = (prev.revisions || []).map((rev) =>
                  rev.id === revisionId ? { ...rev, status: 'error' as const, errorMessage } : rev
                );
                return { ...prev, status: 'error', revisions: updatedRevisions };
              });
              Alert.alert('Error', errorMessage);
            } finally {
              setIsRecreating(false);
            }
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={AppColors.FABMain} />
          <Text style={styles.centerText}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!app) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.centerText}>App not found.</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={safeGoBack}>
            <Text style={styles.primaryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={safeGoBack}
            disabled={isRecreating}
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={22} color="rgba(0, 0, 0, 0.8)" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Update Prompt & Recreate</Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {app.title}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={() => Keyboard.dismiss()}
            accessibilityLabel="Hide keyboard"
          >
            <Ionicons name="chevron-down" size={20} color="rgba(0, 0, 0, 0.65)" />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sectionTitle}>Select AI Model</Text>
          <View style={{ gap: 8 }}>
            {CLAUDE_MODEL_PICKER_OPTIONS.map((model) => {
              const isSelected = selectedModel === model;
              const status = MODEL_INFO[model]?.status;
              const isRetired = status === 'retired';
              return (
                <TouchableOpacity
                  key={model}
                  style={[styles.modelOption, isSelected && styles.modelOptionSelected, isRetired && { opacity: 0.5 }]}
                  disabled={isRetired || isRecreating}
                  onPress={() => setSelectedModel(model)}
                >
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={[styles.modelName, isSelected && styles.modelNameSelected]}>
                      {MODEL_INFO[model]?.name || model}
                      {status === 'deprecated' ? ' (deprecated)' : status === 'retired' ? ' (retired)' : ''}
                    </Text>
                    <Text style={[styles.modelPrice, isSelected && styles.modelPriceSelected]}>
                      {formatModelPricingShort(model) || 'Pricing unavailable'} (as of {PRICING_AS_OF_DISPLAY})
                    </Text>
                  </View>
                  {isSelected && <Ionicons name="checkmark" size={16} color="white" />}
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.sectionTitle}>Updated Prompt</Text>
          <TextInput
            ref={newPromptRef}
            style={[styles.textInput, styles.multiline]}
            value={newPrompt}
            onChangeText={setNewPrompt}
            placeholder="Update the original prompt…"
            multiline={true}
            textAlignVertical="top"
            editable={!isRecreating}
          />

          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Fix Request (optional)</Text>
            <TouchableOpacity
              style={styles.inlineActionButton}
              onPress={() => {
                const template =
                  'Repro steps:\n- \n\nExpected:\n- \n\nActual:\n- \n\nDevice / screen:\n- \n\nConstraints:\n- Keep same functionality\n- Fix layout/overflow\n';
                setFixNotes((prev) => (prev.trim() ? `${prev.trim()}\n\n${template}` : template));
              }}
              disabled={isRecreating}
            >
              <Ionicons name="clipboard-outline" size={16} color="rgba(0, 0, 0, 0.7)" />
              <Text style={styles.inlineActionText}>Template</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            ref={fixNotesRef}
            style={[styles.textInput, styles.multiline]}
            value={fixNotes}
            onChangeText={setFixNotes}
            placeholder="e.g., buttons overflow on small screens; spacing is off; scrolling is broken…"
            multiline={true}
            textAlignVertical="top"
            editable={!isRecreating}
          />

          <TouchableOpacity
            style={styles.historyToggle}
            onPress={() => setShowRevisionHistory((v) => !v)}
            disabled={isRecreating}
          >
            <Ionicons
              name={showRevisionHistory ? 'chevron-down' : 'chevron-forward'}
              size={18}
              color="rgba(0, 0, 0, 0.7)"
            />
            <Text style={styles.historyToggleText}>Generation History</Text>
          </TouchableOpacity>

          {showRevisionHistory && (
            <View style={styles.historyPanel}>
              {revisionHistory.length === 0 ? (
                <Text style={styles.historyEmptyText}>No revision history yet.</Text>
              ) : (
                revisionHistory.map((rev) => {
                  const when = new Date(rev.at).toLocaleString();
                  const statusIcon =
                    rev.status === 'completed'
                      ? 'checkmark-circle-outline'
                      : rev.status === 'error'
                        ? 'close-circle-outline'
                        : 'time-outline';
                  const statusColor =
                    rev.status === 'completed' ? '#16A34A' : rev.status === 'error' ? '#EF4444' : '#F59E0B';
                  const errorMessage =
                    typeof (rev as any)?.errorMessage === 'string' ? ((rev as any).errorMessage as string) : undefined;
                  return (
                    <View key={rev.id} style={styles.historyRow}>
                      <Ionicons name={statusIcon as any} size={18} color={statusColor} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.historyRowTitle}>
                          {when} • {MODEL_INFO[rev.model]?.name || rev.model}
                        </Text>
                        {!!rev.fixSummary?.length && (
                          <Text style={styles.historyRowSubtext}>Fixes: {rev.fixSummary.join(' · ')}</Text>
                        )}
                        {!!errorMessage && (
                          <Text style={[styles.historyRowSubtext, { color: '#EF4444' }]}>{errorMessage}</Text>
                        )}
                      </View>
                      <TouchableOpacity
                        style={styles.historyUseButton}
                        onPress={() => {
                          setNewPrompt(rev.updatedPrompt);
                          setFixNotes(rev.userNotes || '');
                        }}
                        disabled={isRecreating}
                      >
                        <Text style={styles.historyUseButtonText}>Use</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })
              )}
            </View>
          )}

          <View style={{ height: 90 }} />
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            style={[styles.footerButton, styles.footerButtonSecondary]}
            onPress={safeGoBack}
            disabled={isRecreating}
          >
            <Text style={styles.footerButtonSecondaryText}>Cancel</Text>
          </Pressable>
          <Pressable style={[styles.footerButton, styles.footerButtonPrimary]} onPress={onRecreate} disabled={isRecreating}>
            {isRecreating ? (
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <ActivityIndicator size="small" color="white" />
                <Text style={styles.footerButtonPrimaryText}>Working…</Text>
              </View>
            ) : (
              <Text style={styles.footerButtonPrimaryText}>Recreate</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.Primary,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 10,
  },
  centerText: {
    fontSize: 14,
    color: 'rgba(0, 0, 0, 0.7)',
    textAlign: 'center',
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
  },
  headerIconButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: 'rgba(0, 0, 0, 0.85)',
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: 'rgba(0, 0, 0, 0.55)',
  },
  body: {
    flex: 1,
    paddingHorizontal: 12,
  },
  bodyContent: {
    paddingBottom: 14,
    gap: 14,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: 'rgba(0, 0, 0, 0.82)',
    marginBottom: 6,
  },
  textInput: {
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.18)',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    color: 'rgba(0, 0, 0, 0.85)',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  multiline: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  modelOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.18)',
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
    gap: 10,
  },
  modelOptionSelected: {
    backgroundColor: AppColors.FABMain,
    borderColor: AppColors.FABMain,
  },
  modelName: {
    fontSize: 13,
    fontWeight: '800',
    color: 'rgba(0, 0, 0, 0.82)',
  },
  modelNameSelected: {
    color: 'white',
  },
  modelPrice: {
    marginTop: 3,
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(0, 0, 0, 0.55)',
    lineHeight: 14,
  },
  modelPriceSelected: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  inlineActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
  },
  inlineActionText: {
    fontSize: 12,
    fontWeight: '800',
    color: 'rgba(0, 0, 0, 0.7)',
  },
  historyToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
  },
  historyToggleText: {
    fontSize: 14,
    fontWeight: '800',
    color: 'rgba(0, 0, 0, 0.8)',
  },
  historyPanel: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.12)',
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
    padding: 12,
    gap: 10,
  },
  historyEmptyText: {
    fontSize: 13,
    color: 'rgba(0, 0, 0, 0.6)',
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  historyRowTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: 'rgba(0, 0, 0, 0.78)',
  },
  historyRowSubtext: {
    marginTop: 3,
    fontSize: 12,
    color: 'rgba(0, 0, 0, 0.55)',
    lineHeight: 16,
  },
  historyUseButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
  },
  historyUseButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: 'rgba(0, 0, 0, 0.75)',
  },
  footer: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.08)',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    flexDirection: 'row',
    gap: 12,
  },
  footerButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerButtonPrimary: {
    backgroundColor: AppColors.FABMain,
  },
  footerButtonPrimaryText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '900',
  },
  footerButtonSecondary: {
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
  },
  footerButtonSecondaryText: {
    color: 'rgba(0, 0, 0, 0.7)',
    fontSize: 14,
    fontWeight: '900',
  },
});
