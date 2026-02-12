import React from 'react';
import type { LiveActivityVariants } from 'voltra';

type TimerLiveActivityParams = {
  title?: string;
  subtitle?: string;
  tintColor?: string;
  startAtMs?: number;
  endAtMs?: number;
  durationMs?: number;
  direction?: 'up' | 'down';
  showHours?: boolean;
  textStyle?: 'timer' | 'relative';
  autoHideOnEnd?: boolean;
};

type CounterLiveActivityParams = {
  title?: string;
  subtitle?: string;
  tintColor?: string;
  count: number;
  unit?: string;
};

function clampNumber(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return value;
}

function clampNonNegativeInt(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

function sanitizeColor(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

function sanitizeText(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

async function loadVoltra(): Promise<{ Voltra: any } | null> {
  try {
    return (await import('voltra')) as any;
  } catch {
    return null;
  }
}

export async function buildTimerLiveActivityVariants(
  params: TimerLiveActivityParams
): Promise<LiveActivityVariants | null> {
  const voltra = await loadVoltra();
  if (!voltra) return null;

  const { Voltra } = voltra;

  const accent = sanitizeColor(params.tintColor, '#7C3AED');
  const title = sanitizeText(params.title, 'Timer');
  const subtitle = params.subtitle?.trim() ? params.subtitle.trim() : 'Tap to open';

  const direction = params.direction === 'up' ? 'up' : 'down';
  const endAtMs = params.endAtMs === undefined ? undefined : clampNumber(params.endAtMs);
  const startAtMs = params.startAtMs === undefined ? undefined : clampNumber(params.startAtMs);
  const durationMs = params.durationMs === undefined ? undefined : clampNumber(params.durationMs);

  if (endAtMs === undefined && durationMs === undefined) return null;

  const showHours = params.showHours ?? true;
  const textStyle = params.textStyle === 'relative' ? 'relative' : 'timer';
  const autoHideOnEnd = params.autoHideOnEnd ?? false;

  const timerTemplates = JSON.stringify({
    running: '{time}',
    completed: 'Done',
  });

  const timerNode = (
    <Voltra.Timer
      direction={direction}
      startAtMs={startAtMs}
      endAtMs={endAtMs}
      durationMs={durationMs}
      autoHideOnEnd={autoHideOnEnd}
      textStyle={textStyle}
      textTemplates={timerTemplates}
      showHours={showHours}
      style={{ color: 'white', fontSize: 16, fontWeight: '900' }}
    />
  );

  const lockScreen = (
    <Voltra.VStack
      spacing={10}
      alignment="leading"
      style={{ padding: 16, borderRadius: 18, backgroundColor: '#111827' }}
    >
      <Voltra.HStack spacing={12} alignment="center">
        <Voltra.Symbol name="timer" size={18} type="hierarchical" tintColor={accent} />

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

        {timerNode}
      </Voltra.HStack>

      <Voltra.LinearProgressView
        height={4}
        cornerRadius={999}
        trackColor="rgba(255, 255, 255, 0.18)"
        progressColor={accent}
        countDown={direction !== 'up'}
        startAtMs={startAtMs}
        endAtMs={endAtMs}
      />
    </Voltra.VStack>
  );

  const expandedCenter = (
    <Voltra.VStack spacing={2} alignment="leading">
      <Voltra.Text style={{ color: 'white', fontSize: 14, fontWeight: '900' }} numberOfLines={1}>
        {title}
      </Voltra.Text>
      <Voltra.Text style={{ color: 'rgba(255, 255, 255, 0.70)', fontSize: 11, fontWeight: '700' }} numberOfLines={1}>
        {subtitle}
      </Voltra.Text>
    </Voltra.VStack>
  );

  const compactTrailing = (
    <Voltra.Timer
      direction={direction}
      startAtMs={startAtMs}
      endAtMs={endAtMs}
      durationMs={durationMs}
      autoHideOnEnd={autoHideOnEnd}
      textStyle={textStyle}
      textTemplates={timerTemplates}
      showHours={showHours}
      style={{ color: 'white', fontSize: 12, fontWeight: '900' }}
    />
  );

  const minimal = (
    <Voltra.Timer
      direction={direction}
      startAtMs={startAtMs}
      endAtMs={endAtMs}
      durationMs={durationMs}
      autoHideOnEnd={autoHideOnEnd}
      textStyle={textStyle}
      textTemplates={timerTemplates}
      showHours={showHours}
      style={{ color: 'white', fontSize: 12, fontWeight: '900' }}
    />
  );

  return {
    lockScreen: {
      content: lockScreen,
      activityBackgroundTint: '#111827',
    },
    island: {
      keylineTint: accent,
      expanded: {
        leading: <Voltra.Symbol name="timer" size={16} type="hierarchical" tintColor={accent} />,
        center: expandedCenter,
        trailing: timerNode,
        bottom: (
          <Voltra.LinearProgressView
            height={3}
            cornerRadius={999}
            trackColor="rgba(255, 255, 255, 0.24)"
            progressColor={accent}
            countDown={direction !== 'up'}
            startAtMs={startAtMs}
            endAtMs={endAtMs}
          />
        ),
      },
      compact: {
        leading: <Voltra.Symbol name="timer" size={14} type="hierarchical" tintColor={accent} />,
        trailing: compactTrailing,
      },
      minimal,
    },
  };
}

export async function buildCounterLiveActivityVariants(
  params: CounterLiveActivityParams
): Promise<LiveActivityVariants | null> {
  const voltra = await loadVoltra();
  if (!voltra) return null;

  const { Voltra } = voltra;

  const accent = sanitizeColor(params.tintColor, '#7C3AED');
  const title = sanitizeText(params.title, 'Counter');
  const subtitle = params.subtitle?.trim() ? params.subtitle.trim() : 'Tap to open';
  const count = clampNonNegativeInt(params.count);
  const unit = params.unit?.trim() ? params.unit.trim() : '';

  const valueText = unit ? `${count} ${unit}` : `${count}`;

  const valueNode = (
    <Voltra.Text style={{ color: 'white', fontSize: 16, fontWeight: '900' }} numberOfLines={1}>
      {valueText}
    </Voltra.Text>
  );

  const lockScreen = (
    <Voltra.VStack
      spacing={10}
      alignment="leading"
      style={{ padding: 16, borderRadius: 18, backgroundColor: '#111827' }}
    >
      <Voltra.HStack spacing={12} alignment="center">
        <Voltra.Symbol name="number" size={18} type="hierarchical" tintColor={accent} />

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

        {valueNode}
      </Voltra.HStack>
    </Voltra.VStack>
  );

  const expandedCenter = (
    <Voltra.VStack spacing={2} alignment="leading">
      <Voltra.Text style={{ color: 'white', fontSize: 14, fontWeight: '900' }} numberOfLines={1}>
        {title}
      </Voltra.Text>
      <Voltra.Text style={{ color: 'rgba(255, 255, 255, 0.70)', fontSize: 11, fontWeight: '700' }} numberOfLines={1}>
        {subtitle}
      </Voltra.Text>
    </Voltra.VStack>
  );

  const compactTrailing = (
    <Voltra.Text style={{ color: 'white', fontSize: 12, fontWeight: '900' }} numberOfLines={1}>
      {count}
    </Voltra.Text>
  );

  const minimal = (
    <Voltra.Text style={{ color: 'white', fontSize: 12, fontWeight: '900' }} numberOfLines={1}>
      {count}
    </Voltra.Text>
  );

  return {
    lockScreen: {
      content: lockScreen,
      activityBackgroundTint: '#111827',
    },
    island: {
      keylineTint: accent,
      expanded: {
        leading: <Voltra.Symbol name="number" size={16} type="hierarchical" tintColor={accent} />,
        center: expandedCenter,
        trailing: valueNode,
      },
      compact: {
        leading: <Voltra.Symbol name="number" size={14} type="hierarchical" tintColor={accent} />,
        trailing: compactTrailing,
      },
      minimal,
    },
  };
}

