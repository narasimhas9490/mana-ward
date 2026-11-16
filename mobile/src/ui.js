import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, Text, TextInput, View, StyleSheet } from 'react-native';
import { SealCheck } from 'phosphor-react-native';
import { LinearGradient } from 'expo-linear-gradient';

// Instagram-familiar palette
export const C = {
  bg: '#FFFFFF', ink: '#262626', mute: '#8E8E8E', line: '#EFEFEF', field: '#F2F2F2',
  blue: '#0095F6', like: '#FF3040', bad: '#ED4956', green: '#2FB36D', amber: '#F59F00',
};
export const RING = ['#F9CE34', '#EE2A7B', '#6228D7'];
export const BRAND = ['#833AB4', '#FD1D1D', '#FCB045'];

const NAME_COLORS = ['#E5527A', '#C27B00', '#1F9D55', '#2B7FD8', '#9B51E0', '#E8590C', '#00897B', '#B5446E'];
export const colorFor = (name = '') => NAME_COLORS[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % NAME_COLORS.length];

export const short = (iso) => {
  const s = Math.max(1, (Date.now() - new Date(iso)) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return `${Math.floor(s / 86400)}d`;
  return `${Math.floor(s / 604800)}w`;
};
export const longAgo = (iso) => {
  const s = Math.max(1, (Date.now() - new Date(iso)) / 1000);
  const f = (n, u) => `${n} ${u}${n === 1 ? '' : 'S'} AGO`;
  if (s < 60) return 'JUST NOW';
  if (s < 3600) return f(Math.floor(s / 60), 'MINUTE');
  if (s < 86400) return f(Math.floor(s / 3600), 'HOUR');
  if (s < 2592000) return f(Math.floor(s / 86400), 'DAY');
  return new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'long' }).toUpperCase();
};

export function FadeIn({ children, delay = 0, style }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 280, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, []);
  return (
    <Animated.View style={[{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }, style]}>
      {children}
    </Animated.View>
  );
}

export function Press({ children, onPress, style, outer, disabled, scale = 0.96, onLongPress }) {
  const v = useRef(new Animated.Value(1)).current;
  const to = (x) => Animated.spring(v, { toValue: x, speed: 40, bounciness: 5, useNativeDriver: true }).start();
  return (
    <Pressable style={outer} onPress={onPress} onLongPress={onLongPress} disabled={disabled} onPressIn={() => to(scale)} onPressOut={() => to(1)}>
      <Animated.View style={[{ transform: [{ scale: v }] }, disabled && { opacity: 0.4 }, style]}>{children}</Animated.View>
    </Pressable>
  );
}

// grey pulsing placeholder (Instagram-style loading)
export function Skeleton({ w, h, r = 6, style }) {
  const v = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(v, { toValue: 0.45, duration: 700, useNativeDriver: true }),
    ]));
    a.start();
    return () => a.stop();
  }, []);
  return <Animated.View style={[{ width: w, height: h, borderRadius: r, backgroundColor: '#E6E6E6', opacity: v }, style]} />;
}

// gradient story ring around any circle
export const Ring = ({ size, on = true, width = 2.5, children }) => {
  const inner = size - (width + 2.5) * 2;
  return (
    <LinearGradient colors={on ? RING : [C.line, C.line]} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }}
      style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: size - width * 2, height: size - width * 2, borderRadius: size, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: inner, height: inner, borderRadius: inner / 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>{children}</View>
      </View>
    </LinearGradient>
  );
};

export const Avatar = ({ name = '?', size = 38, ring = false }) => {
  const col = colorFor(name);
  const inner = (
    <View style={{ width: '100%', height: '100%', backgroundColor: col + '26', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: col, fontWeight: '800', fontSize: size * (ring ? 0.34 : 0.42) }}>{(name || '?')[0].toUpperCase()}</Text>
    </View>
  );
  if (ring) return <Ring size={size}>{inner}</Ring>;
  return <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }}>{inner}</View>;
};

export const VerifiedBadge = ({ size = 15 }) => <SealCheck size={size} color={C.blue} weight="fill" />;

export const NameLine = ({ name, verified, style, size = 14 }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1 }}>
    <Text numberOfLines={1} style={[{ color: C.ink, fontWeight: '700', fontSize: size, flexShrink: 1 }, style]}>{name}</Text>
    {verified && <View style={{ marginLeft: 3 }}><VerifiedBadge size={size + 1} /></View>}
  </View>
);

export const STATUS_LABEL = { open: 'Open', submitted: 'Sent', in_progress: 'In progress', resolved: 'Resolved', completed: 'Completed', rejected: 'Rejected' };
const STATUS_COL = { open: ['#FFF3D6', '#B07500'], submitted: ['#FFF3D6', '#B07500'], in_progress: ['#E1F1FF', '#0B72C7'], resolved: ['#DDF6E8', '#1A8A4F'], completed: ['#DDF6E8', '#1A8A4F'], rejected: ['#FFE2E4', '#C4202E'] };
export const StatusPill = ({ v }) => {
  const [bg, fg] = STATUS_COL[v] || ['#eee', '#555'];
  return <Text style={{ backgroundColor: bg, color: fg, fontSize: 11.5, fontWeight: '800', paddingHorizontal: 9, paddingVertical: 3, borderRadius: 99, overflow: 'hidden' }}>{STATUS_LABEL[v] || v}</Text>;
};

export const Btn = ({ title, onPress, kind, disabled, style, icon: Icon }) => {
  const label = (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
      {Icon && <View style={{ marginRight: 8 }}><Icon size={19} color={kind === 'ghost' ? C.ink : '#fff'} weight="bold" /></View>}
      <Text style={[s.btnT, kind === 'ghost' && { color: C.ink }]}>{title}</Text>
    </View>
  );
  return (
    <Press onPress={onPress} disabled={disabled} style={style}>
      {kind === 'grad'
        ? <LinearGradient colors={['#6228D7', '#EE2A7B', '#F9A03F']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.btn}>{label}</LinearGradient>
        : <View style={[s.btn, { backgroundColor: kind === 'ghost' ? C.field : C.blue }]}>{label}</View>}
    </Press>
  );
};

export const Input = ({ icon: Icon, style, ...p }) => {
  const field = (
    <TextInput placeholderTextColor={C.mute} {...p}
      style={[s.input, Icon && { paddingLeft: 44 }, p.multiline && { height: 92, textAlignVertical: 'top' }, style]} />
  );
  if (!Icon) return field;
  return <View>{field}<View style={{ position: 'absolute', left: 14, top: 13 }}><Icon size={21} color={C.mute} /></View></View>;
};

// dark filter pill (Instagram's Following / Favourites style)
export const Pill = ({ label, on, onPress }) => (
  <Pressable onPress={onPress} style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, marginRight: 8, backgroundColor: on ? C.ink : C.field }}>
    <Text style={{ color: on ? '#fff' : C.ink, fontWeight: '600', fontSize: 13.5 }}>{label}</Text>
  </Pressable>
);

export const s = StyleSheet.create({
  btn: { paddingVertical: 13, paddingHorizontal: 22, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btnT: { color: '#fff', fontWeight: '700', fontSize: 15 },
  input: { backgroundColor: C.field, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15.5, color: C.ink, marginBottom: 12 },
  mute: { color: C.mute, fontSize: 13 },
  hair: { height: StyleSheet.hairlineWidth * 2, backgroundColor: C.line },
  pad: { padding: 18 },
});

// brand wordmark: "Mana Ward" in Telugu (loaded in App.js)
export const Wordmark = ({ size = 32, center, color = C.ink }) => (
  <Text style={{ fontFamily: 'AnekTelugu_800ExtraBold', fontSize: size, color, textAlign: center ? 'center' : 'left', lineHeight: size * 1.5, includeFontPadding: false }}>మన వార్డ్</Text>
);
