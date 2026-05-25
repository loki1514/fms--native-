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
import { LinearGradient } from 'expo-linear-gradient';
import SafeBlurView from '@/components/ui/SafeBlurView';

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
      <View style={styles.container}>
        <LinearGradient colors={['#0f172a', '#1e1b4b', '#0f172a']} style={StyleSheet.absoluteFillObject} />

        <View style={styles.contentWrap}>
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
            <SafeBlurView intensity={60} tint="dark" style={[styles.permissionCard, { borderColor: 'rgba(255,255,255,0.08)' }]}>
              <LinearGradient colors={['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)', 'rgba(0,0,0,0.1)']} style={StyleSheet.absoluteFillObject} />
              <View style={styles.permissionInner}>
                <Ionicons name="checkmark-circle" size={56} color="#10B981" />
                
                <Text style={styles.permissionTitle}>All Set!</Text>
                <Text style={styles.permissionSub}>
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
                        <Text style={styles.summaryItemText}>{item?.title}</Text>
                      </View>
                    );
                  })}
                </View>

                <TouchableOpacity
                  style={[styles.permissionBtn, { width: '100%', marginTop: 24 }]}
                  onPress={handleComplete}
                  activeOpacity={0.8}
                >
                  <Text style={styles.permissionBtnText}>Continue to Dashboard</Text>
                </TouchableOpacity>
              </View>
            </SafeBlurView>
          ) : (
            /* Permission request card */
            <SafeBlurView intensity={60} tint="dark" style={[styles.permissionCard, { borderColor: 'rgba(255,255,255,0.08)' }]}>
              <LinearGradient colors={['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)', 'rgba(0,0,0,0.1)']} style={StyleSheet.absoluteFillObject} />
              <View style={styles.permissionInner}>
                <View style={[styles.iconCircle, { backgroundColor: `${currentItem.color}15` }]}>
                  <Ionicons name={currentItem.icon} size={48} color={currentItem.color} />
                </View>

                <Text style={styles.permissionTitle}>{currentItem.title}</Text>
                <Text style={styles.permissionSub}>{currentItem.description}</Text>

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
                        styles.permissionBtn,
                        { backgroundColor: '#708F96' },
                        currentStatus === 'loading' && { opacity: 0.7 },
                      ]}
                      onPress={handleRequest}
                      disabled={currentStatus === 'loading'}
                      activeOpacity={0.8}
                    >
                      {currentStatus === 'loading' ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.permissionBtnText}>
                          {currentStatus === 'denied' ? 'Try Again' : 'Grant Permission'}
                        </Text>
                      )}
                    </TouchableOpacity>
                  )}

                  {!isLast && currentStatus !== 'granted' && (
                    <TouchableOpacity
                      style={styles.permissionClose}
                      onPress={handleSkip}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.permissionCloseText}>Skip for Now</Text>
                    </TouchableOpacity>
                  )}

                  {(isLast || currentStatus === 'granted') && (
                    <TouchableOpacity
                      style={[styles.permissionBtn, { backgroundColor: '#708F96' }]}
                      onPress={
                        isLast ? handleComplete : () => setCurrentIndex((i) => i + 1)
                      }
                      activeOpacity={0.8}
                    >
                      <Text style={styles.permissionBtnText}>
                        {isLast ? 'Continue' : 'Next'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </SafeBlurView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentWrap: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
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
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  dotActive: {
    backgroundColor: '#708F96',
    width: 24,
  },
  dotDone: {
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  permissionCard: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
  },
  permissionInner: {
    padding: 32,
    alignItems: 'center',
    gap: 16,
    position: 'relative',
    zIndex: 1,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#E6EBEE',
    textAlign: 'center',
  },
  permissionSub: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
  },
  btnRow: {
    width: '100%',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  permissionBtn: {
    backgroundColor: '#708F96',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
  },
  permissionBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  permissionClose: {
    paddingVertical: 12,
  },
  permissionCloseText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  statusGranted: {
    fontSize: 13,
    fontWeight: '600',
    color: '#10B981',
  },
  statusDenied: {
    fontSize: 13,
    fontWeight: '600',
    color: '#EF4444',
  },
  summaryList: {
    width: '100%',
    gap: 10,
    marginTop: 12,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 14,
  },
  summaryItemText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E6EBEE',
  },
});
