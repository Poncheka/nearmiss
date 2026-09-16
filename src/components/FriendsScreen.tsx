import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Search } from 'lucide-react-native';
import { Body, Card, Display, Pill, ProgressDots, Screen, SectionLabel } from '@/components/ui';
import { Avatar, PersonAvatar } from '@/components/avatar';
import { contactsOnApp, inviteContacts, people } from '@/data/mock';
import { useStore } from '@/state/store';
import { colors, fonts, radius } from '@/theme';

const TOTAL_CONTACTS = 412;
const INVITE_LINK = '[domain]/i/jeff';

export function FriendsScreen({ onboarding = false }: { onboarding?: boolean }) {
  const [q, setQ] = useState('');
  const [copied, setCopied] = useState(false);
  const added = useStore((s) => s.addedFriends);
  const sent = useStore((s) => s.invitesSent);
  const addFriend = useStore((s) => s.addFriend);
  const sendInvite = useStore((s) => s.sendInvite);
  const finishOnboarding = useStore((s) => s.finishOnboarding);

  const query = q.trim().toLowerCase();
  const onApp = useMemo(
    () => contactsOnApp.map((id) => people[id]).filter((p) => !query || `${p.fullName} ${p.handle}`.toLowerCase().includes(query)),
    [query],
  );
  const invite = useMemo(
    () => inviteContacts.filter((c) => !query || c.name.toLowerCase().includes(query)),
    [query],
  );
  const noResults = query && !onApp.length && !invite.length;

  return (
    <Screen>
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, gap: 14 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 44 }}>
          <Display size={32}>Friends</Display>
          {onboarding && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <ProgressDots total={3} active={3} />
              <Pill label="Next" variant="ink" height={40} onPress={() => { finishOnboarding(); router.replace('/'); }} />
            </View>
          )}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, paddingHorizontal: 16, borderRadius: radius.pill, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.inputBorder }}>
          <Search size={18} color={colors.muted} strokeWidth={2} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder={`Search ${TOTAL_CONTACTS} contacts`}
            placeholderTextColor={colors.faint}
            style={{ flex: 1, fontFamily: fonts.regular, fontSize: 16, color: colors.ink, height: 44 }}
          />
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        {!query && (
          <View style={{ padding: 16, borderRadius: radius.cardLg, backgroundColor: colors.violet, gap: 12 }}>
            <View style={{ gap: 2 }}>
              <Body size={14} color="rgba(255,255,255,0.85)">Waiting in your photos</Body>
              <Display size={22} style={{ color: colors.white }}>7 possible near misses</Display>
              <Body size={14} color="rgba(255,255,255,0.85)">Each one unlocks when that person joins.</Body>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 6, paddingLeft: 14, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.14)' }}>
              <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonts.regular, fontSize: 15, color: colors.white }}>{INVITE_LINK}</Text>
              {/* expo-clipboard is wired up in step 4 */}
              <Pressable onPress={() => setCopied(true)} style={{ minHeight: 40, paddingHorizontal: 16, borderRadius: radius.pill, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.violet }}>{copied ? 'Copied' : 'Copy link'}</Text>
              </Pressable>
            </View>
          </View>
        )}

        {onApp.length > 0 && (
          <>
            <SectionLabel>On Near Miss</SectionLabel>
            <Card style={{ paddingHorizontal: 14, paddingVertical: 4 }}>
              {onApp.map((p, i) => (
                <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, borderBottomWidth: i === onApp.length - 1 ? 0 : 1, borderBottomColor: colors.divider }}>
                  <Pressable onPress={() => router.push({ pathname: '/friend/[id]', params: { id: p.id } })} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <PersonAvatar id={p.id} size={44} />
                    <View style={{ flex: 1 }}>
                      <Body size={16} weight="semibold">{p.fullName}</Body>
                      <Body size={13} color={colors.muted}>{p.handle} · {p.mutuals} mutual friend{p.mutuals === 1 ? '' : 's'}</Body>
                    </View>
                  </Pressable>
                  {added[p.id]
                    ? <Pill label="Added" variant="sand" />
                    : <Pill label="Add" onPress={() => addFriend(p.id)} />}
                </View>
              ))}
            </Card>
          </>
        )}

        {invite.length > 0 && (
          <>
            <SectionLabel>Invite to unlock · most near misses first</SectionLabel>
            <Card style={{ paddingHorizontal: 14, paddingVertical: 4 }}>
              {invite.map((c, i) => (
                <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, borderBottomWidth: i === invite.length - 1 ? 0 : 1, borderBottomColor: colors.divider }}>
                  <Avatar initial={c.initial} color={c.color} size={44} />
                  <View style={{ flex: 1 }}>
                    <Body size={16} weight="semibold">{c.name}</Body>
                    <Body size={13} weight="semibold" color={c.count ? colors.coralText : colors.muted}>
                      {c.count ? `${c.count} possible near miss${c.count > 1 ? 'es' : ''}` : 'In your contacts'}
                    </Body>
                  </View>
                  {sent[c.id]
                    ? <Pill label="Sent" variant="sand" />
                    : <Pill label="Invite" variant="tint" onPress={() => sendInvite(c.id)} />}
                </View>
              ))}
            </Card>
            {!query && (
              <Pressable style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
                <Body size={15} weight="semibold" color={colors.violet}>Show all {TOTAL_CONTACTS} contacts</Body>
              </Pressable>
            )}
          </>
        )}

        {noResults && (
          <Body size={16} color={colors.muted} style={{ textAlign: 'center', paddingVertical: 40 }}>
            No one matches "{q}". Try their name or number.
          </Body>
        )}
      </ScrollView>
    </Screen>
  );
}
