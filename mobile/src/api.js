import AsyncStorage from '@react-native-async-storage/async-storage';

// Set to your computer's LAN IP while testing (phone and PC on same Wi-Fi),
// or your deployed URL (e.g. https://my-ward.onrender.com) in production.
export const BASE_URL = 'http://192.168.1.104:5000';

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
  const timer = setTimeout(() => ctl.abort(), 12000);
  try {
    res = await fetch(BASE_URL + '/api' + path, { method, headers, signal: ctl.signal, body: form || (body && JSON.stringify(body)) });
  } catch {
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
