import React from 'react';
import type { LiveActivityVariants } from 'voltra';

type GenerationLiveActivityParams = {
  phase?: 'queued' | 'running' | 'completed' | 'failed';
  pendingCount: number;
  queuedCount: number;
  tintColor?: string;
};

function clampCount(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

async function loadVoltra(): Promise<{ Voltra: any } | null> {
  try {
    return (await import('voltra')) as any;
  } catch {
    return null;
  }
}

export async function buildGenerationLiveActivityVariants({
  phase,
  pendingCount,
  queuedCount,
  tintColor,
}: GenerationLiveActivityParams): Promise<LiveActivityVariants | null> {
  const voltra = await loadVoltra();
  if (!voltra) return null;

  const { Voltra } = voltra;

  const pending = clampCount(pendingCount);
  const queued = clampCount(queuedCount);
  const accent = tintColor?.trim() ? tintColor.trim() : '#7C3AED';

  const effectivePhase = phase ?? (pending > 0 ? 'running' : 'queued');

  const iconSymbol =
    effectivePhase === 'completed'
      ? 'checkmark.circle.fill'
      : effectivePhase === 'failed'
          ? 'exclamationmark.triangle.fill'
          : 'sparkles';

  const title =
    effectivePhase === 'completed'
      ? 'App ready'
      : effectivePhase === 'failed'
          ? 'Generation failed'
          : pending <= 1
              ? 'Generating app…'
              : `Generating ${pending} apps…`;

  const subtitle =
    effectivePhase === 'completed'
      ? 'Tap to open Droplets'
      : effectivePhase === 'failed'
          ? 'Tap to review'
          : queued > 0
              ? `${queued} queued • keep Droplets open`
              : 'Keep Droplets open';

  const accentForPhase =
    effectivePhase === 'failed' ? '#EF4444' : accent;

  const trailing =
    effectivePhase === 'completed'
      ? (
          <Voltra.Symbol
            name="checkmark"
            size={14}
            type="hierarchical"
            tintColor="rgba(255, 255, 255, 0.92)"
          />
        )
      : effectivePhase === 'failed'
          ? (
              <Voltra.Symbol
                name="xmark"
                size={14}
                type="hierarchical"
                tintColor="rgba(255, 255, 255, 0.92)"
              />
            )
          : (
              <Voltra.Text style={{ color: 'white', fontSize: 14, fontWeight: '900' }} numberOfLines={1}>
                {pending}
              </Voltra.Text>
            );

  const lockScreen = (
    <Voltra.VStack
      spacing={10}
      alignment="leading"
      style={{ padding: 16, borderRadius: 18, backgroundColor: '#111827' }}
    >
      <Voltra.HStack spacing={12} alignment="center">
        <Voltra.Symbol name={iconSymbol} size={18} type="hierarchical" tintColor={accentForPhase} />

        <Voltra.VStack spacing={2} alignment="leading" style={{ flexGrow: 1 }}>
          <Voltra.Text style={{ color: 'white', fontSize: 16, fontWeight: '800' }} numberOfLines={1}>
            {title}
          </Voltra.Text>
          <Voltra.Text
            style={{ color: 'rgba(255, 255, 255, 0.72)', fontSize: 12, fontWeight: '700' }}
            numberOfLines={1}
          >
            {subtitle}
          </Voltra.Text>
        </Voltra.VStack>

        {trailing}
      </Voltra.HStack>

      <Voltra.LinearProgressView
        height={4}
        cornerRadius={999}
        trackColor="rgba(255, 255, 255, 0.18)"
        progressColor={accentForPhase}
        value={effectivePhase === 'completed' ? 1 : undefined}
        maximumValue={effectivePhase === 'completed' ? 1 : undefined}
      />
    </Voltra.VStack>
  );

  const expandedCenter = (
    <Voltra.VStack spacing={2} alignment="leading">
      <Voltra.Text style={{ color: 'white', fontSize: 14, fontWeight: '900' }} numberOfLines={1}>
        Generating…
      </Voltra.Text>
      <Voltra.Text
        style={{ color: 'rgba(255, 255, 255, 0.70)', fontSize: 11, fontWeight: '700' }}
        numberOfLines={1}
      >
        {queued > 0 ? `${queued} queued` : 'Keep open'}
      </Voltra.Text>
    </Voltra.VStack>
  );

  const expandedLeading = (
    <Voltra.Symbol name={iconSymbol} size={16} type="hierarchical" tintColor={accentForPhase} />
  );

  const expandedTrailing = trailing;

  const expandedBottom = (
    <Voltra.LinearProgressView
      height={3}
      cornerRadius={999}
      trackColor="rgba(255, 255, 255, 0.24)"
      progressColor={accentForPhase}
      value={effectivePhase === 'completed' ? 1 : undefined}
      maximumValue={effectivePhase === 'completed' ? 1 : undefined}
    />
  );

  const compactLeading = (
    <Voltra.Symbol name={iconSymbol} size={14} type="hierarchical" tintColor={accentForPhase} />
  );

  const compactTrailing =
    effectivePhase === 'completed'
      ? (
          <Voltra.Symbol name="checkmark" size={12} type="hierarchical" tintColor="white" />
        )
      : effectivePhase === 'failed'
          ? (
              <Voltra.Symbol name="xmark" size={12} type="hierarchical" tintColor="white" />
            )
          : (
              <Voltra.Text style={{ color: 'white', fontSize: 12, fontWeight: '900' }} numberOfLines={1}>
                {pending}
              </Voltra.Text>
            );

  const minimal = (
    effectivePhase === 'completed'
      ? (
          <Voltra.Symbol name="checkmark" size={12} type="hierarchical" tintColor="white" />
        )
      : effectivePhase === 'failed'
          ? (
              <Voltra.Symbol name="xmark" size={12} type="hierarchical" tintColor="white" />
            )
          : (
              <Voltra.Text style={{ color: 'white', fontSize: 12, fontWeight: '900' }} numberOfLines={1}>
                {pending}
              </Voltra.Text>
            )
  );

  return {
    lockScreen: {
      content: lockScreen,
      activityBackgroundTint: '#111827',
    },
    island: {
      keylineTint: accentForPhase,
      expanded: {
        leading: expandedLeading,
        center: expandedCenter,
        trailing: expandedTrailing,
        bottom: expandedBottom,
      },
      compact: {
        leading: compactLeading,
        trailing: compactTrailing,
      },
      minimal,
    },
  };
}
