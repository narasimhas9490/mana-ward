import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { ArrowLeft } from 'phosphor-react-native';
import { api } from '../api';
import { C, FadeIn, Press, StatusPill, short, s } from '../ui';
import { SvcTile } from '../icons';

export default function Services() {
  const [list, setList] = useState([]);
  const [mine, setMine] = useState([]);
  const [pick, setPick] = useState(null);
  const [subject, setSubject] = useState('');
  const [details, setDetails] = useState('');
  const loadMine = () => api('/service-requests').then(setMine).catch(() => {});
  useEffect(() => { api('/services').then(setList).catch(() => {}); loadMine(); }, []);

  const ok = subject.trim().length >= 3;
  const submit = async () => {
    try {
      await api('/service-requests', { method: 'POST', body: { service_id: pick.id, subject, details } });
      Alert.alert('Request sent', 'The ward office has it. You can track it under "Your requests".');
      setPick(null); setSubject(''); setDetails(''); loadMine();
    } catch (e) { Alert.alert('Oops', e.message); }
  };

  if (pick) return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderColor: C.line }}>
        <Pressable onPress={() => setPick(null)} hitSlop={10}><ArrowLeft size={24} color={C.ink} weight="bold" /></Pressable>
        <Text style={{ flex: 1, fontSize: 17, fontWeight: '800', color: C.ink, marginLeft: 16 }}>{pick.name}</Text>
        <Pressable onPress={submit} disabled={!ok}><Text style={{ color: C.blue, fontWeight: '800', fontSize: 16, opacity: ok ? 1 : 0.35 }}>Send</Text></Pressable>
      </View>
      <ScrollView contentContainerStyle={s.pad} keyboardShouldPersistTaps="handled">
        <FadeIn style={{ alignItems: 'center', marginBottom: 20 }}>
          <SvcTile name={pick.name} size={84} />
          <Text style={[s.mute, { textAlign: 'center', marginTop: 10, fontSize: 14 }]}>{pick.description}</Text>
        </FadeIn>
        <TextInput value={subject} onChangeText={setSubject} placeholder="What do you need? (short)" placeholderTextColor={C.mute}
          style={{ fontSize: 17, fontWeight: '700', color: C.ink, paddingVertical: 8 }} />
        <View style={s.hair} />
        <TextInput value={details} onChangeText={setDetails} multiline placeholder="Details: card number, family members, etc." placeholderTextColor={C.mute}
          style={{ fontSize: 15, color: C.ink, paddingVertical: 12, minHeight: 120, textAlignVertical: 'top' }} />
      </ScrollView>
    </View>
  );

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
      <Text style={{ fontSize: 26, fontWeight: '900', color: C.ink, paddingHorizontal: 16, paddingTop: 8 }}>Services</Text>
      <Text style={[s.mute, { paddingHorizontal: 16, marginTop: 2, fontSize: 14 }]}>Ask the ward office for help</Text>

      {mine.length > 0 && (
        <>
          <Text style={{ fontWeight: '800', fontSize: 15, color: C.ink, paddingHorizontal: 16, marginTop: 20, marginBottom: 6 }}>Your requests</Text>
          {mine.map((r) => (
            <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 }}>
              <SvcTile name={r.service} size={48} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ fontWeight: '700', color: C.ink, fontSize: 15 }}>{r.service}</Text>
                <Text numberOfLines={1} style={{ color: C.mute, fontSize: 13.5 }}>{r.subject} · {short(r.created_at)}</Text>
                {!!r.admin_note && <Text numberOfLines={2} style={{ color: C.blue, fontSize: 13, marginTop: 2 }}>Ward Office: {r.admin_note}</Text>}
              </View>
              <StatusPill v={r.status} />
            </View>))}
          <View style={[s.hair, { marginTop: 10 }]} />
        </>)}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 10, marginTop: 14 }}>
        {list.map((x, k) => (
          <FadeIn key={x.id} delay={Math.min(k, 8) * 35} style={{ width: '50%', padding: 6 }}>
            <Press onPress={() => setPick(x)} style={{ borderRadius: 18, padding: 14, minHeight: 112, borderWidth: 1, borderColor: C.line, backgroundColor: '#fff' }}>
              <SvcTile name={x.name} size={46} />
              <Text style={{ fontWeight: '700', color: C.ink, marginTop: 10, fontSize: 14.5 }}>{x.name}</Text>
            </Press>
          </FadeIn>
        ))}
      </View>
    </ScrollView>
  );
}
