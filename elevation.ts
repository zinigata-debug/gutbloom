import { Platform, ViewStyle } from 'react-native';

export type ElevationLevel = 0 | 1 | 2 | 3 | 4 | 5;

// M3 elevation levels 0-5 as Android `elevation` values. Level 1 uses 2 (not the raw 1dp): RN's
// elevation renders lighter than the true M3 shadow, so 2 better matches the M3 L1 look / the iOS
// side below. Higher levels track the M3 dp scale.
const ANDROID_DP = [0, 2, 3, 6, 8, 12];

// M3's elevation shadow is two layers (a tighter key shadow + a wider ambient one); RN supports
// only a single shadow layer, so this collapses them into one that matches the M3 look: a soft,
// neutral, clearly-present drop shadow that sits just below the surface. Offset and blur grow with
// the level (per M3's key-shadow vertical offsets 1/1/2/3/4dp and its widening ambient blur).
const IOS_SHADOW: { height: number; opacity: number; radius: number }[] = [
  { height: 0, opacity: 0, radius: 0 },
  { height: 1, opacity: 0.20, radius: 3 },
  { height: 2, opacity: 0.22, radius: 5 },
  { height: 4, opacity: 0.24, radius: 8 },
  { height: 6, opacity: 0.26, radius: 10 },
  { height: 8, opacity: 0.28, radius: 12 },
];

// Black, per M3 (its shadows are pure black at low opacity). Reads as the neutral soft grey in the
// M3 card reference; a tinted color would shift the shadow's hue away from that.
const SHADOW_COLOR = '#000';

export function getElevation(level: ElevationLevel): ViewStyle {
  if (Platform.OS === 'android') return { elevation: ANDROID_DP[level] };
  const { height, opacity, radius } = IOS_SHADOW[level];
  return { shadowColor: SHADOW_COLOR, shadowOffset: { width: 0, height }, shadowOpacity: opacity, shadowRadius: radius };
}
