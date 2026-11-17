import AsyncStorage from '@react-native-async-storage/async-storage';

// Deployed backend (Render free tier may take ~30-60s to wake after idle, hence the long timeout below).
export const BASE_URL = 'https://mana-ward.onrender.com';

// Free hosting sleeps when idle and can take 60s+ to wake: ping on app start so it is warm by the time the user submits.
fetch(BASE_URL + '/api/health').catch(() => {});

let token = null;
export const setToken = async (t) => {
  token = t;
  t ? await AsyncStorage.setItem('token', t) : await AsyncStorage.removeItem('token');
};
export const loadToken = async () => {
  try { return (token = await AsyncStorage.getItem('token')); } catch { return null; }
};

export async function api(path, { method = 'GET', body, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  let res;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 120000);
  try {
    res = await fetch(BASE_URL + '/api' + path, { method, headers, signal: ctl.signal, body: form || (body && JSON.stringify(body)) });
  } catch (err) {
    if (err && err.name === 'AbortError') throw new Error('Server is waking up (free hosting). Please wait a minute and try again.');
    throw new Error('No internet / server not reachable');
  } finally {
    clearTimeout(timer);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(data.error || 'Something went wrong');
    e.status = res.status;
    throw e;
  }
  return data;
}

export const timeAgo = (iso) => {
  const s = (Date.now() - new Date(iso)) / 1000;
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

// Photos live in Appwrite Storage and arrive as absolute URLs; older relative paths still resolve against the API.
export const photoUrl = (p) => (!p ? null : /^https?:\/\//.test(p) ? p : BASE_URL + p);
