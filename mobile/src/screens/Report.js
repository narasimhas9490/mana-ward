import React, { useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Camera, MapPin, ImageSquare } from 'phosphor-react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import { api } from '../api';
import { C, Ring, s } from '../ui';
import { CatTile, catGradient } from '../icons';

export default function Report({ user, onDone, onCancel }) {
  const [cats, setCats] = useState([]);
  const [cat, setCat] = useState(null);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [loc, setLoc] = useState(user.street || '');
  const [photo, setPhoto] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api('/categories').then(setCats).catch(() => {}); }, []);

  const pick = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (r.canceled) return;
    const a = r.assets[0];
    // Phone photos can be 5-10 MB (server limit is 6 MB). Shrink to 1280px JPEG (~200-400 KB) before upload.
    try {
      const out = await ImageManipulator.manipulateAsync(
        a.uri, a.width > 1280 ? [{ resize: { width: 1280 } }] : [],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true });
      setPhoto({ ...a, uri: out.uri, width: out.width, height: out.height, b64: out.base64 });
    } catch { setPhoto(a); }
  };
  const ok = title.trim().length >= 5 && !busy;
  const submit = async () => {
    if (!ok) return;
    setBusy(true);
    try {
      if (photo && photo.b64) {
        // resized JPEG travels as base64 in a JSON body: avoids RN multipart file uploads, which failed on this device
        await api('/issues', { method: 'POST', body: { title, description: desc, location: loc, category_id: cat ? String(cat) : null, photo_b64: photo.b64 } });
      } else {
        const f = new FormData();
        f.append('title', title); f.append('description', desc); f.append('location', loc);
        if (cat) f.append('category_id', String(cat));
        if (photo) f.append('photo', { uri: photo.uri, name: 'photo.jpg', type: 'image/jpeg' });
        await api('/issues', { method: 'POST', form: f });
      }
      onDone();
    } catch (e) { Alert.alert('Oops', e.message); }
    setBusy(false);
  };
  const catName = cats.find((c) => c.id === cat)?.name;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderColor: C.line }}>
        <Pressable onPress={onCancel} hitSlop={10}><X size={26} color={C.ink} weight="bold" /></Pressable>
        <Text style={{ flex: 1, fontSize: 17, fontWeight: '800', color: C.ink, marginLeft: 18 }}>New problem</Text>
        <Pressable onPress={submit} disabled={!ok} hitSlop={10}>
          <Text style={{ color: C.blue, fontWeight: '800', fontSize: 16, opacity: ok ? 1 : 0.35 }}>{busy ? 'Sharing…' : 'Share'}</Text>
        </Pressable>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
        {/* media preview: photo, or gradient card of the chosen topic */}
        <Pressable onPress={pick} style={{ margin: 14, borderRadius: 16, overflow: 'hidden' }}>
          {photo ? <Image source={{ uri: photo.uri }} style={{ height: 240 }} /> : (
            <LinearGradient colors={catGradient(catName)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ height: 170, alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: '#ffffff33', alignItems: 'center', justifyContent: 'center' }}>
                <ImageSquare size={28} color="#fff" weight="fill" />
              </View>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16, marginTop: 10 }}>Add a photo</Text>
              <Text style={{ color: '#ffffffcc', fontSize: 13 }}>Optional. Without one, your post becomes a colour card.</Text>
            </LinearGradient>)}
          {photo && <Pressable onPress={() => setPhoto(null)} style={{ position: 'absolute', right: 10, top: 10, backgroundColor: '#000a', borderRadius: 99, padding: 7 }}><X size={16} color="#fff" weight="bold" /></Pressable>}
        </Pressable>

        <Text style={{ color: C.mute, fontWeight: '700', fontSize: 12.5, marginHorizontal: 16, marginBottom: 6 }}>TOPIC</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 10 }}>
          {cats.map((c) => (
            <Pressable key={c.id} onPress={() => setCat(c.id)} style={{ alignItems: 'center', width: 78, opacity: !cat || cat === c.id ? 1 : 0.4 }}>
              <Ring size={66} on={cat === c.id}><CatTile name={c.name} size={56} /></Ring>
              <Text numberOfLines={1} style={{ fontSize: 11.5, color: C.ink, marginTop: 4, fontWeight: cat === c.id ? '800' : '400' }}>{c.name.split(/[ &/]/)[0]}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          <TextInput value={title} onChangeText={setTitle} placeholder="What's the problem? (e.g. Drain overflowing near temple)" placeholderTextColor={C.mute}
            multiline style={{ fontSize: 17, fontWeight: '700', color: C.ink, paddingVertical: 8 }} />
          <View style={s.hair} />
          <TextInput value={desc} onChangeText={setDesc} placeholder="Write more details… (optional)" placeholderTextColor={C.mute}
            multiline style={{ fontSize: 15, color: C.ink, paddingVertical: 12, minHeight: 80, textAlignVertical: 'top' }} />
          <View style={s.hair} />
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
            <MapPin size={22} color={C.ink} />
            <TextInput value={loc} onChangeText={setLoc} placeholder="Add street / landmark (optional)" placeholderTextColor={C.mute}
              style={{ flex: 1, fontSize: 15, color: C.ink, marginLeft: 12, paddingVertical: 8 }} />
          </View>
          <View style={s.hair} />
          <Text style={{ color: C.mute, fontSize: 12.5, marginTop: 12 }}>Visible to everyone in Ward {user.ward?.id}. Neighbours can support and comment.</Text>
        </View>
      </ScrollView>
    </View>
  );
}
