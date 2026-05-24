import React from 'react';
import { StyleSheet, TouchableOpacity, Text, View, Platform } from 'react-native';
import SafeBlurView from '@/components/ui/SafeBlurView';
import { Ionicons } from '@expo/vector-icons';
import { EdgeInsets } from 'react-native-safe-area-context';
import SidekickFace, { type FaceState } from '@/components/dashboard/SidekickFace';
import { useCassandraStore } from '@/stores/cassandraStore';
import type { CassandraVoiceState } from '@/hooks/voice/useCassandraVoice';

const fontSans = Platform.OS === 'ios' ? 'System' : 'sans-serif';

export type NavActiveState = 'properties' | 'console' | 'analytics' | 'detail';

interface BottomNavProps {
  active: NavActiveState;
  onProperties: () => void;
  onConsole: () => void;
  onAnalytics: () => void;
  onChat: () => void;
  insets: EdgeInsets;
}

export default function BottomNav({
  active,
  onProperties,
  onConsole,
  onAnalytics,
  onChat,
  insets,
}: BottomNavProps) {
  const isPropsActive = active === 'properties' || active === 'detail';

  // Read live voice state from the shared Cassandra store
  const voiceState = useCassandraStore((s) => s.voiceState);

  // Map CassandraVoiceState → FaceState for the orb
  const faceState: FaceState = (() => {
    if (voiceState === 'recording' || voiceState === 'processing' || voiceState === 'connecting') {
      return 'listening';
    }
    if (voiceState === 'speaking') {
      return 'speaking';
    }
    if (voiceState === 'error') {
      return 'alert';
    }
    return 'idle';
  })();

  return (
    <SafeBlurView
      intensity={40}
      tint="dark"
      style={[
        styles.bottomNav,
        { paddingBottom: insets.bottom > 0 ? insets.bottom + 8 : 16 },
      ]}
    >
      <TouchableOpacity 
        style={[styles.navItem, isPropsActive && styles.navItemActive]} 
        onPress={onProperties}
      >
        <Ionicons
          name={isPropsActive ? 'grid' : 'grid-outline'}
          size={22}
          color={isPropsActive ? '#FFF' : 'rgba(255,255,255,0.40)'}
        />
        <Text style={[styles.navText, isPropsActive && styles.navTextActive]}>
          Properties
        </Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.navItem, active === 'console' && styles.navItemActive]} 
        onPress={onConsole}
      >
        <Ionicons
          name={active === 'console' ? 'settings' : 'settings-outline'}
          size={22}
          color={active === 'console' ? '#FFF' : 'rgba(255,255,255,0.40)'}
        />
        <Text style={[styles.navText, active === 'console' && styles.navTextActive]}>
          Console
        </Text>
      </TouchableOpacity>

      {/* Center Cassandra Orb */}
      <TouchableOpacity style={styles.navItemCenter} onPress={onChat}>
        <View style={styles.askPill}>
          <Text style={styles.askPillText}>ASK CASSANDRA</Text>
        </View>
        <View style={styles.orbContainer}>
          <View style={styles.orbGlow}>
            <SidekickFace size={36} state={faceState} compact onClick={onChat} />
          </View>
        </View>
        <Text style={styles.navText}>Cassandra</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.navItem, active === 'analytics' && styles.navItemActive]} 
        onPress={onAnalytics}
      >
        <Ionicons
          name={active === 'analytics' ? 'bar-chart' : 'bar-chart-outline'}
          size={22}
          color={active === 'analytics' ? '#FFF' : 'rgba(255,255,255,0.40)'}
        />
        <Text style={[styles.navText, active === 'analytics' && styles.navTextActive]}>
          Analytics
        </Text>
      </TouchableOpacity>

    </SafeBlurView>
  );
}

const styles = StyleSheet.create({
  bottomNav: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    backgroundColor: 'rgba(14, 14, 22, 0.92)',
    paddingTop: 10,
    paddingHorizontal: 12,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    gap: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 4,
    zIndex: 20,
  },
  navItem: { 
    alignItems: 'center', 
    justifyContent: 'flex-end', 
    width: 44, 
    height: 44, 
    borderRadius: 22,
    marginTop: 0,
    paddingBottom: 4,
  },
  navItemActive: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  navItemCenter: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 0,
    width: 80,
    gap: 2,
    paddingBottom: 4,
    position: 'relative',
  },
  navText: {
    display: 'none',
  },
  navTextActive: { 
    color: '#FFFFFF' 
  },
  askPill: {
    position: 'absolute',
    top: -14,
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  askPillText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 8,
    fontWeight: '800',
    fontFamily: fontSans,
    letterSpacing: 0.5,
  },
  orbContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -24,
  },
  orbGlow: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    shadowColor: '#3B82F6',
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
});
