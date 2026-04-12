
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import { createClient } from '@/utils/supabase/client';
import { useTheme } from '@/context';
import StatusBadge from '@/components/tickets/StatusBadge';
import MediaCaptureModal, { MediaFile } from '@/components/shared/MediaCaptureModal';
import { compressImage, getStoragePath } from '@/utils/mediaUtils';

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
  assignee: { id: string; full_name: string; user_photo_url?: string | null; property_memberships?: { role: string; property_id: string }[] } | null;
  creator:  { id: string; full_name: string; email?: string; property_memberships?: { role: string; property_id: string }[] } | null;
  location?: string;
}

interface Comment {
  id: string;
  comment: string;
  created_at: string;
  is_internal: boolean;
  user_id?: string;
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

interface MaterialItem {
  name: string;
  qty: string;
  notes: string;
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
  pending_validation: ['resolved', 'open'],
  resolved:           ['closed', 'in_progress'],
  closed:             ['in_progress'],
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
  const insets = useSafeAreaInsets();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [escalationLogs, setEscalationLogs] = useState<EscalationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'timeline' | 'chat'>('details');
  const [mediaUploadType, setMediaUploadType] = useState<'before' | 'after' | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showAssigneePicker, setShowAssigneePicker] = useState(false);
  const [availableMSTs, setAvailableMSTs] = useState<{ id: string; full_name: string }[]>([]);
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [materialItems, setMaterialItems] = useState<MaterialItem[]>([{ name: '', qty: '1', notes: '' }]);
  const [procurementUsers, setProcurementUsers] = useState<{ id: string; full_name: string; user_photo_url?: string; role?: string }[]>([]);
  const [selectedProcurementId, setSelectedProcurementId] = useState<string | null>(null);
  const [showProcurementDropdown, setShowProcurementDropdown] = useState(false);
  const [validationEnabled, setValidationEnabled] = useState(false);

  // Property segregation: verify ticket belongs to current property
  const fetchTicket = useCallback(async () => {
    if (!propertyId || !id) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);

      // Fetch ticket with property_id filter for segregation
      const { data: ticketData, error: ticketError } = await (supabase
        .from('tickets')
        .select(`*, assignee:users!assigned_to(id, full_name, user_photo_url, property_memberships(role, property_id)),
                         creator:users!raised_by(id, full_name, email, property_memberships(role, property_id))`)
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

      // Fetch validationEnabled from property_features
      const { data: featData } = await (supabase as any)
        .from('property_features')
        .select('feature_key, is_enabled')
        .eq('property_id', propertyId)
        .eq('feature_key', 'ticket_validation')
        .single();
      setValidationEnabled(featData?.is_enabled ?? true);

      // Fetch current user's role for this property
      if (user) {
        const { data: memberData } = await (supabase as any)
          .from('property_memberships')
          .select('role')
          .eq('user_id', user.id)
          .eq('property_id', propertyId)
          .eq('is_active', true)
          .single();
        setCurrentUserRole(memberData?.role ?? null);
      }

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
      .select('role, user:users(id, full_name)')
      .eq('property_id', propertyId)
      .eq('is_active', true);
    
    const msts = (data ?? [])
      .filter((m: any) => m.role !== 'client')
      .map((m: any) => ({ id: m.user?.id, full_name: m.user?.full_name }))
      .filter((u: any) => u.id && u.full_name);
    setAvailableMSTs(msts as { id: string; full_name: string }[]);
  };

  const fetchProcurementUsers = async () => {
    let users: any[] = [];
    
    // Determine organization_id based on propertyId
    let orgId = ticket?.organization_id;
    if (!orgId && propertyId) {
       console.log('[fetchProcurementUsers] Fetching orgId for property:', propertyId);
       const { data: property, error: propErr } = await (supabase.from('properties').select('organization_id').eq('id', propertyId).single() as unknown) as { data: { organization_id: string } | null; error: any };
       if (propErr) console.error('[fetchProcurementUsers] Property fetch error:', propErr);
       orgId = property?.organization_id;
    }

    console.log('[fetchProcurementUsers] Final orgId:', orgId, 'propertyId:', propertyId);

    if (orgId && orgId !== 'undefined' && orgId !== '') {
      // 1. Fetch from organization_memberships FIRST
      const { data: orgData, error: orgError } = await supabase
        .from('organization_memberships')
        .select(`role, user:users!user_id(id, full_name, user_photo_url)`)
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .eq('role', 'procurement');
      
      if (orgError) {
        console.error('[fetchProcurementUsers] Org Membership Query Error:', orgError);
      } else if (orgData) {
        users = orgData
          .map((m: any) => ({ 
            id: m.user?.id, 
            full_name: m.user?.full_name,
            user_photo_url: m.user?.user_photo_url,
            role: 'Procurement'
          }))
          .filter((u: any) => u.id && u.full_name);
      }
    }
    
    if (users.length === 0 && propertyId && propertyId !== 'undefined' && propertyId !== '') {
      // 2. Fallback to property_memberships
      const { data: propData, error: propError } = await supabase
        .from('property_memberships')
        .select(`role, user:users!user_id(id, full_name, user_photo_url)`)
        .eq('property_id', propertyId)
        .eq('is_active', true)
        .eq('role', 'procurement');
      
      if (propError) {
        console.error('[fetchProcurementUsers] Prop Membership Query Error:', propError);
      } else if (propData) {
        users = propData
          .map((m: any) => ({ 
            id: m.user?.id, 
            full_name: m.user?.full_name,
            user_photo_url: m.user?.user_photo_url,
            role: 'Procurement'
          }))
          .filter((u: any) => u.id && u.full_name);
      }
    }
    
    console.log('[fetchProcurementUsers] Success! Found users:', users.length);

    setProcurementUsers(users);
  };


  const handleAddMaterialItem = () => {
    setMaterialItems(prev => [...prev, { name: '', qty: '1', notes: '' }]);
  };

  const handleRemoveMaterialItem = (index: number) => {
    if (materialItems.length > 1) {
      setMaterialItems(materialItems.filter((_, i) => i !== index));
    } else {
      setMaterialItems([{ name: '', qty: '1', notes: '' }]);
    }
  };

  const updateMaterialItem = (index: number, field: string, value: string) => {
    const newItems = [...materialItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setMaterialItems(newItems);
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

  const handleAddMaterial = async () => {
    if (!selectedProcurementId || !id) {
       Alert.alert('Selection Required', 'Please select a procurement member to assign this request to.');
       return;
    }
    const validItems = materialItems.filter(item => item.name.trim());
    if (validItems.length === 0) {
       Alert.alert('Items Required', 'Please add at least one material item with a name.');
       return;
    }

    setShowMaterialModal(false);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id;
      const procUser = procurementUsers.find(u => u.id === selectedProcurementId);
      
      let commentText = `[MATERIAL REQUESTED]`;
      validItems.forEach((item, index) => {
        commentText += `\n${index + 1}. ${item.qty} of ${item.name.trim()}`;
        if (item.notes.trim()) commentText += ` - Notes: ${item.notes.trim()}`;
      });
      if (procUser) {
        commentText += `\nAssignee: @${procUser.full_name} (${procUser.role ?? 'Procurement'})`;
      }
      
      // 1. Store structured request in material_requests table
      const { error: materialError } = await supabase
        .from('material_requests')
        .insert({
          ticket_id: id,
          property_id: propertyId,
          requested_by: userId,
          assignee_uid: selectedProcurementId,
          items: validItems, // JSONB structure: [{name, qty, notes}] (unit removed)
          status: 'pending'
        } as any);

      if (materialError) {
        console.error('[handleAddMaterial] Error inserting into material_requests:', materialError);
        Alert.alert('Warning', 'Stored structured request failed, but we will still log it to the ticket chat.');
      }

      // 2. Insert comment for chat visibility
      const { data, error } = await supabase
        .from('ticket_comments')
        .insert({ ticket_id: id, comment: commentText, user_id: userId, is_internal: false } as any)
        .select(`*, user:users(full_name, user_photo_url)`)
        .single();
        
      if (error) throw error;
      setComments(prev => [...prev, data as Comment]);
      
      // Reset state
      setMaterialItems([{ name: '', qty: '1', notes: '' }]);
      setSelectedProcurementId(null);
      setShowProcurementDropdown(false);
      
      Alert.alert('Success', 'Material request submitted successfully.');
    } catch (err) {
      console.error('Error adding material:', err);
      Alert.alert('Error', 'Failed to submit material request. Please try again.');
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    if (!id) return;
    setUpdatingStatus(true);
    setShowStatusPicker(false);
    try {
      const updates: any = { status: newStatus };
      // Web app flow: 'closed' = MST completes (sets resolved_at), 'resolved' = tenant approves
      if ((newStatus === 'closed' || newStatus === 'resolved') && !ticket?.resolved_at) {
        updates.resolved_at = new Date().toISOString();
      }
      if (newStatus === 'closed' && !ticket?.closed_at) {
        updates.closed_at = new Date().toISOString();
      }
      if (newStatus === 'in_progress' && !ticket?.work_started_at) {
        updates.work_started_at = new Date().toISOString();
      }
      // When tenant rejects validation → back to 'open', clear resolved_at
      if (newStatus === 'open' && ticket?.status === 'pending_validation') {
        updates.resolved_at = null;
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
    const isClosed = ticket?.status === 'closed';
    const updates: any = { assigned_to: mstId, assigned_at: new Date().toISOString() };

    if (isClosed) {
      updates.status = 'in_progress';
      updates.closed_at = null;
      updates.work_started_at = new Date().toISOString();
    } else {
      updates.status = 'assigned';
    }

    try {
      const { error } = await (supabase.from('tickets') as any)
        .update(updates)
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
      const isImage = media.type === 'image';
      const extension = isImage ? 'jpg' : 'mp4';
      const path = getStoragePath(id as string, mediaUploadType, extension);
      
      let finalUri = media.uri;
      if (isImage) {
        console.log('[handleMediaUpload] Compressing image...');
        finalUri = await compressImage(media.uri);
      }

      console.log('[handleMediaUpload] Uploading to Supabase Storage:', path);
      
      // Convert URI to Blob for Supabase upload
      const response = await fetch(finalUri);
      const blob = await response.blob();
      
      const bucketName = isImage ? 'ticket_photos' : 'ticket_videos';
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(path, blob, {
          contentType: isImage ? 'image/jpeg' : 'video/mp4',
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      // Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from(bucketName)
        .getPublicUrl(path);

      console.log('[handleMediaUpload] Upload success. Public URL:', publicUrl);

      // Determine which field to update
      let field = '';
      if (isImage) {
        field = mediaUploadType === 'before' ? 'photo_before_url' : 'photo_after_url';
      } else {
        field = mediaUploadType === 'before' ? 'video_before_url' : 'video_after_url';
      }

      // Update Database
      const { error: dbError } = await (supabase.from('tickets') as any)
        .update({ [field]: publicUrl })
        .eq('id', id)
        .eq('property_id', propertyId);

      if (dbError) throw dbError;
      
      await fetchTicket();
      Alert.alert('Success', `${isImage ? 'Photo' : 'Video'} uploaded successfully.`);
    } catch (err) {
      console.error('[handleMediaUpload] Error:', err);
      Alert.alert('Upload Failed', 'There was an error storing your media. Please try again.');
    } finally {
      setIsUploading(false);
      setMediaUploadType(null);
    }
  };

  const pCfg = ticket ? (PRIORITY_CONFIG[ticket.priority?.toLowerCase()] ?? PRIORITY_CONFIG.low) : PRIORITY_CONFIG.low;
  const isAssignee = currentUser && ticket?.assignee?.id === currentUser.id;
  const isTenant = currentUserRole === 'client';
  const bg = isDark ? '#0F1521' : '#F8FAFC';
  const cardBg = isDark ? '#1E2633' : '#FFFFFF';
  const textPrimary = isDark ? '#F0F4F8' : '#1A2332';
  const textSecondary = isDark ? '#A0AEC0' : '#64748B';
  const borderColor = isDark ? 'rgba(80,100,130,0.30)' : '#E2E8F0';

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: bg }]}>
        <ActivityIndicator size="large" color="#3B82F6" />
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
        style={{ flex: 1, backgroundColor: bg, paddingBottom: insets.bottom }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <View style={[styles.customHeader, { backgroundColor: cardBg, borderBottomColor: borderColor }]}>
          <TouchableOpacity 
            onPress={() => router.back()} 
            style={styles.customBackButton}
          >
            <Ionicons name="chevron-back" size={24} color={textPrimary} />
            <Text style={[styles.customBackText, { color: textPrimary }]}>Back</Text>
          </TouchableOpacity>
        </View>

        {/* Sub-section tabs */}
        <View style={[styles.tabContainer, { backgroundColor: cardBg, borderBottomColor: borderColor }]}>
          {(['details', 'timeline', 'chat'] as const).map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[
                styles.tabBtnText,
                { color: textSecondary },
                activeTab === tab && { color: '#3B82F6', fontWeight: '800' }
              ]}>
                {tab.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView
          style={{ flex: 1, backgroundColor: activeTab === 'chat' ? (isDark ? '#0B141A' : '#EFEAE2') : undefined }}
          contentContainerStyle={[
            styles.scrollContent,
            activeTab === 'chat' && styles.chatScrollContent
          ]}
          showsVerticalScrollIndicator={false}
        >
          {activeTab === 'details' && (
            <>
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

          {/* Assignee Actions */}
          {isAssignee && ticket.status !== 'resolved' && (
            <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
              <Text style={[styles.sectionTitle, { color: textPrimary }]}>My Actions</Text>
              <View style={styles.primaryActionRow}>
                {/* Start Work */}
                {(ticket.status === 'assigned' || ticket.status === 'open' || ticket.status === 'waitlist') && (
                  <TouchableOpacity
                    style={[styles.primaryBlockBtn, { backgroundColor: '#3B82F6', flex: 1 }]}
                    onPress={() => handleUpdateStatus('in_progress')}
                    disabled={updatingStatus}
                  >
                    {updatingStatus ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <Ionicons name="play-circle" size={20} color="#FFF" />
                    )}
                    <Text style={styles.primaryBlockBtnText}>Start Work</Text>
                  </TouchableOpacity>
                )}
                {/* Complete / Send for Validation */}
                {ticket.status === 'in_progress' && (
                  <TouchableOpacity
                    style={[styles.primaryBlockBtn, { backgroundColor: validationEnabled ? '#8B5CF6' : '#10B981', flex: 1 }]}
                    onPress={() => handleUpdateStatus(validationEnabled ? 'pending_validation' : 'closed')}
                    disabled={updatingStatus}
                  >
                    {updatingStatus ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <Ionicons name={validationEnabled ? 'shield-checkmark' : 'checkmark-circle'} size={20} color="#FFF" />
                    )}
                    <Text style={styles.primaryBlockBtnText}>
                      {validationEnabled ? 'Send for Approval' : 'Complete'}
                    </Text>
                  </TouchableOpacity>
                )}
                {/* Reassign — always shown except when closed */}
                {ticket.status !== 'closed' && (
                  <TouchableOpacity
                    style={[styles.primaryBlockBtn, { backgroundColor: isDark ? '#2D3748' : '#F1F5F9', flex: 1, shadowOpacity: 0 }]}
                    onPress={() => { fetchMSTs(); setShowAssigneePicker(true); }}
                  >
                    <Ionicons name="swap-horizontal" size={18} color={textPrimary} />
                    <Text style={[styles.primaryBlockBtnText, { color: textPrimary }]}>Reassign</Text>
                  </TouchableOpacity>
                )}
                {/* Reopen — for closed tickets */}
                {ticket.status === 'closed' && (
                  <TouchableOpacity
                    style={[styles.primaryBlockBtn, { backgroundColor: '#F59E0B', flex: 1 }]}
                    onPress={() => { fetchMSTs(); setShowAssigneePicker(true); }}
                    disabled={updatingStatus}
                  >
                    {updatingStatus ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <Ionicons name="refresh-circle" size={20} color="#FFF" />
                    )}
                    <Text style={styles.primaryBlockBtnText}>Reopen</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* Tenant Validation — shown when ticket is pending client approval */}
          {isTenant && ticket.status === 'pending_validation' && (
            <View style={[styles.card, { backgroundColor: 'rgba(139,92,246,0.08)', borderColor: 'rgba(139,92,246,0.3)' }]}>
              <View style={styles.validationHeader}>
                <Ionicons name="shield-checkmark" size={22} color="#8B5CF6" />
                <Text style={[styles.sectionTitle, { color: '#8B5CF6' }]}>Awaiting Your Approval</Text>
              </View>
              <Text style={[styles.validationSubtext, { color: textSecondary }]}>
                The service team has completed the work. Please review and approve or request changes.
              </Text>
              <View style={styles.validationActions}>
                <TouchableOpacity
                  style={[styles.validateBtn, { flex: 1 }]}
                  onPress={() => handleUpdateStatus('closed')}
                  disabled={updatingStatus}
                >
                  {updatingStatus ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Ionicons name="checkmark-circle" size={18} color="#FFF" />
                  )}
                  <Text style={styles.validateBtnText}>Looks Good</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.rejectBtn, { flex: 1 }]}
                  onPress={() => handleUpdateStatus('open')}
                  disabled={updatingStatus}
                >
                  {updatingStatus ? (
                    <ActivityIndicator size="small" color="#EF4444" />
                  ) : (
                    <Ionicons name="close-circle" size={18} color="#EF4444" />
                  )}
                  <Text style={styles.rejectBtnText}>Request Changes</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

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

          {/* Ticket Information */}
          <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
            <Text style={[styles.sectionTitle, { color: textPrimary }]}>Ticket Information</Text>
            
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
              <Text style={{ color: textSecondary, fontSize: 14 }}>Category</Text>
              <Text style={{ color: textPrimary, fontSize: 14, fontWeight: '500' }}>
                {ticket.category || 'N/A'}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
              <Text style={{ color: textSecondary, fontSize: 14 }}>Raised By</Text>
              <Text style={{ color: textPrimary, fontSize: 14, fontWeight: '500', textAlign: 'right' }}>
                {ticket.creator?.full_name || 'System / Unknown'}{'\n'}
                <Text style={{ color: textSecondary, fontSize: 12, fontWeight: '400' }}>
                  {ticket.creator?.property_memberships?.find(m => m.property_id === propertyId)?.role?.replace('_', ' ')?.replace(/\b\w/g, l => l.toUpperCase()) || 'User'}
                </Text>
              </Text>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: textSecondary, fontSize: 14 }}>Served By</Text>
              <Text style={{ color: textPrimary, fontSize: 14, fontWeight: '500', textAlign: 'right' }}>
                {ticket.assignee?.full_name || 'Unassigned'}{'\n'}
                {ticket.assignee && (
                  <Text style={{ color: textSecondary, fontSize: 12, fontWeight: '400' }}>
                    {ticket.assignee.property_memberships?.find(m => m.property_id === propertyId)?.role?.replace('_', ' ')?.replace(/\b\w/g, l => l.toUpperCase()) || 'Technician'}
                  </Text>
                )}
              </Text>
            </View>
          </View>
            </>
          )}

          {activeTab === 'timeline' && (
            <>
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
            </>
          )}

          {activeTab === 'details' && (
            <>
              {/* Media Section */}
              <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
            <Text style={[styles.sectionTitle, { color: textPrimary }]}>Photos & Videos</Text>
            {isUploading && (
              <View style={styles.uploadingRow}>
                <ActivityIndicator size="small" color="#3B82F6" />
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
                ) : ticket.video_before_url ? (
                  <Video
                    source={{ uri: ticket.video_before_url }}
                    style={styles.mediaImage}
                    resizeMode={ResizeMode.COVER}
                    isMuted
                    shouldPlay
                    isLooping
                  />
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
                ) : ticket.video_after_url ? (
                  <Video
                    source={{ uri: ticket.video_after_url }}
                    style={styles.mediaImage}
                    resizeMode={ResizeMode.COVER}
                    isMuted
                    shouldPlay
                    isLooping
                  />
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
                <View style={[styles.assigneeAvatar, { backgroundColor: 'rgba(59,130,246,0.15)' }]}>
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
                  <Ionicons name="swap-horizontal" size={16} color="#3B82F6" />
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
            </>
          )}

          {activeTab === 'chat' && (
            <View style={[styles.whatsappBackground, { backgroundColor: isDark ? '#0B141A' : '#EFEAE2' }]}>
              {/* Activity Feed */}
              {(activities.length > 0 || comments.length > 0) && (
              <View style={styles.whatsappChatContainer}>
                {[
                  ...activities.map(a => ({ ...a, type: 'activity' as const })),
                  ...comments.map(c => ({ ...c, type: 'comment' as const }))
                ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                 .map(event => {
                  if (event.type === 'activity') {
                    return (
                      <View key={`act_${event.id}`} style={styles.systemPill}>
                        <Text style={styles.systemPillText}>
                          {event.user?.full_name ?? 'System'} {event.action.replace(/_/g, ' ')}
                          {event.new_value && ` to "${event.new_value}"`}
                        </Text>
                        <Text style={styles.systemPillTime}>{timeAgo(event.created_at)}</Text>
                      </View>
                    );
                  } else {
                    const isMe = currentUser && event.user_id === currentUser.id;
                    return (
                      <View key={`com_${event.id}`} style={[styles.chatRow, isMe ? styles.chatRowRight : styles.chatRowLeft]}>
                        {!isMe && (
                          <View style={[styles.chatAvatar, { backgroundColor: isDark ? '#2D3748' : '#E2E8F0' }]}>
                            {event.user?.user_photo_url ? (
                              <Image source={{ uri: event.user.user_photo_url }} style={styles.chatAvatarImg} />
                            ) : (
                              <Text style={[styles.chatAvatarText, { color: isDark ? '#A0AEC0' : '#64748B' }]}>
                                {event.user?.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() ?? '?'}
                              </Text>
                            )}
                          </View>
                        )}
                        <View style={[
                          styles.chatBubble,
                          isMe ? [styles.chatBubbleMe, { backgroundColor: isDark ? '#005C4B' : '#D9FDD3' }]
                               : [styles.chatBubbleOther, { backgroundColor: isDark ? '#202C33' : '#FFFFFF', borderColor: isDark ? 'transparent' : '#E2E8F0', borderWidth: isDark ? 0 : 1 }]
                        ]}>
                          {!isMe && (
                            <Text style={[styles.chatAuthorName, { color: isDark ? '#A0AEC0' : '#3B82F6' }]}>
                              {event.user?.full_name ?? 'Unknown'}
                            </Text>
                          )}
                          <Text style={[styles.chatMessageText, { color: isMe ? (isDark ? '#FFF' : '#111') : textPrimary }]}>
                            {event.comment}
                          </Text>
                          <Text style={[styles.chatMessageTime, { color: isMe ? (isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.45)') : textSecondary }]}>
                            {formatDate(event.created_at)}
                          </Text>
                        </View>
                      </View>
                    );
                  }
                })}
              </View>
          )}
            </View>
          )}

          {/* Bottom padding for comment input */}
          <View style={{ height: activeTab === 'chat' ? 0 : 100 }} />
        </ScrollView>

        {/* Comment Input (sticky bottom) */}
        {activeTab === 'chat' && (
          <View style={[
            styles.whatsappInputBar,
            { backgroundColor: isDark ? '#1F2C34' : '#F0F2F5' },
          ]}>
            <TouchableOpacity 
              style={{ marginRight: 8, padding: 8 }} 
              onPress={() => { setShowMaterialModal(true); fetchProcurementUsers(); }}
            >
              <Ionicons name="add" size={24} color={isDark ? '#8696A0' : '#54656F'} />
            </TouchableOpacity>
            <TextInput
              style={[
                styles.whatsappInput,
                {
                  backgroundColor: isDark ? '#2A3942' : '#FFFFFF',
                  color: textPrimary,
                },
              ]}
              placeholder="Type a message..."
              placeholderTextColor={isDark ? '#8696A0' : '#8696A0'}
              value={newComment}
              onChangeText={setNewComment}
              multiline
            />
            <View style={styles.whatsappSendWrapper}>
              <TouchableOpacity
                style={[
                  styles.whatsappSendBtn,
                  !newComment.trim() && styles.sendBtnDisabled,
                ]}
                onPress={handleSendComment}
                disabled={!newComment.trim() || sendingComment}
              >
                {sendingComment ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Ionicons name="send" size={18} color="#FFF" style={{ marginLeft: 4 }} />
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
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

      {/* Material Modal */}
      <Modal visible={showMaterialModal} transparent animationType="fade" onRequestClose={() => setShowMaterialModal(false)}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
          style={styles.modalOverlay}
        >
          <View style={[styles.pickerCard, { backgroundColor: isDark ? '#1E2633' : '#FFF', borderColor, width: '90%', padding: 24, borderRadius: 24 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4, justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name="cube-outline" size={24} color="#69D2A4" />
                <Text style={{ color: textPrimary, fontSize: 20, fontWeight: '800', fontStyle: 'italic' }}>Request Materials</Text>
              </View>
              <TouchableOpacity onPress={() => setShowMaterialModal(false)}>
                <Ionicons name="close" size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>
            <Text style={{ color: textSecondary, fontSize: 13, fontStyle: 'italic', marginBottom: 24 }}>Requisition materials from the inventory forces.</Text>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: 11, color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>Assign To Procurement</Text>
              <Text style={{ fontSize: 10, color: '#3B82F6', fontWeight: '700' }}>REQUIRED</Text>
            </View>

            <View style={{ marginBottom: 24, zIndex: 10 }}>
              <TouchableOpacity
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                  borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 16, padding: 12,
                  backgroundColor: '#FFFFFF',
                  shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2
                }}
                onPress={() => setShowProcurementDropdown(!showProcurementDropdown)}
              >
                {selectedProcurementId ? (
                  (() => {
                    const u = procurementUsers.find(user => user.id === selectedProcurementId);
                    return (
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginRight: 12, overflow: 'hidden' }}>
                          {u?.user_photo_url ? (
                            <Image source={{ uri: u.user_photo_url }} style={{ width: 40, height: 40 }} />
                          ) : (
                            <Text style={{ fontSize: 14, fontWeight: '700', color: '#64748B' }}>{u?.full_name?.charAt(0)}</Text>
                          )}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: '#1A2332', fontSize: 14, fontWeight: '700' }}>{u?.full_name}</Text>
                          <Text style={{ color: '#64748B', fontSize: 11, fontWeight: '500' }}>{u?.role ?? 'Procurement'}</Text>
                        </View>
                      </View>
                    );
                  })()
                ) : (
                  <Text style={{ color: '#64748B', fontSize: 14, fontWeight: '600' }}>-- Select Member --</Text>
                )}
                <Ionicons name={showProcurementDropdown ? "chevron-up" : "chevron-expand"} size={18} color="#64748B" />
              </TouchableOpacity>

              {showProcurementDropdown && (
                <View style={{
                  position: 'absolute', top: 68, left: 0, right: 0, zIndex: 100,
                  borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 16,
                  backgroundColor: '#FFFFFF', maxHeight: 200, overflow: 'hidden',
                  shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 5
                }}>
                  <ScrollView nestedScrollEnabled>
                    {procurementUsers.map((u, i) => (
                      <TouchableOpacity
                        key={u.id}
                        style={{
                          flexDirection: 'row', alignItems: 'center', padding: 12,
                          borderBottomWidth: i === procurementUsers.length - 1 ? 0 : 1,
                          borderBottomColor: '#F1F5F9',
                          backgroundColor: selectedProcurementId === u.id ? '#F0FDF4' : 'transparent'
                        }}
                        onPress={() => { setSelectedProcurementId(u.id); setShowProcurementDropdown(false); }}
                      >
                         <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginRight: 10, overflow: 'hidden' }}>
                          {u.user_photo_url ? (
                            <Image source={{ uri: u.user_photo_url }} style={{ width: 32, height: 32 }} />
                          ) : (
                            <Text style={{ fontSize: 12, fontWeight: '700', color: '#64748B' }}>{u.full_name?.charAt(0)}</Text>
                          )}
                        </View>
                        <View>
                          <Text style={{ color: selectedProcurementId === u.id ? '#10B981' : '#1A2332', fontSize: 13, fontWeight: '600' }}>{u.full_name}</Text>
                          <Text style={{ color: '#64748B', fontSize: 10 }}>{u.role ?? 'Procurement'}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: 15, color: '#1A2332', fontWeight: '700' }}>Material Items</Text>
              <TouchableOpacity onPress={handleAddMaterialItem} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }}>
                <Text style={{ fontSize: 12, color: '#3B82F6', fontWeight: '700' }}>+ Add Item</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView style={{ maxHeight: 300, marginBottom: 16 }}>
              {materialItems.map((item, index) => (
                <View key={index} style={{ 
                  borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 20, 
                  padding: 16, backgroundColor: '#F8FAFC', marginBottom: 12 
                }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' }}>
                      <Ionicons name="options-outline" size={20} color="#3B82F6" />
                    </View>
                    <TouchableOpacity onPress={() => handleRemoveMaterialItem(index)}>
                      <Ionicons name="trash-outline" size={20} color="#94A3B8" />
                    </TouchableOpacity>
                  </View>

                  <View style={{ marginBottom: 12 }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#94A3B8', marginBottom: 4, textTransform: 'uppercase' }}>Item Name / Code</Text>
                    <TextInput
                      style={{
                        borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, 
                        color: '#1A2332', backgroundColor: '#FFFFFF', fontSize: 14
                      }}
                      placeholder="e.g. HVAC Filter Grade-A"
                      placeholderTextColor="#CBD5E1"
                      value={item.name}
                      onChangeText={(val) => updateMaterialItem(index, 'name', val)}
                    />
                  </View>

                  <View style={{ marginBottom: 12 }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#94A3B8', marginBottom: 4, textTransform: 'uppercase' }}>Qty</Text>
                    <TextInput
                      style={{
                        borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, 
                        color: '#1A2332', backgroundColor: '#FFFFFF', fontSize: 14
                      }}
                      keyboardType="numeric"
                      value={item.qty}
                      onChangeText={(val) => updateMaterialItem(index, 'qty', val)}
                    />
                  </View>

                  <View>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#94A3B8', marginBottom: 4, textTransform: 'uppercase' }}>Notes</Text>
                    <TextInput
                      style={{
                        borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, 
                        color: '#1A2332', backgroundColor: '#FFFFFF', fontSize: 13, height: 60, textAlignVertical: 'top'
                      }}
                      multiline
                      placeholder="Specific brand requirements or delivery instructions..."
                      placeholderTextColor="#CBD5E1"
                      value={item.notes}
                      onChangeText={(val) => updateMaterialItem(index, 'notes', val)}
                    />
                  </View>
                </View>
              ))}
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 16, alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 16 }}
                onPress={() => { setShowMaterialModal(false); setMaterialItems([{ name: '', qty: '1', notes: '' }]); setSelectedProcurementId(null); setShowProcurementDropdown(false); }}
              >
                <Text style={{ color: '#64748B', fontWeight: '700', fontSize: 13, letterSpacing: 0.5 }}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1.5, paddingVertical: 16, alignItems: 'center', backgroundColor: '#69D2A4', borderRadius: 16, shadowColor: '#69D2A4', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }}
                onPress={handleAddMaterial}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="cube-outline" size={18} color="#FFF" />
                  <View>
                    <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 13, letterSpacing: 0.5 }}>SUBMIT</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.8)', fontWeight: '600', fontSize: 9, letterSpacing: 0.5 }}>REQUEST</Text>
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
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
    flexGrow: 1,
  },
  chatScrollContent: {
    padding: 0,
    gap: 0,
  },
  card: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
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
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 16,
    lineHeight: 28,
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
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginTop: 4,
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
    color: '#3B82F6',
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
    borderColor: 'rgba(59,130,246,0.3)',
    backgroundColor: 'rgba(59,130,246,0.08)',
  },
  reassignBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#3B82F6',
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
    backgroundColor: 'rgba(59,130,246,0.12)',
  },
  assignNowBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#3B82F6',
  },
  whatsappBackground: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  whatsappChatContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  systemPill: {
    alignSelf: 'center',
    backgroundColor: 'rgba(148,163,184,0.15)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 4,
    marginTop: 4,
    alignItems: 'center',
  },
  systemPillText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
    textAlign: 'center',
  },
  systemPillTime: {
    fontSize: 9,
    color: '#94A3B8',
    marginTop: 2,
  },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  chatRowLeft: {
    alignSelf: 'flex-start',
  },
  chatRowRight: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
  },
  chatAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    marginRight: 6,
    marginLeft: 6,
  },
  chatAvatarText: {
    fontSize: 10,
    fontWeight: '700',
  },
  chatAvatarImg: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  chatBubble: {
    maxWidth: '80%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 1,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  chatBubbleMe: {
    borderTopRightRadius: 4,
  },
  chatBubbleOther: {
    borderTopLeftRadius: 4,
  },
  chatAuthorName: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },
  chatMessageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  chatMessageTime: {
    fontSize: 10,
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  customHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  customBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingRight: 16,
  },
  customBackText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingHorizontal: 16,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: '#3B82F6',
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
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
  primaryActionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryBlockBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  primaryBlockBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  validationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  validationSubtext: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  validationActions: {
    flexDirection: 'row',
    gap: 12,
  },
  validateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#10B981',
  },
  validateBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
  },
  rejectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
  },
  rejectBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#EF4444',
  },
  whatsappInputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  whatsappInput: {
    flex: 1,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingTop: 12,
    fontSize: 15,
    maxHeight: 120,
    elevation: 0,
  },
  whatsappSendWrapper: {
    justifyContent: 'flex-end',
    paddingBottom: 2,
  },
  whatsappSendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#00A884',
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
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    maxHeight: 500,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 20,
    textAlign: 'center',
  },
  pickerItem: {
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  pickerItemText: {
    fontSize: 16,
    fontWeight: '600',
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
    backgroundColor: '#3B82F6',
    borderRadius: 12,
  },
  backBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
