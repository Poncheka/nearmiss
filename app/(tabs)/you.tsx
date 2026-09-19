// Your profile: who you are, and who you're connected to. Everything you configure rather
// than look at now lives behind the gear, in app/settings.tsx.
import { useCallback, useMemo } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { ChevronRight, Settings as SettingsIcon, UserPlus } from 'lucide-react-native';
import { Body, Card, Display, Screen, SectionLabel } from '@/components/ui';
import { Avatar } from '@/components/avatar';
import { AvatarPicker } from '@/components/AvatarPicker';
import { useAuth } from '@/lib/auth';
import { AppUser, useContacts } from '@/lib/contacts';
import { useNearMisses } from '@/lib/nearMisses';
import { colors, pastel, radius } from '@/theme';

const PASTELS = [pastel.lilac, pastel.peach, pastel.sage, pastel.butter, pastel.sky];
const colorFor = (key: string) => PASTELS[[...key].reduce((n, ch) => n + ch.charCodeAt(0), 0) % PASTELS.length];

const firstName = (u: AppUser) => u.name?.split(' ')[0] || (u.username ? `@${u.username}` : 'Friend');

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <View style={{ alignItems: 'center', minWidth: 76 }}>
      <Display size={22}>{n.toLocaleString('en-US')}</Display>
      <Body size={13} color={colors.muted}>{label}</Body>
    </View>
  );
}

function FriendTile({ user, misses }: { user: AppUser; misses: number }) {
  const name = firstName(user);
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/friend/[id]', params: { id: user.id } })}
      style={{ width: 92, alignItems: 'center', gap: 6 }}
    >
      {user.avatar_url
        ? <Image source={{ uri: user.avatar_url }} style={{ width: 64, height: 64, borderRadius: 32 }} />
        : <Avatar initial={name.replace('@', '').charAt(0).toUpperCase()} color={colorFor(user.id)} size={64} />}
      <Body size={14} weight="semibold" numberOfLines={1} style={{ textAlign: 'center' }}>{name}</Body>
      <Body size={12} color={colors.muted} numberOfLines={1}>
        {misses > 0 ? `${misses} near ${misses === 1 ? 'miss' : 'misses'}` : 'No near misses'}
      </Body>
    </Pressable>
  );
}

export default function You() {
  const { profile, demo } = useAuth();
  const friendsAll = useContacts((s) => s.friends);
  const statuses = useContacts((s) => s.statuses);
  const items = useNearMisses((s) => s.items);

  useFocusEffect(useCallback(() => {
    if (demo) return;
    useContacts.getState().refreshFriends();
    useNearMisses.getState().load();
  }, [demo]));

  // Only people who actually accepted; requests still waiting belong on the Invite tab.
  const friends = useMemo(
    () => friendsAll.filter((f) => statuses[f.id] === 'friends'),
    [friendsAll, statuses],
  );

  const missesPerFriend = useMemo(() => {
    const m: Record<string, number> = {};
    for (const n of items) m[n.other_id] = (m[n.other_id] ?? 0) + 1;
    return m;
  }, [items]);

  return (
    <Screen>
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Display size={32}>You</Display>
        <Pressable
          accessibilityLabel="Settings"
          onPress={() => router.push('/settings')}
          style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.cardBorder }}
        >
          <SettingsIcon size={20} color={colors.ink} strokeWidth={2} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 32, gap: 16 }}>
        <Card style={{ padding: 20, alignItems: 'center', gap: 10 }}>
          <AvatarPicker size={88} showLink={false} />
          <View style={{ alignItems: 'center', gap: 2 }}>
            <Display size={26}>{profile?.name || `@${profile?.username ?? ''}`}</Display>
            <Body size={15} color={colors.muted}>@{profile?.username}</Body>
            {profile?.bio ? <Body size={15} color={colors.text2} style={{ textAlign: 'center', paddingTop: 4 }}>{profile.bio}</Body> : null}
          </View>
          <View style={{ flexDirection: 'row', gap: 24, paddingTop: 8 }}>
            <Stat n={friends.length} label={friends.length === 1 ? 'friend' : 'friends'} />
            <Stat n={items.length} label={items.length === 1 ? 'near miss' : 'near misses'} />
          </View>
        </Card>

        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <SectionLabel>Friends</SectionLabel>
            {friends.length > 0 && (
              <Pressable onPress={() => router.navigate('/invite')} hitSlop={8} style={{ minHeight: 44, justifyContent: 'center' }}>
                <Body size={15} weight="semibold" color={colors.violet}>Add</Body>
              </Pressable>
            )}
          </View>

          {friends.length === 0 ? (
            <Pressable onPress={() => router.navigate('/invite')}>
              <Card style={{ padding: 18, alignItems: 'center', gap: 8 }}>
                <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.violetTint, alignItems: 'center', justifyContent: 'center' }}>
                  <UserPlus size={22} color={colors.violet} strokeWidth={2} />
                </View>
                <Body size={16} weight="bold">No friends yet</Body>
                <Body size={14} color={colors.muted} style={{ textAlign: 'center' }}>
                  Near misses only exist between two people who have added each other.
                </Body>
                <View style={{ marginTop: 4, minHeight: 40, paddingHorizontal: 20, borderRadius: radius.pill, backgroundColor: colors.violet, justifyContent: 'center' }}>
                  <Body size={15} weight="bold" color={colors.white}>Find friends</Body>
                </View>
              </Card>
            </Pressable>
          ) : (
            <Card style={{ paddingVertical: 16 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}>
                {friends.map((f) => <FriendTile key={f.id} user={f} misses={missesPerFriend[f.id] ?? 0} />)}
              </ScrollView>
            </Card>
          )}
        </View>

      </ScrollView>
    </Screen>
  );
}
