import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Pressable, SectionList, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { BookUser, Search, X } from 'lucide-react-native';
import { Body, Button, Card, Display, Pill, ProgressDots, Screen, SectionLabel } from '@/components/ui';
import { Avatar } from '@/components/avatar';
import { ActivityButton } from '@/components/ActivityButton';
import { contactsOnApp, inviteContacts, people } from '@/data/mock';
import { AppUser, chooseMoreContacts, FriendStatus, PhoneContact, searchUsers, sendInvite, useContacts } from '@/lib/contacts';
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
const demoContacts: PhoneContact[] = inviteContacts.map((c) => ({ id: c.id, name: c.name, initial: c.initial, phone: null, email: null, thumbnail: null, emails: [], emailHashes: [], browsable: true }));

type Row = { kind: 'user'; user: AppUser } | { kind: 'contact'; contact: PhoneContact };

export function FriendsScreen({ onboarding = false }: { onboarding?: boolean }) {
  const { profile, demo } = useAuth();
  const c = useContacts();
  const [q, setQ] = useState('');
  const [invited, setInvited] = useState<Record<string, boolean>>({});
  const [demoStatus, setDemoStatus] = useState<Record<string, FriendStatus>>({ sam: 'friends' });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [found, setFound] = useState<AppUser[]>([]);
  // The contacts half of this screen used to be the whole screen. It is folded away now, and
  // opens when you ask for it or when you search.
  const [showContacts, setShowContacts] = useState(false);

  useEffect(() => {
    if (demo) return;
    // The cached read goes up first; the live read replaces it when it arrives.
    useContacts.getState().hydrate();
    useContacts.getState().loadEveryone();
    useContacts.getState().checkAccess().then(() => {
      const { access, loading } = useContacts.getState();
      if ((access === 'granted' || access === 'limited') && !loading) useContacts.getState().load();
      else useContacts.getState().refreshFriends();
    });
  }, [demo]);
  // Refresh when the tab is opened (only if access was already given; never pops a prompt by itself).
  useFocusEffect(useCallback(() => {
    if (demo) return;
    useContacts.getState().loadEveryone();
    const { access, loading } = useContacts.getState();
    if (access === null || loading) return; // first load is handled above
    if (access === 'granted' || access === 'limited') useContacts.getState().load();
    else useContacts.getState().refreshFriends();
  }, [demo]));

  // Typing a username searches everyone, not just your contacts. Contact matching only works
  // when your address book holds the exact address someone signed up with, which for most
  // people it does not, so this is the path that actually reaches them.
  useEffect(() => {
    if (demo) return;
    const handle = q.trim().replace(/^@/, '').toLowerCase();
    if (!/^[a-z0-9_.]{3,24}$/.test(handle)) { setFound([]); return; }
    let live = true;
    const t = setTimeout(() => {
      searchUsers(handle).then((u) => { if (live) setFound(u); }).catch(() => {});
    }, 300);
    return () => { live = false; clearTimeout(t); };
  }, [q, demo]);

  const access = demo ? 'granted' : c.access;
  const hasAccess = access === 'granted' || access === 'limited';
  const statuses = demo ? demoStatus : c.statuses;

  // The @ is how people type a username and is in none of the names it gets compared against,
  // so leaving it on filtered the person out of the list they had just been found for.
  const query = q.trim().replace(/^@/, '').toLowerCase();
  const sections = useMemo(() => {
    const users = new Map<string, AppUser>();
    for (const u of demo ? demoOnApp : c.onApp) users.set(u.id, u);
    // Everyone with an account, while the app is small enough for that to be a short list.
    if (!demo) for (const u of c.everyone) if (!users.has(u.id)) users.set(u.id, u);
    for (const u of found) users.set(u.id, u);
    if (!demo) for (const f of c.friends) if (!users.has(f.id)) users.set(f.id, f);
    const match = (s: string) => !query || s.toLowerCase().includes(query);
    const userRows = [...users.values()]
      // People you've already added live on your profile now. This tab is for people you
      // haven't connected with yet — keeping friends here just made it a list you scroll past.
      // A username search still surfaces them, so you can always find someone deliberately.
      .filter((u) => (query ? true : statuses[u.id] !== 'friends'))
      .filter((u) => match(`${u.name ?? ''} ${u.username ?? ''}`))
      .sort((a, b) => rank(statuses[a.id]) - rank(statuses[b.id]));
    // Shortcodes and nameless rows are dropped from browsing but stay findable: a search for
    // something specific should still turn them up.
    const contactRows = (demo ? demoContacts : c.contacts)
      // Someone whose address matched an account is listed above, with an Add. Offering them
      // again down here with an Invite is how you end up texting a signup link to someone who
      // is already using the app.
      .filter((p) => !p.onApp)
      .filter((p) => (query ? true : p.browsable))
      .filter((p) => match(`${p.name} ${p.phone ?? ''} ${p.email ?? ''}`));
    const out: { key: string; title: string; count: number; data: Row[] }[] = [];
    const everyoneListed = !demo && !query && c.everyone.length > 0;
    if (userRows.length) out.push({
      key: 'users',
      title: everyoneListed ? 'Everyone on Near Miss' : 'On Near Miss',
      count: userRows.length,
      data: userRows.map((user) => ({ kind: 'user', user })),
    });
    // Always listed, even with nothing in it: the header is the way back to your contacts.
    // Searching opens it, since what you are looking for may well be down there.
    const open = showContacts || !!query;
    out.push({
      key: 'contacts',
      title: 'Invite from your contacts',
      count: contactRows.length,
      data: open ? contactRows.map((contact) => ({ kind: 'contact', contact })) : [],
    });
    return out;
  }, [demo, c.onApp, c.everyone, c.friends, c.contacts, statuses, query, found, showContacts]);

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

  // Location is the last step again, and it is the only screen that marks onboarding finished.
  // This one hands off to it rather than finishing here, or someone would land in the app
  // having never been asked.
  const done = () => router.push('/turn-on-location');

  const invite = async (p: PhoneContact) => {
    setInvited((s) => ({ ...s, [p.id]: true }));
    if (demo) return;
    await sendInvite(p, profile?.username);
  };

  // Everything about the address book, kept together under the fold.
  const contactsPanel = (
    <View style={{ gap: 12, paddingBottom: 8 }}>
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
    </View>
  );

  const header = (
    <View style={{ gap: 12, paddingBottom: 4 }}>
      {c.loading && sections.length === 0 && <ActivityIndicator color={colors.violet} style={{ paddingVertical: 24 }} />}
      {c.error ? <Body size={14} color={colors.danger}>{c.error}</Body> : null}
    </View>
  );

  return (
    <Screen>
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, gap: 14 }}>
        {/* Controls get their own row, like the other two onboarding steps. Sharing a row with a
            32pt title pushed "Next" off the edge of the screen on a narrow phone. */}
        {onboarding && (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 44 }}>
            <View style={{ width: 44 }} />
            <ProgressDots total={4} active={3} />
            <Pill label="Next" variant="ink" height={40} onPress={done} />
          </View>
        )}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 44 }}>
          <Display size={32}>{onboarding ? 'Find your friends' : 'Search'}</Display>
          {!onboarding && <ActivityButton />}
        </View>
        {(hasAccess || !demo) && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, paddingHorizontal: 16, borderRadius: radius.pill, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.inputBorder }}>
            <Search size={18} color={colors.muted} strokeWidth={2} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder={(demo ? demoContacts : c.contacts).length ? `Search contacts or @username` : 'Search @username'}
              placeholderTextColor={colors.faint}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              style={{ flex: 1, fontFamily: fonts.regular, fontSize: 16, color: colors.ink, height: 44 }}
            />
            {q.length > 0 ? (
              <Pressable
                accessibilityLabel="Clear search"
                onPress={() => setQ('')}
                hitSlop={10}
                style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: colors.inputBorder, alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={13} color={colors.ink} strokeWidth={2.6} />
              </Pressable>
            ) : null}
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
        renderSectionHeader={({ section }) => {
          if (section.key !== 'contacts') return <SectionLabel>{section.title}</SectionLabel>;
          const open = showContacts || !!query;
          return (
            <View>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
                onPress={() => setShowContacts((v) => !v)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, marginTop: 18, paddingHorizontal: 16, paddingVertical: 12, borderRadius: radius.card, backgroundColor: colors.sand }}
              >
                <BookUser size={18} color={colors.ink} strokeWidth={2} />
                <View style={{ flex: 1 }}>
                  <Body size={15} weight="bold">Invite from your contacts</Body>
                  <Body size={13} color={colors.muted}>
                    {hasAccess
                      ? `${section.count} ${section.count === 1 ? 'person' : 'people'} to text an invite`
                      : 'Find the ones already here, invite the rest'}
                  </Body>
                </View>
                <Body size={14} weight="semibold" color={colors.violet}>{open ? 'Hide' : 'Show'}</Body>
              </Pressable>
              {open ? <View style={{ paddingTop: 12 }}>{contactsPanel}</View> : null}
            </View>
          );
        }}
        ListEmptyComponent={
          c.loading && !c.contacts.length ? (
            <View style={{ paddingVertical: 48, alignItems: 'center', gap: 12 }}>
              <ActivityIndicator color={colors.violet} />
              <Body size={14} color={colors.muted}>Looking through your contacts…</Body>
            </View>
          ) : query ? (
            <Body size={16} color={colors.muted} style={{ textAlign: 'center', paddingVertical: 40 }}>No one matches "{q}".</Body>
          ) : null
        }
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
            // Finding someone and only being offered "Add" is a dead end: you cannot check it
            // is the right Sarah first. The row opens their profile; the pill still adds.
            return (
              <Pressable
                accessibilityLabel={`Open ${title}'s profile`}
                onPress={() => router.push({ pathname: '/friend/[id]', params: { id: u.id } })}
                style={rowStyle}
              >
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
              </Pressable>
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
