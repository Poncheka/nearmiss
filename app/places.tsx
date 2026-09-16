import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import { Briefcase, ChevronLeft, ChevronRight, House, LocateFixed, MapPin, Search } from 'lucide-react-native';
import { Body, Button, Card, Chip, Display, Divider, IconButton, IconTile, Screen, SectionLabel, Segmented, TextLink } from '@/components/ui';
import { PlaceMap } from '@/components/map/PlaceMap';
import { useAuth } from '@/lib/auth';
import { HiddenPlace, RADII, usePlaces } from '@/lib/places';
import { colors, fonts, radius } from '@/theme';

type Draft = { id?: string; label: string; latitude: number | null; longitude: number | null; radius_m: number; address: string };
type RadiusId = `${(typeof RADII)[number]}`;

const iconFor = (label: string, color: string) => {
  const l = label.toLowerCase();
  if (l === 'home') return <House size={18} color={color} strokeWidth={2} />;
  if (l === 'work') return <Briefcase size={18} color={color} strokeWidth={2} />;
  return <MapPin size={18} color={color} strokeWidth={2} />;
};
const fmtRadius = (m: number) => (m >= 1000 ? `${m / 1000}km` : `${m}m`);

function describe(a: Location.LocationGeocodedAddress | undefined) {
  if (!a) return '';
  const street = [a.streetNumber, a.street].filter(Boolean).join(' ');
  return [street || a.name, a.city].filter(Boolean).join(', ');
}

export default function Places() {
  const { demo } = useAuth();
  const params = useLocalSearchParams<{ add?: string }>();
  const { places, loaded, load, add, update, remove } = usePlaces();
  const [draft, setDraft] = useState<Draft | null>(params.add ? { label: params.add, latitude: null, longitude: null, radius_m: 300, address: '' } : null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<'locate' | 'search' | 'save' | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (demo || loaded) return;
    load().catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [demo, loaded, load]);

  const start = (label: string, existing?: HiddenPlace) => {
    setError('');
    setQuery('');
    setDraft(existing
      ? { id: existing.id, label: existing.label, latitude: existing.latitude, longitude: existing.longitude, radius_m: existing.radius_m, address: '' }
      : { label, latitude: null, longitude: null, radius_m: 300, address: '' });
  };

  const addressFor = async (latitude: number, longitude: number) => {
    try { return describe((await Location.reverseGeocodeAsync({ latitude, longitude }))[0]); } catch { return ''; }
  };

  const useCurrent = async () => {
    if (!draft || busy) return;
    setBusy('locate'); setError('');
    try {
      let perm = await Location.getForegroundPermissionsAsync();
      if (!perm.granted && perm.canAskAgain) perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Location is off for Near Miss', 'You can turn it on in Settings, or search for the address instead.', [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = pos.coords;
      setDraft((d) => d && { ...d, latitude, longitude, address: 'Getting address…' });
      const address = await addressFor(latitude, longitude);
      setDraft((d) => d && { ...d, address: address || 'Your current location' });
    } catch (e) {
      setError("Couldn't get your location. Try searching for the address.");
      console.warn('locate failed', e);
    } finally {
      setBusy(null);
    }
  };

  const search = async () => {
    if (!draft || busy || query.trim().length < 3) return;
    setBusy('search'); setError('');
    try {
      const hit = (await Location.geocodeAsync(query.trim()))[0];
      if (!hit) { setError('No match. Try adding the city.'); return; }
      const address = await addressFor(hit.latitude, hit.longitude);
      setDraft((d) => d && { ...d, latitude: hit.latitude, longitude: hit.longitude, address: address || query.trim() });
    } catch (e) {
      setError(Platform.OS === 'web' ? 'Address search works in the phone app.' : "Couldn't find that address.");
      console.warn('geocode failed', e);
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    if (!draft || draft.latitude == null || draft.longitude == null || busy) return;
    const label = draft.label.trim() || 'Place';
    const p = { label, latitude: draft.latitude, longitude: draft.longitude, radius_m: draft.radius_m };
    setBusy('save'); setError('');
    try {
      if (demo) {
        usePlaces.setState((s) => ({ places: draft.id ? s.places.map((x) => (x.id === draft.id ? { ...x, ...p } : x)) : [...s.places, { id: String(Date.now()), ...p }] }));
      } else if (draft.id) {
        await update(draft.id, p);
      } else {
        await add(p);
      }
      if (params.add) router.back();
      else setDraft(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const confirmRemove = (p: HiddenPlace) => Alert.alert(`Stop hiding ${p.label}?`, 'Photos taken there can show up in near misses after your next rescan.', [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Remove', style: 'destructive', onPress: async () => {
        try {
          if (demo) usePlaces.setState((s) => ({ places: s.places.filter((x) => x.id !== p.id) }));
          else await remove(p.id);
          setDraft(null);
        } catch (e) { Alert.alert("Couldn't remove it", e instanceof Error ? e.message : String(e)); }
      },
    },
  ]);

  const back = () => {
    if (draft && !params.add) return setDraft(null);
    if (router.canGoBack()) router.back(); else router.replace('/');
  };
  const has = (label: string) => places.some((p) => p.label.toLowerCase() === label.toLowerCase());
  const existing = draft?.id ? places.find((p) => p.id === draft.id) : undefined;

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ paddingHorizontal: 20, paddingTop: 8, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <IconButton label="Back" onPress={back}><ChevronLeft size={20} color={colors.ink} /></IconButton>
        </View>

        {!draft ? (
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32 }}>
            <Display size={32}>Hidden places</Display>
            <Body size={16} color={colors.text2} style={{ paddingTop: 8 }}>
              Photos taken inside these circles are never saved or matched. Nobody else can see them.
            </Body>

            {!loaded && !demo && !error ? <ActivityIndicator color={colors.violet} style={{ paddingTop: 24 }} /> : null}

            {places.length > 0 && (
              <>
                <SectionLabel>Your places</SectionLabel>
                <Card style={{ paddingHorizontal: 16, paddingVertical: 2 }}>
                  {places.map((p, i) => (
                    <View key={p.id}>
                      <Pressable onPress={() => start(p.label, p)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60 }}>
                        <IconTile>{iconFor(p.label, colors.violet)}</IconTile>
                        <View style={{ flex: 1 }}>
                          <Body size={16} weight="semibold">{p.label}</Body>
                          <Body size={13} color={colors.muted}>{fmtRadius(p.radius_m)} around</Body>
                        </View>
                        <ChevronRight size={16} color={colors.faint} />
                      </Pressable>
                      {i < places.length - 1 && <Divider />}
                    </View>
                  ))}
                </Card>
              </>
            )}

            <SectionLabel>Add</SectionLabel>
            <View style={{ gap: 8 }}>
              {!has('Home') && <Button label="Add home" variant="white" onPress={() => start('Home')} />}
              {!has('Work') && <Button label="Add work" variant="white" onPress={() => start('Work')} />}
              <Button label="Add another place" variant="text" onPress={() => start('')} />
            </View>
            {error ? <Body size={14} color={colors.danger} style={{ paddingTop: 12 }}>{error}</Body> : null}
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32, gap: 16 }} keyboardShouldPersistTaps="handled">
            <Display size={30}>{draft.id ? `Edit ${draft.label}` : draft.label ? `Add ${draft.label.toLowerCase()}` : 'Add a place'}</Display>

            <View style={{ gap: 8 }}>
              <Body size={14} weight="semibold" color={colors.muted} style={{ paddingLeft: 4 }}>Name</Body>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {['Home', 'Work', 'Gym', 'School'].map((l) => (
                  <Chip key={l} label={l} tone={draft.label === l ? 'solidViolet' : 'outline'} onPress={() => setDraft({ ...draft, label: l })} />
                ))}
              </View>
              <TextInput
                value={draft.label}
                onChangeText={(label) => setDraft({ ...draft, label })}
                placeholder="Mom's place"
                placeholderTextColor={colors.faint}
                maxLength={40}
                style={{ height: 52, borderRadius: radius.input, borderWidth: 1, borderColor: colors.inputBorder, paddingHorizontal: 16, backgroundColor: colors.white, fontSize: 17, fontFamily: fonts.regular, color: colors.ink }}
              />
            </View>

            <View style={{ gap: 8 }}>
              <Body size={14} weight="semibold" color={colors.muted} style={{ paddingLeft: 4 }}>Where</Body>
              <Button label={busy === 'locate' ? 'Finding you…' : "I'm here now"} variant="tint" onPress={useCurrent} />
              <View style={{ flexDirection: 'row', alignItems: 'center', height: 52, borderRadius: radius.input, borderWidth: 1, borderColor: colors.inputBorder, paddingLeft: 14, paddingRight: 6, backgroundColor: colors.white, gap: 8 }}>
                <Search size={18} color={colors.muted} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  onSubmitEditing={search}
                  returnKeyType="search"
                  placeholder="Or search an address"
                  placeholderTextColor={colors.faint}
                  style={{ flex: 1, height: 50, fontSize: 17, fontFamily: fonts.regular, color: colors.ink }}
                />
                {busy === 'search' ? <ActivityIndicator color={colors.violet} /> : query.trim().length >= 3 ? <TextLink label="Find" size={15} onPress={search} /> : null}
              </View>
            </View>

            {draft.latitude != null && draft.longitude != null ? (
              <Card style={{ overflow: 'hidden' }}>
                <PlaceMap latitude={draft.latitude} longitude={draft.longitude} radius={draft.radius_m} />
                <View style={{ padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <LocateFixed size={16} color={colors.violet} />
                  <Body size={15} color={colors.text2} style={{ flex: 1 }} numberOfLines={2}>{draft.address || (existing ? 'Saved location' : '')}</Body>
                </View>
              </Card>
            ) : (
              <Card style={{ padding: 16 }}>
                <Body size={15} color={colors.muted}>Pick where it is and we'll show the area we skip.</Body>
              </Card>
            )}

            <View style={{ gap: 8 }}>
              <Body size={14} weight="semibold" color={colors.muted} style={{ paddingLeft: 4 }}>How much to hide around it</Body>
              <Segmented<RadiusId>
                options={RADII.map((r) => ({ id: `${r}` as RadiusId, label: fmtRadius(r) }))}
                value={`${draft.radius_m}` as RadiusId}
                onChange={(v) => setDraft({ ...draft, radius_m: Number(v) })}
              />
            </View>

            {error ? <Body size={14} color={colors.danger}>{error}</Body> : null}
            <Body size={13} color={colors.muted}>Saving removes any photo places we already have inside this circle.</Body>

            <View style={{ gap: 4 }}>
              {busy === 'save'
                ? <View style={{ height: 54, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.violet} /></View>
                : <Button label="Save" variant={draft.latitude != null && draft.label.trim() ? 'violet' : 'sand'} onPress={save} disabled={draft.latitude == null || !draft.label.trim()} />}
              {existing && <Button label={`Stop hiding ${existing.label}`} variant="text" onPress={() => confirmRemove(existing)} />}
            </View>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}
