import { ReactNode } from 'react';
import { Pressable, StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';
import { colors, fonts, radius } from '@/theme';

// ---------- Layout ----------

export function Screen({ children, edges = ['top'], style }: { children: ReactNode; edges?: Edge[]; style?: StyleProp<ViewStyle> }) {
  return (
    <SafeAreaView edges={edges} style={[{ flex: 1, backgroundColor: colors.bg }, style]}>
      {children}
    </SafeAreaView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionLabel({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.section, style]}>{children}</Text>;
}

export function Divider() {
  return <View style={{ height: 1, backgroundColor: colors.divider }} />;
}

// ---------- Text ----------

export function Display({ children, size = 32, style, numberOfLines }: { children: ReactNode; size?: number; style?: StyleProp<TextStyle>; numberOfLines?: number }) {
  return (
    <Text numberOfLines={numberOfLines} style={[{ fontFamily: fonts.display, fontSize: size, lineHeight: Math.round(size * 1.06), letterSpacing: -0.5, color: colors.ink }, style]}>
      {children}
    </Text>
  );
}

/**
 * The app's name, with the pin.
 *
 * Display sets a tight 1.06 line height, which suits the typeface and clips the emoji: the pin
 * renders taller than the Latin glyphs, so its point was being cut off at the bottom on both the
 * feed and the sign-in screen. The emoji gets its own box with room to breathe.
 */
export function Wordmark({ size = 28, color = colors.ink, style }: { size?: number; color?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: size * 0.22 }, style]}>
      <Text style={{ fontSize: size * 0.86, lineHeight: Math.round(size * 1.34) }}>📍</Text>
      <Display size={size} style={{ color }}>near miss</Display>
    </View>
  );
}

export function Body({ children, size = 16, color = colors.ink, weight = 'regular', style, numberOfLines }: {
  children: ReactNode; size?: number; color?: string; weight?: 'regular' | 'medium' | 'semibold' | 'bold'; style?: StyleProp<TextStyle>; numberOfLines?: number;
}) {
  return (
    <Text numberOfLines={numberOfLines} style={[{ fontFamily: fonts[weight], fontSize: size, color, lineHeight: Math.round(size * 1.4) }, style]}>
      {children}
    </Text>
  );
}

// ---------- Buttons ----------

type BtnVariant = 'violet' | 'ink' | 'white' | 'text' | 'tint' | 'sand' | 'danger';

const btnColors: Record<BtnVariant, { bg: string; fg: string; border?: string }> = {
  violet: { bg: colors.violet, fg: colors.white },
  ink: { bg: colors.ink, fg: colors.white },
  white: { bg: colors.white, fg: colors.ink, border: colors.handle },
  text: { bg: 'transparent', fg: colors.text2 },
  tint: { bg: colors.violetTint, fg: colors.violet },
  sand: { bg: colors.sand, fg: colors.muted },
  danger: { bg: colors.danger, fg: colors.white },
};

export function Button({ label, onPress, variant = 'violet', style, disabled }: {
  label: string; onPress?: () => void; variant?: BtnVariant; style?: StyleProp<ViewStyle>; disabled?: boolean;
}) {
  const c = btnColors[variant];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: c.bg, borderColor: c.border ?? 'transparent', borderWidth: c.border ? 1 : 0, opacity: pressed ? 0.85 : 1 },
        variant === 'text' && { minHeight: 44 },
        style,
      ]}
    >
      <Text style={{ fontFamily: fonts.semibold, fontSize: variant === 'text' ? 16 : 17, color: c.fg }}>{label}</Text>
    </Pressable>
  );
}

export function Pill({ label, onPress, variant = 'violet', height = 36, style, textSize = 15 }: {
  label: string; onPress?: () => void; variant?: BtnVariant; height?: number; style?: StyleProp<ViewStyle>; textSize?: number;
}) {
  const c = btnColors[variant];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      hitSlop={height < 44 ? { top: (44 - height) / 2, bottom: (44 - height) / 2 } : undefined}
      style={({ pressed }) => [
        { minHeight: height, paddingHorizontal: 16, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg, opacity: pressed ? 0.85 : 1 },
        c.border ? { borderWidth: 1, borderColor: c.border } : null,
        style,
      ]}
    >
      <Text style={{ fontFamily: fonts.semibold, fontSize: textSize, color: c.fg }}>{label}</Text>
    </Pressable>
  );
}

export function IconButton({ children, onPress, style, label }: { children: ReactNode; onPress?: () => void; style?: StyleProp<ViewStyle>; label?: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.8 : 1 }, style]}>
      {children}
    </Pressable>
  );
}

export function TextLink({ label, onPress, color = colors.violet, size = 16, style }: { label: string; onPress?: () => void; color?: string; size?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} hitSlop={8} style={[{ minHeight: 44, justifyContent: 'center' }, style]}>
      <Text style={{ fontFamily: fonts.semibold, fontSize: size, color }}>{label}</Text>
    </Pressable>
  );
}

// ---------- Chips ----------

export type ChipTone = 'sand' | 'outline' | 'violet' | 'coral' | 'green' | 'solidViolet';

const chipTones: Record<ChipTone, { bg: string; fg: string; border?: string }> = {
  sand: { bg: colors.sand, fg: colors.ink },
  outline: { bg: colors.white, fg: colors.ink, border: colors.inputBorder },
  violet: { bg: colors.violetTint, fg: colors.violet },
  coral: { bg: colors.coralTint, fg: colors.coralText },
  green: { bg: colors.greenTint, fg: colors.greenText },
  solidViolet: { bg: colors.violet, fg: colors.white },
};

export function Chip({ label, tone = 'sand', onPress }: { label: string; tone?: ChipTone; onPress?: () => void }) {
  const t = chipTones[tone];
  const content = (
    <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: t.bg, borderWidth: t.border ? 1 : 0, borderColor: t.border }}>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: t.fg }}>{label}</Text>
    </View>
  );
  return onPress ? <Pressable onPress={onPress} hitSlop={8}>{content}</Pressable> : content;
}

export function UnreadDot({ label }: { label?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.violet }} />
      {label ? <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.violet }}>{label}</Text> : null}
    </View>
  );
}

// ---------- Controls ----------

export function Toggle({ value, onChange }: { value: boolean; onChange: () => void }) {
  return (
    <Pressable accessibilityRole="switch" accessibilityState={{ checked: value }} onPress={onChange}
      style={{ width: 52, height: 32, borderRadius: 16, backgroundColor: value ? colors.violet : colors.toggleOff, justifyContent: 'center' }}>
      <View style={[styles.knob, { marginLeft: value ? 23 : 3 }]} />
    </Pressable>
  );
}

export function Segmented<T extends string>({ options, value, onChange, disabled = [] }: {
  options: { id: T; label: string }[]; value: T; onChange: (v: T) => void; disabled?: T[];
}) {
  return (
    <View style={{ flexDirection: 'row', gap: 4, padding: 4, borderRadius: radius.pill, backgroundColor: colors.sandDeep }}>
      {options.map((o) => {
        const on = o.id === value;
        const off = disabled.includes(o.id);
        return (
          <Pressable key={o.id} onPress={() => !off && onChange(o.id)} accessibilityState={{ selected: on, disabled: off }}
            style={[{ flex: 1, minHeight: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' }, on && styles.segOn]}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: off ? '#C9C0B3' : on ? colors.ink : colors.muted }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ProgressDots({ total, active, width = 22 }: { total: number; active: number; width?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={{ width, height: 6, borderRadius: 3, backgroundColor: i < active ? colors.violet : colors.handle }} />
      ))}
    </View>
  );
}

export function IconTile({ children, bg = colors.violetTint, size = 36, radiusSize = 12 }: { children: ReactNode; bg?: string; size?: number; radiusSize?: number }) {
  return <View style={{ width: size, height: size, borderRadius: radiusSize, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>{children}</View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.card, borderWidth: 1, borderColor: colors.cardBorder },
  section: { fontFamily: fonts.semibold, fontSize: 13, color: colors.muted, paddingTop: 20, paddingBottom: 8, paddingHorizontal: 4 },
  btn: { minHeight: 54, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.inputBorder, alignItems: 'center', justifyContent: 'center' },
  knob: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.white, shadowColor: colors.ink, shadowOpacity: 0.25, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  segOn: { backgroundColor: colors.white, shadowColor: colors.ink, shadowOpacity: 0.15, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
});
