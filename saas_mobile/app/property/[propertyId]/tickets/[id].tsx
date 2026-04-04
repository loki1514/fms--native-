
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { createClient } from '@/utils/supabase/client';
import { useTheme } from '@/context';
import StatusBadge from '@/components/tickets/StatusBadge';
import MediaCaptureModal, { MediaFile } from '@/components/shared/MediaCaptureModal';

interface Ticket {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  category?: string;
  ticket_number: string;
  created_at: string;
  updated_at: string;
  assigned_at?: string;
  work_started_at?: string;
  resolved_at?: string;
  closed_at?: string;
  work_paused: boolean;
  work_pause_reason?: string;
  sla_deadline?: string | null;
  sla_breached?: boolean;
  total_paused_minutes?: number;
  photo_before_url?: string | null;
  photo_after_url?: string | null;
  video_before_url?: string | null;
  video_after_url?: string | null;
  property_id: string;
  organization_id: string;
  assignee: { id: string; full_name: string; user_photo_url?: string | null } | null;
  creator:  { id: string; full_name: string; email?: string } | null;
  location?: string;
}

interface Comment {
  id: string;
  comment: string;
  created_at: string;
  is_internal: boolean;
  user?: { full_name: string; user_photo_url?: string | null };
}

interface Activity {
  id: string;
  action: string;
  new_value?: string | null;
  old_value?: string | null;
  created_at: string;
  user?: { full_name: string };
}

interface EscalationLog {
  id: string;
  from_level: number;
  to_level: number | null;
  reason: string;
  escalated_at: string;
  from_employee?: { full_name: string } | null;
  to_employee?:  { full_name: string } | null;
}

const PRIORITY_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  critical: { bg: 'rgba(244,63,94,0.1)',  text: '#F43F5E', label: 'Critical' },
  high:     { bg: 'rgba(249,115,22,0.1)', text: '#F97316', label: 'High' },
  medium:   { bg: 'rgba(245,158,11,0.1)', text: '#F59E0B', label: 'Medium' },
  low:      { bg: 'rgba(148,163,184,0.1)',text: '#94A3B8', label: 'Low' },
};

const STATUS_TRANSITIONS: Record<string, string[]> = {
  open:               ['waitlist', 'assigned'],
  waitlist:           ['open', 'assigned'],
  assigned:           ['in_progress', 'open'],
  in_progress:        ['paused', 'pending_validation', 'resolved'],
  paused:             ['in_progress', 'open'],
  pending_validation: ['resolved', 'in_progress'],
  resolved:           ['closed', 'in_progress'],
  closed:             ['resolved'],
};

const STATUS_LABELS: Record<string, string> = {
  open:               'Open',
  waitlist:           'Waitlist',
  assigned:           'Assigned',
  in_progress:        'In Progress',
  paused:             'Paused',
  pending_validation: 'Pending Validation',
  resolved:           'Resolved',
  closed:             'Closed',
};

function formatDuration(ms: number): string {
  const totalMins = Math.floor(ms / 60000);
  if (totalMins < 60)  return `${totalMins}m`;
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60)    return 'Just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function TicketDetailScreen() {
  const { propertyId, id } = useLocalSearchParams<{ propertyId: string; id: string }>();
  const router = useRouter();
  const supabase = createClient();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [escalationLogs, setEscalationLogs] = useState<EscalationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [mediaUploadType, setMediaUploadType] = useState<'before' | 'after' | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showAssigneePicker, setShowAssigneePicker] = useState(false);
  const [availableMSTs, setAvailableMSTs] = useState<{ id: string; full_name: string }[]>([]);

  // Property segregation: verify ticket belongs to current property
  const fetchTicket = useCallback(async () => {
    if (!propertyId || !id) return;
    setLoading(true);
    try {
      // Fetch ticket with property_id filter for segregation
      const { data: ticketData, error: ticketError } = await (supabase
        .from('tickets')
        .select(`*, assignee:users!assigned_to(id, full_name, user_photo_url),
                         creator:users!raised_by(id, full_name, email)`)
        .eq('id', id)
        .eq('property_id', propertyId)
        .single() as any);

      if (ticketError || !ticketData) {
        setTicket(null);
        setLoading(false);
        return;
      }

      // Property segregation guard
      if (ticketData.property_id !== propertyId) {
        console.error('Property segregation violation: ticket belongs to different property');
        setTicket(null);
        setLoading(false);
        return;
      }

      setTicket(ticketData as Ticket);

      // Fetch comments
      const { data: commentData } = await (supabase
        .from('ticket_comments')
        .select(`*, user:users(full_name, user_photo_url)`)
        .eq('ticket_id', id)
        .order('created_at', { ascending: true }) as any);
      setComments((commentData ?? []) as Comment[]);

      // Fetch activity
      const { data: activityData } = await (supabase
        .from('ticket_activity_log')
        .select(`*, user:users(full_name)`)
        .eq('ticket_id', id)
        .order('created_at', { ascending: true }) as any);
      setActivities((activityData ?? []) as Activity[]);

      // Fetch escalation logs
      const { data: escData } = await supabase
        .from('ticket_escalation_logs')
        .select(`*, from_employee:users!from_employee_id(full_name),
                         to_employee:users!to_employee_id(full_name)`)
        .eq('ticket_id', id)
        .order('escalated_at', { ascending: true });
      setEscalationLogs((escData ?? []) as EscalationLog[]);

    } catch (err) {
      console.error('Error fetching ticket:', err);
    } finally {
      setLoading(false);
    }
  }, [propertyId, id, supabase]);

  useEffect(() => {
    fetchTicket();
  }, [fetchTicket]);

  const fetchMSTs = async () => {
    if (!propertyId) return;
    const { data } = await supabase
      .from('property_memberships')
      .select(`user:users!user_id(id, full_name)`)
      .eq('property_id', propertyId)
      .eq('is_active', true)
      .in('role', ['mst', 'technician', 'maintenance']);
    const msts = (data ?? [])
      .map((m: any) => ({ id: m.user?.id, full_name: m.user?.full_name }))
      .filter((u: any) => u.id && u.full_name);
    setAvailableMSTs(msts as { id: string; full_name: string }[]);
  };

  const handleSendComment = async () => {
    if (!newComment.trim() || !id) return;
    setSendingComment(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id;
      const { data, error } = await supabase
        .from('ticket_comments')
        .insert({ ticket_id: id, comment: newComment.trim(), user_id: userId, is_internal: false } as any)
        .select(`*, user:users(full_name, user_photo_url)`)
        .single();
      if (error) throw error;
      setComments(prev => [...prev, data as Comment]);
      setNewComment('');
    } catch (err) {
      console.error('Error sending comment:', err);
    } finally {
      setSendingComment(false);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    if (!id) return;
    setUpdatingStatus(true);
    setShowStatusPicker(false);
    try {
      const updates: any = { status: newStatus };
      if (newStatus === 'resolved' && !ticket?.resolved_at) {
        updates.resolved_at = new Date().toISOString();
      }
      if (newStatus === 'closed' && !ticket?.closed_at) {
        updates.closed_at = new Date().toISOString();
      }
      if (newStatus === 'in_progress' && !ticket?.work_started_at) {
        updates.work_started_at = new Date().toISOString();
      }

      const { error } = await (supabase.from('tickets') as any)
        .update(updates)
        .eq('id', id)
        .eq('property_id', propertyId);
      if (error) throw error;
      await fetchTicket();
    } catch (err) {
      console.error('Error updating status:', err);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleReassign = async (mstId: string) => {
    if (!id) return;
    setShowAssigneePicker(false);
    try {
      const { error } = await (supabase.from('tickets') as any)
        .update({ assigned_to: mstId, assigned_at: new Date().toISOString(), status: 'assigned' })
        .eq('id', id)
        .eq('property_id', propertyId);
      if (error) throw error;
      await fetchTicket();
    } catch (err) {
      console.error('Error reassigning:', err);
    }
  };

  const handleMediaUpload = async (media: MediaFile) => {
    if (!mediaUploadType || !id) return;
    setShowMediaModal(false);
    setIsUploading(true);
    try {
      const field = mediaUploadType === 'before' ? 'photo_before_url' : 'photo_after_url';
      // In production: upload to Supabase Storage first, then update field
      // For now, we set a placeholder URL
      const placeholderUrl = media.uri;
      const { error } = await (supabase.from('tickets') as any)
        .update({ [field]: placeholderUrl })
        .eq('id', id)
        .eq('property_id', propertyId);
      if (error) throw error;
      await fetchTicket();
    } catch (err) {
      console.error('Error uploading media:', err);
    } finally {
      setIsUploading(false);
      setMediaUploadType(null);
    }
  };

  const pCfg = ticket ? (PRIORITY_CONFIG[ticket.priority?.toLowerCase()] ?? PRIORITY_CONFIG.low) : PRIORITY_CONFIG.low;
  const bg = isDark ? '#0F1521' : '#F5F0E8';
  const cardBg = isDark ? 'rgba(30,38,55,0.88)' : 'rgba(255,255,255,0.88)';
  const textPrimary = isDark ? '#F0F4F8' : '#1A2332';
  const textSecondary = isDark ? '#A0AEC0' : '#64748B';
  const borderColor = isDark ? 'rgba(80,100,130,0.30)' : 'rgba(180,195,210,0.35)';

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: bg }]}>
        <ActivityIndicator size="large" color="#7CB9A8" />
      </View>
    );
  }

  if (!ticket) {
    return (
      <>
        <Stack.Screen options={{ title: 'Request Not Found' }} />
        <View style={[styles.centered, { backgroundColor: bg }]}>
          <Ionicons name="alert-circle-outline" size={64} color={isDark ? '#4B5563' : '#CBD5E1'} />
          <Text style={[styles.notFoundTitle, { color: textPrimary }]}>Request Not Found</Text>
          <Text style={[styles.notFoundSubtitle, { color: textSecondary }]}>
            This request does not exist or you do not have access.
          </Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  const slaDeadline = ticket.sla_deadline ? new Date(ticket.sla_deadline) : null;
  const isResolved = ['resolved', 'closed'].includes(ticket.status);
  const referenceTime = isResolved && ticket.resolved_at ? new Date(ticket.resolved_at) : new Date();
  const isSLABreached = Boolean(ticket.sla_breached) ||
    (slaDeadline !== null && slaDeadline < referenceTime);
  const breachMs = slaDeadline && isSLABreached
    ? referenceTime.getTime() - slaDeadline.getTime()
    : 0;

  const availableStatuses = STATUS_TRANSITIONS[ticket.status] ?? [];

  const slaSteps = [
    { label: 'Created', time: ticket.created_at, done: true, color: '#94A3B8' },
    { label: 'Assigned', time: ticket.assigned_at, done: !!ticket.assigned_at, color: '#3B82F6' },
    { label: 'Started', time: ticket.work_started_at, done: !!ticket.work_started_at, color: '#F59E0B' },
    {
      label: 'Deadline',
      time: ticket.sla_deadline ?? null,
      done: isResolved || !slaDeadline || (slaDeadline > new Date()),
      color: isSLABreached ? '#F43F5E' : '#10B981',
      isDeadline: true,
    },
    { label: 'Resolved', time: ticket.resolved_at, done: !!ticket.resolved_at, color: '#10B981' },
  ].filter(s => s.time || s.label === 'Created');

  return (
    <>
      <Stack.Screen
        options={{
          title: ticket.ticket_number ?? 'Request',
          headerBackTitle: 'Requests',
          headerStyle: { backgroundColor: bg },
          headerTintColor: textPrimary,
          headerShadowVisible: false,
        }}
      />

      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: bg }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Title + Badges */}
          <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
            <Text style={[styles.ticketNumberLabel, { color: textSecondary }]}>
              {ticket.ticket_number ?? ticket.id.slice(0, 8).toUpperCase()}
            </Text>
            <Text style={[styles.ticketTitle, { color: textPrimary }]}>{ticket.title}</Text>
            <View style={styles.badgeRow}>
              <StatusBadge status={ticket.status} />
              <View style={[styles.priorityBadge, { backgroundColor: pCfg.bg }]}>
                <Text style={[styles.priorityText, { color: pCfg.text }]}>{pCfg.label}</Text>
              </View>
              {ticket.category && (
                <View style={[styles.categoryBadge, { backgroundColor: isDark ? '#1E2633' : '#F1F5F9' }]}>
                  <Text style={[styles.categoryText, { color: textSecondary }]}>
                    {ticket.category}
                  </Text>
                </View>
              )}
              {ticket.work_paused && (
                <View style={[styles.pausedBadge, { backgroundColor: 'rgba(245,158,11,0.1)' }]}>
                  <Ionicons name="pause" size={10} color="#F59E0B" />
                  <Text style={[styles.pausedText, { color: '#F59E0B' }]}>Paused</Text>
                </View>
              )}
            </View>
          </View>

          {/* SLA Breach Banner */}
          {slaDeadline && (
            <View style={[
              styles.slaCard,
              {
                backgroundColor: isSLABreached
                  ? (isDark ? 'rgba(244,63,94,0.12)' : 'rgba(244,63,94,0.08)')
                  : (isDark ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.08)'),
                borderColor: isSLABreached ? 'rgba(244,63,94,0.3)' : 'rgba(16,185,129,0.3)',
              },
            ]}>
              <View style={styles.slaHeader}>
                <Ionicons
                  name={isSLABreached ? 'alert-circle' : 'checkmark-circle'}
                  size={20}
                  color={isSLABreached ? '#F43F5E' : '#10B981'}
                />
                <Text style={[
                  styles.slaTitle,
                  { color: isSLABreached ? '#F43F5E' : '#10B981' },
                ]}>
                  {isSLABreached ? 'SLA Breached' : 'SLA On Track'}
                </Text>
                {isSLABreached && breachMs > 0 && (
                  <Text style={styles.slaBreachTime}>+{formatDuration(breachMs)}</Text>
                )}
              </View>
              <Text style={[styles.slaSubtext, { color: textSecondary }]}>
                {isSLABreached
                  ? isResolved ? 'Resolved after SLA deadline' : 'Service Level Agreement not met'
                  : 'Within agreed service time'}
              </Text>
            </View>
          )}

          {/* Description */}
          <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
            <Text style={[styles.sectionTitle, { color: textPrimary }]}>Description</Text>
            <Text style={[styles.description, { color: textSecondary }]}>{ticket.description}</Text>
            <View style={[styles.divider, { backgroundColor: borderColor }]} />
            <View style={styles.metaRow}>
              {ticket.creator?.full_name && (
                <View style={styles.metaItem}>
                  <Ionicons name="person-outline" size={14} color={textSecondary} />
                  <Text style={[styles.metaText, { color: textSecondary }]}>
                    {ticket.creator.full_name}
                  </Text>
                </View>
              )}
              <View style={styles.metaItem}>
                <Ionicons name="time-outline" size={14} color={textSecondary} />
                <Text style={[styles.metaText, { color: textSecondary }]}>
                  {formatDate(ticket.created_at)}
                </Text>
              </View>
              {ticket.location && (
                <View style={styles.metaItem}>
                  <Ionicons name="location-outline" size={14} color={textSecondary} />
                  <Text style={[styles.metaText, { color: textSecondary }]}>{ticket.location}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Request Progress Timeline */}
          {slaSteps.length > 0 && (
            <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
              <Text style={[styles.sectionTitle, { color: textPrimary }]}>Request Progress</Text>
              <View style={styles.timeline}>
                {slaSteps.map((step, i) => (
                  <View key={step.label} style={styles.timelineItem}>
                    <View style={styles.timelineLeft}>
                      <View style={[
                        styles.timelineDot,
                        { backgroundColor: step.done ? step.color : isDark ? '#2D3748' : '#E2E8F0' },
                      ]}>
                        {step.done && (
                          <Ionicons name="checkmark" size={10} color="#FFF" />
                        )}
                      </View>
                      {i < slaSteps.length - 1 && (
                        <View style={[
                          styles.timelineLine,
                          { backgroundColor: step.done && slaSteps[i + 1]?.done ? step.color : borderColor },
                        ]} />
                      )}
                    </View>
                    <View style={styles.timelineRight}>
                      <Text style={[
                        styles.timelineLabel,
                        { color: step.done ? textPrimary : textSecondary },
                      ]}>
                        {step.label}
                      </Text>
                      {step.time && (
                        <Text style={[styles.timelineTime, { color: textSecondary }]}>
                          {formatDate(step.time)}
                        </Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Escalation Timeline */}
          {escalationLogs.length > 0 && (
            <View style={[styles.card, { backgroundColor: cardBg, borderColor: 'rgba(244,63,94,0.3)' }]}>
              <View style={styles.escalationHeader}>
                <Ionicons name="arrow-up-circle" size={18} color="#F43F5E" />
                <Text style={[styles.sectionTitle, { color: '#F43F5E', marginBottom: 0 }]}>
                  Escalation Timeline
                </Text>
              </View>
              {escalationLogs.map(log => {
                const reasonLabel = log.reason === 'timeout' ? 'SLA Timeout'
                  : log.reason === 'manual' ? 'Manual' : log.reason || 'Timeout';
                return (
                  <View key={log.id} style={[styles.escalationItem, { borderColor: 'rgba(244,63,94,0.2)' }]}>
                    <View style={styles.escLevelRow}>
                      <View style={styles.levelBadge}>
                        <Text style={styles.levelText}>L{log.from_level}</Text>
                      </View>
                      <Ionicons name="arrow-forward" size={12} color="#F43F5E" />
                      <View style={[styles.levelBadge, styles.levelBadgeActive]}>
                        <Text style={styles.levelTextActive}>L{log.to_level ?? 'Final'}</Text>
                      </View>
                      <View style={[styles.reasonBadge, { backgroundColor: 'rgba(245,158,11,0.1)' }]}>
                        <Text style={[styles.reasonText, { color: '#F59E0B' }]}>{reasonLabel}</Text>
                      </View>
                      <Text style={[styles.escTime, { color: textSecondary }]}>
                        {timeAgo(log.escalated_at)}
                      </Text>
                    </View>
                    <View style={styles.escEmployeeRow}>
                      <View style={styles.escEmployee}>
                        <View style={[styles.escAvatar, { backgroundColor: isDark ? '#2D3748' : '#E2E8F0' }]}>
                          <Text style={styles.escAvatarText}>
                            {log.from_employee?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() ?? '?'}
                          </Text>
                        </View>
                        <Text style={[styles.escEmployeeName, { color: textSecondary }]}>
                          {log.from_employee?.full_name ?? 'Unassigned'}
                        </Text>
                      </View>
                      <Ionicons name="arrow-forward" size={14} color={textSecondary} />
                      <View style={styles.escEmployee}>
                        <View style={[styles.escAvatar, { backgroundColor: 'rgba(244,63,94,0.15)' }]}>
                          <Text style={[styles.escAvatarText, { color: '#F43F5E' }]}>
                            {log.to_employee?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() ?? '?'}
                          </Text>
                        </View>
                        <Text style={[styles.escEmployeeName, { color: textPrimary }]}>
                          {log.to_employee?.full_name ?? 'No Assignee'}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Media Section */}
          <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
            <Text style={[styles.sectionTitle, { color: textPrimary }]}>Photos & Videos</Text>
            {isUploading && (
              <View style={styles.uploadingRow}>
                <ActivityIndicator size="small" color="#7CB9A8" />
                <Text style={[styles.uploadingText, { color: textSecondary }]}>Uploading...</Text>
              </View>
            )}
            <View style={styles.mediaGrid}>
              {/* Before */}
              <TouchableOpacity
                style={[styles.mediaSlot, { backgroundColor: isDark ? '#1E2633' : '#F8FAFC', borderColor }]}
                onPress={() => { setMediaUploadType('before'); setShowMediaModal(true); }}
                disabled={isUploading}
              >
                {ticket.photo_before_url ? (
                  <Image source={{ uri: ticket.photo_before_url }} style={styles.mediaImage} />
                ) : (
                  <View style={styles.mediaPlaceholder}>
                    <Ionicons name="camera-outline" size={28} color={isDark ? '#4B5563' : '#CBD5E1'} />
                    <Text style={[styles.mediaSlotLabel, { color: textSecondary }]}>Before</Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* After */}
              <TouchableOpacity
                style={[styles.mediaSlot, { backgroundColor: isDark ? '#1E2633' : '#F8FAFC', borderColor }]}
                onPress={() => { setMediaUploadType('after'); setShowMediaModal(true); }}
                disabled={isUploading}
              >
                {ticket.photo_after_url ? (
                  <Image source={{ uri: ticket.photo_after_url }} style={styles.mediaImage} />
                ) : (
                  <View style={styles.mediaPlaceholder}>
                    <Ionicons name="camera-outline" size={28} color={isDark ? '#4B5563' : '#CBD5E1'} />
                    <Text style={[styles.mediaSlotLabel, { color: textSecondary }]}>After</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Assignee */}
          <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
            <Text style={[styles.sectionTitle, { color: textPrimary }]}>
              Assigned Technician
            </Text>
            {ticket.assignee ? (
              <View style={styles.assigneeRow}>
                <View style={[styles.assigneeAvatar, { backgroundColor: 'rgba(124,185,168,0.15)' }]}>
                  {ticket.assignee.user_photo_url ? (
                    <Image source={{ uri: ticket.assignee.user_photo_url }} style={styles.assigneeAvatarImg} />
                  ) : (
                    <Text style={styles.assigneeInitials}>
                      {ticket.assignee.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.assigneeName, { color: textPrimary }]}>
                    {ticket.assignee.full_name}
                  </Text>
                  {ticket.assigned_at && (
                    <Text style={[styles.assigneeMeta, { color: textSecondary }]}>
                      Assigned {timeAgo(ticket.assigned_at)}
                    </Text>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.reassignBtn}
                  onPress={() => { fetchMSTs(); setShowAssigneePicker(true); }}
                >
                  <Ionicons name="swap-horizontal" size={16} color="#7CB9A8" />
                  <Text style={styles.reassignBtnText}>Reassign</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.noAssignee}>
                <Ionicons name="person-outline" size={28} color={isDark ? '#4B5563' : '#CBD5E1'} />
                <Text style={[styles.noAssigneeText, { color: textSecondary }]}>
                  No technician assigned yet
                </Text>
                <TouchableOpacity
                  style={styles.assignNowBtn}
                  onPress={() => { fetchMSTs(); setShowAssigneePicker(true); }}
                >
                  <Text style={styles.assignNowBtnText}>Assign Now</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Activity Feed */}
          {(activities.length > 0 || comments.length > 0) && (
            <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
              <Text style={[styles.sectionTitle, { color: textPrimary }]}>Activity</Text>
              <View style={styles.activityList}>
                {activities.map(activity => (
                  <View key={activity.id} style={styles.activityItem}>
                    <View style={[styles.activityDot, { backgroundColor: '#7CB9A8' }]} />
                    <View style={styles.activityContent}>
                      <Text style={[styles.activityText, { color: textSecondary }]}>
                        <Text style={{ fontWeight: '600', color: textPrimary }}>
                          {activity.user?.full_name ?? 'System'}
                        </Text>
                        {' '}
                        {activity.action.replace(/_/g, ' ')}
                        {activity.new_value && ` to "${activity.new_value}"`}
                      </Text>
                      <Text style={[styles.activityTime, { color: textSecondary }]}>
                        {timeAgo(activity.created_at)}
                      </Text>
                    </View>
                  </View>
                ))}
                {comments.map(comment => (
                  <View key={comment.id} style={styles.activityItem}>
                    <View style={[styles.activityDot, { backgroundColor: '#3B82F6' }]} />
                    <View style={styles.activityContent}>
                      <View style={styles.commentHeader}>
                        <Text style={[styles.commentAuthor, { color: textPrimary }]}>
                          {comment.user?.full_name ?? 'Unknown'}
                        </Text>
                        <Text style={[styles.activityTime, { color: textSecondary }]}>
                          {timeAgo(comment.created_at)}
                        </Text>
                      </View>
                      <Text style={[styles.commentText, { color: textSecondary }]}>
                        {comment.comment}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Action Buttons */}
          <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
            <Text style={[styles.sectionTitle, { color: textPrimary }]}>Actions</Text>
            <View style={styles.actionRow}>
              {availableStatuses.length > 0 && (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: isDark ? 'rgba(124,185,168,0.12)' : 'rgba(124,185,168,0.08)', borderColor: 'rgba(124,185,168,0.3)' }]}
                  onPress={() => setShowStatusPicker(true)}
                  disabled={updatingStatus}
                >
                  {updatingStatus ? (
                    <ActivityIndicator size="small" color="#7CB9A8" />
                  ) : (
                    <Ionicons name="refresh" size={18} color="#7CB9A8" />
                  )}
                  <Text style={[styles.actionBtnText, { color: '#7CB9A8' }]}>Change Status</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: isDark ? 'rgba(59,130,246,0.12)' : 'rgba(59,130,246,0.08)', borderColor: 'rgba(59,130,246,0.3)' }]}
                onPress={() => { setMediaUploadType('before'); setShowMediaModal(true); }}
              >
                <Ionicons name="camera" size={18} color="#3B82F6" />
                <Text style={[styles.actionBtnText, { color: '#3B82F6' }]}>Add Photo</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Bottom padding for comment input */}
          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Comment Input (sticky bottom) */}
        <View style={[
          styles.commentBar,
          { backgroundColor: cardBg, borderTopColor: borderColor },
        ]}>
          <TextInput
            style={[
              styles.commentInput,
              {
                backgroundColor: isDark ? '#1E2633' : '#F1F5F9',
                color: textPrimary,
                borderColor,
              },
            ]}
            placeholder="Type a message..."
            placeholderTextColor={isDark ? '#6E7681' : '#94A3B8'}
            value={newComment}
            onChangeText={setNewComment}
            multiline
          />
          <TouchableOpacity
            style={[
              styles.sendBtn,
              !newComment.trim() && styles.sendBtnDisabled,
            ]}
            onPress={handleSendComment}
            disabled={!newComment.trim() || sendingComment}
          >
            {sendingComment ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Ionicons name="send" size={18} color="#FFF" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Status Picker Modal */}
      <Modal visible={showStatusPicker} transparent animationType="fade" onRequestClose={() => setShowStatusPicker(false)}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowStatusPicker(false)}
        >
          <View style={[styles.pickerCard, { backgroundColor: isDark ? '#1E2633' : '#FFF', borderColor }]}>
            <Text style={[styles.pickerTitle, { color: textPrimary }]}>Change Status</Text>
            {availableStatuses.map(s => (
              <TouchableOpacity
                key={s}
                style={[styles.pickerItem, { borderColor }]}
                onPress={() => handleUpdateStatus(s)}
              >
                <Text style={[styles.pickerItemText, { color: textPrimary }]}>
                  {STATUS_LABELS[s] ?? s}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.pickerItem, { borderColor }]}
              onPress={() => setShowStatusPicker(false)}
            >
              <Text style={[styles.pickerItemText, { color: textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Assignee Picker Modal */}
      <Modal visible={showAssigneePicker} transparent animationType="fade" onRequestClose={() => setShowAssigneePicker(false)}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowAssigneePicker(false)}
        >
          <View style={[styles.pickerCard, { backgroundColor: isDark ? '#1E2633' : '#FFF', borderColor }]}>
            <Text style={[styles.pickerTitle, { color: textPrimary }]}>Reassign To</Text>
            {availableMSTs.length === 0 ? (
              <Text style={[styles.noMSTText, { color: textSecondary }]}>
                No technicians available
              </Text>
            ) : (
              availableMSTs.map(mst => (
                <TouchableOpacity
                  key={mst.id}
                  style={[styles.pickerItem, { borderColor }]}
                  onPress={() => handleReassign(mst.id)}
                >
                  <Text style={[styles.pickerItemText, { color: textPrimary }]}>
                    {mst.full_name}
                  </Text>
                </TouchableOpacity>
              ))
            )}
            <TouchableOpacity
              style={[styles.pickerItem, { borderColor }]}
              onPress={() => setShowAssigneePicker(false)}
            >
              <Text style={[styles.pickerItemText, { color: textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <MediaCaptureModal
        isOpen={showMediaModal}
        onClose={() => { setShowMediaModal(false); setMediaUploadType(null); }}
        onCapture={handleMediaUpload}
        title={`Upload ${mediaUploadType === 'before' ? 'Before' : 'After'} Media`}
      />
    </>
  );
}

const { width } = Dimensions.get('window');
const MEDIA_SIZE = (width - 40 - 12) / 2;

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 16,
    gap: 12,
  },
  card: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  ticketNumberLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  ticketTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    lineHeight: 26,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  priorityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  pausedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  pausedText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  slaCard: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
  },
  slaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  slaTitle: {
    fontSize: 15,
    fontWeight: '800',
    flex: 1,
  },
  slaBreachTime: {
    fontSize: 13,
    fontWeight: '900',
    color: '#F43F5E',
  },
  slaSubtext: {
    fontSize: 12,
  },
  description: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 12,
  },
  divider: {
    height: 1,
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    fontSize: 12,
  },
  timeline: {
    gap: 0,
  },
  timelineItem: {
    flexDirection: 'row',
    gap: 12,
  },
  timelineLeft: {
    alignItems: 'center',
    width: 24,
  },
  timelineDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    minHeight: 24,
    marginVertical: 2,
  },
  timelineRight: {
    flex: 1,
    paddingBottom: 20,
  },
  timelineLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  timelineTime: {
    fontSize: 11,
  },
  escalationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  escalationItem: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  escLevelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  levelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(148,163,184,0.15)',
  },
  levelBadgeActive: {
    backgroundColor: 'rgba(244,63,94,0.15)',
  },
  levelText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  levelTextActive: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F43F5E',
  },
  reasonBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  reasonText: {
    fontSize: 10,
    fontWeight: '700',
  },
  escTime: {
    fontSize: 10,
    marginLeft: 'auto',
  },
  escEmployeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  escEmployee: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  escAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  escAvatarText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
  },
  escEmployeeName: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  uploadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  uploadingText: {
    fontSize: 12,
  },
  mediaGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  mediaSlot: {
    flex: 1,
    height: MEDIA_SIZE,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    overflow: 'hidden',
  },
  mediaImage: {
    width: '100%',
    height: '100%',
  },
  mediaPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  mediaSlotLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  assigneeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  assigneeAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  assigneeAvatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  assigneeInitials: {
    fontSize: 14,
    fontWeight: '700',
    color: '#7CB9A8',
  },
  assigneeName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  assigneeMeta: {
    fontSize: 11,
  },
  reassignBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(124,185,168,0.3)',
    backgroundColor: 'rgba(124,185,168,0.08)',
  },
  reassignBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7CB9A8',
  },
  noAssignee: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  noAssigneeText: {
    fontSize: 13,
  },
  assignNowBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(124,185,168,0.12)',
  },
  assignNowBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7CB9A8',
  },
  activityList: {
    gap: 0,
  },
  activityItem: {
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 14,
  },
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
    flexShrink: 0,
  },
  activityContent: {
    flex: 1,
  },
  activityText: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 2,
  },
  activityTime: {
    fontSize: 10,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  commentAuthor: {
    fontSize: 13,
    fontWeight: '700',
  },
  commentText: {
    fontSize: 13,
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  commentBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    maxHeight: 100,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#7CB9A8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  pickerCard: {
    width: '100%',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    maxHeight: 400,
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 16,
    textAlign: 'center',
  },
  pickerItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  pickerItemText: {
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
  },
  noMSTText: {
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 12,
  },
  notFoundTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  notFoundSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  backBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#7CB9A8',
    borderRadius: 12,
  },
  backBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
