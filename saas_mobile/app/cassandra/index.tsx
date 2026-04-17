/**
 * Cassandra Home Screen — Orb-centric AI companion
 *
 * Perplexity-inspired design:
 *   • Deep radial gradient background (midnight blue → slate purple)
 *   • Center-orb with state-based glow
 *   • Top bar: connection pill + menu
 *   • Bottom dock: Dashboard, Chat, Team, Files quick actions
 *   • Full-screen modals for each feature
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppStore } from '@/stores/appStore';
import { healthCheck, API_URL } from '@/lib/cassandra';
import { Colors, Gradients, Typography, Spacing, OrbState } from '@/constants/cassandra-theme';
import ParticleOrb from '@/components/dashboard/ParticleOrb';
import CassandraSessionModal from '@/components/cassandra/CassandraSessionModal';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// ─── Connection Pill ───────────────────────────────────────────────────────
const ConnectionPill = () => {
  const { isConnected } = useAppStore();
  return (
    <View style={[styles.pill, isConnected && styles.pillConnected]}>
      <View style={[styles.dot, { backgroundColor: isConnected ? Colors.success : Colors.error }]} />
      <Text style={styles.pillText}>{isConnected ? 'Cassandra online' : 'Offline'}</Text>
    </View>
  );
};

// ─── Dock Button ───────────────────────────────────────────────────────────
const DockButton = ({
  icon,
  label,
  onPress,
}: {
  icon: string;
  label: string;
  onPress: () => void;
}) => (
  <TouchableOpacity style={styles.dockItem} onPress={onPress} activeOpacity={0.7}>
    <View style={styles.dockIconBox}>
      <Text style={styles.dockIcon}>{icon}</Text>
    </View>
    <Text style={styles.dockLabel}>{label}</Text>
  </TouchableOpacity>
);

// ─── Hint Text ─────────────────────────────────────────────────────────────
const OrbHint = () => {
  const { orbState, transcript } = useAppStore();
  if (transcript) {
    return (
      <View style={styles.hintBox}>
        <Text style={styles.transcript} numberOfLines={3}>
          {transcript}
        </Text>
      </View>
    );
  }
  const hints: Record<OrbState, string> = {
    idle: 'Tap the orb to talk to Cassandra',
    listening: 'Listening… speak now',
    processing: 'Cassandra is thinking…',
    speaking: 'Cassandra is speaking…',
    error: 'Something went wrong. Tap to retry.',
  };
  return (
    <View style={styles.hintBox}>
      <Text style={styles.hint}>{hints[orbState]}</Text>
    </View>
  );
};

// ─── Main Screen ───────────────────────────────────────────────────────────
export default function CassandraHomeScreen() {
  const insets = useSafeAreaInsets();
  const { orbState, setOrbState, setIsConnected, setActiveModal, setTranscript } = useAppStore();
  const [orbScale] = useState(new Animated.Value(1));
  const [sessionOpen, setSessionOpen] = useState(false);

  // Health check on mount
  useEffect(() => {
    healthCheck()
      .then((ok) => setIsConnected(ok))
      .catch(() => setIsConnected(false));
  }, []);

  // Orb breathing animation (idle)
  useEffect(() => {
    if (orbState !== 'idle') return;
    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(orbScale, { toValue: 1.05, duration: 1500, useNativeDriver: true }),
        Animated.timing(orbScale, { toValue: 1.0, duration: 1500, useNativeDriver: true }),
      ])
    );
    breathe.start();
    return () => breathe.stop();
  }, [orbState]);

  // Orb press — open the Cassandra session modal
  const handleOrbPress = () => {
    setSessionOpen(true);
  };

  return (
    <View style={styles.container}>
      {/* Radial gradient background */}
      <LinearGradient
        colors={Gradients.radialBg}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Subtle ambient glow behind orb */}
      <View
        style={[
          styles.ambientGlow,
          {
            backgroundColor:
              orbState === 'listening'
                ? Colors.cyanGlow
                : orbState === 'error'
                  ? 'rgba(239,68,68,0.15)'
                  : 'rgba(139,92,246,0.12)',
          },
        ]}
      />

      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + Spacing.md }]}>
        <ConnectionPill />
        <TouchableOpacity
          onPress={() => setActiveModal('dashboard')}
          activeOpacity={0.7}
          style={styles.menuBtn}
        >
          <Text style={styles.menuIcon}>☰</Text>
        </TouchableOpacity>
      </View>

      {/* Center: Orb */}
      <View style={styles.orbContainer}>
        <TouchableOpacity
          onPress={handleOrbPress}
          activeOpacity={0.9}
          style={styles.orbTouch}
        >
          <Animated.View style={{ transform: [{ scale: orbScale }] }}>
            <ParticleOrb size={120} />
          </Animated.View>
        </TouchableOpacity>

        <OrbHint />
      </View>

      {/* Bottom dock */}
      <View style={[styles.dock, { paddingBottom: Math.max(insets.bottom, Spacing.lg) }]}>
        <DockButton icon="📊" label="Dashboard" onPress={() => setActiveModal('dashboard')} />
        <DockButton icon="💬" label="Chat" onPress={() => setActiveModal('chat')} />
        <DockButton icon="👥" label="Team" onPress={() => setActiveModal('users')} />
        <DockButton icon="📁" label="Files" onPress={() => setActiveModal('files')} />
      </View>

      {/* Debug info */}
      <Text style={styles.debug}>API: {API_URL}</Text>

      {/* Cassandra Session Modal */}
      <CassandraSessionModal visible={sessionOpen} onClose={() => setSessionOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgDeep,
  },
  ambientGlow: {
    position: 'absolute',
    top: SCREEN_H * 0.25,
    left: SCREEN_W * 0.5 - 150,
    width: 300,
    height: 300,
    borderRadius: 150,
    opacity: 0.6,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.borderGlass,
  },
  pillConnected: {
    borderColor: 'rgba(16,185,129,0.3)',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pillText: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  menuBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.borderGlass,
  },
  menuIcon: {
    fontSize: 18,
    color: Colors.textPrimary,
  },
  orbContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -40,
  },
  orbTouch: {
    padding: 20,
  },
  hintBox: {
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    minHeight: 60,
    alignItems: 'center',
  },
  hint: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  transcript: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  dock: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.md,
    backgroundColor: 'rgba(11,15,25,0.80)',
    borderTopWidth: 1,
    borderTopColor: Colors.borderGlass,
    backdropFilter: 'blur(12px)',
  },
  dockItem: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
  },
  dockIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.borderGlass,
  },
  dockIcon: {
    fontSize: 22,
  },
  dockLabel: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  debug: {
    position: 'absolute',
    bottom: 4,
    left: 0,
    right: 0,
    textAlign: 'center',
    ...Typography.caption,
    color: 'rgba(255,255,255,0.15)',
  },
});
