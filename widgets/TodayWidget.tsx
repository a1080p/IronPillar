// The "Iron Pillar Today" home screen and lock screen widget: week streak and
// workouts this week toward the weekly goal, steps (Pro, Apple Health), and calories left
// (Pro). Long-press → Edit Widget to choose which of the three it shows.
// Kept up to date from the app by components/WidgetSync.tsx.
//
// The function below runs in the widget extension, not in the app: it can
// only use @expo/ui/swift-ui components and its own props. No hooks, no app
// state, and nothing declared elsewhere in this file. Formatting is done by
// hand because the widget runtime may not have Intl.
import {
  AccessoryWidgetBackground,
  HStack,
  Image,
  ProgressView,
  Spacer,
  Text,
  VStack,
  ZStack,
} from '@expo/ui/swift-ui';
import {
  font,
  foregroundStyle,
  frame,
  lineLimit,
  minimumScaleFactor,
  monospacedDigit,
  padding,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';
import type { SFSymbol } from 'sf-symbols-typescript';

export type TodayWidgetProps = {
  streak: number;
  weekCount: number; // workouts counted this week
  weekGoal: number; // the week's goal (2-6)
  steps: number | null; // null until Apple Health is connected (Pro)
  stepsGoal: number;
  caloriesLeft: number | null; // null when not Pro
  calorieGoal: number | null;
  isPro: boolean;
  healthConnected: boolean;
  updatedAt: number; // ms epoch the app last refreshed these numbers
};

export type TodayWidgetConfig = {
  showWorkout: boolean;
  showSteps: boolean;
  showCalories: boolean;
};

const TodayWidget = (props: TodayWidgetProps, env: WidgetEnvironment<TodayWidgetConfig>) => {
  'widget';
  const flame = '#FF8A00';
  const blue = '#3D4FEA';
  const green = '#22A06B';
  const muted = '#8A8A8E';
  const config = env.configuration ?? { showWorkout: true, showSteps: true, showCalories: true };

  // Nothing from the app yet (just added, or never signed in on this phone).
  if (!props || props.updatedAt == null) {
    return (
      <VStack spacing={4}>
        <Image systemName="flame.fill" size={18} color={flame} />
        <Text modifiers={[font({ size: 12 }), lineLimit(2)]}>Open Iron Pillar to start</Text>
      </VStack>
    );
  }

  const fmt = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const short = (n: number) => (n >= 10000 ? `${(n / 1000).toFixed(1)}k` : fmt(n));
  const clamp = (n: number) => Math.max(0, Math.min(1, n));
  const clock = (ms: number) => {
    const d = new Date(ms);
    const h = d.getHours();
    const m = d.getMinutes();
    return `${h % 12 === 0 ? 12 : h % 12}:${m < 10 ? '0' : ''}${m} ${h < 12 ? 'AM' : 'PM'}`;
  };

  const metrics: {
    key: string;
    symbol: SFSymbol;
    color: string;
    value: string; // the big number
    label: string; // what it is
    progress: number | null; // 0-1, null for no bar
    inline: string; // for the one-line lock screen widget
    circular: string; // number in the round lock screen widget
  }[] = [];

  if (config.showWorkout) {
    const done = props.weekCount >= props.weekGoal;
    metrics.push({
      key: 'workout',
      symbol: 'flame.fill',
      color: flame,
      value: `${props.streak}`,
      label: done
        ? 'week streak · goal hit'
        : `week streak · ${props.weekCount}/${props.weekGoal} this week`,
      progress: clamp(props.weekCount / props.weekGoal),
      inline: `${props.streak}-week streak · ${props.weekCount}/${props.weekGoal}`,
      circular: `${props.streak}`,
    });
  }
  if (config.showSteps) {
    const locked = !props.isPro;
    const missing = !locked && (!props.healthConnected || props.steps == null);
    const steps = props.steps ?? 0;
    metrics.push({
      key: 'steps',
      symbol: 'figure.walk',
      color: green,
      value: locked ? 'Pro' : missing ? '—' : short(steps),
      label: locked ? 'steps with Pro' : missing ? 'connect Apple Health' : 'steps',
      progress: locked || missing ? null : clamp(steps / props.stepsGoal),
      inline: locked || missing ? 'Steps' : `${short(steps)} steps`,
      circular: locked || missing ? '—' : short(steps),
    });
  }
  if (config.showCalories) {
    const locked = !props.isPro || props.caloriesLeft == null || props.calorieGoal == null;
    const left = props.caloriesLeft ?? 0;
    metrics.push({
      key: 'calories',
      symbol: 'fork.knife',
      color: blue,
      value: locked ? 'Pro' : fmt(Math.abs(left)),
      label: locked ? 'calories with Pro' : left >= 0 ? 'cal left' : 'cal over',
      progress: locked ? null : clamp(1 - left / (props.calorieGoal || 1)),
      inline: locked ? 'Calories' : `${fmt(left)} cal left`,
      circular: locked ? '—' : short(Math.max(0, left)),
    });
  }

  if (metrics.length === 0) {
    return (
      <VStack>
        <Text modifiers={[font({ size: 13 })]}>Edit the widget to pick what to show</Text>
      </VStack>
    );
  }

  const family = env.widgetFamily;

  if (family === 'accessoryInline') {
    return <Text>{metrics.map((m) => m.inline).join(' · ')}</Text>;
  }

  if (family === 'accessoryCircular') {
    const m = metrics[0];
    return (
      <ZStack>
        <AccessoryWidgetBackground />
        <VStack spacing={1}>
          <Image systemName={m.symbol} size={13} />
          <Text
            modifiers={[font({ size: 17, weight: 'bold' }), monospacedDigit(), minimumScaleFactor(0.6), lineLimit(1)]}
          >
            {m.circular}
          </Text>
        </VStack>
      </ZStack>
    );
  }

  if (family === 'accessoryRectangular') {
    return (
      <VStack alignment="leading" spacing={2}>
        {metrics.map((m) => (
          <HStack key={m.key} spacing={5}>
            <Image systemName={m.symbol} size={12} />
            <Text modifiers={[font({ size: 14, weight: 'semibold' }), monospacedDigit(), lineLimit(1)]}>
              {m.value}
            </Text>
            <Text modifiers={[font({ size: 12 }), lineLimit(1)]}>{m.label}</Text>
            <Spacer />
          </HStack>
        ))}
      </VStack>
    );
  }

  const updated = `Updated ${clock(props.updatedAt)}`;

  if (family === 'systemMedium') {
    return (
      <VStack alignment="leading" spacing={8} modifiers={[padding({ all: 4 })]}>
        <HStack spacing={12}>
          {metrics.map((m) => (
            <VStack key={m.key} alignment="leading" spacing={4} modifiers={[frame({ maxWidth: 1000 })]}>
              <Image systemName={m.symbol} size={16} color={m.color} />
              <Text
                modifiers={[font({ size: 24, weight: 'bold' }), monospacedDigit(), minimumScaleFactor(0.6), lineLimit(1)]}
              >
                {m.value}
              </Text>
              <Text modifiers={[font({ size: 11 }), foregroundStyle(muted), lineLimit(2)]}>{m.label}</Text>
              {m.progress != null ? <ProgressView value={m.progress} modifiers={[tint(m.color)]} /> : null}
            </VStack>
          ))}
        </HStack>
        <Text modifiers={[font({ size: 10 }), foregroundStyle(muted)]}>{updated}</Text>
      </VStack>
    );
  }

  // systemSmall: one row per metric.
  return (
    <VStack alignment="leading" spacing={metrics.length === 3 ? 6 : 10}>
      {metrics.map((m) => (
        <VStack key={m.key} alignment="leading" spacing={2}>
          <HStack spacing={5}>
            <Image systemName={m.symbol} size={13} color={m.color} />
            <Text
              modifiers={[font({ size: metrics.length === 1 ? 30 : 18, weight: 'bold' }), monospacedDigit(), lineLimit(1)]}
            >
              {m.value}
            </Text>
            <Spacer />
          </HStack>
          <Text modifiers={[font({ size: 10 }), foregroundStyle(muted), lineLimit(1)]}>{m.label}</Text>
          {m.progress != null && metrics.length < 3 ? (
            <ProgressView value={m.progress} modifiers={[tint(m.color)]} />
          ) : null}
        </VStack>
      ))}
      <Spacer />
      <Text modifiers={[font({ size: 9 }), foregroundStyle(muted)]}>{updated}</Text>
    </VStack>
  );
};

export default createWidget<TodayWidgetProps, TodayWidgetConfig>('IronPillarToday', TodayWidget);
