import { View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { colors } from '@/theme';

export type PairMapProps = {
  me: { latitude: number; longitude: number };
  them: { latitude: number; longitude: number };
  height: number;
  width?: number;
  interactive?: boolean;
  /** Take the whole parent instead of a fixed height (the full-screen map). */
  fill?: boolean;
};

function Dot({ color }: { color: string }) {
  return <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: color, borderWidth: 3, borderColor: colors.white, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } }} />;
}

/** Real map of where the two of you were: violet is you, coral is them. */
export function PairMap({ me, them, height, width, interactive = false, fill = false }: PairMapProps) {
  const latitude = (me.latitude + them.latitude) / 2;
  const longitude = (me.longitude + them.longitude) / 2;
  // Frame both dots with some room around them (at least ~250m across).
  const span = Math.max(Math.abs(me.latitude - them.latitude), Math.abs(me.longitude - them.longitude)) * 3;
  const delta = Math.max(span, 0.0025);
  return (
    <MapView
      style={fill ? { flex: 1 } : { height, width: width ?? '100%' }}
      initialRegion={{ latitude, longitude, latitudeDelta: delta, longitudeDelta: delta }}
      scrollEnabled={interactive}
      zoomEnabled={interactive}
      rotateEnabled={false}
      pitchEnabled={false}
      toolbarEnabled={false}
      showsPointsOfInterests
      pointerEvents={interactive ? 'auto' : 'none'}
    >
      <Polyline coordinates={[me, them]} strokeColor={colors.ink} strokeWidth={2} lineDashPattern={[4, 4]} />
      <Marker coordinate={them} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}><Dot color={colors.coral} /></Marker>
      <Marker coordinate={me} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}><Dot color={colors.violet} /></Marker>
    </MapView>
  );
}
