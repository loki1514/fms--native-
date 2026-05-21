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
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCassandraStore } from '@/stores/cassandraStore';
import { useAuth } from '@/hooks/useAuth';
// All chat goes through ONE endpoint: POST /chat
// No client-side tool routing.
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
import Svg, { Path, Circle } from 'react-native-svg';
import { streamChat } from '@/services/cassandra/chat';
import {
  createChatSession,
  listChatSessions,
  getChatSession,
  addChatMessage,
  updateChatSessionTitle,
  deleteChatSession,
} from '@/lib/cassandra';
import type { ChatSession, ChatMessage as ChatMessageType } from '@/lib/cassandra';

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
    <Circle cx="12" cy="7" r="4" />
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
  { label: 'Triage tickets', message: 'Show me critical and high-priority open tickets' },
  { label: 'Explain energy spikes', message: 'Explain recent energy spikes at this property' },
  { label: 'Find on-call staff', message: 'Who is on call right now?' },
  { label: 'Summarise reports', message: 'Summarise this week\'s reports' },
];

const MST_SKILLS = [
  { label: 'My tickets', message: 'Show my active tickets' },
  { label: 'Shift status', message: 'Am I checked in?' },
  { label: 'Leaderboard', message: 'Show team leaderboard' },
];

const RECENT_CHATS = [
  { label: 'Show critical tickets at SS Plaza', message: 'Show critical tickets at SS Plaza' },
  { label: 'Energy spike yesterday — why?', message: 'Why was there an energy spike yesterday?' },
  { label: 'Open checklist items for today', message: 'Open checklist items for today' },
  { label: 'Compare health across properties', message: 'Compare health scores across properties' },
  { label: 'Who\'s on call for Bajaj Kolkata?', message: 'Who is on call for Bajaj Kolkata?' },
];

// ─── Main Modal ────────────────────────────────────────────────────────────
interface CassandraSessionModalProps {
  visible: boolean;
  onClose: () => void;
  orgId: string;
  propertyId?: string;
  initialMode?: 'text' | 'voice';
}

export const CassandraSessionModal: React.FC<CassandraSessionModalProps> = ({
  visible,
  onClose,
  orgId,
  propertyId,
  initialMode = 'text',
}) => {
  console.log('[CassandraSessionModal] render. visible:', visible, 'orgId:', orgId, 'propertyId:', propertyId);
  const { user } = useAuth();
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
  const [isTyping, setIsTyping] = useState(false);
  const [currentResponse, setCurrentResponse] = useState('');
  const [view, setView] = useState<'home' | 'chat' | 'history'>('home');
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const sessionId = useRef(Math.random().toString(36).slice(2)).current;
  const scrollRef = useRef<ScrollView>(null);
  const orbScale = useRef(new Animated.Value(1)).current;
  const abortRef = useRef<AbortController | null>(null);
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

  useEffect(() => () => abortRef.current?.abort(), []);

  // ─── Session management ────────────────────────────────────────────────────

  useEffect(() => {
    if (visible && view === 'home' && !currentSessionId && user?.id) {
      createChatSession(user.id, orgId, 'New Chat', propertyId).then((session) => {
        setCurrentSessionId(session.id);
      }).catch(() => {
        // Fallback: use local session id
        setCurrentSessionId(sessionId);
      });
    }
  }, [visible, view, currentSessionId, user?.id, orgId, propertyId]);

  useEffect(() => {
    if (!visible) {
      setView('home');
      setCurrentSessionId(null);
      voice.endSession();
      stopSpeaking();
      setVoiceState('idle');
    }
  }, [visible]);

  useEffect(() => {
    if (visible && initialMode === 'voice' && voiceState === 'idle') {
      setInputMode('voice');
      voice.startSession();
    }
  }, [visible, initialMode]);

  const loadHistory = useCallback(async () => {
    if (!user?.id) return;
    setIsLoadingHistory(true);
    try {
      const data = await listChatSessions(user.id, orgId);
      setSessions(data);
    } catch (err) {
      toast.error('Failed to load chat history');
    } finally {
      setIsLoadingHistory(false);
    }
  }, [user?.id, orgId]);

  const persistMessage = useCallback(async (role: string, text: string) => {
    if (!currentSessionId) return;
    try {
      await addChatMessage(currentSessionId, role, text);
    } catch {
      // Silently fail persistence — local state is source of truth
    }
  }, [currentSessionId]);

  const loadSession = useCallback(async (sessionId: string) => {
    try {
      const session = await getChatSession(sessionId);
      useCassandraStore.getState().clearMessages();
      session.messages.forEach((msg) => {
        useCassandraStore.getState().addMessage({ role: msg.role as 'user' | 'cassandra', text: msg.text });
      });
      setCurrentSessionId(session.id);
      setView('chat');
    } catch {
      toast.error('Failed to load session');
    }
  }, []);

  const handleNewChat = useCallback(() => {
    useCassandraStore.getState().clearMessages();
    setCurrentSessionId(null);
    setView('home');
  }, []);

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

  const handleSend = useCallback((message: string) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setIsTyping(true);
    setView('chat');
    let fullResponse = '';

    streamChat(
      message,
      sessionId,
      (token) => {
        fullResponse += token;
        setCurrentResponse(fullResponse);
      },
      async () => {
        addMessage({ role: 'cassandra', text: fullResponse });
        persistMessage('cassandra', fullResponse);
        setCurrentResponse('');
        setIsTyping(false);
        // Speak the response if voice mode is active
        if (inputMode === 'voice') {
          setVoiceState('speaking');
          await speak(fullResponse);
          setVoiceState('idle');
        }
      },
      (err) => {
        setCurrentResponse(err);
        setIsTyping(false);
      },
      abortRef.current.signal
    );
  }, [sessionId, addMessage, inputMode, speak, setVoiceState]);

  // All skill chips just send a pre-filled message to /chat — no client-side routing.

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
            {view === 'chat' ? (
              <>
                <TouchableOpacity onPress={() => setView('home')} activeOpacity={0.7} style={styles.headerBackBtn}>
                  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={Colors.textPrimary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M19 12H5M12 19l-7-7 7-7" />
                  </Svg>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Cassandra</Text>
                <TouchableOpacity onPress={() => { loadHistory(); setView('history'); }} activeOpacity={0.7} style={styles.headerMenuBtn}>
                  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={Colors.textPrimary} strokeWidth="2" strokeLinecap="round">
                    <Path d="M3 12h18M3 6h18M3 18h18" />
                  </Svg>
                </TouchableOpacity>
              </>
            ) : view === 'history' ? (
              <>
                <TouchableOpacity onPress={() => setView('chat')} activeOpacity={0.7} style={styles.headerBackBtn}>
                  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={Colors.textPrimary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M19 12H5M12 19l-7-7 7-7" />
                  </Svg>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Chat History</Text>
                <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={styles.closeBtn}>
                  <CloseIcon />
                </TouchableOpacity>
              </>
            ) : (
              <>
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
              </>
            )}
          </View>
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={80}
        >
          {view === 'history' ? (
            /* ─── HISTORY VIEW: previous sessions ─── */
            <View style={styles.flex}>
              <View style={styles.historyHeader}>
                <TouchableOpacity onPress={handleNewChat} activeOpacity={0.7} style={styles.newChatBtn}>
                  <Text style={styles.newChatBtnText}>+ New Chat</Text>
                </TouchableOpacity>
              </View>
              {isLoadingHistory ? (
                <View style={styles.centered}>
                  <Text style={styles.loadingText}>Loading…</Text>
                </View>
              ) : sessions.length === 0 ? (
                <View style={styles.centered}>
                  <Text style={styles.emptyText}>No previous chats</Text>
                </View>
              ) : (
                <ScrollView style={styles.flex} showsVerticalScrollIndicator={false}>
                  {sessions.map((session) => (
                    <TouchableOpacity
                      key={session.id}
                      style={styles.historyItem}
                      onPress={() => loadSession(session.id)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.historyItemContent}>
                        <Text style={styles.historyItemTitle} numberOfLines={1}>{session.title}</Text>
                        <Text style={styles.historyItemDate}>{new Date(session.updated_at * 1000).toLocaleDateString()}</Text>
                      </View>
                      <TouchableOpacity
                        onPress={(e) => { e.stopPropagation(); deleteChatSession(session.id).then(() => loadHistory()).catch(() => {}); }}
                        activeOpacity={0.7}
                        style={styles.historyDeleteBtn}
                      >
                        <Text style={styles.historyDeleteText}>×</Text>
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>
          ) : view === 'chat' ? (
            /* ─── CHAT MODE: bottom-aligned messages ─── */
            <ScrollView
              ref={scrollRef}
              style={styles.flex}
              contentContainerStyle={styles.chatScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {messageHistory.map((msg) => (
                <ChatBubble key={msg.id} message={msg as ChatMessage} />
              ))}
              {isTyping && (
                <View style={[styles.bubbleRow, styles.bubbleRowLeft]}>
                  <View style={[styles.bubble, styles.bubbleBot]}>
                    <Text style={[styles.bubbleText, styles.bubbleTextBot]}>
                      {currentResponse || 'Cassandra is typing…'}
                    </Text>
                  </View>
                </View>
              )}
              {/* Suggestions strip at bottom of chat */}
              {!isTyping && (
                <View style={styles.suggestionsStrip}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionsStripContent} showsVerticalScrollIndicator={false}>
                    {WHAT_I_CAN_DO.map((item) => (
                      <SkillChip key={item.label} label={item.label} onPress={() => { addMessage({ role: 'user', text: item.message }); setView('chat'); handleSend(item.message); }} />
                    ))}
                    {propertyId && MST_SKILLS.map((item) => (
                      <SkillChip key={item.label} label={item.label} onPress={() => { addMessage({ role: 'user', text: item.message }); setView('chat'); handleSend(item.message); }} />
                    ))}
                  </ScrollView>
                </View>
              )}
            </ScrollView>
          ) : (
            /* ─── HOME VIEW: orb + suggestions ─── */
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
                      onPress={() => { addMessage({ role: 'user', text: item.message }); setView('chat'); handleSend(item.message); }}
                    />
                  ))}
                  {propertyId && MST_SKILLS.map((item) => (
                    <SkillChip
                      key={item.label}
                      label={item.label}
                      variant="muted"
                      onPress={() => { addMessage({ role: 'user', text: item.message }); setView('chat'); handleSend(item.message); }}
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
                      onPress={() => { addMessage({ role: 'user', text: item.message }); setView('chat'); handleSend(item.message); }}
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
            {/* Attachment & mention buttons hidden until wired */}
            {/* <TouchableOpacity activeOpacity={0.7} style={styles.iconBtn}><AttachmentIcon size={20} /></TouchableOpacity> */}
            {/* <TouchableOpacity activeOpacity={0.7} style={styles.iconBtn}><PersonIcon size={20} /></TouchableOpacity> */}
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                value={inputText}
                onChangeText={setInputText}
                placeholder="Ask Sidekick anything…"
                placeholderTextColor={Colors.textMuted}
                onSubmitEditing={() => { const text = inputText.trim(); if (text) { addMessage({ role: 'user', text }); setInputText(''); setView('chat'); handleSend(text); } }}
                returnKeyType="send"
              />
              <TouchableOpacity onPress={handleOrbPress} activeOpacity={0.8} style={styles.micBtnInline}>
                <MicIcon size={16} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={() => { const text = inputText.trim(); if (text) { addMessage({ role: 'user', text }); setInputText(''); setView('chat'); handleSend(text); } }} activeOpacity={0.7} style={styles.sendBtn}>
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
    paddingHorizontal: CassSpacing.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
    flexGrow: 1,
    justifyContent: 'flex-end',
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
  headerBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: CARD_SURFACES.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: CARD_SURFACES.cardBorder,
  },
  headerMenuBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: CARD_SURFACES.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: CARD_SURFACES.cardBorder,
  },
  historyHeader: {
    paddingHorizontal: CassSpacing.lg,
    paddingVertical: CassSpacing.md,
  },
  newChatBtn: {
    backgroundColor: Colors.violet,
    borderRadius: Radius.lg,
    paddingHorizontal: CassSpacing.lg,
    paddingVertical: CassSpacing.md,
    alignItems: 'center',
  },
  newChatBtnText: {
    ...Typography.body,
    color: '#fff',
    fontWeight: '600',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    ...Typography.body,
    color: Colors.textMuted,
  },
  emptyText: {
    ...Typography.body,
    color: Colors.textMuted,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: CassSpacing.lg,
    paddingVertical: CassSpacing.md,
    borderBottomWidth: 1,
    borderBottomColor: CARD_SURFACES.cardBorder,
  },
  historyItemContent: {
    flex: 1,
  },
  historyItemTitle: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  historyItemDate: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: 2,
  },
  historyDeleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(239,68,68,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyDeleteText: {
    color: '#ef4444',
    fontSize: 18,
    fontWeight: '600',
  },
  suggestionsStrip: {
    paddingVertical: CassSpacing.md,
    paddingHorizontal: CassSpacing.lg,
  },
  suggestionsStripContent: {
    gap: CassSpacing.sm,
  },
});

export default CassandraSessionModal;
