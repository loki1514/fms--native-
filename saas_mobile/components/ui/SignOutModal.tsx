import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

interface SignOutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
}

export default function SignOutModal({ isOpen, onClose, onConfirm }: SignOutModalProps) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleConfirm = async () => {
    setIsLoggingOut(true);
    try {
      await onConfirm();
      setTimeout(() => {
        router.replace('/(auth)/login');
      }, 800);
    } catch (error) {
      console.error('Sign out failed:', error);
      setIsLoggingOut(false);
    }
  };

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Close button */}
          {!isLoggingOut && (
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={20} color="#94A3B8" />
            </TouchableOpacity>
          )}

          {/* Icon */}
          <View style={styles.iconContainer}>
            <Ionicons name="log-out-outline" size={32} color="#F43F5E" />
          </View>

          {/* Text */}
          <Text style={styles.title}>Wait, Don't Go!</Text>
          <Text style={styles.subtitle}>
            Are you sure you want to sign out of your dashboard?
          </Text>

          {/* Buttons */}
          <TouchableOpacity
            style={styles.confirmButton}
            onPress={handleConfirm}
            disabled={isLoggingOut}
            activeOpacity={0.8}
          >
            {isLoggingOut ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.confirmText}>Securing Session...</Text>
              </View>
            ) : (
              <Text style={styles.confirmText}>Yes, Sign Out</Text>
            )}
          </TouchableOpacity>

          {!isLoggingOut && (
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelText}>Stay Logged In</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.2,
    shadowRadius: 32,
    elevation: 12,
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 8,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: '#FFF1F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1A2332',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  confirmButton: {
    width: '100%',
    height: 52,
    backgroundColor: '#EF4444',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: 'rgba(239,68,68,0.3)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cancelButton: {
    width: '100%',
    height: 52,
    backgroundColor: '#F1F5F9',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '800',
  },
});
