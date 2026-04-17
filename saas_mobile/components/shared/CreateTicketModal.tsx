import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Image,
  Switch,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RotatingBorder } from './RotatingBorder';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/context';
import MediaCaptureModal, { MediaFile } from './MediaCaptureModal';
import { createTicket } from '@/utils/api/mobileApi';

interface CreateTicketModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  propertyId: string;
}

interface Member {
  id: string;
  full_name: string;
  role: string | null;
  user_photo_url: string | null;
}

export default function CreateTicketModal({ visible, onClose, onSuccess, propertyId }: CreateTicketModalProps) {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const supabase = createClient();

  // ── Form State ──
  const [description, setDescription] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [mediaFile, setMediaFile] = useState<MediaFile | null>(null);
  const [taggedUser, setTaggedUser] = useState<Member | null>(null);

  // ── UI State ──
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [classificationInfo, setClassificationInfo] = useState<string | null>(null);

  // ── @Mention State ──
  const [propertyMembers, setPropertyMembers] = useState<Member[]>([]);
  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [inputLayout, setInputLayout] = useState({ width: 0, height: 0 });
  const inputRef = useRef<TextInput>(null);

  // ── Org ID ──
  const [orgId, setOrgId] = useState<string | null>(null);

  useEffect(() => {
    if (visible && propertyId) {
      fetchMembers();
      resolveOrgId();
    }
    if (!visible) resetForm();
  }, [visible, propertyId]);

  const resolveOrgId = async () => {
    const { data } = await (supabase
      .from('properties')
      .select('organization_id')
      .eq('id', propertyId)
      .single() as unknown) as { data: { organization_id: string } | null };
    if (data) setOrgId(data.organization_id);
  };

  const fetchMembers = async () => {
    const { data } = await supabase
      .from('property_memberships')
      .select('role, user:users(id, full_name, user_photo_url)')
      .eq('property_id', propertyId)
      .eq('is_active', true);

    if (data) {
      const members = data
        .map((m: any) => ({
          id: m.user?.id,
          full_name: m.user?.full_name,
          role: m.role,
          user_photo_url: m.user?.user_photo_url,
        }))
        .filter((u: any) => u.id && u.full_name);
      setPropertyMembers(members);
    }
  };

  /* ─── @Mention Logic ─────────────────────────────────────────────────────── */

  const handleDescriptionChange = (text: string) => {
    setDescription(text);
    const cursorPos = text.length;
    const textBeforeCursor = text.slice(0, cursorPos);
    const atIndex = textBeforeCursor.lastIndexOf('@');

    if (atIndex !== -1) {
      const query = textBeforeCursor.slice(atIndex + 1);
      if (!query.includes(' ') && !query.includes('\n')) {
        setMentionQuery(query);
        setMentionStartIndex(atIndex);
        setShowMentionDropdown(true);
        return;
      }
    }
    setShowMentionDropdown(false);
    setMentionQuery('');

    if (taggedUser && !text.includes(`@${taggedUser.full_name}`)) {
      setTaggedUser(null);
    }
  };

  const selectMention = (member: Member) => {
    const textBefore = description.slice(0, mentionStartIndex);
    const textAfter = description.slice(mentionStartIndex + 1 + mentionQuery.length);
    setDescription(`${textBefore}@${member.full_name} ${textAfter}`);
    setTaggedUser(member);
    setShowMentionDropdown(false);
    setMentionQuery('');
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const filteredMembers = mentionQuery
    ? propertyMembers.filter(m => m.full_name.toLowerCase().includes(mentionQuery.toLowerCase()))
    : propertyMembers;

  /* ─── Submit with Native AI Classification ───────────────────────────────── */

  const submitTicket = async () => {
    if (!description.trim()) { setErrorMsg('Please describe the issue.'); return; }
    if (!orgId) { setErrorMsg('Organization context not found.'); return; }

    setIsSubmitting(true);
    setErrorMsg(null);
    setClassificationInfo('Classifying with AI...');

    try {
      // Call web API — handles Groq LLM classification server-side with GROQ_API_KEY
      const title = description.split('\n')[0].slice(0, 100) || 'Untitled Request';
      const response = await createTicket({
        description: description.trim(),
        title,
        propertyId,
        organizationId: orgId,
        isInternal,
        priority: undefined,
        assignedTo: taggedUser?.id || undefined,
      });

      if (response.error) {
        throw new Error(response.error);
      }

      const ticket = response.ticket;
      const classification = response.classification;

      // Show LLM classification result
      const skillGroup = ticket?.skill_group_code?.replace(/_/g, ' ') || classification?.skill_group?.replace(/_/g, ' ') || 'Unknown';
      const priority = classification?.priority || ticket?.priority || 'Medium';
      setClassificationInfo(`Classified: ${skillGroup} • ${priority}`);

      // Upload media as before photo/video (uses ticket ID from API response)
      if (mediaFile && ticket?.id) {
        try {
          setClassificationInfo('Uploading media...');
          const isImage = mediaFile.type === 'image';
          const ext = isImage ? 'jpg' : 'mp4';
          const bucketName = isImage ? 'ticket_photos' : 'ticket_videos';
          const path = `${propertyId}/${ticket.id}/before_${Date.now()}.${ext}`;

          const fileResponse = await fetch(mediaFile.uri);
          const blob = await fileResponse.blob();

          const { error: uploadErr } = await supabase.storage
            .from(bucketName)
            .upload(path, blob, {
              contentType: isImage ? 'image/jpeg' : 'video/mp4',
              cacheControl: '3600',
              upsert: true,
            });

          if (!uploadErr) {
            const { data: { publicUrl } } = supabase.storage.from(bucketName).getPublicUrl(path);
            const field = isImage ? 'photo_before_url' : 'video_before_url';
            await (supabase.from('tickets') as any)
              .update({ [field]: publicUrl })
              .eq('id', ticket.id);
          } else {
            console.warn('[CreateTicket] Media upload failed:', uploadErr);
          }
        } catch (mediaErr) {
          console.warn('[CreateTicket] Media upload error (ticket still created):', mediaErr);
        }
      }

      setShowSuccess(true);
      setClassificationInfo(null);
      setTimeout(() => {
        resetForm();
        onSuccess?.();
        onClose();
      }, 1800);
    } catch (err: any) {
      setErrorMsg(err.message || 'Something went wrong.');
      setClassificationInfo(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setDescription('');
    setIsInternal(false);
    setMediaFile(null);
    setTaggedUser(null);
    setShowMentionDropdown(false);
    setMentionQuery('');
    setErrorMsg(null);
    setShowSuccess(false);
    setClassificationInfo(null);
  };

  /* ─── Colors ─────────────────────────────────────────────────────────────── */
  const bg = isDark ? '#0F1521' : '#FFF';
  const inputBg = isDark ? '#1E2633' : '#F8FAFC';
  const borderColor = isDark ? 'rgba(80,100,130,0.30)' : 'rgba(180,195,210,0.35)';
  const textPrimary = isDark ? '#F0F4F8' : '#1A2332';
  const textSecondary = isDark ? '#A0AEC0' : '#64748B';

  /* ─── Render ─────────────────────────────────────────────────────────────── */
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: bg, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>

          {/* Header */}
          <View style={[styles.header, { borderBottomColor: borderColor }]}>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="close" size={24} color={textPrimary} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: textPrimary }]}>Raise a Request</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView style={styles.formScroll} contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">

            {showSuccess ? (
              <View style={styles.successView}>
                <Ionicons name="checkmark-circle" size={72} color="#10B981" />
                <Text style={[styles.successTitle, { color: textPrimary }]}>Request Submitted!</Text>
                <Text style={styles.successSubtitle}>Auto-classified and will be assigned shortly.</Text>
              </View>
            ) : (
              <>
                {/* Assigned Tag */}
                {taggedUser && (
                  <View style={styles.assignedRow}>
                    <Text style={styles.assignedLabel}>Assigned to</Text>
                    <View style={styles.assignedChip}>
                      <View style={styles.assignedAvatar}>
                        <Text style={styles.assignedAvatarLetter}>{taggedUser.full_name.charAt(0).toUpperCase()}</Text>
                      </View>
                      <Text style={styles.assignedChipName}>{taggedUser.full_name}</Text>
                      <TouchableOpacity onPress={() => {
                        setTaggedUser(null);
                        setDescription(prev => prev.replace(`@${taggedUser.full_name} `, '').replace(`@${taggedUser.full_name}`, ''));
                      }}>
                        <Ionicons name="close-circle" size={18} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* Description */}
                <View style={styles.fieldBlock}>
                  <View style={styles.labelRow}>
                    <Text style={[styles.fieldLabel, { color: textSecondary }]}>What's the issue?</Text>
                    <Text style={styles.hintText}>type <Text style={styles.hintAt}>@</Text> to assign</Text>
                  </View>
                  <View 
                    onLayout={(e) => setInputLayout({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
                    style={{ borderRadius: 14, overflow: 'hidden', minHeight: 140 }}
                  >
                    {/* Animated Aurora Border - Only visible when typing */}
                    <Animated.View style={[
                      StyleSheet.absoluteFill,
                      useAnimatedStyle(() => ({
                        opacity: withTiming(description.length > 0 ? 1 : 0, { duration: 450 })
                      }))
                    ]}>
                      {inputLayout.height > 0 && (
                        <RotatingBorder 
                          isDark={isDark} 
                          width={inputLayout.width} 
                          height={inputLayout.height} 
                          speed={5000}
                          borderRadius={14}
                          borderWidth={2}
                        />
                      )}
                    </Animated.View>

                    {/* Content Wrapper - Inset by 2px when border is active to reveal it */}
                    <View style={{ 
                      flex: 1,
                      margin: description.length > 0 ? 2 : 0,
                      borderRadius: description.length > 0 ? 12 : 14,
                      backgroundColor: description.length > 0 ? (isDark ? 'rgba(15,23,42,0.95)' : '#FFF') : inputBg,
                      overflow: 'hidden'
                    }}>
                      <TextInput
                        ref={inputRef}
                        style={[styles.textArea, {
                          backgroundColor: 'transparent',
                          color: textPrimary,
                          borderColor: (description.length === 0 && showMentionDropdown) ? '#3B82F6' : (description.length > 0 ? 'transparent' : borderColor),
                          borderWidth: description.length > 0 ? 0 : 1,
                        }]}
                        placeholder={"Describe the issue in your own words...\nExample: Leaking tap in kitchenette, 2nd floor"}
                        placeholderTextColor={isDark ? '#6E7681' : '#94A3B8'}
                        multiline
                        value={description}
                        onChangeText={handleDescriptionChange}
                        autoFocus
                      />
                    </View>
                  </View>

                  {/* @Mention Dropdown */}
                  {showMentionDropdown && filteredMembers.length > 0 && (
                    <View style={[styles.mentionDropdown, { backgroundColor: isDark ? '#1E2633' : '#FFF', borderColor }]}>
                      <View style={styles.mentionHeader}>
                        <Ionicons name="at" size={14} color="#3B82F6" />
                        <Text style={styles.mentionHeaderText}>Assign to</Text>
                      </View>
                      <ScrollView style={{ maxHeight: 180 }} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                        {filteredMembers.map(member => (
                          <TouchableOpacity key={member.id} style={styles.mentionItem} onPress={() => selectMention(member)} activeOpacity={0.6}>
                            <View style={styles.mentionAvatar}>
                              <Text style={styles.mentionAvatarText}>
                                {member.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                              </Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.mentionName, { color: textPrimary }]}>{member.full_name}</Text>
                              {member.role && <Text style={styles.mentionRole}>{member.role.replace(/_/g, ' ')}</Text>}
                            </View>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>

                {/* Internal Toggle */}
                <View style={[styles.toggleRow, { backgroundColor: inputBg, borderColor }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.toggleTitle, { color: textPrimary }]}>Internal ticket</Text>
                    <Text style={[styles.toggleHint, { color: textSecondary }]}>Not visible to tenants</Text>
                  </View>
                  <Switch value={isInternal} onValueChange={setIsInternal} trackColor={{ false: '#CBD5E1', true: '#F59E0B' }} thumbColor="#FFF" />
                </View>

                {/* Media */}
                <View style={styles.fieldBlock}>
                  {mediaFile ? (
                    <View style={styles.mediaPreview}>
                      {mediaFile.type === 'image' && <Image source={{ uri: mediaFile.uri }} style={styles.mediaImg} />}
                      {mediaFile.type === 'video' && (
                        <View style={[styles.mediaImg, styles.videoThumb]}>
                          <Ionicons name="videocam" size={28} color="#FFF" />
                          <Text style={styles.videoLabel}>Video attached</Text>
                        </View>
                      )}
                      <TouchableOpacity style={styles.mediaRemove} onPress={() => setMediaFile(null)}>
                        <Ionicons name="close" size={16} color="#FFF" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity style={[styles.mediaAddBtn, { borderColor }]} onPress={() => setShowMediaModal(true)} activeOpacity={0.7}>
                      <Ionicons name="camera-outline" size={24} color={textSecondary} />
                      <Text style={[styles.mediaAddText, { color: textSecondary }]}>Add Photo or Video</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* AI Hint / Classification Status */}
                <View style={styles.aiHintRow}>
                  <Ionicons name="sparkles" size={14} color="#8B5CF6" />
                  <Text style={styles.aiHintText}>
                    {classificationInfo || 'Priority & category will be auto-classified by AI'}
                  </Text>
                </View>

                {errorMsg && (
                  <View style={styles.errorRow}>
                    <Ionicons name="alert-circle" size={16} color="#EF4444" />
                    <Text style={styles.errorText}>{errorMsg}</Text>
                  </View>
                )}
              </>
            )}
          </ScrollView>

          {/* Footer */}
          {!showSuccess && (
            <View style={[styles.footer, { borderTopColor: borderColor, backgroundColor: bg }]}>
              <TouchableOpacity style={[styles.cameraBtn, { borderColor }]} onPress={() => setShowMediaModal(true)} activeOpacity={0.7}>
                <Ionicons name="camera" size={22} color={textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, (!description.trim() || isSubmitting) && { opacity: 0.45 }]}
                onPress={submitTicket}
                disabled={isSubmitting || !description.trim()}
                activeOpacity={0.8}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <>
                    <Ionicons name="send" size={18} color="#FFF" />
                    <Text style={styles.submitBtnText}>Submit</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </KeyboardAvoidingView>
      </View>

      <MediaCaptureModal
        isOpen={showMediaModal}
        onClose={() => setShowMediaModal(false)}
        onCapture={(media) => { setMediaFile(media); setShowMediaModal(false); }}
      />
    </Modal>
  );
}

/* ─── Styles ───────────────────────────────────────────────────────────────── */
const { width: SCREEN_WIDTH } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  closeBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  formScroll: { flex: 1 },
  formContent: { padding: 20, paddingBottom: 40 },

  assignedRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  assignedLabel: { fontSize: 12, fontWeight: '600', color: '#64748B', marginRight: 10 },
  assignedChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 6 },
  assignedAvatar: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center' },
  assignedAvatarLetter: { color: '#FFF', fontSize: 11, fontWeight: '800' },
  assignedChipName: { fontSize: 13, fontWeight: '700', color: '#3B82F6' },

  fieldBlock: { marginBottom: 20 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  fieldLabel: { fontSize: 14, fontWeight: '700' },
  hintText: { fontSize: 11, color: '#94A3B8' },
  hintAt: { fontWeight: '800', color: '#3B82F6', fontSize: 13 },
  textArea: { borderRadius: 14, borderWidth: 1, padding: 16, fontSize: 15, lineHeight: 22, minHeight: 140, textAlignVertical: 'top' },

  mentionDropdown: { borderWidth: 1, borderRadius: 14, marginTop: 8, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 6 },
  mentionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  mentionHeaderText: { fontSize: 10, fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: 1 },
  mentionItem: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12 },
  mentionAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
  mentionAvatarText: { color: '#3B82F6', fontWeight: '800', fontSize: 13 },
  mentionName: { fontSize: 14, fontWeight: '700' },
  mentionRole: { fontSize: 11, color: '#94A3B8', textTransform: 'capitalize', marginTop: 1 },

  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderRadius: 14, borderWidth: 1, marginBottom: 20 },
  toggleTitle: { fontSize: 15, fontWeight: '700' },
  toggleHint: { fontSize: 12, marginTop: 2 },

  mediaAddBtn: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 14, height: 72, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  mediaAddText: { fontSize: 14, fontWeight: '600' },
  mediaPreview: { position: 'relative', width: 120, height: 120, borderRadius: 14, overflow: 'hidden' },
  mediaImg: { width: '100%', height: '100%' },
  videoThumb: { backgroundColor: '#1E293B', justifyContent: 'center', alignItems: 'center' },
  videoLabel: { color: '#94A3B8', fontSize: 10, fontWeight: '700', marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  mediaRemove: { position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.6)', padding: 5, borderRadius: 12 },

  aiHintRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 20, paddingHorizontal: 4 },
  aiHintText: { fontSize: 12, fontWeight: '600', color: '#8B5CF6' },

  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  errorText: { color: '#EF4444', fontSize: 13, fontWeight: '600', flex: 1 },

  footer: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 8, borderTopWidth: 1 },
  cameraBtn: { width: 48, height: 48, borderRadius: 14, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  submitBtn: { flex: 1, flexDirection: 'row', backgroundColor: '#3B82F6', paddingVertical: 14, borderRadius: 14, justifyContent: 'center', alignItems: 'center', gap: 8, shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  submitBtnText: { color: '#FFF', fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },

  successView: { alignItems: 'center', paddingVertical: 60 },
  successTitle: { fontSize: 22, fontWeight: '800', marginTop: 20, marginBottom: 8 },
  successSubtitle: { fontSize: 14, color: '#94A3B8', textAlign: 'center', lineHeight: 20, paddingHorizontal: 20 },
});
