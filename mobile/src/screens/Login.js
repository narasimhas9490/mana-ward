import React, { useEffect, useState } from 'react';
import { useBack } from '../useBack';
import { Alert, KeyboardAvoidingView, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Check, Lock, MapPin } from 'phosphor-react-native';
import { api, setToken } from '../api';
import { Btn, C, FadeIn, Press, Ring, Wordmark, s } from '../ui';

const st = { label: { color: C.mute, fontSize: 12, fontWeight: '800', letterSpacing: 1.2, marginHorizontal: 24, marginBottom: 12 } };

export default function Login({ onLogin }) {
  const [step, setStep] = useState('ward'); // 1) ward  2) name + mobile  3) otp
  useBack(step !== 'ward', () => { if (step === 'otp') { setOtp(''); setStep('details'); } else setStep('ward'); });
  const [wards, setWards] = useState([]);
  const [ward, setWard] = useState(1); // Ward 1 is pre-selected
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { api('/wards').then(setWards).catch((e) => Alert.alert('Oops', e.message)); }, []);
  const run = async (fn) => { setBusy(true); try { await fn(); } catch (e) { Alert.alert('Oops', e.message); } setBusy(false); };
  const send = () => run(async () => {
    const r = await api('/auth/send-otp', { method: 'POST', body: { phone } });
    setStep('otp');
    if (r.dev_otp) Alert.alert('Dev mode', `Your OTP is ${r.dev_otp}`);
  });
  const verify = () => run(async () => {
    const r = await api('/auth/verify-otp', { method: 'POST', body: { phone, otp, name, ward_id: ward } });
    await setToken(r.token);
    onLogin(r.user);
  });
  const cur = wards.find((w) => w.id === ward);

  // ---------------------------------------------------------- 1. ward list (first screen)
  if (step === 'ward') {
    const open = wards.filter((w) => w.open);
    const locked = wards.filter((w) => !w.open);
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
          {/* hero */}
          <View style={{ overflow: 'hidden', paddingTop: 36, paddingHorizontal: 24, paddingBottom: 30 }}>
            <View style={{ position: 'absolute', right: -70, top: -70, width: 220, height: 220, borderRadius: 110, backgroundColor: C.field }} />
            <View style={{ position: 'absolute', right: 40, top: 70, width: 60, height: 60, borderRadius: 30, backgroundColor: '#F8F8F8' }} />
            <FadeIn>
              <Wordmark size={50} />
              <Text style={{ fontSize: 17, color: C.ink, marginTop: 6, fontWeight: '500' }}>Your street. Your voice.</Text>
              <Text style={{ fontSize: 13.5, color: C.mute, marginTop: 2 }}>B.Kothakota Nagar Panchayat</Text>
            </FadeIn>
          </View>

          <Text style={st.label}>YOUR WARD</Text>
          {open.map((w) => (
            <FadeIn key={w.id} delay={120} style={{ marginHorizontal: 20 }}>
              <Press onPress={() => setWard(w.id)} scale={0.985}
                style={{ borderRadius: 24, padding: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: C.line, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {/* same gradient ring as the stories on Home */}
                  <Ring size={72}>
                    <View style={{ width: '100%', height: '100%', backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: '#fff', fontSize: 24, fontWeight: '900' }}>{w.id}</Text>
                    </View>
                  </Ring>
                  <View style={{ flex: 1, marginLeft: 16 }}>
                    <Text style={{ fontSize: 22, fontWeight: '900', color: C.ink, letterSpacing: -0.5 }}>{w.name}</Text>
                    <View style={{ alignSelf: 'flex-start', backgroundColor: C.ink, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 3, marginTop: 4 }}>
                      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 11.5 }}>Now open</Text>
                    </View>
                  </View>
                  <Check size={24} color={C.blue} weight="bold" />
                </View>
                {!!w.areas && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 14 }}>
                    {w.areas.split(',').map((a) => (
                      <View key={a} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.field, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, marginRight: 8, marginBottom: 6 }}>
                        <MapPin size={14} color={C.ink} weight="fill" />
                        <Text style={{ marginLeft: 5, color: C.ink, fontWeight: '600', fontSize: 13.5 }}>{a.trim()}</Text>
                      </View>))}
                  </View>)}
              </Press>
            </FadeIn>
          ))}

          <Text style={[st.label, { marginTop: 28 }]}>OTHER WARDS · OPENING SOON</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 14 }}>
            {locked.map((w, k) => (
              <FadeIn key={w.id} delay={200 + Math.min(k, 10) * 20} style={{ width: '25%', padding: 6 }}>
                <View style={{ height: 66, borderRadius: 16, backgroundColor: C.field, alignItems: 'center', justifyContent: 'center', opacity: 0.75 }}>
                  <Text style={{ fontSize: 19, fontWeight: '800', color: '#B0B0B0' }}>{w.id}</Text>
                  <View style={{ position: 'absolute', right: 8, top: 7 }}><Lock size={12} color="#B0B0B0" weight="fill" /></View>
                </View>
              </FadeIn>))}
          </View>
        </ScrollView>
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, paddingBottom: 28, backgroundColor: '#ffffffF2' }}>
          <Btn title={`Continue with Ward ${ward}`} onPress={() => setStep('details')} />
        </View>
      </View>
    );
  }

  // ---------------------------------------------------------- 2/3. login
  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ padding: 26, paddingTop: 50 }} keyboardShouldPersistTaps="handled">
        <Wordmark size={42} center />
        <Pressable onPress={() => setStep('ward')} style={{ alignSelf: 'center', flexDirection: 'row', alignItems: 'center', backgroundColor: C.field, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 6, marginTop: 10 }}>
          <MapPin size={14} color={C.ink} weight="fill" />
          <Text style={{ marginLeft: 5, fontWeight: '700', color: C.ink, fontSize: 13 }}>Ward {ward}{cur?.areas ? ` · ${cur.areas}` : ''}</Text>
        </Pressable>

        {step === 'details' ? (
          <FadeIn style={{ marginTop: 30 }}>
            <TextInput style={s.input} placeholder="Your name" placeholderTextColor={C.mute} value={name} onChangeText={setName} autoCapitalize="words" />
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.field, borderRadius: 12, marginBottom: 14 }}>
              <Text style={{ paddingLeft: 16, fontSize: 15.5, color: C.ink, fontWeight: '600' }}>+91</Text>
              <TextInput style={{ flex: 1, paddingHorizontal: 12, paddingVertical: 12, fontSize: 15.5, color: C.ink, letterSpacing: 0.5 }} placeholder="Mobile number" placeholderTextColor={C.mute}
                keyboardType="number-pad" maxLength={10} value={phone} onChangeText={setPhone} />
            </View>
            <Btn title="Send OTP" onPress={send} disabled={busy || phone.length !== 10 || name.trim().length < 2} />
            <Text style={[s.mute, { textAlign: 'center', marginTop: 16 }]}>We will text you a 6-digit code to confirm your number.</Text>
          </FadeIn>
        ) : (
          <FadeIn style={{ marginTop: 30 }}>
            <Text style={{ textAlign: 'center', fontSize: 17, fontWeight: '800', color: C.ink }}>Enter the code</Text>
            <Text style={[s.mute, { textAlign: 'center', marginTop: 4, marginBottom: 18 }]}>Sent to +91 {phone}</Text>
            <TextInput value={otp} onChangeText={setOtp} keyboardType="number-pad" maxLength={6} autoFocus placeholder="••••••" placeholderTextColor="#C7C7C7"
              style={[s.input, { fontSize: 28, letterSpacing: 12, textAlign: 'center', paddingVertical: 14 }]} />
            <Btn title="Log in" onPress={verify} disabled={busy || otp.length !== 6} />
            <Pressable onPress={() => { setOtp(''); setStep('details'); }} style={{ alignItems: 'center', marginTop: 18 }}>
              <Text style={{ color: C.blue, fontWeight: '700' }}>Wrong number? Go back</Text>
            </Pressable>
          </FadeIn>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
