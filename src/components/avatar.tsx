import { Image, Text, View } from 'react-native';
import { colors, fonts } from '@/theme';
import { me, people } from '@/data/mock';
import { useAuth } from '@/lib/auth';

export function Avatar({ initial, color, size = 40, ring = false, dashed = false }: {
  initial: string; color: string; size?: number; ring?: boolean; dashed?: boolean;
}) {
  return (
    <View
      style={{
        width: size, height: size, borderRadius: size / 2, backgroundColor: color,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: ring || dashed ? 2 : 0, borderColor: dashed ? colors.faint : colors.white,
        borderStyle: dashed ? 'dashed' : 'solid',
      }}
    >
      <Text style={{ fontFamily: fonts.bold, fontSize: Math.round(size * 0.37), color: colors.ink }}>{initial}</Text>
    </View>
  );
}

export function PersonAvatar({ id, size = 40, ring = false }: { id: string; size?: number; ring?: boolean }) {
  const { profile } = useAuth();
  if (id === 'jeff') {
    if (profile?.avatar_url) {
      return (
        <Image
          source={{ uri: profile.avatar_url }}
          style={{ width: size, height: size, borderRadius: size / 2, borderWidth: ring ? 2 : 0, borderColor: colors.white }}
        />
      );
    }
    const initial = (profile?.name || profile?.username || me.initial).charAt(0).toUpperCase();
    return <Avatar initial={initial} color={me.color} size={size} ring={ring} />;
  }
  const p = people[id];
  if (!p) return <Avatar initial="?" color={colors.sand} size={size} ring={ring} />;
  return <Avatar initial={p.initial} color={p.color} size={size} ring={ring} />;
}

/** "You + friend": two overlapping avatars. The friend sits on top, offset so both initials stay readable. */
export function AvatarPair({ otherId, size = 40, unknown = false }: { otherId?: string; size?: number; unknown?: boolean }) {
  const offset = Math.round(size * 0.62);
  return (
    <View style={{ width: size + offset, height: size }}>
      <View style={{ position: 'absolute', left: 0 }}>
        <PersonAvatar id="jeff" size={size} ring />
      </View>
      <View style={{ position: 'absolute', left: offset }}>
        {unknown ? <Avatar initial="?" color={colors.sand} size={size} dashed /> : <PersonAvatar id={otherId ?? ''} size={size} ring />}
      </View>
    </View>
  );
}
