// Contact matching, and how to turn it off.
//
// Three different things get muddled under "contacts", and this screen keeps them apart because
// only two of them are ours to change:
//
//   1. Being findable. A hash of your own number and email sits on the server so a friend who
//      already has them can find you. Turning this off deletes it.
//   2. The address book copy on this phone, used to show you who is already here. Turning it
//      off forgets it.
//   3. The iOS permission itself. Only you can revoke that, in Settings, and saying otherwise
//      would be a lie dressed up as a button.
//
// Your contacts are never uploaded either way. That is worth repeating here rather than
// assuming people took it on faith at sign-up.
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, ScrollView, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import * as ContactsAPI from 'expo-contacts';
import { BookUser, ChevronLeft, EyeOff, Search } from 'lucide-react-native';
import { Body, Button, Card, Display, Divider, IconButton, IconTile, Screen, SectionLabel } from '@/components/ui';
import { useContacts } from '@/lib/contacts';
import { supabase } from '@/lib/supabase';
import { colors } from '@/theme';

export default function ContactsSettings() {
  const c = useContacts();
  const [linked, setLinked] = useState<boolean | null>(null);
  const [permission, setPermission] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const { data } = await supabase.rpc('contacts_linked');
      setLinked(!!data);
    } catch {
      setLinked(null);
    }
    if (Platform.OS === 'web') { setPermission('unavailable'); return; }
    try {
      const p = await ContactsAPI.getPermissionsAsync();
      setPermission(p.granted ? 'granted' : p.status);
    } catch {
      setPermission(null);
    }
  }, []);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const back = () => (router.canGoBack() ? router.back() : router.replace('/settings'));

  const unlink = () => Alert.alert(
    'Turn off contact matching?',
    "Your code is deleted, so friends who have your number or email can no longer find you here, and only your @username will work. This phone also forgets the address book it read. Your friends and near misses are not affected.",
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Turn off',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await useContacts.getState().unlink();
            await refresh();
          } catch (e) {
            Alert.alert("Couldn't turn that off", e instanceof Error ? e.message : String(e));
          } finally {
            setBusy(false);
          }
        },
      },
    ],
  );

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 }}>
        <IconButton label="Back" onPress={back}><ChevronLeft size={20} color={colors.ink} /></IconButton>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32, gap: 16 }}>
        <IconTile bg={colors.violetTint} size={52} radiusSize={18}>
          <BookUser size={24} color={colors.ink} strokeWidth={2} />
        </IconTile>
        <Display size={32}>Contacts</Display>
        <Body size={17} color={colors.text2}>
          Your address book never leaves this phone.
        </Body>
        <Body size={15} color={colors.muted}>
          For a friend to find you, Near Miss scrambled your own email address into a code that
          cannot be turned back into an address. That code is the only thing stored. Their phone
          scrambles the addresses in their contacts the same way and asks whether any of them
          match, so the server never sees a readable address, and never sees their contacts.
        </Body>

        <Card style={{ padding: 16, gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <IconTile bg={linked ? colors.greenTint : colors.sand} size={40} radiusSize={14}>
              {linked
                ? <Search size={19} color={colors.ink} strokeWidth={2} />
                : <EyeOff size={19} color={colors.muted} strokeWidth={2} />}
            </IconTile>
            <View style={{ flex: 1 }}>
              <Body size={16} weight="bold">
                {linked === null ? 'Checking…' : linked ? 'Friends can find you' : "You're not findable"}
              </Body>
              <Body size={13} color={colors.muted}>
                {linked === null ? ''
                  : linked
                    ? 'Someone with your number or email in their phone can add you'
                    : 'Only people who know your @username can add you'}
              </Body>
            </View>
          </View>

          {linked ? (
            <>
              <Divider />
              {busy
                ? <ActivityIndicator color={colors.violet} />
                : <Button label="Turn off contact matching" variant="white" onPress={unlink} />}
            </>
          ) : null}
        </Card>

        {!linked && linked !== null ? (
          <Card style={{ padding: 16, gap: 8 }}>
            <Body size={15} weight="semibold">Want to be findable again?</Body>
            <Body size={14} color={colors.muted}>
              Turning it back on happens automatically the next time you open the Invite tab and
              allow contacts.
            </Body>
          </Card>
        ) : null}

        <SectionLabel>On this phone</SectionLabel>
        <Card style={{ padding: 16, gap: 10 }}>
          <Body size={16} weight="semibold">
            {permission === 'granted' ? 'Near Miss can read your contacts'
              : permission === 'unavailable' ? 'Not available here'
              : 'Near Miss cannot read your contacts'}
          </Body>
          <Body size={14} color={colors.muted}>
            This is the iOS permission, and only you can change it. Turning contact matching off
            above does not revoke it, because an app cannot hand back a permission you granted.
            It only stops Near Miss using it.
          </Body>
          {Platform.OS !== 'web' ? (
            <Button label="Open iOS Settings" variant="tint" onPress={() => Linking.openSettings()} />
          ) : null}
        </Card>

        <Body size={13} color={colors.muted} style={{ paddingHorizontal: 4 }}>
          None of this affects friends you already have, or the near misses between you. To remove
          someone, open their profile.
        </Body>
      </ScrollView>
    </Screen>
  );
}
