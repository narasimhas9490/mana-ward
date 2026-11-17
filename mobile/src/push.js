import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { api } from './api';

// Show notifications even while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

// Ask permission, get this phone's FCM token and give it to the backend. Never throws (push is optional).
export async function registerPush() {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync('default', { name: 'Updates', importance: Notifications.AndroidImportance.HIGH });
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') ({ status } = await Notifications.requestPermissionsAsync());
    if (status !== 'granted') return;
    const t = await Notifications.getDevicePushTokenAsync();
    if (t && t.data) await api('/me/push-token', { method: 'PUT', body: { token: String(t.data) } });
  } catch { /* no Firebase config in this build, or no network: ignore */ }
}

export async function unregisterPush() {
  try { await api('/me/push-token', { method: 'PUT', body: { token: null } }); } catch { /* ignore */ }
}
