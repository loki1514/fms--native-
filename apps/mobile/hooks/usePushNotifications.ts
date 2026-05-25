import { useEffect, useRef, useCallback, useState } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, AppState, AppStateStatus } from 'react-native';
import Constants from 'expo-constants';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from './useAuth';

// ------------------------------------------------------------------
// Foreground notification banner state (shared across app)
// ------------------------------------------------------------------
export interface ForegroundNotification {
  id: string;
  title: string;
  body: string;
  data: Record<string, any>;
  timestamp: number;
}

let bannerListeners: ((notif: ForegroundNotification | null) => void)[] = [];

export function addBannerListener(cb: (notif: ForegroundNotification | null) => void) {
  bannerListeners.push(cb);
  return () => {
    bannerListeners = bannerListeners.filter((l) => l !== cb);
  };
}

export function showBanner(notification: ForegroundNotification) {
  bannerListeners.forEach((cb) => cb(notification));
}

export function hideBanner() {
  bannerListeners.forEach((cb) => cb(null));
}

// ------------------------------------------------------------------
// Notification handler config
// ------------------------------------------------------------------
Notifications.setNotificationHandler({
  handleNotification: async () =>
    ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    } as Notifications.NotificationBehavior),
});

// ------------------------------------------------------------------
// Token registration
// ------------------------------------------------------------------
async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log('[Push] Must use physical device for push notifications');
    return null;
  }

  // SDK 53+ restriction for Expo Go on Android
  if (Platform.OS === 'android' && Constants.appOwnership === 'expo') {
    console.warn('[Push] Android remote notifications are not supported in Expo Go (SDK 53+). Use a development build instead.');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('[Push] Notification permission not granted');
    return null;
  }

  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: 'autopilot-mobile',
  });

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });

    await Notifications.setNotificationChannelAsync('critical', {
      name: 'Critical Alerts',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 500, 250, 500],
      lightColor: '#EF4444',
      sound: 'default',
    });
  }

  return tokenData.data;
}

async function storePushToken(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  token: string
): Promise<boolean> {
  try {
    const { error } = await (supabase as any).from('push_tokens').upsert(
      {
        user_id: userId,
        token,
        provider: 'expo',
        platform: Platform.OS,
        app_type: 'mobile',
        device_info: `${Platform.OS} ${Device.modelName || 'unknown'}`,
        browser: `expo-${Platform.OS}`,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'token' }
    );

    if (error) {
      console.error('[Push] Token storage error:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Push] Token storage exception:', err);
    return false;
  }
}

// ------------------------------------------------------------------
// Deep link extraction from push data
// ------------------------------------------------------------------
function extractRouteFromData(data: Record<string, any>): string | null {
  if (data?.ticket_id) {
    return `/property/${data.property_id || 'all'}/tickets/${data.ticket_id}`;
  }
  if (data?.deep_link) {
    const dl = data.deep_link as string;
    if (dl.includes('/procurement')) {
      return `/property/${data.property_id || 'all'}/stock`;
    }
    if (dl.includes('/security')) {
      return `/property/${data.property_id || 'all'}/security`;
    }
    if (dl.includes('/visitors')) {
      return `/property/${data.property_id || 'all'}/visitors`;
    }
    if (dl.includes('/tickets/')) {
      const match = dl.match(/\/tickets\/([^?]+)/);
      if (match) return `/property/${data.property_id || 'all'}/tickets/${match[1]}`;
    }
  }
  if (data?.screen) {
    return data.screen as string;
  }
  return null;
}

// ------------------------------------------------------------------
// Main Hook
// ------------------------------------------------------------------
export function usePushNotifications() {
  const { user } = useAuth();
  const supabase = createClient();
  const registeredRef = useRef(false);
  const tokenRef = useRef<string | null>(null);

  const [lastTappedNotification, setLastTappedNotification] = useState<ForegroundNotification | null>(null);

  const register = useCallback(async () => {
    if (!user?.id) return;

    try {
      const token = await registerForPushNotificationsAsync();
      if (!token) return;

      if (tokenRef.current === token && registeredRef.current) {
        return;
      }

      const success = await storePushToken(supabase, user.id, token);
      if (success) {
        tokenRef.current = token;
        registeredRef.current = true;
        console.log('[Push] Token registered:', token.slice(0, 20) + '...');
      }
    } catch (err) {
      console.error('[Push] Registration failed:', err);
    }
  }, [user?.id, supabase]);

  // Register on mount / login
  useEffect(() => {
    register();
  }, [register]);

  // Re-register when app comes to foreground (handles token refresh)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && user?.id) {
        register();
      }
    });

    return () => subscription.remove();
  }, [user?.id, register]);

  // Deactivate token on logout
  useEffect(() => {
    if (!user && tokenRef.current) {
      (supabase as any)
        .from('push_tokens')
        .update({ is_active: false })
        .eq('token', tokenRef.current)
        .then(() => {
          console.log('[Push] Token deactivated on logout');
          tokenRef.current = null;
          registeredRef.current = false;
        })
        .catch((err: any) => console.error('[Push] Token deactivation error:', err));
    }
  }, [user, supabase]);

  // Foreground notification listener — show in-app banner
  useEffect(() => {
    if (Platform.OS === 'web') return;
    
    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      const content = notification.request.content;
      console.log('[Push] Foreground notification:', content);

      showBanner({
        id: notification.request.identifier,
        title: content.title || 'Notification',
        body: content.body || '',
        data: (content.data as Record<string, any>) || {},
        timestamp: Date.now(),
      });
    });

    return () => subscription.remove();
  }, []);

  // Notification tap listener (background / quit → foreground)
  useEffect(() => {
    if (Platform.OS === 'web') return;
    
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as Record<string, any>;
        const title = response.notification.request.content.title || '';
        const body = response.notification.request.content.body || '';

        console.log('[Push] Notification tapped:', data);

        setLastTappedNotification({
          id: response.notification.request.identifier,
          title,
          body,
          data: data || {},
          timestamp: Date.now(),
        });
      }
    );

    return () => responseSubscription.remove();
  }, []);

  // Check for notification that launched the app (cold start)
  useEffect(() => {
    if (Platform.OS === 'web') return;
    
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        const data = response.notification.request.content.data as Record<string, any>;
        const title = response.notification.request.content.title || '';
        const body = response.notification.request.content.body || '';

        console.log('[Push] App launched from notification:', data);

        setLastTappedNotification({
          id: response.notification.request.identifier,
          title,
          body,
          data: data || {},
          timestamp: Date.now(),
        });
      }
    });
  }, []);

  return {
    lastTappedNotification,
    extractRouteFromData,
    clearLastTapped: () => setLastTappedNotification(null),
  };
}
