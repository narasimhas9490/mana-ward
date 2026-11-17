import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useBack } from '../useBack';
import {
  ActivityIndicator, Alert, Animated, Dimensions, FlatList, Keyboard, KeyboardAvoidingView, Modal, PanResponder, Pressable, Text, TextInput, View,
} from 'react-native';
import { HandHeart, X } from 'phosphor-react-native';
import { api } from '../api';
import { Avatar, C, NameLine, Skeleton, short } from '../ui';

const H = Dimensions.get('window').height;
const EMOJIS = ['❤️', '🙌', '🔥', '👏', '😢', '😍', '😮', '😂'];

const SkeletonRow = ({ small }) => (
  <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10 }}>
    <Skeleton w={small ? 26 : 38} h={small ? 26 : 38} r={20} />
    <View style={{ marginLeft: 12, flex: 1 }}>
      <Skeleton w={110} h={11} />
      <Skeleton w="85%" h={11} style={{ marginTop: 8 }} />
      <Skeleton w={50} h={9} style={{ marginTop: 10 }} />
    </View>
  </View>
);

function CommentRow({ c, reply, onReply, onLike, onToggleReplies, replies }) {
  const pop = useRef(new Animated.Value(1)).current;
  const like = () => {
    Animated.sequence([
      Animated.spring(pop, { toValue: 1.35, speed: 50, bounciness: 12, useNativeDriver: true }),
      Animated.spring(pop, { toValue: 1, speed: 30, useNativeDriver: true }),
    ]).start();
    onLike(c);
  };
  return (
    <View style={{ opacity: c._sending ? 0.5 : 1 }}>
      <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 9, paddingLeft: reply ? 62 : 16 }}>
        <Avatar name={c.user.name} size={reply ? 26 : 38} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <NameLine name={c.user.name} verified={c.user.verified} size={13} />
            <Text style={{ color: C.mute, fontSize: 12.5, marginLeft: 8 }}>{c._sending ? 'Posting…' : short(c.created_at)}</Text>
          </View>
          <Text style={{ color: C.ink, fontSize: 14.5, lineHeight: 20, marginTop: 2 }}>{c.text}</Text>
          <View style={{ flexDirection: 'row', marginTop: 7 }}>
            <Pressable onPress={() => onReply(c)} hitSlop={8}><Text style={{ color: C.mute, fontSize: 12.5, fontWeight: '700' }}>Reply</Text></Pressable>
            {c.likes > 0 && <Text style={{ color: C.mute, fontSize: 12.5, fontWeight: '700', marginLeft: 16 }}>{c.likes} {c.likes === 1 ? 'support' : 'supports'}</Text>}
          </View>
        </View>
        <Pressable onPress={like} hitSlop={10} style={{ paddingLeft: 12, alignItems: 'center', paddingTop: 6 }}>
          <Animated.View style={{ transform: [{ scale: pop }] }}>
            <HandHeart size={16} weight={c.liked ? 'fill' : 'regular'} color={c.liked ? C.like : C.mute} />
          </Animated.View>
        </Pressable>
      </View>
      {!reply && c.replies > 0 && (
        <Pressable onPress={() => onToggleReplies(c)} style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 66, paddingVertical: 4 }}>
          <View style={{ width: 24, height: 1, backgroundColor: '#C7C7C7', marginRight: 10 }} />
          <Text style={{ color: C.mute, fontSize: 12.5, fontWeight: '700' }}>
            {c._open ? 'Hide replies' : `View ${c.replies} ${c.replies === 1 ? 'reply' : 'replies'}`}
          </Text>
          {c._loadingReplies && <ActivityIndicator size="small" color={C.mute} style={{ marginLeft: 8 }} />}
        </Pressable>
      )}
      {c._open && replies}
    </View>
  );
}

export default function CommentsSheet({ issue, me, onClose, onCount }) {
  const [items, setItems] = useState(null); // null = first load -> skeleton
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [kb, setKb] = useState(false);
  const input = useRef(null);

  // sheet animation + drag-to-close
  const y = useRef(new Animated.Value(H)).current;
  const open = () => Animated.timing(y, { toValue: 0, duration: 300, useNativeDriver: true }).start();
  const close = () => Animated.timing(y, { toValue: H, duration: 220, useNativeDriver: true }).start(() => { Keyboard.dismiss(); onClose(); });
  useBack(true, close);
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderMove: (_, g) => { if (g.dy > 0) y.setValue(g.dy); },
    onPanResponderRelease: (_, g) => (g.dy > 110 || g.vy > 1 ? close() : Animated.spring(y, { toValue: 0, useNativeDriver: true }).start()),
  })).current;
  useEffect(() => {
    open();
    const a = Keyboard.addListener('keyboardDidShow', () => setKb(true));
    const b = Keyboard.addListener('keyboardDidHide', () => setKb(false));
    return () => { a.remove(); b.remove(); };
  }, []);

  const load = useCallback(async (p) => {
    try {
      const r = await api(`/issues/${issue.id}/comments?page=${p}`);
      setItems((xs) => (p === 1 ? r.items : [...(xs || []), ...r.items]));
      setMore(r.has_more); setPage(p);
    } catch (e) { Alert.alert('Oops', e.message); setItems((xs) => xs || []); }
    setLoadingMore(false);
  }, [issue.id]);
  useEffect(() => { load(1); }, [load]);

  const patch = (id, fn) => setItems((xs) => xs.map((c) => (c.id === id ? { ...c, ...fn(c) } : c)));
  const patchReply = (pid, rid, fn) => setItems((xs) => xs.map((c) => (c.id === pid
    ? { ...c, _replies: c._replies.map((r) => (r.id === rid ? { ...r, ...fn(r) } : r)) } : c)));

  const like = async (c) => {
    const upd = (x) => ({ liked: !x.liked, likes: x.likes + (x.liked ? -1 : 1) });
    c.parent_id ? patchReply(c.parent_id, c.id, upd) : patch(c.id, upd);
    try { await api(`/comments/${c.id}/like`, { method: 'POST' }); } catch (e) { Alert.alert('Oops', e.message); }
  };
  const toggleReplies = async (c) => {
    if (c._open) return patch(c.id, () => ({ _open: false }));
    patch(c.id, () => ({ _open: true, _loadingReplies: !c._replies }));
    if (!c._replies) {
      try { const r = await api(`/comments/${c.id}/replies`); patch(c.id, () => ({ _replies: r.items, _loadingReplies: false })); }
      catch (e) { patch(c.id, () => ({ _open: false, _loadingReplies: false })); }
    }
  };
  const startReply = (c) => {
    setReplyTo(c);
    setText(`@${c.user.name.split(' ')[0]} `);
    input.current?.focus();
  };

  const post = async () => {
    const t = text.trim();
    if (!t) return;
    const parent = replyTo ? (replyTo.parent_id || replyTo.id) : null;
    const temp = { id: 'tmp' + Date.now(), text: t, user: me, created_at: new Date().toISOString(), likes: 0, liked: false, replies: 0, parent_id: parent, _sending: true };
    setText(''); setReplyTo(null); Keyboard.dismiss();
    if (parent) {
      setItems((xs) => xs.map((c) => (c.id === parent ? { ...c, replies: c.replies + 1, _open: true, _replies: [...(c._replies || []), temp] } : c)));
    } else setItems((xs) => [temp, ...xs]); // newest on top, like Instagram
    onCount(1);
    try {
      const real = await api(`/issues/${issue.id}/comments`, { method: 'POST', body: { text: t, parent_id: parent } });
      if (parent) setItems((xs) => xs.map((c) => (c.id === parent ? { ...c, _replies: c._replies.map((r) => (r.id === temp.id ? real : r)) } : c)));
      else setItems((xs) => xs.map((c) => (c.id === temp.id ? real : c)));
    } catch (e) {
      Alert.alert('Oops', e.message); onCount(-1);
      setItems((xs) => xs.filter((c) => c.id !== temp.id).map((c) => ({ ...c, _replies: c._replies && c._replies.filter((r) => r.id !== temp.id) })));
    }
  };

  const renderItem = ({ item: c }) => (
    <CommentRow c={c} onReply={startReply} onLike={like} onToggleReplies={toggleReplies}
      replies={(c._replies || []).map((r) => (
        <CommentRow key={r.id} c={r} reply onReply={() => startReply(r)} onLike={like} />))} />
  );

  const caption = (
    <View>
      <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12 }}>
        <Avatar name={issue.user.name} size={38} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <NameLine name={issue.user.name} verified={issue.user.verified} size={13} />
            <Text style={{ color: C.mute, fontSize: 12.5, marginLeft: 8 }}>{short(issue.created_at)}</Text>
          </View>
          <Text style={{ color: C.ink, fontSize: 14.5, lineHeight: 20, marginTop: 2 }}>
            <Text style={{ fontWeight: '700' }}>{issue.title}</Text>{issue.description ? `\n${issue.description}` : ''}
          </Text>
        </View>
      </View>
      <View style={{ height: 1, backgroundColor: C.line }} />
    </View>
  );

  return (
    <Modal transparent visible animationType="none" onRequestClose={close} statusBarTranslucent>
      <Animated.View style={{ flex: 1, backgroundColor: '#0007', opacity: y.interpolate({ inputRange: [0, H], outputRange: [1, 0] }) }}>
        <Pressable style={{ flex: 1 }} onPress={close} />
      </Animated.View>
      <Animated.View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: H * 0.82, transform: [{ translateY: y }] }}>
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, overflow: 'hidden' }}>
          <View {...pan.panHandlers} style={{ alignItems: 'center', paddingTop: 8, paddingBottom: 10 }}>
            <View style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: '#D0D0D0' }} />
            <Text style={{ fontSize: 15.5, fontWeight: '700', color: C.ink, marginTop: 10 }}>Comments</Text>
          </View>
          <View style={{ height: 1, backgroundColor: C.line }} />

          {items === null ? (
            <View>{caption}{[0, 1, 2, 3, 4].map((k) => <SkeletonRow key={k} />)}</View>
          ) : (
            <FlatList data={items} keyExtractor={(c) => String(c.id)} renderItem={renderItem} keyboardShouldPersistTaps="handled"
              ListHeaderComponent={caption}
              ListEmptyComponent={<View style={{ alignItems: 'center', paddingVertical: 48 }}>
                <Text style={{ fontSize: 20, fontWeight: '800', color: C.ink }}>No comments yet</Text>
                <Text style={{ color: C.mute, marginTop: 6 }}>Start the conversation.</Text></View>}
              ListFooterComponent={loadingMore ? <View><SkeletonRow /><SkeletonRow /></View> : <View style={{ height: 12 }} />}
              onEndReachedThreshold={0.6}
              onEndReached={() => { if (more && !loadingMore) { setLoadingMore(true); load(page + 1); } }} />
          )}

          {replyTo && (
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.field, paddingHorizontal: 16, paddingVertical: 8 }}>
              <Text style={{ flex: 1, color: C.mute, fontSize: 13 }}>Replying to <Text style={{ fontWeight: '700' }}>{replyTo.user.name}</Text></Text>
              <Pressable onPress={() => { setReplyTo(null); setText(''); }} hitSlop={10}><X size={16} color={C.mute} /></Pressable>
            </View>
          )}
          <View style={{ height: 1, backgroundColor: C.line }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 8 }}>
            {EMOJIS.map((e) => (
              <Pressable key={e} onPress={() => { setText((t) => t + e); input.current?.focus(); }} hitSlop={6}><Text style={{ fontSize: 24 }}>{e}</Text></Pressable>
            ))}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: kb ? 10 : 18 }}>
            <Avatar name={me.name} size={36} />
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#DBDBDB', borderRadius: 24, marginLeft: 10, paddingLeft: 14, paddingRight: 12 }}>
              <TextInput ref={input} value={text} onChangeText={setText} multiline
                placeholder={replyTo ? `Reply to ${replyTo.user.name}…` : `Add a comment for ${issue.user.name}…`} placeholderTextColor={C.mute}
                style={{ flex: 1, fontSize: 14.5, color: C.ink, paddingVertical: 9, maxHeight: 96 }} />
              <Pressable onPress={post} disabled={!text.trim()} hitSlop={8}>
                <Text style={{ color: C.blue, fontWeight: '800', fontSize: 15, opacity: text.trim() ? 1 : 0.35, marginLeft: 8 }}>Post</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}
