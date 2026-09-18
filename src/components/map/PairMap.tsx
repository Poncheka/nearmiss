import { useWindowDimensions } from 'react-native';
import { MiniMap } from '@/components/art';

export type PairMapProps = {
  me: { latitude: number; longitude: number };
  them: { latitude: number; longitude: number };
  height: number;
  width?: number;
  interactive?: boolean;
  fill?: boolean;
};

const metersBetween = (a: PairMapProps['me'], b: PairMapProps['me']) => {
  const R = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((a.latitude * Math.PI) / 180) * Math.cos((b.latitude * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};

/** Web preview stand-in (real maps render in the phone app). */
export function PairMap({ me, them, height, width }: PairMapProps) {
  const { width: w } = useWindowDimensions();
  const d = Math.round(metersBetween(me, them));
  return <MiniMap width={width ?? w - 40} height={height} distance={d} spread={Math.min(0.5, d / 180)} detail />;
}
