import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Pressable, SectionList, Share, Text, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { router, useFocusEffect } from 'expo-router';
import { BookUser, Search, Share as ShareIcon } from 'lucide-react-native';
import { Body, Button, Card, Display, Pill, ProgressDots, Screen, SectionLabel } from '@/components/ui';
import { Avatar } from '@/components/avatar';
import { contactsOnApp, inviteContacts, people } from '@/data/mock';
import { AppUser, chooseMoreContacts, FriendStatus, inviteLink, inviteMessage, PhoneContact, sendInvite, useContacts } from '@/lib/contacts';
import { useAuth } from '@/lib/auth';
import { colors, fonts, pastel, radius } from '@/theme';

const PASTELS = [pastel.lilac, pastel.peach, pastel.sage, pastel.butter, pastel.sky];
const colorFor = (key: string) => PASTELS[[...key].reduce((n, ch) => n + ch.charCodeAt(0), 0) % PASTELS.length];

function UserAvatar({ id, name, url, size = 44 }: { id: string; name: string; url?: string | null; size?: number }) {
  if (url) return <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  return <Avatar initial={(name || '?').charAt(0).toUpperCase()} color={colorFor(id)} size={size} />;
}

// Sample-data mode (no account): the old demo people.
const demoOnApp: AppUser[] = contactsOnApp.map((id) => ({ id, username: people[id].handle.slice(1), name: people[id].fullName, avatar_url: null }));
const demoContacts: PhoneContact[] = inviteContacts.map((c) => ({ id: c.id, name: c.name, initial: c.initial, phone: null, email: null, thumbnail: null, emailHashes: [] }));

type Row = { kind: 'user'; user: AppUser } | { kind: 'contact'; contact: PhoneContact };

export function FriendsScreen({ onboarding = false }: { onboarding?: boolean }) {
  const { finishOnboarding, profile, demo } = useAuth();
  const c = useContacts();
  const [q, setQ] = useState('');
  const [copied, setCopied] = useState(false);
  const [invited, setInvited] = useState<Record<string, boolean>>({});
  const [demoStatus, setDemoStatus] = useState<Record<string, FriendStatus>>({ sam: 'friends' });
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (demo) return;
    useContacts.getState().checkAccess().then(() => {
      const { access, loading } = useContacts.getState();
      if ((access === 'granted' || access === 'limited') && !loading) useContacts.getState().load();
      else useContacts.getState().refreshFriends();
    });
  }, [demo]);
  // Refresh when the tab is opened (only if access was already given; never pops a prompt by itself).
  useFocusEffect(useCallback(() => {
    if (demo) return;
    const { access, loading } = useContacts.getState();
    if (access === null || loading) return; // first load is handled above
    if (access === 'granted' || access === 'limited') useContacts.getState().load();
    else useContacts.getState().refreshFriends();
  }, [demo]));

  const link = inviteLink(profile?.username);
  const copy = async () => {
    await Clipboard.setStringAsync(link).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const shareLink = () => Share.share({ message: inviteMessage(profile?.username) }).catch(() => {});

  const access = demo ? 'granted' : c.access;
  const hasAccess = access === 'granted' || access === 'limited';
  const statuses = demo ? demoStatus : c.statuses;

  const query = q.trim().toLowerCase();
  const sections = useMemo(() => {
    const users = new Map<string, AppUser>();
    for (const u of demo ? demoOnApp : c.onApp) users.set(u.id, u);
    if (!demo) for (const f of c.friends) if (!users.has(f.id)) users.set(f.id, f);
    const match = (s: string) => !query || s.toLowerCase().includes(query);
    const userRows = [...users.values()]
      .filter((u) => match(`${u.name ?? ''} ${u.username ?? ''}`))
      .sort((a, b) => rank(statuses[a.id]) - rank(statuses[b.id]));
    const contactRows = (demo ? demoContacts : c.contacts).filter((p) => match(`${p.name} ${p.phone ?? ''} ${p.email ?? ''}`));
    const out: { key: string; title: string; data: Row[] }[] = [];
    if (userRows.length) out.push({ key: 'users', title: 'On Near Miss', data: userRows.map((user) => ({ kind: 'user', user })) });
    if (contactRows.length) out.push({ key: 'contacts', title: 'Invite from your contacts', data: contactRows.map((contact) => ({ kind: 'contact', contact })) });
    return out;
  }, [demo, c.onApp, c.friends, c.contacts, statuses, query]);

  const add = async (id: string) => {
    if (demo) return setDemoStatus((s) => ({ ...s, [id]: 'requested' }));
    setBusyId(id);
    try {
      await c.addFriend(id);
    } catch (e) {
      Alert.alert("Couldn't add them", e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  };

  const invite = async (p: PhoneContact) => {
    setInvited((s) => ({ ...s, [p.id]: true }));
    if (demo) return;
    await sendInvite(p, profile?.username);
  };

  const header = (
    <View style={{ gap: 12, paddingBottom: 4 }}>
      {!query && (
        <View style={{ padding: 16, borderRadius: radius.cardLg, backgroundColor: colors.violet, gap: 12 }}>
          <View style={{ gap: 4 }}>
            <Display size={22} style={{ color: colors.white }}>Invite friends to see your missed connections</Display>
            <Body size={14} color="rgba(255,255,255,0.85)">When they join and scan their photos, you'll both see every time you were steps apart.</Body>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 6, paddingLeft: 14, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.14)' }}>
            <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonts.regular, fontSize: 15, color: colors.white }}>{link.replace(/^https?:\/\//, '')}</Text>
            <Pressable accessibilityLabel="Share invite" onPress={shareLink} hitSlop={6} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
              <ShareIcon size={18} color={colors.white} strokeWidth={2} />
            </Pressable>
            <Pressable onPress={copy} style={{ minHeight: 40, paddingHorizontal: 16, borderRadius: radius.pill, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.violet }}>{copied ? 'Copied' : 'Copy link'}</Text>
            </Pressable>
          </View>
        </View>
      )}

      {!hasAccess && access !== null && access !== 'unavailable' && (
        <Card style={{ padding: 16, gap: 12 }}>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.violetTint, alignItems: 'center', justifyContent: 'center' }}>
              <BookUser size={22} color={colors.violet} strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Body size={17} weight="bold">Find friends in your contacts</Body>
              <Body size={14} color={colors.muted}>See who's already here and text the rest an invite. Your contacts stay on your phone.</Body>
            </View>
          </View>
          {access === 'denied'
            ? <Button label="Turn on in Settings" variant="tint" onPress={() => Linking.openSettings()} />
            : <Button label="Allow contacts" onPress={() => c.load(true)} />}
        </Card>
      )}

      {access === 'unavailable' && !demo && (
        <Card style={{ padding: 16 }}>
          <Body size={15} color={colors.text2}>Contacts work in the Near Miss app on your phone.</Body>
        </Card>
      )}

      {c.loading && sections.length === 0 && <ActivityIndicator color={colors.violet} style={{ paddingVertical: 24 }} />}
      {!demo && access === 'limited' && !c.loading && (
        <Card style={{ padding: 14, gap: 8 }}>
          <Body size={15} color={colors.text2}>You shared {c.contacts.length ? `${c.contacts.length} contact${c.contacts.length === 1 ? '' : 's'}` : 'only some contacts'} with Near Miss.</Body>
          <Button label="Choose more contacts" variant="tint" onPress={chooseMoreContacts} />
        </Card>
      )}
      {!demo && access === 'granted' && !c.loading && !c.error && c.contacts.length === 0 && (
        <Card style={{ padding: 14 }}>
          <Body size={15} color={colors.text2}>We didn't find any contacts with a phone number or email on this phone.</Body>
        </Card>
      )}
      {c.error ? <Body size={14} color={colors.danger}>{c.error}</Body> : null}
    </View>
  );

  return (
    <Screen>
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, gap: 14 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 44 }}>
          <Display size={32}>{onboarding ? 'Find your friends' : 'Invite'}</Display>
          {onboarding && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <ProgressDots total={3} active={3} />
              <Pill label="Next" variant="ink" height={40} onPress={() => finishOnboarding().then(() => router.replace('/'))} />
            </View>
          )}
        </View>
        {hasAccess && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, paddingHorizontal: 16, borderRadius: radius.pill, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.inputBorder }}>
            <Search size={18} color={colors.muted} strokeWidth={2} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder={(demo ? demoContacts : c.contacts).length ? `Search ${(demo ? demoContacts : c.contacts).length.toLocaleString('en-US')} contacts` : 'Search contacts'}
              placeholderTextColor={colors.faint}
              autoCorrect={false}
              style={{ flex: 1, fontFamily: fonts.regular, fontSize: 16, color: colors.ink, height: 44 }}
            />
          </View>
        )}
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(r) => (r.kind === 'user' ? `u-${r.user.id}` : `c-${r.contact.id}`)}
        ListHeaderComponent={header}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={20}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
        renderSectionHeader={({ section }) => <SectionLabel>{section.title}</SectionLabel>}
        ListEmptyComponent={query ? (
          <Body size={16} color={colors.muted} style={{ textAlign: 'center', paddingVertical: 40 }}>No one matches "{q}".</Body>
        ) : null}
        renderItem={({ item, index, section }) => {
          const last = index === section.data.length - 1;
          const rowStyle = {
            flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, minHeight: 64, paddingHorizontal: 14,
            backgroundColor: colors.card, borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.cardBorder,
            borderTopWidth: index === 0 ? 1 : 0, borderBottomWidth: last ? 1 : 0,
            borderTopLeftRadius: index === 0 ? radius.card : 0, borderTopRightRadius: index === 0 ? radius.card : 0,
            borderBottomLeftRadius: last ? radius.card : 0, borderBottomRightRadius: last ? radius.card : 0,
          };
          const divider = !last ? <View style={{ position: 'absolute', left: 14, right: 14, bottom: 0, height: 1, backgroundColor: colors.divider }} /> : null;

          if (item.kind === 'user') {
            const u = item.user;
            const status = statuses[u.id];
            const title = u.name || (u.username ? `@${u.username}` : 'Near Miss member');
            return (
              <View style={rowStyle}>
                <UserAvatar id={u.id} name={title} url={u.avatar_url} />
                <View style={{ flex: 1 }}>
                  <Body size={16} weight="semibold" numberOfLines={1}>{title}</Body>
                  {u.username ? <Body size={13} color={colors.muted}>@{u.username}</Body> : null}
                </View>
                {busyId === u.id ? <ActivityIndicator color={colors.violet} />
                  : status === 'friends' ? <Pill label="Friends" variant="sand" />
                  : status === 'requested' ? <Pill label="Requested" variant="sand" />
                  : status === 'incoming' ? <Pill label="Accept" onPress={() => add(u.id)} />
                  : <Pill label="Add" onPress={() => add(u.id)} />}
                {divider}
              </View>
            );
          }
          const p = item.contact;
          return (
            <View style={rowStyle}>
              {p.thumbnail
                ? <Image source={{ uri: p.thumbnail }} style={{ width: 44, height: 44, borderRadius: 22 }} />
                : <Avatar initial={p.initial} color={colorFor(p.id)} size={44} />}
              <View style={{ flex: 1 }}>
                <Body size={16} weight="semibold" numberOfLines={1}>{p.name}</Body>
                <Body size={13} color={colors.muted} numberOfLines={1}>{p.phone ?? p.email ?? 'In your contacts'}</Body>
              </View>
              {invited[p.id]
                ? <Pill label="Invited" variant="sand" onPress={() => invite(p)} />
                : <Pill label="Invite" variant="tint" onPress={() => invite(p)} />}
              {divider}
            </View>
          );
        }}
      />
    </Screen>
  );
}

function rank(s?: FriendStatus) {
  return s === 'incoming' ? 0 : s === undefined ? 1 : s === 'requested' ? 2 : 3;
}
