import React, { useEffect, useState } from 'react';
import { Platform, SafeAreaView, StatusBar, Text, View } from 'react-native';
import { House, Receipt, PlusSquare, UserCircle } from 'phosphor-react-native';
import { useFonts, AnekTelugu_800ExtraBold } from '@expo-google-fonts/anek-telugu';
import { api, loadToken, setToken } from './src/api';
import { Avatar, C, FadeIn, Press } from './src/ui';
import Login from './src/screens/Login';
import { Feed } from './src/screens/Feed';
import Report from './src/screens/Report';
import Services from './src/screens/Services';
import Profile from './src/screens/Profile';
import { PostScreen } from './src/screens/Post';

class Boundary extends React.Component {
  state = { err: null };
  static getDerivedStateFromError(err) { return { err }; }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <View style={{ flex: 1, padding: 24, paddingTop: 70, backgroundColor: '#fff' }}>
        <Text style={{ fontSize: 20, fontWeight: '800', color: '#ED4956' }}>Something broke</Text>
        <Text style={{ marginTop: 10, color: '#262626' }}>{String(this.state.err?.message || this.state.err)}</Text>
        <Text style={{ marginTop: 10, color: '#8E8E8E', fontSize: 11 }}>{String(this.state.err?.stack || '').slice(0, 900)}</Text>
      </View>
    );
  }
}

export default function Root() { return <Boundary><App /></Boundary>; }

function App() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState('home');
  const [reporting, setReporting] = useState(false);
  const [postId, setPostId] = useState(null);
  const [feedKey, setFeedKey] = useState(0);

  const [fontsLoaded, fontError] = useFonts({ AnekTelugu_800ExtraBold });
  const refreshMe = () => api('/me').then(setUser).catch(() => {});
  useEffect(() => {
    (async () => {
      try {
        if (await loadToken()) {
          try { setUser(await api('/me')); } catch (e) { if (e.status === 401) await setToken(null); }
        }
      } finally { setReady(true); }
    })();
  }, []);

  if (!ready || !(fontsLoaded || fontError)) return <View style={{ flex: 1, backgroundColor: C.bg }} />;
  const top = StatusBar.currentHeight || 0;
  const shell = (children) => (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, paddingTop: top }}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />{children}
    </SafeAreaView>
  );

  if (!user) return shell(<Login onLogin={setUser} />);

  if (reporting) return (
    shell(<FadeIn key="report" style={{ flex: 1 }}>
      <Report user={user} onCancel={() => setReporting(false)}
        onDone={() => { setReporting(false); setTab('home'); setFeedKey((k) => k + 1); refreshMe(); }} />
    </FadeIn>)
  );
  if (postId) return (
    shell(<FadeIn key={'p' + postId} style={{ flex: 1 }}><PostScreen id={postId} me={user} onBack={() => { setPostId(null); refreshMe(); }} /></FadeIn>)
  );

  let body;
  if (tab === 'home') body = <Feed key={feedKey} me={user} onReport={() => setReporting(true)} />;
  else if (tab === 'services') body = <Services />;
  else body = <Profile user={user} setUser={setUser} onLogout={() => setUser(null)} onOpenPost={setPostId} />;

  const Tab = ({ id, Icon }) => (
    <Press onPress={() => setTab(id)} outer={{ flex: 1 }} scale={0.85} style={{ alignItems: 'center', paddingVertical: 10 }}>
      <Icon size={28} color={C.ink} weight={tab === id ? 'fill' : 'regular'} />
    </Press>
  );

  return shell(
    <>
      <FadeIn key={tab} style={{ flex: 1 }}>{body}</FadeIn>
      {/* Instagram-style icon-only bar with a centre "+" */}
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.bg, borderTopWidth: 1, borderColor: C.line, paddingTop: 4, paddingBottom: Platform.OS === 'android' ? 30 : 12 }}>
        <Tab id="home" Icon={House} />
        <Tab id="services" Icon={Receipt} />
        <Press onPress={() => setReporting(true)} outer={{ flex: 1 }} scale={0.85} style={{ alignItems: 'center', paddingVertical: 10 }}>
          <PlusSquare size={28} color={C.ink} />
        </Press>
        <Press onPress={() => setTab('profile')} outer={{ flex: 1 }} scale={0.85} style={{ alignItems: 'center', paddingVertical: 10 }}>
          <View style={tab === 'profile' ? { borderWidth: 2, borderColor: C.ink, borderRadius: 16, padding: 1 } : { padding: 3 }}>
            <Avatar name={user.name} size={tab === 'profile' ? 24 : 26} />
          </View>
        </Press>
      </View>
    </>
  );
}
