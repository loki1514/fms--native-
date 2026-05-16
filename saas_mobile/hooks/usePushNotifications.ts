import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from './useAuth';

Notifications.setNotificationHandler({
  handleNotification: async () =>
    ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    } as Notifications.NotificationBehavior),
});

async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log('[Push] Must use physical device for push notifications');
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
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  return tokenData.data;
}

/**
 * Hook to register push notifications and store token in Supabase push_tokens table.
 * Mirrors saas_one web FCM registration but uses Expo Push Tokens instead.
 */
export function usePushNotifications() {
  const { user } = useAuth();
  const supabase = createClient();
  const registeredRef = useRef(false);

  useEffect(() => {
    if (!user?.id || registeredRef.current) return;

    const register = async () => {
      try {
        const token = await registerForPushNotificationsAsync();
        if (!token) return;

        // Upsert token into push_tokens table (mirrors saas_one web pattern)
        const { error } = await (supabase as any)
          .from('push_tokens')
          .upsert(
            {
              user_id: user.id,
              token,
              device_info: `${Platform.OS} ${Device.modelName || 'unknown'}`,
              browser: `expo-${Platform.OS}`,
              is_active: true,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'token' }
          );

        if (error) {
          console.error('[Push] Token registration error:', error);
        } else {
          console.log('[Push] Token registered:', token);
          registeredRef.current = true;
        }
      } catch (err) {
        console.error('[Push] Registration failed:', err);
      }
    };

    register();
  }, [user?.id, supabase]);

  useEffect(() => {
    // Listen for foreground notifications
    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      console.log('[Push] Foreground notification:', notification.request.content);
    });

    // Listen for notification tap (background/quit → foreground)
    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      console.log('[Push] Notification tapped:', data);
    });

    return () => {
      subscription.remove();
      responseSubscription.remove();
    };
  }, []);
}
