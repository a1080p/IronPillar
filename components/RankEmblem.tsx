import Svg, { Defs, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { Pressable } from 'react-native';
import { router } from 'expo-router';
import { TIER_COLORS, rankForXp, type Rank } from '../constants/rank';
import { useAuth } from '../contexts/AuthContext';
import { usePurchases } from '../contexts/PurchasesContext';

// A rank's shield: the tier's colors, the division numeral inside (a small
// pillar for the Pillar tier). `framed` adds the gold Pro rank frame.
export function RankEmblem({ rank, size = 28, framed = false }: { rank: Rank; size?: number; framed?: boolean }) {
  const [light, dark] = TIER_COLORS[rank.tier];
  const id = `rank-${rank.index}-${framed ? 'f' : 'p'}`;
  const shield = 'M50 4 L90 18 V52 C90 76 72 92 50 100 C28 92 10 76 10 52 V18 Z';
  return (
    <Svg width={size} height={size * 1.04} viewBox="0 0 100 104" accessibilityLabel={`${rank.name} rank`}>
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={light} />
          <Stop offset="1" stopColor={dark} />
        </LinearGradient>
        <LinearGradient id={`${id}-frame`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFE58A" />
          <Stop offset="0.5" stopColor="#E0A800" />
          <Stop offset="1" stopColor="#FFF2C2" />
        </LinearGradient>
      </Defs>
      {framed && <Path d={shield} fill="none" stroke={`url(#${id}-frame)`} strokeWidth={12} strokeLinejoin="round" />}
      <Path d={shield} fill={`url(#${id})`} stroke={dark} strokeWidth={4} strokeLinejoin="round" />
      {rank.division ? (
        <SvgText
          x="50"
          y="66"
          fontSize={rank.division.length === 3 ? 34 : 40}
          fontWeight="900"
          fill="#FFFFFF"
          stroke={dark}
          strokeWidth={1.5}
          textAnchor="middle"
        >
          {rank.division}
        </SvgText>
      ) : (
        <>
          <Rect x="30" y="28" width="40" height="8" rx="2" fill="#FFFFFF" />
          <Rect x="36" y="38" width="7" height="34" fill="#FFFFFF" />
          <Rect x="47" y="38" width="7" height="34" fill="#FFFFFF" />
          <Rect x="58" y="38" width="7" height="34" fill="#FFFFFF" />
          <Rect x="28" y="74" width="44" height="8" rx="2" fill="#FFFFFF" />
        </>
      )}
    </Svg>
  );
}

// The signed-in user's rank emblem for the top bar; tap for the rank screen.
// Pro subscribers get the gold rank frame.
export function RankBadge({ size = 26 }: { size?: number }) {
  const { profile } = useAuth();
  const { isPro } = usePurchases();
  const rank = rankForXp(profile?.xp);
  return (
    <Pressable
      onPress={() => router.push('/rank')}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={`Rank: ${rank.name}. Opens your rank`}
    >
      <RankEmblem rank={rank} size={size} framed={isPro} />
    </Pressable>
  );
}
