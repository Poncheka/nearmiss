// Someone's friends, as a page of its own.
//
// What you see depends on whether you know them. Their friends see the whole list. Everyone
// else sees only the people you both know, which is the part that helps you work out who this
// person is without handing their address book to anyone who guesses a username. The heading
// says which of the two you are looking at, because a filtered list under the word "Friends"
// would be a quiet lie.
//
// Every row can be added from here. That is the point of the page: the people a friend knows
// are the best guess at the people you know.
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, UserPlus, Users } from 'lucide-react-native';
import { Avatar } from '@/components/avatar';
import { Body, Card, Display, Divider, IconButton, Screen } from '@/components/ui';
import { useContacts } from '@/lib/contacts';
import { FriendOf, friendsOf, PublicProfile, publicProfile } from '@/lib/relationships';
import { colors, pastel, radius } from '@/theme';

export default function FriendsOfPerson() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const statuses = useContacts((s) => s.statuses);
  const [person, setPerson] = useState<PublicProfile | null>(null);
  const [list, setList] = useState<FriendOf[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    if (!id) return;
    let live = true;
    useContacts.getState().refreshFriends();
    publicProfile(id).then((p) => { if (live) setPerson(p); }).catch(() => {});
    friendsOf(id).then((f) => { if (live) setList(f); }).catch(() => { if (live) setList([]); });
    return () => { live = false; };
  }, [id]));

  const back = () => (router.canGoBack() ? router.back() : router.replace('/you'));
  const name = person?.name?.split(' ')[0] || (person?.username ? `@${person.username}` : 'They');
  const mutualOnly = !!list?.length && list[0].scope === 'mutual';

  const add = async (who: string, label: string) => {
    setBusy(who);
    try {
      await useContacts.getState().addFriend(who);
    } catch (e) {
      Alert.alert(`Couldn't add ${label}`, e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen edges={['top']}>
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <IconButton label="Back" onPress={back}><ChevronLeft size={20} color={colors.ink} /></IconButton>
        <Body size={16} weight="bold">{mutualOnly ? 'People you both know' : `${name}'s friends`}</Body>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32, gap: 14 }}>
        {list === null ? (
          <ActivityIndicator color={colors.violet} style={{ paddingTop: 48 }} />
        ) : list.length === 0 ? (
          <View style={{ paddingVertical: 48, alignItems: 'center', gap: 12 }}>
            <Users size={28} color={colors.faint} strokeWidth={1.6} />
            <Body size={16} color={colors.muted} style={{ textAlign: 'center' }}>
              You don't know anyone {name} knows yet.
            </Body>
          </View>
        ) : (
          <>
            <Body size={15} color={colors.text2}>
              {mutualOnly
                ? `You and ${name} both know these people. Add them and you'll start seeing where you crossed paths.`
                : `Add anyone here and you'll both see the times you were nearby.`}
            </Body>

            <Card style={{ paddingHorizontal: 16, paddingVertical: 2 }}>
              {list.map((f, i) => {
                const who = f.name || (f.username ? `@${f.username}` : 'Someone');
                const status = statuses[f.user_id];
                return (
                  <View key={f.user_id}>
                    <Pressable
                      accessibilityLabel={`Open ${who}'s profile`}
                      onPress={() => router.push({ pathname: '/friend/[id]', params: { id: f.user_id } })}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }}
                    >
                      {f.avatar_url
                        ? <Image source={{ uri: f.avatar_url }} style={{ width: 44, height: 44, borderRadius: 22 }} />
                        : <Avatar initial={who.replace('@', '').charAt(0).toUpperCase()} color={pastel.lilac} size={44} />}
                      <View style={{ flex: 1 }}>
                        <Body size={16} weight="semibold" numberOfLines={1}>{who}</Body>
                        {f.username ? <Body size={13} color={colors.muted}>@{f.username}</Body> : null}
                      </View>

                      {busy === f.user_id ? <ActivityIndicator color={colors.violet} />
                        : status === 'friends' ? <Body size={14} color={colors.muted}>Friends</Body>
                        : status === 'requested' ? <Body size={14} color={colors.muted}>Requested</Body>
                        : <Pressable
                            accessibilityLabel={status === 'incoming' ? `Accept ${who}` : `Add ${who}`}
                            onPress={() => add(f.user_id, who)}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.violet }}
                          >
                            <UserPlus size={14} color={colors.white} strokeWidth={2.4} />
                            <Body size={14} weight="bold" color={colors.white}>
                              {status === 'incoming' ? 'Accept' : 'Add'}
                            </Body>
                          </Pressable>}
                    </Pressable>
                    {i < list.length - 1 && <Divider />}
                  </View>
                );
              })}
            </Card>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
