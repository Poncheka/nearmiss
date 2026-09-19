import { Text, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Image as SvgImage, Path, Rect, Text as SvgText } from 'react-native-svg';
import { colors, fonts } from '@/theme';

/**
 * Welcome illustration: two dotted paths almost crossing.
 *
 * The two ends are faces rather than initials in coloured discs. This is the first screen anyone
 * sees, and the promise is about people, which a J and an M in circles do not convey. Same two
 * photos as the marketing site, so the app someone downloads looks like the page that sold it.
 *
 * Each photo is clipped to its circle, then the ring is drawn over the top so the outline stays
 * crisp rather than being a cropped edge.
 */
export function WelcomeArt() {
  return (
    <Svg width={320} height={250} viewBox="0 0 320 250" fill="none">
      <Defs>
        <ClipPath id="wa-you"><Circle cx={34} cy={214} r={22} /></ClipPath>
        <ClipPath id="wa-maya"><Circle cx={36} cy={36} r={22} /></ClipPath>
      </Defs>

      <Circle cx={160} cy={124} r={40} fill={colors.violetTint} />
      <Path d="M34 214 C 84 204, 100 150, 148 136 S 236 64, 292 40" stroke={colors.violet} strokeWidth={3.5} strokeDasharray="1 10" strokeLinecap="round" />
      <Path d="M36 36 C 88 56, 118 96, 172 112 S 250 186, 294 214" stroke={colors.coral} strokeWidth={3.5} strokeDasharray="1 10" strokeLinecap="round" />
      <Circle cx={148} cy={136} r={7} fill={colors.violet} />
      <Circle cx={172} cy={112} r={7} fill={colors.coral} />

      <Circle cx={34} cy={214} r={22} fill="#D9D0F7" />
      <SvgImage
        href={require('../../assets/hero-you.jpg')}
        x={12} y={192} width={44} height={44}
        preserveAspectRatio="xMidYMid slice"
        clipPath="url(#wa-you)"
      />
      <Circle cx={34} cy={214} r={22} fill="none" stroke={colors.ink} strokeWidth={1.5} />

      <Circle cx={36} cy={36} r={22} fill="#F6C9B9" />
      <SvgImage
        href={require('../../assets/hero-maya.jpg')}
        x={14} y={14} width={44} height={44}
        preserveAspectRatio="xMidYMid slice"
        clipPath="url(#wa-maya)"
      />
      <Circle cx={36} cy={36} r={22} fill="none" stroke={colors.ink} strokeWidth={1.5} />

      <Rect x={182} y={140} width={52} height={26} rx={13} fill={colors.white} stroke={colors.handle} />
      <SvgText x={208} y={158} textAnchor="middle" fontFamily={fonts.semibold} fontWeight="600" fontSize={13} fill={colors.ink}>22m</SvgText>
    </Svg>
  );
}

/** Scan illustration: stacked photos with a map pin. */
export function ScanArt() {
  return (
    <Svg width={260} height={220} viewBox="0 0 260 220" fill="none">
      <Rect x={40} y={44} width={120} height={140} rx={18} fill={colors.white} stroke={colors.handle} transform="rotate(-8 100 114)" />
      <Rect x={100} y={36} width={120} height={140} rx={18} fill={colors.white} stroke={colors.handle} transform="rotate(7 160 106)" />
      <Rect x={70} y={40} width={120} height={140} rx={18} fill={colors.white} stroke={colors.ink} strokeWidth={1.5} />
      <Rect x={82} y={52} width={96} height={84} rx={10} fill={colors.violetTint} />
      <Path d="M82 120 L112 94 L136 114 L150 102 L178 124 V126 a10 10 0 0 1 -10 10 H92 a10 10 0 0 1 -10 -10 Z" fill="#C9BDF2" />
      <Rect x={82} y={148} width={60} height={8} rx={4} fill={colors.sandDeep} />
      <Rect x={82} y={162} width={38} height={8} rx={4} fill={colors.sandDeep} />
      <Path d="M186 20c-13 0-22 9.5-22 21.5C164 58 186 80 186 80s22-22 22-38.5C208 29.5 199 20 186 20z" fill={colors.coral} stroke={colors.ink} strokeWidth={1.5} />
      <Circle cx={186} cy={42} r={7} fill={colors.white} />
    </Svg>
  );
}

/** Stand-in photo (concert-like silhouette on a flat color). */
export function PhotoArt({ color, size }: { color: string; size: number }) {
  return (
    <View style={{ width: size, height: size, backgroundColor: color }}>
      <Svg width={size} height={size} viewBox="0 0 84 84" preserveAspectRatio="xMidYMid slice">
        <Path d="M8 0 L28 58 L48 0" fill="#FFFFFF" opacity={0.16} />
        <Path d="M44 0 L60 58 L80 0" fill="#FFFFFF" opacity={0.1} />
        <Rect x={0} y={58} width={84} height={26} fill="#000000" opacity={0.35} />
        <Circle cx={18} cy={62} r={8} fill="#000000" opacity={0.45} />
        <Circle cx={44} cy={60} r={9} fill="#000000" opacity={0.45} />
        <Circle cx={70} cy={63} r={8} fill="#000000" opacity={0.45} />
      </Svg>
    </View>
  );
}

/**
 * Simplified map. `detail` shows both paths; otherwise just two dots with a distance label.
 * Real maps (react-native-maps) replace this once live data is wired up.
 */
export function MiniMap({ width, height = 190, distance, spread = 0.3, detail = false, label }: {
  width: number; height?: number; distance: number; spread?: number; detail?: boolean; label?: string;
}) {
  const cx = width / 2;
  const half = Math.max(12, (width * spread) / 2);
  const ax = cx - half;
  const bx = cx + half;
  const ay = detail ? height * 0.5 : height * 0.5;
  const by = detail ? height * 0.32 : height * 0.5;
  return (
    <View style={{ width, height, backgroundColor: colors.inputBg }}>
      <Svg width={width} height={height}>
        <G stroke={colors.sandDeep} strokeWidth={9} strokeLinecap="round">
          <Path d={`M0 ${height * 0.29} H${width}`} />
          <Path d={`M0 ${height * 0.7} H${width}`} />
          <Path d={`M${width * 0.19} 0 V${height}`} />
          <Path d={`M${width * 0.53} 0 V${height}`} />
          <Path d={`M${width * 0.84} 0 V${height}`} />
        </G>
        <G stroke="#F4EEE5" strokeWidth={4}>
          <Path d={`M0 ${height * 0.5} H${width}`} />
          <Path d={`M${width * 0.36} 0 V${height}`} />
        </G>
        {detail ? (
          <>
            <Path d={`M18 ${height * 0.7} H${width * 0.19} V${ay} L${ax} ${ay}`} stroke={colors.violet} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <Path d={`M${width - 14} 18 H${width * 0.84} V${height * 0.29} H${width * 0.53} L${bx} ${by}`} stroke={colors.coral} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            {label ? (
              <>
                <Rect x={width * 0.36 + 10} y={height * 0.72 + 8} width={label.length * 6.4 + 16} height={24} rx={8} fill={colors.white} stroke={colors.handle} />
                <SvgText x={width * 0.36 + 18} y={height * 0.72 + 24} textAnchor="start" fontFamily={fonts.semibold} fontWeight="600" fontSize={10} fill={colors.ink}>{label}</SvgText>
              </>
            ) : null}
          </>
        ) : null}
        <Path d={`M${ax} ${ay} L${bx} ${by}`} stroke={colors.ink} strokeWidth={1.3} strokeDasharray="3 3" />
        <Circle cx={ax} cy={ay} r={8} fill={colors.violet} stroke={colors.white} strokeWidth={2} />
        <Circle cx={bx} cy={by} r={8} fill={colors.coral} stroke={colors.white} strokeWidth={2} />
      </Svg>
      {!detail ? (
        <View style={{ position: 'absolute', top: ay + 16, left: 0, right: 0, alignItems: 'center' }}>
          <View style={{ backgroundColor: colors.white, borderColor: colors.inputBorder, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.ink }}>{distance}m apart</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

/** Tab icon: two overlapping circles. */
export function OverlapIcon({ color, size = 24 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8}>
      <Circle cx={8.5} cy={12} r={5.5} />
      <Circle cx={15.5} cy={12} r={5.5} />
    </Svg>
  );
}
