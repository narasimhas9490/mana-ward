import React, { useCallback, useEffect, useState } from 'react';
import { useBack } from '../useBack';
import { Alert, FlatList, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { MagnifyingGlass, Plus, X, Camera, SquaresFour } from 'phosphor-react-native';
import { MapPin } from 'phosphor-react-native';
import { api } from '../api';
import { Avatar, C, Pill, Ring, Skeleton, Wordmark, s } from '../ui';
import { CatTile } from '../icons';
import { PostCard } from './Post';

const FILTERS = [
  ['all', 'For you', {}],
  ['trending', 'Trending', { sort: 'top' }],
  ['open', 'Open', { status: 'active' }],
  ['resolved', 'Resolved', { status: 'resolved' }],
  ['mine', 'Mine', { mine: 1 }],
];

const PostSkeleton = () => (
  <View style={{ marginBottom: 18 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12 }}>
      <Skeleton w={36} h={36} r={18} /><View style={{ marginLeft: 10 }}><Skeleton w={120} h={11} /><Skeleton w={80} h={9} style={{ marginTop: 6 }} /></View>
    </View>
    <Skeleton w="100%" h={300} r={0} />
    <View style={{ padding: 12 }}><Skeleton w={90} h={12} /><Skeleton w="80%" h={11} style={{ marginTop: 8 }} /></View>
  </View>
);

export function Feed({ me, onReport }) {
  const [items, setItems] = useState(null);
  const [cats, setCats] = useState([]);
  const [cat, setCat] = useState(null);
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [searching, setSearching] = useState(false);
  useBack(searching, () => { setQ(''); setSearching(false); });
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (pull) => {
    pull ? setRefreshing(true) : setItems(null);
    try {
      const extra = FILTERS.find((f) => f[0] === filter)[2];
      const p = new URLSearchParams({ ...extra, ...(cat ? { category: cat } : {}), ...(q.trim() ? { q: q.trim() } : {}) });
      setItems(await api('/issues?' + p));
    } catch (e) { Alert.alert('Oops', e.message); setItems([]); }
    setRefreshing(false);
  }, [filter, cat, q]);
  useEffect(() => { const t = setTimeout(() => load(false), q ? 350 : 0); return () => clearTimeout(t); }, [load]);
  useEffect(() => { api('/categories').then(setCats).catch(() => {}); }, []);

  const change = (id) => (patch) => setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const header = (
    <View>
      {/* stories row: first = you (new problem), then one ring per topic */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 10, paddingVertical: 10 }}>
        <Pressable onPress={onReport} style={{ alignItems: 'center', width: 78 }}>
          <View>
            <Avatar name={me.name} size={66} />
            <View style={{ position: 'absolute', right: -1, bottom: -1, width: 22, height: 22, borderRadius: 11, backgroundColor: C.blue, borderWidth: 2.5, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
              <Plus size={12} color="#fff" weight="bold" />
            </View>
          </View>
          <Text numberOfLines={1} style={{ fontSize: 12, color: C.ink, marginTop: 6 }}>Your problem</Text>
        </Pressable>
        <Pressable onPress={() => setCat(null)} style={{ alignItems: 'center', width: 78, opacity: cat ? 0.6 : 1 }}>
          <Ring size={70} on={!cat}>
            <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: cat ? C.field : C.ink, alignItems: 'center', justifyContent: 'center' }}>
              <SquaresFour size={28} color={cat ? C.ink : '#fff'} weight="fill" />
            </View>
          </Ring>
          <Text numberOfLines={1} style={{ fontSize: 12, color: C.ink, marginTop: 5, fontWeight: !cat ? '800' : '400' }}>All</Text>
        </Pressable>
        {cats.map((c) => (
          <Pressable key={c.id} onPress={() => setCat(cat === c.id ? null : c.id)} style={{ alignItems: 'center', width: 78, opacity: !cat || cat === c.id ? 1 : 0.45 }}>
            <Ring size={70} on={!cat || cat === c.id}><CatTile name={c.name} size={60} /></Ring>
            <Text numberOfLines={1} style={{ fontSize: 12, color: C.ink, marginTop: 5, fontWeight: cat === c.id ? '800' : '400' }}>{c.name.split(/[ &/]/)[0]}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 10 }}>
        {FILTERS.map(([id, label]) => <Pill key={id} label={label} on={filter === id} onPress={() => setFilter(id)} />)}
      </ScrollView>
      <View style={s.hair} />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* top bar */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8 }}>
        {searching ? (
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: C.field, borderRadius: 12, paddingHorizontal: 12 }}>
            <MagnifyingGlass size={18} color={C.mute} />
            <TextInput autoFocus value={q} onChangeText={setQ} placeholder="Search problems" placeholderTextColor={C.mute}
              style={{ flex: 1, paddingVertical: 9, paddingHorizontal: 8, fontSize: 15, color: C.ink }} />
            <Pressable onPress={() => { setQ(''); setSearching(false); }} hitSlop={10}><X size={18} color={C.ink} /></Pressable>
          </View>
        ) : (
          <>
            <View style={{ flex: 1 }}>
              <Wordmark size={30} />
              {me.ward && (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <MapPin size={12} color={C.mute} weight="fill" />
                  <Text numberOfLines={1} style={{ color: C.mute, fontSize: 12, marginLeft: 3, flex: 1 }}>{me.ward.name}{me.ward.areas ? ` · ${me.ward.areas}` : ''}</Text>
                </View>)}
            </View>
            <Pressable onPress={() => setSearching(true)} hitSlop={10} style={{ marginRight: 18 }}><MagnifyingGlass size={26} color={C.ink} /></Pressable>
            <Pressable onPress={onReport} hitSlop={10}><Camera size={27} color={C.ink} /></Pressable>
          </>
        )}
      </View>

      {/* One list for loading + loaded: the stories/filter header stays mounted, so its horizontal scroll position survives a reload. */}
      <FlatList data={items || []} keyExtractor={(i) => String(i.id)}
        ListHeaderComponent={header}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={C.ink} />}
        renderItem={({ item }) => <PostCard i={item} me={me} onChange={change(item.id)} />}
        ListEmptyComponent={items === null ? (
          <View><PostSkeleton /><PostSkeleton /></View>
        ) : (
          <View style={{ alignItems: 'center', marginTop: 60, paddingHorizontal: 40 }}>
            <View style={{ width: 84, height: 84, borderRadius: 42, borderWidth: 2.5, borderColor: C.ink, alignItems: 'center', justifyContent: 'center' }}>
              <Camera size={40} color={C.ink} />
            </View>
            <Text style={{ fontSize: 22, fontWeight: '800', color: C.ink, marginTop: 16 }}>{q ? 'No results' : 'No problems yet'}</Text>
            <Text style={[s.mute, { textAlign: 'center', marginTop: 6, fontSize: 14 }]}>{q ? 'Try another word.' : 'Be the first to post a problem in your ward.'}</Text>
          </View>)}
        contentContainerStyle={{ paddingBottom: 20 }} />
    </View>
  );
}
