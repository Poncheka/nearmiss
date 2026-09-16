import { View } from 'react-native';
import { Body } from '@/components/ui';
import { colors } from '@/theme';

export type PlaceMapProps = { latitude: number; longitude: number; radius: number; height?: number };

/** Web preview stand-in (maps render in the phone app). */
export function PlaceMap({ latitude, longitude, radius, height = 220 }: PlaceMapProps) {
  return (
    <View style={{ height, width: '100%', backgroundColor: colors.violetTint, alignItems: 'center', justifyContent: 'center', gap: 4 }}>
      <View style={{ width: 96, height: 96, borderRadius: 48, borderWidth: 2, borderColor: colors.violet, backgroundColor: 'rgba(91,63,208,0.15)', alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colors.violet }} />
      </View>
      <Body size={12} color={colors.muted}>{latitude.toFixed(4)}, {longitude.toFixed(4)} · {radius}m</Body>
    </View>
  );
}
