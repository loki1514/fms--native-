/**
 * Cassandra Session Modal — Full-screen voice + chat interaction
 *
 * Opens as a true full-screen modal overlay when the orb is tapped.
 * Matches the original intended design: orb, capability grid, recent-chat
 * suggestions, and the Cassandra input bar.
 *
 * Chat messages are bottom-aligned (newest at the bottom) like a normal
 * text-chat app (WhatsApp / iMessage style).
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
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
import { useCassandraStore } from '@/stores/cassandraStore';
import {
  smartQuery,
  createTicketNL,
  researchQuery,
  generateReport,
} from '@/lib/cassandra';
import { useTextToSpeech } from '@/hooks/voice/useTextToSpeech';
import { useCassandraVoice } from '@/hooks/voice/useCassandraVoice';
import { toast } from '@/lib/toast';
import {
  Colors,
  Gradients,
  Typography,
  Spacing as CassSpacing,
  Radius,
} from '@/constants/cassandra-theme';
import {
  MODAL_TOKENS,
  SPACING,
  CARD_SURFACES,
} from '@/constants/designSystem';
import SidekickFace, { type FaceState } from '@/components/dashboard/SidekickFace';
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

const AttachmentIcon = ({ size = 20, color = '#9CA3AF' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
  </Svg>
);

const PersonIcon = ({ size = 20, color = '#9CA3AF' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </Svg>
);

// ─── Skill Chip ────────────────────────────────────────────────────────────
const SkillChip = ({ label, onPress, variant = 'default' }: { label: string; onPress: () => void; variant?: 'default' | 'muted' }) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={[styles.chip, variant === 'muted' && styles.chipMuted]}>
    <Text style={[styles.chipText, variant === 'muted' && styles.chipTextMuted]}>{label}</Text>
  </TouchableOpacity>
);

// ─── Chat Bubble ───────────────────────────────────────────────────────────
interface ChatMessage {
  id: string;
  role: 'user' | 'cassandra';
  text: string;
}

const ChatBubble = ({ message }: { message: ChatMessage }) => {
  const isUser = message.role === 'user';
  return (
    <View style={[styles.bubbleRow, isUser ? styles.bubbleRowRight : styles.bubbleRowLeft]}>
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleBot]}>
        <Text style={[styles.bubbleText, isUser ? styles.bubbleTextUser : styles.bubbleTextBot]}>
          {message.text}
        </Text>
      </View>
    </View>
  );
};

// ─── Status Ring (orb state visualization) ─────────────────────────────────
const StatusRing = ({ voiceState }: { voiceState: string }) => {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (voiceState === 'recording') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.4, duration: 1200, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 0, useNativeDriver: true }),
        ])
      ).start();
    } else if (voiceState === 'processing') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.15, duration: 600, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulse.setValue(1);
    }
  }, [voiceState]);

  const color = voiceState === 'speaking' ? Colors.violet
    : voiceState === 'recording' ? Colors.cyan
    : voiceState === 'processing' ? Colors.warning
    : voiceState === 'error' ? Colors.error
    : Colors.violet;
  const isActive = voiceState === 'recording' || voiceState === 'processing' || voiceState === 'speaking';

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

// ─── Capability Grid ───────────────────────────────────────────────────────
const WHAT_I_CAN_DO = [
  { label: 'Triage tickets', action: 'Triage open tickets', endpoint: 'ticket' as const },
  { label: 'Explain energy spikes', action: 'Explain recent energy spikes', endpoint: 'research' as const },
  { label: 'Find on-call staff', action: 'Who is on call right now?', endpoint: undefined },
  { label: 'Summarise reports', action: 'Summarise this week\'s reports', endpoint: 'report' as const },
];

const RECENT_CHATS = [
  { label: 'Show critical tickets at SS Plaza', action: 'Show critical tickets at SS Plaza', endpoint: 'ticket' as const },
  { label: 'Energy spike yesterday — why?', action: 'Why was there an energy spike yesterday?', endpoint: 'research' as const },
  { label: 'Open checklist items for today', action: 'Open checklist items for today', endpoint: undefined },
  { label: 'Compare health across properties', action: 'Compare health scores across properties', endpoint: 'research' as const },
  { label: 'Who\'s on call for Bajaj Kolkata?', action: 'Who is on call for Bajaj Kolkata?', endpoint: undefined },
];

// ─── Main Modal ────────────────────────────────────────────────────────────
interface CassandraSessionModalProps {
  visible: boolean;
  onClose: () => void;
  orgId: string;
  initialMode?: 'text' | 'voice';
}

export const CassandraSessionModal: React.FC<CassandraSessionModalProps> = ({
  visible,
  onClose,
  orgId,
  initialMode = 'text',
}) => {
  const insets = useSafeAreaInsets();
  const {
    voiceState,
    isConnected,
    addMessage,
    transcript,
    messageHistory,
    setVoiceState,
    setLastResponse,
  } = useCassandraStore();
  const [inputText, setInputText] = useState('');
  const [inputMode, setInputMode] = useState<'text' | 'voice'>(initialMode);
  const scrollRef = useRef<ScrollView>(null);
  const orbScale = useRef(new Animated.Value(1)).current;
  const { speak, stop: stopSpeaking } = useTextToSpeech();

  const voice = useCassandraVoice(orgId, {
    onStateChange: useCassandraStore.getState().setVoiceState,
    onTranscript: (text, speakerId) => {
      useCassandraStore.getState().addTranscriptSegment(text, speakerId);
      if (text.trim()) {
        useCassandraStore.getState().addMessage({ role: 'user', text });
      }
    },
    onAudioPlaybackStart: () => {},
    onAudioPlaybackEnd: () => {
      stopSpeaking();
      useCassandraStore.getState().setVoiceState('idle');
    },
    onTicketCreated: (id, desc) => {
      toast.success(`Ticket ${id} created: ${desc}`);
      useCassandraStore.getState().addMessage({ role: 'cassandra', text: `Ticket ${id} created: ${desc}` });
    },
    onError: (err) => {
      toast.error(err);
      useCassandraStore.getState().setConnectionError(err);
    },
  });

  useEffect(() => {
    if (voiceState !== 'idle' || !visible) return;
    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(orbScale, { toValue: 1.05, duration: 2000, useNativeDriver: true }),
        Animated.timing(orbScale, { toValue: 1, duration: 2000, useNativeDriver: true }),
      ])
    );
    breathe.start();
    return () => breathe.stop();
  }, [voiceState, visible]);

  const handleOrbPress = () => {
    if (voiceState === 'speaking') {
      stopSpeaking();
      if (inputMode === 'voice') {
        voice.stopSession();
      }
      setVoiceState('idle');
      return;
    }
    if (inputMode === 'voice') {
      if (voice.state === 'idle' || voice.state === 'error') {
        voice.startSession();
      } else {
        voice.stopSession();
      }
      return;
    }
    if (voiceState === 'idle' || voiceState === 'error') {
      setVoiceState('processing');
    } else {
      setVoiceState('idle');
    }
  };

  const handleSend = useCallback(async () => {
    if (!inputText.trim()) return;
    const text = inputText.trim();
    addMessage({ role: 'user', text });
    setInputText('');
    setVoiceState('processing');

    try {
      const res = await smartQuery(text, orgId);
      const responseText = (res as any)?.response ?? (res as any)?.message ?? "I'm not sure how to answer that.";
      addMessage({ role: 'cassandra', text: responseText });
      setVoiceState('speaking');
      await speak(responseText);
      setVoiceState('idle');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.';
      addMessage({ role: 'cassandra', text: `Error: ${msg}` });
      toast.error(msg);
      setVoiceState('idle');
    }
  }, [inputText, orgId, speak, addMessage, setVoiceState]);

  const handleSkill = useCallback((skill: string, endpoint?: 'research' | 'report' | 'ticket') => {
    addMessage({ role: 'user', text: skill });
    setVoiceState('processing');

    const runSkill = async () => {
      try {
        let responseText: string;
        if (endpoint === 'research') {
          responseText = 'Researching…';
          const res = await researchQuery(skill, orgId);
          responseText = (res as any)?.response ?? (res as any)?.message ?? 'Research complete.';
        } else if (endpoint === 'report') {
          const res = await generateReport('weekly', '', '7d', orgId);
          responseText = (res as any)?.response ?? (res as any)?.summary ?? 'Report generated successfully.';
        } else if (endpoint === 'ticket') {
          const res = await createTicketNL(skill, orgId);
          responseText = (res as any)?.response ?? (res as any)?.message ?? 'Ticket created.';
          if ((res as any)?.ticket_id) {
            toast.success(`Ticket created: ${(res as any).ticket_id}`);
          }
        } else {
          const res = await smartQuery(skill, orgId);
          responseText = (res as any)?.response ?? (res as any)?.message ?? "I'm not sure how to answer that.";
        }
        addMessage({ role: 'cassandra', text: responseText });
        setVoiceState('speaking');
        await speak(responseText);
        setVoiceState('idle');
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Something went wrong.';
        addMessage({ role: 'cassandra', text: `Error: ${msg}` });
        toast.error(msg);
        setVoiceState('idle');
      }
    };

    runSkill();
  }, [orgId, speak, addMessage, setVoiceState]);

  const statusLabels: Record<string, string> = {
    idle: 'Tap face to speak',
    recording: 'Listening… speak now',
    connecting: 'Connecting…',
    processing: 'Cassandra is thinking…',
    speaking: 'Cassandra is speaking…',
    error: 'Something went wrong. Tap to retry.',
  };

  const hasMessages = messageHistory.length > 0;

  return (
    <Modal
      animationType="slide"
      presentationStyle="fullScreen"
      visible={visible}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Solid background — must fully occlude everything behind */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: MODAL_TOKENS.sheetBg }]} />

      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.headerSurface}>
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
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={80}
        >
          {hasMessages ? (
            /* ─── CHAT MODE: bottom-aligned messages ─── */
            <ScrollView
              ref={scrollRef}
              style={styles.flex}
              contentContainerStyle={styles.chatScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {[...messageHistory].reverse().map((msg) => (
                <ChatBubble key={msg.id} message={msg as ChatMessage} />
              ))}
            </ScrollView>
          ) : (
            /* ─── EMPTY STATE: orb + suggestions ─── */
            <ScrollView
              style={styles.flex}
              contentContainerStyle={styles.emptyScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Orb Section */}
              <View style={styles.orbSection}>
                <StatusRing voiceState={voiceState} />
                <TouchableOpacity onPress={handleOrbPress} activeOpacity={0.9}>
                  <Animated.View style={{ transform: [{ scale: orbScale }] }}>
                    <SidekickFace
                      size={140}
                      state={voiceState === 'recording' || voiceState === 'connecting' ? 'listening' : voiceState === 'processing' ? 'thinking' : voiceState === 'error' ? 'alert' : voiceState as FaceState}
                    />
                  </Animated.View>
                </TouchableOpacity>
                <Text style={[styles.statusLabel, { color: voiceState === 'speaking' ? Colors.violet : voiceState === 'recording' ? Colors.cyan : voiceState === 'processing' ? Colors.warning : voiceState === 'error' ? Colors.error : Colors.textMuted }]}>
                  {statusLabels[voiceState] ?? 'Tap face to speak'}
                </Text>
              </View>

              {/* ─── WHAT I CAN DO ─── */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>WHAT I CAN DO</Text>
                <View style={styles.capabilityGrid}>
                  {WHAT_I_CAN_DO.map((item) => (
                    <SkillChip
                      key={item.label}
                      label={item.label}
                      variant="muted"
                      onPress={() => handleSkill(item.action, item.endpoint)}
                    />
                  ))}
                </View>
              </View>

              {/* ─── BASED ON RECENT CHATS ─── */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>BASED ON RECENT CHATS</Text>
                <View style={styles.recentChipsWrap}>
                  {RECENT_CHATS.map((item) => (
                    <SkillChip
                      key={item.label}
                      label={item.label}
                      variant="muted"
                      onPress={() => handleSkill(item.action, item.endpoint)}
                    />
                  ))}
                </View>
              </View>
            </ScrollView>
          )}

          {/* Input Bar */}
          <View
            style={[
              styles.inputBar,
              { paddingBottom: Math.max(insets.bottom, SPACING.md) },
            ]}
          >
            <TouchableOpacity activeOpacity={0.7} style={styles.iconBtn}>
              <AttachmentIcon size={20} />
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.7} style={styles.iconBtn}>
              <PersonIcon size={20} />
            </TouchableOpacity>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                value={inputText}
                onChangeText={setInputText}
                placeholder="Ask Cassandra anything…"
                placeholderTextColor={Colors.textMuted}
                onSubmitEditing={handleSend}
                returnKeyType="send"
              />
              <TouchableOpacity onPress={handleOrbPress} activeOpacity={0.8} style={styles.micBtnInline}>
                <MicIcon size={16} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
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
    backgroundColor: MODAL_TOKENS.sheetBg,
  },
  flex: {
    flex: 1,
  },
  headerSurface: {
    backgroundColor: MODAL_TOKENS.sheetBg,
    borderBottomWidth: 1,
    borderBottomColor: CARD_SURFACES.cardBorder,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: CassSpacing.lg,
    paddingVertical: CassSpacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
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
    backgroundColor: CARD_SURFACES.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: CARD_SURFACES.cardBorder,
  },
  /* ─── Chat (bottom-aligned) ─── */
  chatScrollContent: {
    flexDirection: 'column-reverse',
    paddingHorizontal: CassSpacing.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
    flexGrow: 1,
    justifyContent: 'flex-start',
  },
  bubbleRow: {
    width: '100%',
    marginBottom: CassSpacing.sm,
  },
  bubbleRowLeft: {
    alignItems: 'flex-start',
  },
  bubbleRowRight: {
    alignItems: 'flex-end',
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: Radius.xl,
    paddingHorizontal: CassSpacing.md,
    paddingVertical: CassSpacing.sm,
  },
  bubbleBot: {
    backgroundColor: CARD_SURFACES.cardBg,
    borderWidth: 1,
    borderColor: CARD_SURFACES.cardBorder,
    borderTopLeftRadius: Radius.sm,
  },
  bubbleUser: {
    backgroundColor: Colors.violet,
    borderTopRightRadius: Radius.sm,
  },
  bubbleText: {
    ...Typography.body,
    lineHeight: 22,
  },
  bubbleTextBot: {
    color: Colors.textPrimary,
  },
  bubbleTextUser: {
    color: '#fff',
  },
  /* ─── Empty state ─── */
  emptyScrollContent: {
    paddingHorizontal: CassSpacing.lg,
    paddingBottom: SPACING.xl,
    flexGrow: 1,
  },
  orbSection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl,
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
    marginTop: SPACING.md,
    fontWeight: '500',
  },
  section: {
    marginBottom: CassSpacing.xl,
  },
  sectionTitle: {
    ...Typography.caption,
    color: Colors.textMuted,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginBottom: CassSpacing.md,
    textTransform: 'uppercase',
  },
  capabilityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CassSpacing.sm,
  },
  recentChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CassSpacing.sm,
  },
  chip: {
    backgroundColor: 'rgba(139,92,246,0.15)',
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.30)',
  },
  chipMuted: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: Radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  chipText: {
    ...Typography.caption,
    color: Colors.violetLight,
    fontWeight: '500',
  },
  chipTextMuted: {
    color: Colors.textSecondary,
    fontSize: 13,
  },
  /* ─── Input Bar ─── */
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: CassSpacing.sm,
    paddingHorizontal: CassSpacing.lg,
    paddingTop: CassSpacing.md,
    borderTopWidth: 1,
    borderTopColor: CARD_SURFACES.cardBorder,
    backgroundColor: MODAL_TOKENS.sheetBg,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_SURFACES.cardBg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: CARD_SURFACES.cardBorder,
    paddingLeft: CassSpacing.md,
  },
  input: {
    flex: 1,
    height: 44,
    color: Colors.textPrimary,
    ...Typography.body,
    paddingRight: 4,
  },
  micBtnInline: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.violet,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default CassandraSessionModal;
