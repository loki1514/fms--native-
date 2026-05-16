import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as ImagePicker from 'expo-image-picker';
import { Camera } from 'expo-camera';
import { Audio } from 'expo-av';
import { useTheme } from '@/context';
import { GlassCard } from '@/constants/designSystem';

const PERMISSIONS_STORAGE_KEY = '@autopilot_permissions_requested';

interface PermissionItem {
  id: string;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  request: () => Promise<boolean>;
}

export async function hasRequestedPermissions(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(PERMISSIONS_STORAGE_KEY);
    return value === 'true';
  } catch {
    return false;
  }
}

export async function setPermissionsRequested(): Promise<void> {
  await AsyncStorage.setItem(PERMISSIONS_STORAGE_KEY, 'true');
}

export default function PermissionOnboarding({
  visible,
  onComplete,
}: {
  visible: boolean;
  onComplete: () => void;
}) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [permissions, setPermissions] = useState<
    { id: string; status: 'pending' | 'granted' | 'denied' | 'loading' }[]
  >([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const permissionItems: PermissionItem[] = [
    {
      id: 'notifications',
      title: 'Push Notifications',
      description: 'Get instant alerts for tickets, material requests, and approvals. Never miss an important update.',
      icon: 'notifications-outline',
      color: '#2997FF',
      request: async () => {
        const { status: existing } = await Notifications.getPermissionsAsync();
        if (existing === 'granted') return true;
        const { status } = await Notifications.requestPermissionsAsync();
        return status === 'granted';
      },
    },
    {
      id: 'camera',
      title: 'Camera Access',
      description: 'Scan QR codes, capture photos for tickets, and record video evidence.',
      icon: 'camera-outline',
      color: '#10B981',
      request: async () => {
        const { status } = await Camera.requestCameraPermissionsAsync();
        return status === 'granted';
      },
    },
    {
      id: 'microphone',
      title: 'Microphone Access',
      description: 'Record voice notes, use voice commands, and enroll voice authentication.',
      icon: 'mic-outline',
      color: '#AF52DE',
      request: async () => {
        const { status } = await Audio.requestPermissionsAsync();
        return status === 'granted';
      },
    },
    {
      id: 'media',
      title: 'Photo Library',
      description: 'Save ticket photos and evidence to your device gallery.',
      icon: 'images-outline',
      color: '#FF9F0A',
      request: async () => {
        if (Platform.OS === 'web') return true;
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        return status === 'granted';
      },
    },
  ];

  useEffect(() => {
    if (visible) {
      setPermissions(
        permissionItems.map((p) => ({ id: p.id, status: 'pending' }))
      );
      setCurrentIndex(0);
    }
  }, [visible]);

  const handleRequest = async () => {
    const item = permissionItems[currentIndex];
    setPermissions((prev) =>
      prev.map((p) => (p.id === item.id ? { ...p, status: 'loading' } : p))
    );

    const granted = await item.request();

    setPermissions((prev) =>
      prev.map((p) =>
        p.id === item.id
          ? { ...p, status: granted ? 'granted' : 'denied' }
          : p
      )
    );

    // Move to next after a short delay
    setTimeout(() => {
      if (currentIndex < permissionItems.length - 1) {
        setCurrentIndex((i) => i + 1);
      }
    }, 400);
  };

  const handleSkip = () => {
    if (currentIndex < permissionItems.length - 1) {
      setCurrentIndex((i) => i + 1);
    }
  };

  const handleComplete = async () => {
    await setPermissionsRequested();
    onComplete();
  };

  const currentItem = permissionItems[currentIndex];
  const currentStatus = permissions.find((p) => p.id === currentItem?.id)?.status;
  const isLast = currentIndex === permissionItems.length - 1;
  const allProcessed = currentIndex >= permissionItems.length;

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={[styles.overlay, { backgroundColor: isDark ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.6)' }]}>
        <View style={styles.container}>
          {/* Progress dots */}
          {!allProcessed && (
            <View style={styles.dotsRow}>
              {permissionItems.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    i === currentIndex && styles.dotActive,
                    i < currentIndex && styles.dotDone,
                  ]}
                />
              ))}
            </View>
          )}

          {allProcessed || !currentItem ? (
            /* Summary screen */
            <GlassCard style={styles.card}>
              <View style={styles.summaryIcon}>
                <Ionicons name="checkmark-circle" size={48} color="#10B981" />
              </View>
              <Text
                style={[
                  styles.summaryTitle,
                  { color: isDark ? '#F8FAFC' : '#1A2332' },
                ]}
              >
                All Set!
              </Text>
              <Text
                style={[
                  styles.summarySubtitle,
                  { color: isDark ? 'rgba(230,235,238,0.5)' : 'rgba(26,35,50,0.5)' },
                ]}
              >
                You can manage these permissions anytime in your device settings.
              </Text>

              <View style={styles.summaryList}>
                {permissions.map((p) => {
                  const item = permissionItems.find((pi) => pi.id === p.id);
                  return (
                    <View key={p.id} style={styles.summaryItem}>
                      <Ionicons
                        name={
                          p.status === 'granted'
                            ? 'checkmark-circle'
                            : p.status === 'denied'
                            ? 'close-circle'
                            : 'ellipse-outline'
                        }
                        size={18}
                        color={
                          p.status === 'granted'
                            ? '#10B981'
                            : p.status === 'denied'
                            ? '#EF4444'
                            : '#94A3B8'
                        }
                      />
                      <Text
                        style={[
                          styles.summaryItemText,
                          { color: isDark ? '#E6EBEE' : '#1D1D1F' },
                        ]}
                      >
                        {item?.title}
                      </Text>
                    </View>
                  );
                })}
              </View>

              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: '#708F96' }]}
                onPress={handleComplete}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryBtnText}>Continue to Dashboard</Text>
              </TouchableOpacity>
            </GlassCard>
          ) : (
            /* Permission request card */
            <GlassCard style={styles.card}>
              <View
                style={[
                  styles.iconCircle,
                  { backgroundColor: `${currentItem.color}15` },
                ]}
              >
                <Ionicons
                  name={currentItem.icon}
                  size={32}
                  color={currentItem.color}
                />
              </View>

              <Text
                style={[
                  styles.title,
                  { color: isDark ? '#F8FAFC' : '#1A2332' },
                ]}
              >
                {currentItem.title}
              </Text>
              <Text
                style={[
                  styles.description,
                  { color: isDark ? 'rgba(230,235,238,0.5)' : 'rgba(26,35,50,0.5)' },
                ]}
              >
                {currentItem.description}
              </Text>

              {/* Status indicator */}
              {currentStatus === 'granted' && (
                <View style={styles.statusRow}>
                  <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                  <Text style={styles.statusGranted}>Permission granted</Text>
                </View>
              )}
              {currentStatus === 'denied' && (
                <View style={styles.statusRow}>
                  <Ionicons name="close-circle" size={16} color="#EF4444" />
                  <Text style={styles.statusDenied}>Permission denied</Text>
                </View>
              )}

              {/* Action buttons */}
              <View style={styles.btnRow}>
                {currentStatus !== 'granted' && (
                  <TouchableOpacity
                    style={[
                      styles.primaryBtn,
                      { backgroundColor: currentItem.color },
                      currentStatus === 'loading' && { opacity: 0.7 },
                    ]}
                    onPress={handleRequest}
                    disabled={currentStatus === 'loading'}
                    activeOpacity={0.8}
                  >
                    {currentStatus === 'loading' ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.primaryBtnText}>
                        {currentStatus === 'denied' ? 'Try Again' : 'Allow Access'}
                      </Text>
                    )}
                  </TouchableOpacity>
                )}

                {!isLast && currentStatus !== 'granted' && (
                  <TouchableOpacity
                    style={styles.secondaryBtn}
                    onPress={handleSkip}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.secondaryBtnText}>Skip for Now</Text>
                  </TouchableOpacity>
                )}

                {(isLast || currentStatus === 'granted') && (
                  <TouchableOpacity
                    style={[styles.primaryBtn, { backgroundColor: '#708F96' }]}
                    onPress={
                      isLast
                        ? handleComplete
                        : () => setCurrentIndex((i) => i + 1)
                    }
                    activeOpacity={0.8}
                  >
                    <Text style={styles.primaryBtnText}>
                      {isLast ? 'Continue' : 'Next'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </GlassCard>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    width: '100%',
    maxWidth: 400,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  dotActive: {
    backgroundColor: '#FFFFFF',
    width: 24,
  },
  dotDone: {
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  card: {
    padding: 28,
    alignItems: 'center',
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontFamily: 'Poppins-Bold',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  description: {
    fontFamily: 'Urbanist-Regular',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 20,
  },
  statusGranted: {
    fontFamily: 'Poppins-Medium',
    fontSize: 13,
    fontWeight: '600',
    color: '#10B981',
  },
  statusDenied: {
    fontFamily: 'Poppins-Medium',
    fontSize: 13,
    fontWeight: '600',
    color: '#EF4444',
  },
  btnRow: {
    width: '100%',
    gap: 10,
  },
  primaryBtn: {
    height: 50,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryBtnText: {
    fontFamily: 'Poppins-Bold',
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryBtn: {
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontFamily: 'Poppins-Medium',
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  summaryIcon: {
    marginBottom: 16,
  },
  summaryTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  summarySubtitle: {
    fontFamily: 'Urbanist-Regular',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 20,
  },
  summaryList: {
    width: '100%',
    gap: 10,
    marginBottom: 24,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(112,143,150,0.06)',
    borderRadius: 10,
    padding: 12,
  },
  summaryItemText: {
    fontFamily: 'Poppins-Medium',
    fontSize: 14,
    fontWeight: '600',
  },
});
