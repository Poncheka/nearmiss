// Who you have blocked.
//
// A block you cannot find is a trap: people block someone in a bad moment and want it back
// later, and if the only record of it is invisible they are stuck. Unblocking lets them find you
// again, and nothing that was deleted comes back, which the screen says rather than implies.
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { ChevronLeft, ShieldOff } from 'lucide-react-native';
import { Avatar } from '@/components/avatar';
import { Body, Card, Display, Divider, IconButton, Screen } from '@/components/ui';
import { BlockedPerson, myBlocks, unblockUser } from '@/lib/relationships';
import { colors, pastel, radius } from '@/theme';

export default function Blocked() {
  const [people, setPeople] = useState<BlockedPerson[] | null>(null);

  const load = useCallback(() => {
    myBlocks().then(setPeople).catch(() => setPeople([]));
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const back = () => (router.canGoBack() ? router.back() : router.replace('/settings'));

  const undo = (person: BlockedPerson) => {
    const name = person.name?.split(' ')[0] || (person.username ? `@${person.username}` : 'them');
    Alert.alert(
      `Unblock ${name}?`,
      `They will be able to find you and add you again. The near misses you deleted do not come back.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: async () => {
            try {
              await unblockUser(person.user_id);
              setPeople((p) => (p ?? []).filter((x) => x.user_id !== person.user_id));
            } catch (e) {
              Alert.alert("Couldn't unblock them", e instanceof Error ? e.message : String(e));
            }
          },
        },
      ],
    );
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 }}>
        <IconButton label="Back" onPress={back}><ChevronLeft size={20} color={colors.ink} /></IconButton>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32, gap: 16 }}>
        <Display size={32}>Blocked</Display>

        {people === null ? (
          <ActivityIndicator color={colors.violet} style={{ paddingTop: 32 }} />
        ) : people.length === 0 ? (
          <View style={{ paddingVertical: 40, alignItems: 'center', gap: 12 }}>
            <ShieldOff size={28} color={colors.faint} strokeWidth={1.6} />
            <Body size={16} color={colors.muted} style={{ textAlign: 'center' }}>
              You haven't blocked anyone. You can block someone from their profile.
            </Body>
          </View>
        ) : (
          <>
            <Body size={15} color={colors.text2}>
              These people can't find you, add you, or turn up in your near misses. They aren't told.
            </Body>
            <Card style={{ paddingHorizontal: 16, paddingVertical: 2 }}>
              {people.map((person, i) => {
                const name = person.name || (person.username ? `@${person.username}` : 'Someone');
                return (
                  <View key={person.user_id}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 }}>
                      {person.avatar_url
                        ? <Image source={{ uri: person.avatar_url }} style={{ width: 40, height: 40, borderRadius: 20 }} />
                        : <Avatar initial={name.replace('@', '').charAt(0).toUpperCase()} color={pastel.lilac} size={40} />}
                      <View style={{ flex: 1 }}>
                        <Body size={16} weight="semibold">{name}</Body>
                        {person.username ? <Body size={13} color={colors.muted}>@{person.username}</Body> : null}
                      </View>
                      <Pressable
                        onPress={() => undo(person)}
                        style={{ minHeight: 36, paddingHorizontal: 16, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.inputBorder, alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Body size={14} weight="semibold">Unblock</Body>
                      </Pressable>
                    </View>
                    {i < people.length - 1 && <Divider />}
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
