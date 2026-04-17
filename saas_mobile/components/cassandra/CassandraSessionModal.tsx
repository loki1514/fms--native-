/**
 * Cassandra Session Modal — Full-screen voice + chat interaction
 *
 * Opens as a true full-screen modal overlay when the orb is tapped.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppStore } from '@/stores/appStore';
import {
  Colors,
  Gradients,
  Typography,
  Spacing,
  Radius,
  OrbState,
  OrbColors,
} from '@/constants/cassandra-theme';
import ParticleOrb from '@/components/dashboard/ParticleOrb';
import Svg, { Path } from 'react-native-svg';

// ─── Icons ─────────────────────────────────────────────────────────────────
const SendIcon = ({ size = 20, color = '#fff' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
  </Svg>
);

const MicIcon = ({ size = 20, color = '#fff' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
    <Path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <Path d="M12 19v4M8 23h8" />
  </Svg>
);

const CloseIcon = ({ size = 18, color = '#fff' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round">
    <Path d="M18 6L6 18M6 6l12 12" />
  </Svg>
);

// ─── Skill Chip ────────────────────────────────────────────────────────────
const SkillChip = ({ label, onPress }: { label: string; onPress: () => void }) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={styles.chip}>
    <Text style={styles.chipText}>{label}</Text>
  </TouchableOpacity>
);

// ─── Status Ring (orb state visualization) ─────────────────────────────────
const StatusRing = ({ state }: { state: OrbState }) => {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (state === 'listening') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.4, duration: 1200, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 0, useNativeDriver: true }),
        ])
      ).start();
    } else if (state === 'processing') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.15, duration: 600, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulse.setValue(1);
    }
  }, [state]);

  const color = OrbColors[state];
  const isActive = state === 'listening' || state === 'processing' || state === 'speaking';

  return (
    <Animated.View
      style={[
        styles.statusRing,
        {
          transform: [{ scale: pulse }],
          borderColor: color,
          opacity: isActive ? 0.5 : 0,
        },
      ]}
    />
  );
};

// ─── Main Modal ────────────────────────────────────────────────────────────
interface CassandraSessionModalProps {
  visible: boolean;
  onClose: () => void;
}

export const CassandraSessionModal: React.FC<CassandraSessionModalProps> = ({
  visible,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const { orbState, setOrbState, transcript, setTranscript, isConnected } = useAppStore();
  const [inputText, setInputText] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const orbScale = useRef(new Animated.Value(1)).current;

  // Breathing animation when idle
  useEffect(() => {
    if (orbState !== 'idle' || !visible) return;
    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(orbScale, { toValue: 1.05, duration: 2000, useNativeDriver: true }),
        Animated.timing(orbScale, { toValue: 1, duration: 2000, useNativeDriver: true }),
      ])
    );
    breathe.start();
    return () => breathe.stop();
  }, [orbState, visible]);

  // Auto-scroll transcript
  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [transcript]);

  const handleOrbPress = () => {
    if (orbState === 'idle' || orbState === 'error') {
      setOrbState('listening');
      setTranscript('');
    } else {
      setOrbState('idle');
    }
  };

  const handleSend = () => {
    if (!inputText.trim()) return;
    setTranscript((prev) => (prev ? prev + '\n\n' : '') + '🧑 ' + inputText.trim());
    setInputText('');
  };

  const handleSkill = (skill: string) => {
    setTranscript((prev) => (prev ? prev + '\n\n' : '') + '🧑 ' + skill);
  };

  const statusLabels: Record<OrbState, string> = {
    idle: 'Tap orb to speak',
    listening: 'Listening…',
    processing: 'Cassandra is thinking…',
    speaking: 'Cassandra is speaking…',
    error: 'Connection error',
  };

  return (
    <Modal
      animationType="slide"
      presentationStyle="fullScreen"
      visible={visible}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Background */}
        <LinearGradient
          colors={Gradients.radialBg}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: isConnected ? Colors.success : Colors.error },
              ]}
            />
            <Text style={styles.headerTitle}>Cassandra</Text>
          </View>
          <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={styles.closeBtn}>
            <CloseIcon />
          </TouchableOpacity>
        </View>

        {/* Drag handle */}
        <View style={styles.dragHandle} />

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={80}
        >
          <ScrollView
            ref={scrollRef}
            style={styles.flex}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Orb Section */}
            <View style={styles.orbSection}>
              <StatusRing state={orbState} />
              <TouchableOpacity onPress={handleOrbPress} activeOpacity={0.9}>
                <Animated.View style={{ transform: [{ scale: orbScale }] }}>
                  <ParticleOrb size={140} />
                </Animated.View>
              </TouchableOpacity>
              <Text style={[styles.statusLabel, { color: OrbColors[orbState] }]}>
                {statusLabels[orbState]}
              </Text>
            </View>

            {/* Transcript */}
            {transcript ? (
              <View style={styles.transcriptBox}>
                <Text style={styles.transcriptText}>{transcript}</Text>
              </View>
            ) : (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>
                  Ask Cassandra anything about your properties, tickets, or team.
                </Text>
              </View>
            )}

            {/* Quick Skills */}
            <View style={styles.skillsRow}>
              <SkillChip label="Dashboard" onPress={() => handleSkill('Show me the dashboard')} />
              <SkillChip label="Tickets" onPress={() => handleSkill('Any open tickets?')} />
              <SkillChip label="Report" onPress={() => handleSkill('Generate weekly report')} />
              <SkillChip label="Research" onPress={() => handleSkill('Research HVAC vendors')} />
            </View>
          </ScrollView>

          {/* Input Bar */}
          <View
            style={[
              styles.inputBar,
              { paddingBottom: Math.max(insets.bottom, 12) },
            ]}
          >
            <TouchableOpacity
              onPress={handleOrbPress}
              style={[
                styles.micBtn,
                { backgroundColor: orbState === 'listening' ? Colors.cyan : Colors.violet },
              ]}
              activeOpacity={0.8}
            >
              <MicIcon size={18} color="#fff" />
            </TouchableOpacity>
            <TextInput
              style={styles.input}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Type a command or question…"
              placeholderTextColor={Colors.textMuted}
              onSubmitEditing={handleSend}
              returnKeyType="send"
            />
            <TouchableOpacity onPress={handleSend} activeOpacity={0.7} style={styles.sendBtn}>
              <SendIcon />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgDeep,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderGlass,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  headerTitle: {
    ...Typography.h2,
    color: Colors.textPrimary,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.borderGlass,
  },
  dragHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.20)',
    marginTop: 8,
    marginBottom: 4,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  orbSection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
    minHeight: 220,
  },
  statusRing: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 2,
  },
  statusLabel: {
    ...Typography.bodySmall,
    marginTop: Spacing.md,
    fontWeight: '500',
  },
  transcriptBox: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderGlass,
    marginBottom: Spacing.lg,
  },
  transcriptText: {
    ...Typography.body,
    color: Colors.textSecondary,
    lineHeight: 24,
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
  },
  emptyText: {
    ...Typography.body,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  skillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  chip: {
    backgroundColor: 'rgba(139,92,246,0.15)',
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.30)',
  },
  chipText: {
    ...Typography.caption,
    color: Colors.violetLight,
    fontWeight: '500',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.borderGlass,
    backgroundColor: 'rgba(11,15,25,0.90)',
  },
  micBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    height: 44,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    color: Colors.textPrimary,
    ...Typography.body,
    borderWidth: 1,
    borderColor: Colors.borderGlass,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.violet,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default CassandraSessionModal;
