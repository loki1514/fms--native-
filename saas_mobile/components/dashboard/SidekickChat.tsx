'use client';
/**
 * SidekickChat — Full chat sheet matching reference design
 *
 * Slide-from-bottom sheet with:
 *  - SidekickFace in center
 *  - Status dot with pulse
 *  - "Tap face to speak" hint
 *  - Suggested question pills
 *  - Member search dropdown
 *  - Document attachment chips
 *  - Input bar with attach, member add, mic, send
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import SidekickFace, { type FaceState } from './SidekickFace';
import { useCassandraStore } from '@/stores/cassandraStore';
import { useCassandraVoice } from '@/hooks/voice/useCassandraVoice';
import { smartQuery } from '@/lib/cassandra';
import { useTextToSpeech } from '@/hooks/voice/useTextToSpeech';

const { width: SCREEN_W } = Dimensions.get('window');

const fontSans = Platform.OS === 'ios' ? 'System' : 'sans-serif';

// Pulse animation for status dot
function StatusPulseDot({ color }: { color: string }) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  React.useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(0.85, { duration: 800 }),
        withTiming(1, { duration: 800 })
      ),
      -1,
      true
    );
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.5, { duration: 800 }),
        withTiming(1, { duration: 800 })
      ),
      -1,
      true
    );
  }, [scale, opacity]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.statusDot,
        { backgroundColor: color, shadowColor: color, shadowOpacity: 1, shadowRadius: 6 },
        animStyle,
      ]}
    />
  );
}

interface SidekickChatProps {
  open: boolean;
  onClose: () => void;
  orgId: string;
}

export default function SidekickChat({ open, onClose, orgId }: SidekickChatProps) {
  const [input, setInput] = useState('');
  const [showMembers, setShowMembers] = useState(false);
  const [memberQuery, setMemberQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [docs, setDocs] = useState<string[]>([]);
  const scrollRef = useRef<ScrollView>(null);

  // ── Shared Cassandra store ────────────────────────────────────────────────
  const {
    voiceState,
    addMessage,
    connectionError,
    suggestedPrompts,
    setLastResponse,
  } = useCassandraStore();

  // ── TTS ──────────────────────────────────────────────────────────────────
  const { speak, stop: stopSpeaking } = useTextToSpeech();

  // ── Derive faceState from voiceState ────────────────────────────────────
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

  const isListening = voiceState === 'recording';

  // ── Status label ────────────────────────────────────────────────────────
  const statusLabel = (() => {
    if (connectionError) return `Error: ${connectionError}`;
    if (voiceState === 'connecting') return 'Connecting...';
    if (voiceState === 'recording') return 'Listening...';
    if (voiceState === 'processing') return 'Thinking...';
    if (voiceState === 'speaking') return 'Speaking...';
    if (voiceState === 'error') return 'Connection failed';
    return 'Tap face or mic to speak';
  })();

  const statusDotColor = connectionError || voiceState === 'error'
    ? '#D9261C'
    : voiceState === 'idle'
    ? '#1FC26E'
    : '#C4A000';

  // ── Voice session (useCassandraVoice) ───────────────────────────────────
  const { startSession, stopSession } = useCassandraVoice(orgId, {
    onStateChange: useCassandraStore.getState().setVoiceState,
    onTranscript: (text) => {
      if (text.trim()) {
        addMessage({ role: 'user', text });
      }
    },
    onAudioPlaybackEnd: () => {
      stopSpeaking();
      useCassandraStore.getState().setVoiceState('idle');
    },
    onTicketCreated: (ticketId, description) => {
      addMessage({ role: 'cassandra', text: `Ticket #${ticketId} created: ${description}` });
    },
    onError: (err) => useCassandraStore.getState().setConnectionError(err),
  });

  // ── Mic toggle ──────────────────────────────────────────────────────────
  const handleMicToggle = useCallback(async () => {
    if (voiceState === 'idle' || voiceState === 'error') {
      try {
        await startSession();
      } catch {
        useCassandraStore.getState().setConnectionError('Failed to start session');
      }
    } else if (voiceState === 'recording') {
      await stopSession();
    }
  }, [voiceState, startSession, stopSession]);

  // ── Text send ───────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    if (!input.trim()) return;
    const text = input.trim();
    setInput('');
    addMessage({ role: 'user', text });
    useCassandraStore.getState().setVoiceState('processing');

    try {
      const result = await smartQuery(text, orgId);
      const response = (result as any)?.response ?? (result as any)?.text ?? "I'm not sure how to help with that.";
      addMessage({ role: 'cassandra', text: response });
      setLastResponse(response);
      useCassandraStore.getState().setVoiceState('speaking');
      await speak(response);
      useCassandraStore.getState().setVoiceState('idle');
    } catch {
      const fallback = "I'm having trouble connecting right now. Try again?";
      addMessage({ role: 'cassandra', text: fallback });
      setLastResponse(fallback);
      useCassandraStore.getState().setVoiceState('speaking');
      await speak(fallback);
      useCassandraStore.getState().setVoiceState('idle');
    }
  }, [input, orgId, addMessage, setLastResponse, speak]);

  // ── Face tap also triggers mic ───────────────────────────────────────────
  const handleFaceTap = useCallback(async () => {
    await handleMicToggle();
  }, [handleMicToggle]);

  const handleAttach = () => {
    setDocs((d) => [...d, `Report-${Date.now()}.pdf`]);
  };

  // ── Static team list for member search (decorative) ─────────────────────
  const TEAM = [
    { id: '1', name: 'Aarav Mehta', role: 'Facility Manager' },
    { id: '2', name: 'Priya Shah', role: 'Ops Lead' },
    { id: '3', name: 'Rohan Kapoor', role: 'Engineer' },
    { id: '4', name: 'Nisha Verma', role: 'Security Head' },
    { id: '5', name: 'Devansh Iyer', role: 'Tech Support' },
    { id: '6', name: 'Kavya Nair', role: 'Housekeeping' },
  ];
  const filtered = TEAM.filter((m) =>
    m.name.toLowerCase().includes(memberQuery.toLowerCase())
  );
  const toggleMember = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <Modal
      visible={open}
      animationType="slide"
      transparent
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <BlurView intensity={90} tint="dark" style={styles.sheetContainer}>
          <View style={{ flex: 1 }}>
            {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <StatusPulseDot color={statusDotColor} />
              <Text style={styles.headerTitle}>Cassandra</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={18} color="rgba(255,255,255,0.80)" />
            </TouchableOpacity>
          </View>

          {/* Drag handle */}
          <View style={styles.dragHandle} />
          
          {/* Ambient Glow behind face */}
          <View style={styles.faceAmbientGlow} pointerEvents="none" />

          {/* Face */}
          <View style={styles.faceSection}>
            <TouchableOpacity
              onPress={handleFaceTap}
              activeOpacity={0.9}
            >
              <SidekickFace size={140} state={faceState} />
            </TouchableOpacity>
            <Text style={styles.tapHint}>{statusLabel}</Text>
          </View>

          {/* Suggested pills */}
          <View style={styles.suggestionsSection}>
            <Text style={styles.suggestionsLabel}>Based on recent chats</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.suggestionsScroll}
            >
              {suggestedPrompts.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={styles.suggestionChip}
                  onPress={() => setInput(p.text)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.suggestionText}>{p.text}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Attached docs / members */}
          {(docs.length > 0 || selected.length > 0) && (
            <View style={styles.chipsRow}>
              {docs.map((d) => (
                <View key={d} style={styles.docChip}>
                  <Ionicons name="document-text" size={12} color="#5B9AF5" />
                  <Text style={styles.docChipText}>{d}</Text>
                </View>
              ))}
              {selected.map((id) => {
                const m = TEAM.find((t) => t.id === id);
                return (
                  <View key={id} style={styles.memberChip}>
                    <Text style={styles.memberChipText}>@{m?.name.split(' ')[0]}</Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* Member dropdown */}
          {showMembers && (
            <View style={styles.memberDropdown}>
              <View style={styles.memberSearchBar}>
                <Ionicons name="search" size={16} color="rgba(255,255,255,0.50)" />
                <TextInput
                  autoFocus
                  value={memberQuery}
                  onChangeText={setMemberQuery}
                  placeholder="Search members..."
                  placeholderTextColor="rgba(255,255,255,0.40)"
                  style={styles.memberSearchInput}
                />
              </View>
              <ScrollView style={styles.memberList} nestedScrollEnabled>
                {filtered.map((m) => {
                  const isSelected = selected.includes(m.id);
                  return (
                    <TouchableOpacity
                      key={m.id}
                      style={styles.memberRow}
                      onPress={() => toggleMember(m.id)}
                    >
                      <View>
                        <Text style={styles.memberName}>{m.name}</Text>
                        <Text style={styles.memberRole}>{m.role}</Text>
                      </View>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={20} color="#1FC26E" />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Input bar */}
          <View style={styles.inputBar}>
            <TouchableOpacity onPress={handleAttach} style={styles.iconBtn} activeOpacity={0.7}>
              <Ionicons name="attach" size={20} color="rgba(255,255,255,0.70)" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowMembers((v) => !v)}
              style={[styles.iconBtn, showMembers && styles.iconBtnActive]}
              activeOpacity={0.7}
            >
              <Ionicons
                name="person-add"
                size={20}
                color={showMembers ? '#FFFFFF' : 'rgba(255,255,255,0.70)'}
              />
            </TouchableOpacity>

            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Ask Cassandra anything..."
              placeholderTextColor="rgba(255,255,255,0.40)"
              style={styles.textInput}
              multiline
              maxLength={500}
            />

            <TouchableOpacity
              onPress={handleMicToggle}
              style={[
                styles.iconBtn,
                isListening && styles.micBtnActive,
              ]}
              activeOpacity={0.7}
            >
              <Ionicons
                name="mic"
                size={20}
                color={isListening ? '#FFFFFF' : 'rgba(255,255,255,0.70)'}
              />
            </TouchableOpacity>

            <TouchableOpacity onPress={handleSend} style={styles.sendBtn} activeOpacity={0.8}>
              <Ionicons name="send" size={18} color="#0A0C14" />
            </TouchableOpacity>
          </View>
        </View>
        </BlurView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.60)',
  },
  keyboardView: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: 'rgba(10,12,20,0.7)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 34,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
    height: '92%',
  },
  faceAmbientGlow: {
    position: 'absolute',
    top: 60,
    left: SCREEN_W / 2 - 120,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(112,143,150,0.2)',
    shadowColor: '#708F96',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 60,
    elevation: 10,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontFamily: Platform.OS === 'web' ? 'Poppins' : 'System',
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.20)',
    alignSelf: 'center',
    marginBottom: 16,
  },

  // Face
  faceSection: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  tapHint: {
    fontFamily: fontSans,
    fontSize: 14,
    color: 'rgba(255,255,255,0.70)',
    marginTop: 12,
  },

  // Suggestions
  suggestionsSection: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  suggestionsLabel: {
    fontFamily: fontSans,
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.45)',
    textTransform: 'uppercase',
    letterSpacing: 0.15 * 10,
    marginBottom: 8,
  },
  suggestionsScroll: {
    gap: 8,
  },
  suggestionChip: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  suggestionText: {
    fontFamily: fontSans,
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
  },

  // Chips
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    paddingBottom: 8,
    gap: 8,
  },
  docChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(91,154,245,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(91,154,245,0.25)',
  },
  docChipText: {
    fontFamily: fontSans,
    fontSize: 12,
    color: '#5B9AF5',
  },
  memberChip: {
    backgroundColor: 'rgba(31,194,110,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(31,194,110,0.25)',
  },
  memberChipText: {
    fontFamily: fontSans,
    fontSize: 12,
    color: '#38D870',
  },

  // Member dropdown
  memberDropdown: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.10)',
    backgroundColor: '#06090F',
    maxHeight: 200,
  },
  memberSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  memberSearchInput: {
    flex: 1,
    fontFamily: fontSans,
    fontSize: 14,
    color: '#FFFFFF',
    paddingVertical: 0,
  },
  memberList: {
    maxHeight: 140,
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  memberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  memberName: {
    fontFamily: fontSans,
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  memberRole: {
    fontFamily: fontSans,
    fontSize: 12,
    color: 'rgba(255,255,255,0.50)',
    marginTop: 2,
  },

  // Input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  micBtnActive: {
    backgroundColor: 'rgba(217,38,28,0.60)',
  },
  textInput: {
    flex: 1,
    minHeight: 36,
    maxHeight: 80,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontFamily: fontSans,
    fontSize: 14,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
