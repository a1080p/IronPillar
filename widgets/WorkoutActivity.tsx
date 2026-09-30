// The Live Activity shown on the lock screen and in the Dynamic Island while
// a workout is in progress. Started, updated and ended through
// lib/liveActivity.ts.
//
// The function below runs in the widget extension, not in the app: it can
// only use @expo/ui/swift-ui components and its own props. No hooks, no app
// state, and nothing declared elsewhere in this file.
import { HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  font,
  foregroundStyle,
  frame,
  lineLimit,
  monospacedDigit,
  multilineTextAlignment,
  padding,
} from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity } from 'expo-widgets';
import type { SFSymbol } from 'sf-symbols-typescript';

export type WorkoutActivityProps = {
  title: string; // workout name, e.g. "Upper Body Strength" or "Outdoor Walk"
  headline: string; // what's happening now: the exercise, or the distance
  detail: string; // e.g. "Exercise 2 of 7 · Set 3 of 4", or the pace
  icon: string; // SF Symbol name
  // ms epoch the on-screen timer counts up from (start time, moved forward by
  // any time spent paused).
  timerStart: number;
  pausedElapsed?: string; // set while paused: the frozen time, e.g. "12:34"
  restEndsAt?: number; // ms epoch a rest countdown ends, while resting
};

const WorkoutActivity = (props: WorkoutActivityProps) => {
  'widget';
  const flame = '#FF8A00';
  // A count-up timer needs an end; a workout never runs this long.
  const dayMs = 24 * 60 * 60 * 1000;
  const symbol = props.icon as SFSymbol;
  const resting = !!props.restEndsAt && props.restEndsAt > Date.now();

  const timer = props.pausedElapsed ? (
    <Text modifiers={[font({ weight: 'bold', size: 22 }), monospacedDigit(), foregroundStyle(flame)]}>
      {props.pausedElapsed}
    </Text>
  ) : (
    <Text
      timerInterval={{ lower: new Date(props.timerStart), upper: new Date(props.timerStart + dayMs) }}
      countsDown={false}
      modifiers={[
        font({ weight: 'bold', size: 22 }),
        monospacedDigit(),
        foregroundStyle(flame),
        multilineTextAlignment('trailing'),
        frame({ maxWidth: 96, alignment: 'trailing' }),
      ]}
    />
  );

  const compactTimer = props.pausedElapsed ? (
    <Text modifiers={[font({ size: 14, weight: 'semibold' }), monospacedDigit(), foregroundStyle(flame)]}>
      {props.pausedElapsed}
    </Text>
  ) : (
    <Text
      timerInterval={{ lower: new Date(props.timerStart), upper: new Date(props.timerStart + dayMs) }}
      countsDown={false}
      modifiers={[
        font({ size: 14, weight: 'semibold' }),
        monospacedDigit(),
        foregroundStyle(flame),
        multilineTextAlignment('trailing'),
        frame({ maxWidth: 52, alignment: 'trailing' }),
      ]}
    />
  );

  const status = resting ? (
    <HStack spacing={4}>
      <Text modifiers={[font({ size: 13 })]}>Rest</Text>
      <Text
        timerInterval={{ lower: new Date(), upper: new Date(props.restEndsAt ?? 0) }}
        countsDown
        modifiers={[font({ size: 13, weight: 'semibold' }), monospacedDigit(), multilineTextAlignment('leading')]}
      />
    </HStack>
  ) : (
    <Text modifiers={[font({ size: 13 }), lineLimit(1)]}>
      {props.pausedElapsed ? 'Paused' : props.detail}
    </Text>
  );

  return {
    banner: (
      <VStack alignment="leading" spacing={4} modifiers={[padding({ all: 16 })]}>
        <HStack spacing={6}>
          <Image systemName={symbol} size={14} color={flame} />
          <Text modifiers={[font({ size: 13, weight: 'semibold' }), lineLimit(1)]}>{props.title}</Text>
          <Spacer />
          {timer}
        </HStack>
        <Text modifiers={[font({ size: 20, weight: 'bold' }), lineLimit(1)]}>{props.headline}</Text>
        {status}
      </VStack>
    ),
    compactLeading: <Image systemName={symbol} size={14} color={flame} />,
    compactTrailing: compactTimer,
    minimal: <Image systemName={symbol} size={12} color={flame} />,
    expandedLeading: (
      <VStack alignment="leading" modifiers={[padding({ leading: 8, top: 4 })]}>
        <Image systemName={symbol} size={20} color={flame} />
      </VStack>
    ),
    expandedTrailing: <VStack modifiers={[padding({ trailing: 8, top: 4 })]}>{timer}</VStack>,
    expandedCenter: (
      <Text modifiers={[font({ size: 13, weight: 'semibold' }), lineLimit(1)]}>{props.title}</Text>
    ),
    expandedBottom: (
      <VStack alignment="leading" spacing={2} modifiers={[padding({ horizontal: 8, bottom: 8 })]}>
        <Text modifiers={[font({ size: 18, weight: 'bold' }), lineLimit(1)]}>{props.headline}</Text>
        {status}
      </VStack>
    ),
  };
};

export default createLiveActivity('WorkoutActivity', WorkoutActivity);
