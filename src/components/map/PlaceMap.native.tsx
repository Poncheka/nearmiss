import MapView, { Circle, Marker } from 'react-native-maps';
import { colors } from '@/theme';

export type PlaceMapProps = { latitude: number; longitude: number; radius: number; height?: number };

/** Map preview of a hidden place: a pin and the circle we skip. */
export function PlaceMap({ latitude, longitude, radius, height = 220 }: PlaceMapProps) {
  const delta = (radius * 3.2) / 111_000;
  return (
    <MapView
      style={{ height, width: '100%' }}
      region={{ latitude, longitude, latitudeDelta: delta, longitudeDelta: delta }}
      scrollEnabled={false}
      zoomEnabled={false}
      rotateEnabled={false}
      pitchEnabled={false}
      toolbarEnabled={false}
    >
      <Circle center={{ latitude, longitude }} radius={radius} strokeColor={colors.violet} strokeWidth={2} fillColor="rgba(91,63,208,0.15)" />
      <Marker coordinate={{ latitude, longitude }} pinColor={colors.violet} />
    </MapView>
  );
}
