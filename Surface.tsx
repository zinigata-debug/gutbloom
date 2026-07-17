import React from 'react';
import { View, StyleSheet, ViewProps, ViewStyle, StyleProp } from 'react-native';
import { getElevation, ElevationLevel } from './elevation';

// M3 surface-tint overlay opacity per elevation level 0-5.
const TINT_OPACITY = [0, 0.05, 0.08, 0.11, 0.12, 0.14];

// Self-sizing/positioning props stay on the outer (shadow-casting) view; everything else
// (padding, flex layout of children, etc.) goes on the inner (clipped, tinted) view that
// actually hosts the children.
//
// height/minHeight/maxHeight are deliberately NOT here (unlike their width counterparts):
// in a column-direction parent, RN's default `alignItems: 'stretch'` propagates a WIDTH bound
// from outer to inner automatically, but height bounds along the main axis do not propagate to
// children at all. A maxHeight meant to cap+scroll a tall panel (e.g. a bottom-sheet category
// list) has to live on the SAME view as `overflow: 'hidden'` — the inner view — or it silently
// fails to clip/bound content, breaking ScrollView's ability to compute a scroll boundary and
// leaving real touch targets in a different place than what's visible.
const OUTER_KEYS = [
  'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight', 'marginHorizontal', 'marginVertical',
  'flex', 'flexGrow', 'flexShrink', 'flexBasis', 'alignSelf', 'width',
  'minWidth', 'maxWidth', 'position', 'top', 'left', 'right', 'bottom',
  'opacity', 'transform',
];

// Radius props are applied to BOTH the outer (shadow) and inner (clip) views — the shadow's
// silhouette needs to match the clipped shape, e.g. a bottom sheet that only rounds its top
// corners, or the shadow would render as a plain rectangle behind a rounded panel.
const RADIUS_KEYS = ['borderRadius', 'borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomLeftRadius', 'borderBottomRightRadius'];

type SurfaceProps = ViewProps & {
  elevation?: ElevationLevel;
  primaryColor?: string;
  // Set false to keep the shadow but skip M3's tonal tint overlay — for surfaces that should read
  // as pure white (or a pure custom fill) rather than a tinted elevated surface.
  tinted?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Surface({ elevation = 0, primaryColor = '#6750A4', tinted = true, style, children, ...rest }: SurfaceProps) {
  const flat = (StyleSheet.flatten(style) || {}) as Record<string, any>;
  const { backgroundColor = '#fff', ...remaining } = flat;
  const radiusStyle: Record<string, any> = {};
  const outerStyle: Record<string, any> = {};
  const innerStyle: Record<string, any> = {};
  for (const key of Object.keys(remaining)) {
    if (RADIUS_KEYS.includes(key)) radiusStyle[key] = remaining[key];
    else if (OUTER_KEYS.includes(key)) outerStyle[key] = remaining[key];
    else innerStyle[key] = remaining[key];
  }
  const tint = tinted ? TINT_OPACITY[elevation] : 0;
  return (
    <View style={[getElevation(elevation), { backgroundColor }, radiusStyle, outerStyle]} {...rest}>
      <View style={[{ overflow: 'hidden' }, radiusStyle, innerStyle]}>
        {tint > 0 && (
          <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { backgroundColor: primaryColor, opacity: tint }]} />
        )}
        {children}
      </View>
    </View>
  );
}
