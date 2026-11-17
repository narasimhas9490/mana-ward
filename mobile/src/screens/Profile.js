import React, { useEffect, useState } from 'react';
import { useBack } from '../useBack';
import { Alert, Dimensions, Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SealCheck, IdentificationCard, ShieldCheck, SignOut, MapPin, HandHeart, ChatCircle, GridFour } from 'phosphor-react-native';
import { api, setToken, photoUrl } from '../api';
import { unregisterPush } from '../push';
import { Avatar, Btn, C, FadeIn, Input, NameLine, VerifiedBadge, s } from '../ui';
import { CatIconBare, catGradient } from '../icons';

const W = Dimensions.get('window').width;
const T = (W - 4) / 3;

const Stat = ({ n, label }) => (
  <View style={{ alignItems: 'center', flex: 1 }}>
    <Text style={{ fontSize: 18, fontWeight: '800', color: C.ink }}>{n}</Text>
    <Text style={{ fontSize: 13, color: C.ink }}>{label}</Text>
  </View>
);

export default function Profile({ user, setUser, onLogout, onOpenPost }) {
  const [editing, setEditing] = useState(false);
  useBack(editing, () => setEditing(false));
  const [name, setName] = useState(user.name === 'Resident' ? '' : user.name);
  const [street, setStreet] = useState(user.street || '');
  const [epic, setEpic] = useState('');
  const [otp, setOtp] = useState('');
  const [masked, setMasked] = useState(null);
  const [mine, setMine] = useState([]);
  useEffect(() => { api('/issues?mine=1').then(setMine).catch(() => {}); }, []);

  const guard = async (fn) => { try { await fn(); } catch (e) { Alert.alert('Oops', e.message); } };
  const save = () => guard(async () => { setUser({ ...user, ...(await api('/me', { method: 'PUT', body: { name, street } })) }); setEditing(false); });
  const sendOtp = () => guard(async () => {
    const r = await api('/voter/send-otp', { method: 'POST', body: { voter_id: epic } });
    setMasked(r.masked_mobile);
    if (r.dev_otp) Alert.alert('Dev mode', `Voter OTP is ${r.dev_otp}`);
  });
  const verify = () => guard(async () => {
    setUser({ ...user, ...(await api('/voter/verify', { method: 'POST', body: { voter_id: epic, otp } })) });
    setMasked(null);
    Alert.alert('You are verified', 'The blue tick now shows next to your name.');
  });
  const st = user.stats || { posts: mine.length, likes: 0, requests: 0 };

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 30 }}>
      <FadeIn>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 10 }}>
          <Avatar name={user.name} size={88} ring />
          <View style={{ flex: 1, flexDirection: 'row', marginLeft: 8 }}>
            <Stat n={st.posts} label="Problems" /><Stat n={st.likes} label="Supports" /><Stat n={st.requests} label="Requests" />
          </View>
        </View>
        <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>
          <NameLine name={user.name} verified={user.verified} size={15} />
          {user.ward && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
              <MapPin size={14} color={C.mute} weight="fill" />
              <Text style={{ color: C.ink, marginLeft: 3, fontSize: 14 }}>{user.ward.name}{user.ward.areas ? ` · ${user.ward.areas}` : ''}</Text>
            </View>)}
          {!!user.street && <Text style={{ color: C.mute, fontSize: 14, marginTop: 1 }}>{user.street}</Text>}
          <Text style={{ color: C.mute, fontSize: 13, marginTop: 1 }}>+91 {user.phone}</Text>
        </View>

        {(st.earned > 0 || st.pending > 0) && (
          <View style={{ flexDirection: 'row', marginHorizontal: 16, marginTop: 12, borderRadius: 12, backgroundColor: '#F4F4F4', padding: 12 }}>
            <View style={{ flex: 1 }}><Text style={{ fontWeight: '800', fontSize: 17, color: '#0B7A47' }}>₹{st.earned || 0}</Text><Text style={{ color: C.mute, fontSize: 12 }}>Rewards paid</Text></View>
            <View style={{ flex: 1 }}><Text style={{ fontWeight: '800', fontSize: 17, color: '#9A6700' }}>₹{st.pending || 0}</Text><Text style={{ color: C.mute, fontSize: 12 }}>Pending (we will call you)</Text></View>
          </View>)}

        <View style={{ flexDirection: 'row', paddingHorizontal: 16, marginTop: 12 }}>
          <View style={{ flex: 1 }}><Btn kind="ghost" title={editing ? 'Cancel' : 'Edit profile'} onPress={() => setEditing(!editing)} style={{ paddingVertical: 8 }} /></View>
        </View>
        {editing && (
          <FadeIn style={{ paddingHorizontal: 16, marginTop: 12 }}>
            <Input placeholder="Your name" value={name} onChangeText={setName} />
            <Input placeholder="Street / area in ward" value={street} onChangeText={setStreet} />
            <Btn title="Save" onPress={save} />
          </FadeIn>)}
      </FadeIn>

      {/* verification card */}
      <FadeIn delay={80} style={{ margin: 16 }}>
        {user.verified ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#EAF6FF', borderRadius: 16, padding: 14 }}>
            <SealCheck size={40} color={C.blue} weight="fill" />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={{ fontWeight: '800', fontSize: 16, color: C.ink }}>Verified resident</Text>
              <Text style={{ color: C.mute, fontSize: 13 }}>Voter ID {user.voter_id}</Text>
            </View>
          </View>
        ) : (
          <View style={{ borderRadius: 18, borderWidth: 1, borderColor: C.line, overflow: 'hidden' }}>
            <LinearGradient colors={['#E6F4FF', '#F3EBFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 16, flexDirection: 'row', alignItems: 'center' }}>
              <SealCheck size={46} color={C.blue} weight="fill" />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={{ fontWeight: '900', fontSize: 17, color: C.ink }}>Get verified</Text>
                <Text style={{ color: '#555', fontSize: 13, marginTop: 2 }}>Show a blue tick on your problems and comments so neighbours know you are a real voter of this ward.</Text>
              </View>
            </LinearGradient>
            <View style={{ padding: 14 }}>
              <Input icon={IdentificationCard} placeholder="Voter ID (EPIC) e.g. ABC1234567" autoCapitalize="characters" value={epic} onChangeText={setEpic} editable={!masked} />
              {masked ? (
                <>
                  <Text style={[s.mute, { marginBottom: 8 }]}>OTP sent to the mobile registered with this Voter ID ({masked})</Text>
                  <Input icon={ShieldCheck} placeholder="6-digit OTP" keyboardType="number-pad" maxLength={6} value={otp} onChangeText={setOtp} />
                  <Btn title="Verify me" onPress={verify} disabled={otp.length !== 6} />
                  <Pressable onPress={() => setMasked(null)} style={{ alignItems: 'center', marginTop: 12 }}><Text style={{ color: C.blue, fontWeight: '700' }}>Change Voter ID</Text></Pressable>
                </>
              ) : <Btn title="Send OTP" onPress={sendOtp} disabled={epic.trim().length < 6} />}
            </View>
          </View>
        )}
      </FadeIn>

      {/* my posts grid */}
      <View style={{ flexDirection: 'row', justifyContent: 'center', paddingVertical: 10, borderTopWidth: 1, borderColor: C.line }}>
        <GridFour size={26} color={C.ink} weight="fill" />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {mine.map((p, k) => (
          <Pressable key={p.id} onPress={() => onOpenPost(p.id)} style={{ width: T, height: T * 1.25, marginRight: k % 3 === 2 ? 0 : 2, marginBottom: 2 }}>
            {p.photo
              ? <Image source={{ uri: photoUrl(p.photo) }} style={{ width: '100%', height: '100%' }} />
              : <LinearGradient colors={catGradient(p.category?.name)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, padding: 8, justifyContent: 'flex-end' }}>
                  <View style={{ position: 'absolute', top: 8, right: 8 }}><CatIconBare name={p.category?.name} size={18} color="#fff" weight="fill" /></View>
                  <Text numberOfLines={4} style={{ color: '#fff', fontWeight: '800', fontSize: 12.5 }}>{p.title}</Text>
                </LinearGradient>}
            {p.reward && p.reward.state === 'paid' && (
              <View style={{ position: 'absolute', left: 6, top: 6, backgroundColor: '#0B7A47', borderRadius: 99, paddingHorizontal: 7, paddingVertical: 2 }}>
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>₹{p.reward.amount} paid</Text>
              </View>)}
            <View style={{ position: 'absolute', left: 6, bottom: 6, flexDirection: 'row', alignItems: 'center' }}>
              {p.photo && <><HandHeart size={13} color="#fff" weight="fill" /><Text style={{ color: '#fff', fontSize: 12, fontWeight: '700', marginLeft: 3 }}>{p.upvotes}</Text></>}
            </View>
          </Pressable>))}
      </View>
      {mine.length === 0 && <Text style={{ textAlign: 'center', color: C.mute, marginTop: 30 }}>Problems you post will appear here.</Text>}

      <Pressable onPress={async () => { await unregisterPush(); await setToken(null); onLogout(); }} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 22 }}>
        <SignOut size={20} color={C.bad} /><Text style={{ marginLeft: 8, color: C.bad, fontWeight: '700' }}>Log out</Text>
      </Pressable>
    </ScrollView>
  );
}
