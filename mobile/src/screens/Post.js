import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Dimensions, Image, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, ChatCircle, DotsThree, HandHeart, MapPin, Megaphone, PaperPlaneTilt } from 'phosphor-react-native';
import { api, photoUrl } from '../api';
import { Avatar, C, NameLine, StatusPill, longAgo } from '../ui';
import { CatIconBare, catGradient } from '../icons';
import CommentsSheet from './Comments';

const W = Dimensions.get('window').width;

// One problem = one Instagram-style post
export function PostCard({ i, me, onChange }) {
  const [sheet, setSheet] = useState(false);
  const [more, setMore] = useState(false);
  const burst = useRef(new Animated.Value(0)).current; // big double-tap heart
  const pop = useRef(new Animated.Value(1)).current;   // small action-row heart
  const last = useRef(0);

  const toggleLike = async (forceOn) => {
    if (forceOn && i.upvoted) return;
    const was = i.upvoted;
    onChange({ upvoted: !was, upvotes: i.upvotes + (was ? -1 : 1) }); // optimistic
    if (!was) Animated.sequence([
      Animated.spring(pop, { toValue: 1.35, speed: 50, bounciness: 14, useNativeDriver: true }),
      Animated.spring(pop, { toValue: 1, speed: 30, useNativeDriver: true }),
    ]).start();
    try { const r = await api(`/issues/${i.id}/upvote`, { method: 'POST' }); onChange(r); }
    catch (e) { onChange({ upvoted: was, upvotes: i.upvotes }); Alert.alert('Oops', e.message); }
  };
  const tapMedia = () => {
    const now = Date.now();
    if (now - last.current < 300) {
      burst.setValue(0);
      Animated.sequence([
        Animated.spring(burst, { toValue: 1, speed: 30, bounciness: 14, useNativeDriver: true }),
        Animated.timing(burst, { toValue: 0, duration: 350, delay: 250, useNativeDriver: true }),
      ]).start();
      toggleLike(true);
    }
    last.current = now;
  };
  const share = () =>
    Share.share({ message: `${i.title}\n${i.location ? i.location + ' · ' : ''}Ward ${i.ward_id}, B.Kothakota\nReported on Mana Ward app` }).catch(() => {});

  const cname = i.category?.name;
  const hasPhoto = !!i.photo;
  const grad = catGradient(cname);

  return (
    <View style={{ marginBottom: 6 }}>
      {/* header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10 }}>
        <Avatar name={i.user.name} size={36} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <NameLine name={i.user.name} verified={i.user.verified} size={13.5} />
          <Text numberOfLines={1} style={{ color: C.ink, fontSize: 12 }}>{i.location || cname || `Ward ${i.ward_id}`}</Text>
        </View>
        <StatusPill v={i.status} />
        <DotsThree size={26} color={C.ink} weight="bold" style={{ marginLeft: 6 }} />
      </View>

      {/* media: photo, or a bold gradient text card when there is no photo */}
      <Pressable onPress={tapMedia}>
        {hasPhoto ? (
          <Image source={{ uri: photoUrl(i.photo) }} style={{ width: W, height: W * 1.1, backgroundColor: C.field }} />
        ) : (
          <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{ width: W, height: W * 0.86, padding: 26, justifyContent: 'center' }}>
            <View style={{ position: 'absolute', right: -30, bottom: -30, opacity: 0.18 }}><CatIconBare name={cname} size={220} color="#fff" weight="fill" /></View>
            <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: '#ffffff30', borderRadius: 99, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 16 }}>
              <CatIconBare name={cname} size={18} color="#fff" weight="fill" />
              <Text style={{ color: '#fff', fontWeight: '700', marginLeft: 6, fontSize: 13 }}>{cname || 'Problem'}</Text>
            </View>
            <Text style={{ color: '#fff', fontSize: i.title.length > 60 ? 24 : 30, fontWeight: '900', lineHeight: i.title.length > 60 ? 31 : 38, letterSpacing: -0.5 }}>{i.title}</Text>
            {!!i.location && (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16 }}>
                <MapPin size={16} color="#fff" weight="fill" /><Text style={{ color: '#fff', marginLeft: 4, fontWeight: '600' }}>{i.location}</Text>
              </View>)}
          </LinearGradient>
        )}
        <Animated.View pointerEvents="none" style={{ ...absFill, alignItems: 'center', justifyContent: 'center', opacity: burst, transform: [{ scale: burst.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1.1] }) }] }}>
          <HandHeart size={110} weight="fill" color="#fff" />
        </Animated.View>
      </Pressable>

      {/* actions */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 10 }}>
        <Pressable onPress={() => toggleLike(false)} hitSlop={8} style={{ marginRight: 18 }}>
          <Animated.View style={{ transform: [{ scale: pop }] }}>
            <HandHeart size={27} weight={i.upvoted ? 'fill' : 'regular'} color={i.upvoted ? C.like : C.ink} />
          </Animated.View>
        </Pressable>
        <Pressable onPress={() => setSheet(true)} hitSlop={8} style={{ marginRight: 18 }}><ChatCircle size={26} color={C.ink} /></Pressable>
        <Pressable onPress={share} hitSlop={8}><PaperPlaneTilt size={25} color={C.ink} /></Pressable>
      </View>

      <View style={{ paddingHorizontal: 12, paddingTop: 8 }}>
        <Text style={{ fontWeight: '700', color: C.ink, fontSize: 14 }}>
          {i.upvotes === 0 ? 'Be the first to support this' : `${i.upvotes} ${i.upvotes === 1 ? 'support' : 'supports'}`}
        </Text>

        {/* caption: with a photo the title is the caption; on a text card show the details */}
        {(hasPhoto || !!i.description) && (
          <Text numberOfLines={more ? undefined : 2} style={{ color: C.ink, fontSize: 14, lineHeight: 19, marginTop: 4 }}>
            <Text style={{ fontWeight: '700' }}>{i.user.name} </Text>
            {hasPhoto ? <Text style={{ fontWeight: '600' }}>{i.title}{i.description ? '\n' : ''}</Text> : null}
            {i.description}
          </Text>
        )}
        {!more && (i.description?.length > 90) && <Pressable onPress={() => setMore(true)}><Text style={{ color: C.mute }}>more</Text></Pressable>}

        {!!i.admin_note && (
          <View style={{ flexDirection: 'row', backgroundColor: '#EAF6FF', borderRadius: 12, padding: 10, marginTop: 8 }}>
            <Megaphone size={18} color={C.blue} weight="fill" />
            <Text style={{ flex: 1, marginLeft: 8, color: C.ink, fontSize: 13.5, lineHeight: 18 }}>
              <Text style={{ fontWeight: '800' }}>Ward Office </Text>{i.admin_note}
            </Text>
          </View>)}

        {i.comments > 0 && (
          <Pressable onPress={() => setSheet(true)} style={{ marginTop: 6 }}>
            <Text style={{ color: C.mute, fontSize: 14 }}>View all {i.comments} comment{i.comments === 1 ? '' : 's'}</Text>
          </Pressable>)}
        {i.last_comment && (
          <Text numberOfLines={1} style={{ color: C.ink, fontSize: 14, marginTop: 3 }}>
            <Text style={{ fontWeight: '700' }}>{i.last_comment.user} </Text>{i.last_comment.text}
          </Text>)}
        <Pressable onPress={() => setSheet(true)} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
          <Avatar name={me.name} size={24} />
          <Text style={{ color: C.mute, marginLeft: 8, fontSize: 14 }}>Add a comment…</Text>
        </Pressable>
        <Text style={{ color: C.mute, fontSize: 10.5, letterSpacing: 0.3, marginTop: 8, marginBottom: 6 }}>{longAgo(i.created_at)}</Text>
      </View>

      {sheet && <CommentsSheet issue={i} me={me} onClose={() => setSheet(false)} onCount={(d) => onChange({ comments: i.comments + d })} />}
    </View>
  );
}
const absFill = { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 };

// a single post opened on its own (from the profile grid)
export function PostScreen({ id, me, onBack }) {
  const [i, setI] = useState(null);
  useEffect(() => { api(`/issues/${id}`).then(setI).catch((e) => { Alert.alert('Oops', e.message); onBack(); }); }, [id]);
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderColor: C.line }}>
        <Pressable onPress={onBack} hitSlop={10}><ArrowLeft size={24} color={C.ink} weight="bold" /></Pressable>
        <Text style={{ fontSize: 17, fontWeight: '800', color: C.ink, marginLeft: 16 }}>Post</Text>
      </View>
      {i && <ScrollView><PostCard i={i} me={me} onChange={(p) => setI((x) => ({ ...x, ...p }))} /></ScrollView>}
    </View>
  );
}
