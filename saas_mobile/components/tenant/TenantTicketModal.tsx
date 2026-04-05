'use client';
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { createTicket } from '@/utils/api/mobileApi';
import { useTheme } from '@/context';
import {
  classifyTicketEnhanced,
  getSkillGroupDisplayName,
  getSkillGroupColor,
  getIssueCodeDisplayName,
  EnhancedClassificationResult,
} from '@/utils/ticketing/classifyTicket';

interface TenantTicketModalProps {
  visible: boolean;
  propertyId: string;
  organizationId: string;
  userId: string;
  userName: string;
  propertyName: string;
  onClose: () => void;
  onSuccess?: (ticketNumber: string, ticketId: string) => void;
}

type Priority = 'low' | 'medium' | 'high' | 'critical';

export function TenantTicketModal({
  visible,
  propertyId,
  organizationId,
  userId,
  userName,
  propertyName,
  onClose,
  onSuccess,
}: TenantTicketModalProps) {
  const { isDark, colors } = useTheme();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Classification preview
  const [classification, setClassification] = useState<EnhancedClassificationResult | null>(null);
  const [isClassifying, setIsClassifying] = useState(false);
  const classifyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    classifyTimeoutRef.current = setTimeout(() => {
      const result = classifyTicketEnhanced(description);
      setClassification(result);
      setIsClassifying(false);
    }, 400);

    return () => {
      if (classifyTimeoutRef.current) {
        clearTimeout(classifyTimeoutRef.current);
      }
    };
  }, [description]);

  const reset = () => {
    setTitle('');
    setDescription('');
    setPriority('medium');
    setError(null);
    setIsSubmitting(false);
    setClassification(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      setError('Please describe the issue');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await createTicket({
        title: title.trim() || undefined,
        description: description.trim(),
        propertyId,
        organizationId,
        priority,
        isInternal: false,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      const ticketNumber = result.ticket?.ticket_number ?? 'TKT';
      const ticketId = result.ticket?.id ?? '';

      // Use server-side classification for the confirmation message (more authoritative)
      const classification = result.classification;
      let message = `Ticket ${ticketNumber} created successfully!`;
      if (classification?.issue_code) {
        message += `\n\nAuto-classified as: ${classification.issue_code.replace(/_/g, ' ')}`;
        message += `\nConfidence: ${classification.confidence}`;
      }

      Alert.alert('Ticket Created', message, [
        {
          text: 'OK',
          onPress: () => {
            onSuccess?.(ticketNumber, ticketId);
            handleClose();
          },
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create ticket');
    } finally {
      setIsSubmitting(false);
    }
  };

  const priorityOptions: { value: Priority; label: string; color: string }[] = [
    { value: 'low', label: 'Low', color: '#64748B' },
    { value: 'medium', label: 'Medium', color: '#708F96' },
    { value: 'high', label: 'High', color: '#F97316' },
    { value: 'critical', label: 'Critical', color: '#EF4444' },
  ];

  const selectedPriority = priorityOptions.find(p => p.value === priority) ?? priorityOptions[1];
  const sgColor = classification ? getSkillGroupColor(classification.skill_group) : null;
  const hasContent = description.trim().length >= 5;

  // Theme-aware colors
  const bg = isDark ? colors.background : '#F0F4F8';
  const cardBg = isDark ? '#1E2535' : '#FFFFFF';
  const cardBorder = isDark ? '#2D3748' : 'rgba(0,0,0,0.06)';
  const inputBg = isDark ? '#141820' : '#FFFFFF';
  const inputBorder = isDark ? '#2D3748' : 'rgba(0,0,0,0.08)';
  const textPrimary = isDark ? '#F1F5F9' : '#1A1A1A';
  const textSecondary = isDark ? '#94A3B8' : '#374151';
  const textMuted = isDark ? '#64748B' : '#94A3B8';
  const headerBg = isDark ? '#141820' : '#FFFFFF';
  const headerBorder = isDark ? '#2D3748' : 'rgba(0,0,0,0.06)';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: bg }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={[styles.header, { backgroundColor: headerBg, borderBottomColor: headerBorder }]}>
          <TouchableOpacity onPress={handleClose} disabled={isSubmitting}>
            <Text style={[styles.cancelText, { color: isDark ? '#F87171' : '#EF4444' }]}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: textPrimary }]}>New Request</Text>
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={isSubmitting || !description.trim()}
            style={styles.submitBtn}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text
                style={[
                  styles.submitText,
                  { color: description.trim() ? colors.primary : textMuted },
                ]}
              >
                Submit
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { backgroundColor: bg }]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Property info */}
          <View style={[styles.propertyBanner, { backgroundColor: colors.primary + '14', borderColor: colors.primary + '30' }]}>
            <Text style={[styles.propertyLabel, { color: colors.primary }]}>Property</Text>
            <Text style={[styles.propertyName, { color: textPrimary }]}>{propertyName}</Text>
          </View>

          {/* Classification Preview */}
          {hasContent ? (
            <View style={[styles.classificationCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <View style={styles.classificationHeader}>
                <View style={[styles.aiDot, { backgroundColor: colors.primary }]} />
                <Text style={[styles.classificationLabel, { color: colors.primary }]}>AI Classification Preview</Text>
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
                    <Text style={[styles.issueBadgeText, { color: textPrimary }]}>
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
                      {classification.confidence === 'high' ? 'High confidence' : 'Will be reviewed'}
                    </Text>
                  </View>
                </View>
              ) : (
                <Text style={[styles.classifyingText, { color: textMuted }]}>
                  Analyzing description...
                </Text>
              )}
            </View>
          ) : (
            // AI Classification note (shown before user starts typing)
            <View style={[styles.aiNote, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '20' }]}>
              <Text style={[styles.aiNoteText, { color: colors.primary }]}>
                Your request will be automatically classified by AI and assigned to the right team.
              </Text>
            </View>
          )}

          {/* Title */}
          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: textSecondary }]}>Title (optional)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: inputBg, borderColor: inputBorder, color: textPrimary }]}
              placeholder="Brief summary of the issue"
              placeholderTextColor={textMuted}
              value={title}
              onChangeText={setTitle}
              maxLength={120}
            />
          </View>

          {/* Description */}
          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: textSecondary }]}>
              Description <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, styles.textArea, { backgroundColor: inputBg, borderColor: inputBorder, color: textPrimary }]}
              placeholder="Describe the issue in detail. Mention the floor/location if relevant."
              placeholderTextColor={textMuted}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />
          </View>

          {/* Priority */}
          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: textSecondary }]}>Priority</Text>
            <View style={styles.priorityRow}>
              {priorityOptions.map((p) => (
                <TouchableOpacity
                  key={p.value}
                  style={[
                    styles.priorityChip,
                    priority === p.value && {
                      backgroundColor: p.color,
                      borderColor: p.color,
                    },
                    priority !== p.value && {
                      backgroundColor: isDark ? '#1E2535' : '#FFFFFF',
                      borderColor: isDark ? '#2D3748' : 'rgba(0,0,0,0.1)',
                    },
                  ]}
                  onPress={() => setPriority(p.value)}
                >
                  <Text
                    style={[
                      styles.priorityChipText,
                      priority === p.value && styles.priorityChipTextActive,
                      priority !== p.value && { color: isDark ? '#94A3B8' : '#6B7280' },
                    ]}
                  >
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Error */}
          {error && (
            <View style={[styles.errorBox, { backgroundColor: isDark ? '#2D1B1B' : 'rgba(239, 68, 68, 0.08)', borderColor: isDark ? '#7F1D1D' : '#FECACA' }]}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  cancelText: {
    fontSize: 15,
  },
  submitBtn: {
    minWidth: 60,
    alignItems: 'flex-end',
  },
  submitText: {
    fontSize: 15,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  propertyBanner: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
  },
  propertyLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  propertyName: {
    fontSize: 12,
    fontWeight: '500',
  },
  classificationCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 20,
  },
  classificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  aiDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  classificationLabel: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
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
    fontSize: 10,
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
    fontSize: 10,
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
  aiNote: {
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
  },
  aiNoteText: {
    fontSize: 12,
    lineHeight: 18,
  },
  field: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  required: {
    color: '#EF4444',
  },
  input: {
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    borderWidth: 1,
  },
  textArea: {
    minHeight: 120,
    paddingTop: 14,
  },
  priorityRow: {
    flexDirection: 'row',
    gap: 10,
  },
  priorityChip: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  priorityChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  priorityChipTextActive: {
    color: '#FFFFFF',
  },
  errorBox: {
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
  },
  errorText: {
    fontSize: 13,
    color: '#EF4444',
  },
});
