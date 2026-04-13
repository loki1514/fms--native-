import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createClient } from '@/utils/supabase/client';
import { createTicket } from '@/utils/api/mobileApi';
import MediaCaptureModal, { MediaFile } from '../shared/MediaCaptureModal';
import { Video, ResizeMode } from 'expo-av';
import { useTheme } from '@/context';
import {
  classifyTicket,
  getSkillGroupDisplayName,
  getSkillGroupColor,
  getIssueCodeDisplayName,
  ClassificationResult,
} from '@/utils/ticketing/classifyTicket';

interface TicketCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  propertyId: string;
  organizationId: string;
  onSuccess?: (ticket: any) => void;
  isAdminMode?: boolean;
}

export default function TicketCreateModal({
  isOpen,
  onClose,
  propertyId,
  organizationId,
  onSuccess,
  isAdminMode = false,
}: TicketCreateModalProps) {
  const supabase = createClient();
  const { isDark, colors } = useTheme();

  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [location, setLocation] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [media, setMedia] = useState<MediaFile | null>(null);
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Classification preview state
  const [classification, setClassification] = useState<ClassificationResult | null>(null);
  const [isClassifying, setIsClassifying] = useState(false);
  const classifyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mentions
  const [propertyUsers, setPropertyUsers] = useState<{ id: string; full_name: string; role?: string }[]>([]);
  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [taggedUser, setTaggedUser] = useState<{ id: string; full_name: string } | null>(null);

  useEffect(() => {
    if (!propertyId || !isOpen) return;
    const fetchUsers = async () => {
      const { data } = await (supabase
        .from('property_memberships')
        .select('user:users(id, full_name), role')
        .eq('property_id', propertyId)
        .eq('is_active', true) as any);

      const users = (data || [])
        .map((m: any) => ({
          id: m.user?.id,
          full_name: m.user?.full_name,
          role: m.role,
        }))
        .filter((u: any) => u.id && u.full_name);
      setPropertyUsers(users);
    };
    fetchUsers();
  }, [propertyId, isOpen]);

  // Debounced classification as user types
  useEffect(() => {
    if (!description.trim() || description.trim().length < 5) {
      setClassification(null);
      setIsClassifying(false);
      return;
    }

    setIsClassifying(true);
    if (classifyTimeoutRef.current) {
      clearTimeout(classifyTimeoutRef.current);
    }

    classifyTimeoutRef.current = setTimeout(async () => {
      const result = await classifyTicket(description);
      setClassification(result);
      setIsClassifying(false);
    }, 400);

    return () => {
      if (classifyTimeoutRef.current) {
        clearTimeout(classifyTimeoutRef.current);
      }
    };
  }, [description]);

  const handleTextChange = (text: string) => {
    setDescription(text);
    const lastAt = text.lastIndexOf('@');
    if (lastAt !== -1) {
      const query = text.slice(lastAt + 1);
      if (!query.includes(' ') && !query.includes('\n')) {
        setMentionQuery(query);
        setShowMentionDropdown(true);
        return;
      }
    }
    setShowMentionDropdown(false);
  };

  const selectMention = (user: { id: string; full_name: string }) => {
    const lastAt = description.lastIndexOf('@');
    const before = description.slice(0, lastAt);
    setDescription(`${before}@${user.full_name} `);
    setTaggedUser(user);
    setShowMentionDropdown(false);
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      setError('Please describe the issue');
      return;
    }
    setIsSubmitting(true);
    setError(null);

    try {
      const title = description.split('\n')[0].slice(0, 80);

      const result = await createTicket({
        description: description.trim(),
        title,
        propertyId,
        organizationId,
        isInternal,
        priority,
        assignedTo: taggedUser?.id,
      });

      if (result.error) {
        throw new Error(result.error);
      }

      setSuccess(true);
      onSuccess?.(result.ticket);
      setTimeout(() => {
        handleReset();
        onClose();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to create ticket');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setDescription('');
    setPriority('medium');
    setLocation('');
    setIsInternal(false);
    setMedia(null);
    setClassification(null);
    setSuccess(false);
    setError(null);
    setTaggedUser(null);
    setShowMentionDropdown(false);
  };

  const sgColor = classification ? getSkillGroupColor(classification.skill_group) : null;
  const hasContent = description.trim().length >= 5;

  // Dark mode surface/border from theme
  const cardBg = isDark ? '#1E2535' : '#FFFFFF';
  const cardBorder = isDark ? '#2D3748' : '#E2E8F0';
  const inputBg = isDark ? '#141820' : '#F8FAFC';
  const inputBorder = isDark ? '#2D3748' : '#E2E8F0';
  const mutedText = isDark ? '#94A3B8' : '#64748B';

  return (
    <Modal visible={isOpen} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: isDark ? colors.background : '#F8FAFC' }]}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: cardBorder }]}>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={mutedText} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Raise Request</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView style={styles.form} contentContainerStyle={{ padding: 20 }}>
            {success ? (
              <View style={styles.successView}>
                <View style={[styles.successIconWrap, { backgroundColor: isDark ? '#064E3B' : '#D1FAE5' }]}>
                  <Ionicons name="checkmark-circle" size={80} color="#10B981" />
                </View>
                <Text style={[styles.successText, { color: colors.textPrimary }]}>Request Submitted!</Text>
                <Text style={[styles.successSubText, { color: mutedText }]}>
                  Your ticket has been created and assigned.
                </Text>
                {classification && (
                  <View style={[styles.successBadge, { backgroundColor: sgColor?.bg, borderColor: sgColor?.border }]}>
                    <Text style={[styles.successBadgeText, { color: sgColor?.text }]}>
                      {getSkillGroupDisplayName(classification.skill_group)} — {getIssueCodeDisplayName(classification.issue_code)}
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              <>
                {/* Classification Preview */}
                {hasContent && (
                  <View style={[styles.classificationCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                    <View style={styles.classificationHeader}>
                      <Ionicons name="bulb-outline" size={14} color={colors.primary} />
                      <Text style={[styles.classificationLabel, { color: colors.primary }]}>AI Classification</Text>
                      {isClassifying && <ActivityIndicator size="small" color={colors.primary} />}
                    </View>

                    {classification ? (
                      <View style={styles.classificationResult}>
                        <View style={[styles.sgBadge, { backgroundColor: sgColor?.bg, borderColor: sgColor?.border }]}>
                          <Text style={[styles.sgBadgeText, { color: sgColor?.text }]}>
                            {getSkillGroupDisplayName(classification.skill_group)}
                          </Text>
                        </View>
                        <View style={[styles.issueBadge, { backgroundColor: isDark ? '#1C2530' : '#F1F5F9', borderColor: cardBorder }]}>
                          <Text style={[styles.issueBadgeText, { color: colors.textPrimary }]}>
                            {getIssueCodeDisplayName(classification.issue_code)}
                          </Text>
                        </View>
                        <View style={[styles.confidenceBadge, {
                          backgroundColor: classification.confidence === 'high'
                            ? 'rgba(16,185,129,0.1)'
                            : 'rgba(245,158,11,0.1)',
                          borderColor: classification.confidence === 'high'
                            ? 'rgba(16,185,129,0.2)'
                            : 'rgba(245,158,11,0.2)',
                        }]}>
                          <Text style={[styles.confidenceText, {
                            color: classification.confidence === 'high' ? '#10B981' : '#F59E0B',
                          }]}>
                            {classification.confidence === 'high' ? 'High confidence' : 'Low confidence — will be reviewed'}
                          </Text>
                        </View>
                      </View>
                    ) : (
                      <Text style={[styles.classifyingText, { color: mutedText }]}>
                        Analyzing description...
                      </Text>
                    )}
                  </View>
                )}

                {/* Priority Selection */}
                <View style={styles.field}>
                  <Text style={[styles.label, { color: mutedText }]}>Priority</Text>
                  <View style={styles.chipRow}>
                    {(['low', 'medium', 'high', 'critical'] as const).map(p => {
                      const pc = {
                        low:      { bg: isDark ? '#1E2D1E' : '#F0FDF4', border: isDark ? '#22543D' : '#BBF7D0', text: '#22C55E' },
                        medium:   { bg: isDark ? '#2D2A1E' : '#FFFBEB', border: isDark ? '#92400E' : '#FDE68A', text: '#F59E0B' },
                        high:     { bg: isDark ? '#2D1E1E' : '#FFF7ED', border: isDark ? '#991B1B' : '#FDBA74', text: '#F97316' },
                        critical: { bg: isDark ? '#2D1E1E' : '#FEF2F2', border: isDark ? '#7F1D1D' : '#FECACA', text: '#EF4444' },
                      }[p];
                      return (
                        <TouchableOpacity
                          key={p}
                          style={[
                            styles.chip,
                            {
                              backgroundColor: priority === p ? pc.bg : (isDark ? '#1E2535' : '#F1F5F9'),
                              borderColor: priority === p ? pc.border : inputBorder,
                            },
                          ]}
                          onPress={() => setPriority(p)}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              { color: priority === p ? pc.text : mutedText },
                              priority === p && { fontWeight: '700' },
                            ]}
                          >
                            {p.charAt(0).toUpperCase() + p.slice(1)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Description */}
                <View style={styles.field}>
                  <Text style={[styles.label, { color: mutedText }]}>Description</Text>
                  <View style={styles.inputWrapper}>
                    <TextInput
                      style={[
                        styles.textArea,
                        {
                          backgroundColor: inputBg,
                          borderColor: inputBorder,
                          color: colors.textPrimary,
                        },
                      ]}
                      placeholder="Describe the issue... (use @ to tag)"
                      placeholderTextColor={mutedText}
                      multiline
                      value={description}
                      onChangeText={handleTextChange}
                    />

                    {/* Mention Dropdown */}
                    {showMentionDropdown && (
                      <View style={[styles.mentionOverlay, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                        {propertyUsers
                          .filter(u => u.full_name.toLowerCase().includes(mentionQuery.toLowerCase()))
                          .slice(0, 5)
                          .map(user => (
                            <TouchableOpacity
                              key={user.id}
                              style={[styles.mentionItem, { borderBottomColor: cardBorder }]}
                              onPress={() => selectMention(user)}
                            >
                              <View style={[styles.avatarMini, { backgroundColor: colors.primary }]}>
                                <Text style={styles.avatarText}>
                                  {user.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                                </Text>
                              </View>
                              <View>
                                <Text style={[styles.mentionName, { color: colors.textPrimary }]}>{user.full_name}</Text>
                                <Text style={[styles.mentionRole, { color: mutedText }]}>
                                  {user.role?.replace(/_/g, ' ')}
                                </Text>
                              </View>
                            </TouchableOpacity>
                          ))}
                      </View>
                    )}
                  </View>
                </View>

                {/* Location */}
                <View style={styles.field}>
                  <Text style={[styles.label, { color: mutedText }]}>Location / Unit (optional)</Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: inputBg,
                        borderColor: inputBorder,
                        color: colors.textPrimary,
                      },
                    ]}
                    placeholder="e.g. Conference Room B, Level 2"
                    placeholderTextColor={mutedText}
                    value={location}
                    onChangeText={setLocation}
                  />
                </View>

                {/* Tagged user chip */}
                {taggedUser && (
                  <View style={styles.taggedRow}>
                    <View style={[styles.taggedChip, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '30' }]}>
                      <Ionicons name="at" size={12} color={colors.primary} />
                      <Text style={[styles.taggedChipText, { color: colors.primary }]}>{taggedUser.full_name}</Text>
                      <TouchableOpacity onPress={() => {
                        setTaggedUser(null);
                        setDescription(d =>
                          d.replace(`@${taggedUser.full_name} `, '').replace(`@${taggedUser.full_name}`, ''),
                        );
                      }}>
                        <Ionicons name="close-circle" size={14} color={colors.primary} />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* Internal Toggle */}
                <View style={[styles.toggleRow, { backgroundColor: inputBg, borderColor: inputBorder }]}>
                  <View>
                    <Text style={[styles.toggleLabel, { color: colors.textPrimary }]}>Internal Ticket</Text>
                    <Text style={[styles.toggleSubLabel, { color: mutedText }]}>Not visible to tenants</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.toggle, isInternal ? { backgroundColor: '#F59E0B' } : { backgroundColor: inputBorder }]}
                    onPress={() => setIsInternal(!isInternal)}
                  >
                    <View style={[styles.toggleCircle, isInternal && styles.toggleCircleActive]} />
                  </TouchableOpacity>
                </View>

                {/* Media Attachment */}
                <View style={[styles.field, { marginTop: 20 }]}>
                  <Text style={[styles.label, { color: mutedText }]}>Proof Attachment</Text>
                  {media ? (
                    <View style={styles.mediaPreview}>
                      {media.type === 'image' ? (
                        <Image source={{ uri: media.uri }} style={styles.previewContent} />
                      ) : (
                        <Video
                          source={{ uri: media.uri }}
                          style={styles.previewContent}
                          resizeMode={ResizeMode.COVER}
                          shouldPlay={false}
                        />
                      )}
                      <TouchableOpacity style={styles.removeMedia} onPress={() => setMedia(null)}>
                        <Ionicons name="close" size={16} color="#FFF" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[styles.mediaPlaceholder, { borderColor: inputBorder, backgroundColor: inputBg }]}
                      onPress={() => setShowMediaModal(true)}
                    >
                      <Ionicons name="camera-outline" size={32} color={mutedText} />
                      <Text style={[styles.mediaPlaceholderText, { color: mutedText }]}>Add Photo or Video</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Submit Action */}
                <TouchableOpacity
                  style={[
                    styles.submitBtn,
                    (!description.trim() || isSubmitting) && styles.submitBtnDisabled,
                    { backgroundColor: colors.primary },
                  ]}
                  onPress={handleSubmit}
                  disabled={isSubmitting || !description.trim()}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <>
                      <Text style={styles.submitBtnText}>Submit Request</Text>
                      <Ionicons name="arrow-forward" size={18} color="#FFF" />
                    </>
                  )}
                </TouchableOpacity>

                {error && (
                  <View style={[styles.errorRow, { backgroundColor: isDark ? '#2D1B1B' : '#FEF2F2', borderColor: isDark ? '#7F1D1D' : '#FECACA' }]}>
                    <Ionicons name="alert-circle" size={16} color="#EF4444" />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>

        <MediaCaptureModal
          isOpen={showMediaModal}
          onClose={() => setShowMediaModal(false)}
          onCapture={setMedia}
          title="Capture Evidence"
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  form: { flex: 1 },
  field: { marginBottom: 12 },
  label: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  inputWrapper: { position: 'relative', zIndex: 10 },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    fontSize: 15,
  },
  textArea: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    fontSize: 15,
    height: 140,
    textAlignVertical: 'top',
  },
  mentionOverlay: {
    position: 'absolute',
    top: 145,
    left: 0,
    right: 0,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
    zIndex: 20,
  },
  mentionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderBottomWidth: 1,
  },
  avatarMini: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  mentionName: { fontSize: 14, fontWeight: '700' },
  mentionRole: { fontSize: 10, textTransform: 'uppercase' },
  taggedRow: { flexDirection: 'row', marginTop: 8, marginBottom: 4 },
  taggedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  taggedChipText: { fontSize: 12, fontWeight: '700' },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 8,
  },
  toggleLabel: { fontSize: 14, fontWeight: '800' },
  toggleSubLabel: { fontSize: 12 },
  toggle: {
    width: 48,
    height: 24,
    borderRadius: 12,
    padding: 2,
  },
  toggleActive: { backgroundColor: '#F59E0B' },
  toggleCircle: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFF' },
  toggleCircleActive: { transform: [{ translateX: 24 }] },
  classificationCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
  },
  classificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  classificationLabel: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    flex: 1,
  },
  classificationResult: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  sgBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  sgBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  issueBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  issueBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  confidenceBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  confidenceText: {
    fontSize: 10,
    fontWeight: '600',
  },
  classifyingText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  mediaPlaceholder: {
    height: 140,
    borderStyle: 'dashed',
    borderWidth: 2,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  mediaPlaceholderText: { fontSize: 13, fontWeight: '700' },
  mediaPreview: {
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  previewContent: { width: '100%', height: '100%' },
  removeMedia: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitBtn: {
    flexDirection: 'row',
    padding: 18,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginTop: 32,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 12,
  },
  errorText: { color: '#EF4444', fontSize: 12, fontWeight: '700', flex: 1 },
  successView: { alignItems: 'center', paddingVertical: 40 },
  successIconWrap: { width: 120, height: 120, borderRadius: 60, justifyContent: 'center', alignItems: 'center' },
  successText: { fontSize: 20, fontWeight: '900', marginTop: 24 },
  successSubText: { fontSize: 14, textAlign: 'center', marginTop: 8 },
  successBadge: {
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  successBadgeText: { fontSize: 12, fontWeight: '700' },
});
