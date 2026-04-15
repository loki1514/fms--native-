import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/context';
import TicketListItem from '@/components/tickets/TicketListItem';
import MediaCaptureModal, { MediaFile } from '@/components/shared/MediaCaptureModal';

type StatusFilter = 'all' | 'open' | 'in_progress' | 'resolved' | 'closed';
type DateRangeFilter = 'all' | 'today' | 'week' | 'month';

const FILTER_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'all',         label: 'All' },
  { key: 'open',        label: 'Open' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'resolved',    label: 'Resolved' },
  { key: 'closed',      label: 'Closed' },
];

const DATE_RANGES: { key: DateRangeFilter; label: string }[] = [
  { key: 'all',   label: 'All Time' },
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
];

interface TicketEscalationLog {
  from_level: number;
  to_level: number | null;
  escalated_at: string;
  from_employee?: { full_name: string; user_photo_url?: string | null } | null;
  to_employee?: { full_name: string; user_photo_url?: string | null } | null;
}

interface Ticket {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  ticket_number: string;
  created_at: string;
  updated_at: string;
  property_id: string;
  organization_id: string;
  assignee: { id: string; full_name: string; user_photo_url?: string | null } | null;
  creator:  { id: string; full_name: string } | null;
  photo_before_url?: string | null;
  ticket_escalation_logs?: TicketEscalationLog[];
}

const PAGE_SIZE = 20;

export default function TicketsScreen() {
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();
  const router = useRouter();
  const supabase = createClient();
  const { membership, user: authUser } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [dateRange, setDateRange] = useState<DateRangeFilter>('all');
  const [statusCounts, setStatusCounts] = useState<Record<StatusFilter, number>>({
    all: 0, open: 0, in_progress: 0, resolved: 0, closed: 0,
  });
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createPriority, setCreatePriority] = useState<string>('medium');
  const [createCategory, setCreateCategory] = useState<string>('');
  const [createMedia, setCreateMedia] = useState<MediaFile | null>(null);
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState(false);

  const insets = useSafeAreaInsets();
  const orgId = membership?.org_id ?? '';

  const buildQuery = useCallback((offset: number, limit: number) => {
    if (!propertyId) return null;
    let q = supabase
      .from('tickets')
      .select(`id, title, description, status, priority, ticket_number, created_at, updated_at,
               property_id, organization_id, photo_before_url,
               assignee:users!assigned_to(id, full_name, user_photo_url),
               creator:users!raised_by(id, full_name),
               ticket_escalation_logs(from_level, to_level, escalated_at,
                 from_employee:users!from_employee_id(full_name, user_photo_url),
                 to_employee:users!to_employee_id(full_name, user_photo_url))`)
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (statusFilter === 'open') {
      q = q.in('status', ['open', 'assigned']);
    } else if (statusFilter === 'in_progress') {
      q = q.in('status', ['in_progress', 'paused', 'pending_validation']);
    } else if (statusFilter !== 'all') {
      q = q.eq('status', statusFilter);
    }

    if (dateRange !== 'all') {
      const now = new Date();
      const end = now.toISOString().split('T')[0] + 'T23:59:59';
      let start: string;
      if (dateRange === 'today') {
        start = now.toISOString().split('T')[0];
      } else if (dateRange === 'week') {
        const d = new Date(now);
        d.setDate(d.getDate() - 7);
        start = d.toISOString().split('T')[0];
      } else {
        const d = new Date(now);
        d.setDate(d.getDate() - 30);
        start = d.toISOString().split('T')[0];
      }
      q = q.gte('created_at', start).lte('created_at', end);
    }

    return q;
  }, [propertyId, statusFilter, dateRange, supabase]);

  const fetchTickets = useCallback(async (reset = false) => {
    if (!propertyId) return;
    if (reset) setLoading(true);
    try {
      const q = buildQuery(0, PAGE_SIZE + 1);
      if (!q) return;
      const { data, error } = await q;
      let items: Ticket[] = (data ?? []) as Ticket[];
      if (error && error.code === 'PGRST116') {
        // No rows — not an error, just empty
        items = [];
      } else if (error) {
        throw error;
      }
      const hasMoreItems = items.length > PAGE_SIZE;
      setTickets(items.slice(0, PAGE_SIZE));
      setHasMore(hasMoreItems);
    } catch (err) {
      console.error('Error fetching tickets:', err);
      setTickets([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [propertyId, buildQuery]);

  useEffect(() => {
    fetchTickets(true);
    fetchStatusCounts();
  }, [statusFilter]);

  useEffect(() => {
    fetchStatusCounts();
  }, [dateRange]);

  const loadMore = async () => {
    if (loadingMore || !hasMore || !propertyId) return;
    setLoadingMore(true);
    try {
      const q = buildQuery(tickets.length, PAGE_SIZE + 1);
      if (!q) return;
      const { data, error } = await q;
      let items: Ticket[] = (data ?? []) as Ticket[];
      if (error && error.code === 'PGRST116') items = [];
      else if (error) throw error;
      setTickets(prev => [...prev, ...items.slice(0, PAGE_SIZE)]);
      setHasMore(items.length > PAGE_SIZE);
    } catch (err) {
      console.error('Error loading more:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  const fetchStatusCounts = async () => {
    if (!propertyId) return;
    try {
      const counts: Record<StatusFilter, number> = {
        all: 0, open: 0, in_progress: 0, resolved: 0, closed: 0,
      };

      const getDateRange = (range: DateRangeFilter) => {
        const now = new Date();
        const end = now.toISOString().split('T')[0] + 'T23:59:59';
        if (range === 'today') return { start: now.toISOString().split('T')[0], end };
        if (range === 'week') { const d = new Date(now); d.setDate(d.getDate() - 7); return { start: d.toISOString().split('T')[0], end }; }
        if (range === 'month') { const d = new Date(now); d.setDate(d.getDate() - 30); return { start: d.toISOString().split('T')[0], end }; }
        return { start: '1970-01-01', end };
      };
      const { start, end } = getDateRange(dateRange);

      const { count: allCount } = await supabase
        .from('tickets').select('id', { count: 'exact', head: true })
        .eq('property_id', propertyId).gte('created_at', start).lte('created_at', end) as any;
      counts.all = allCount ?? 0;

      const { count: openCount } = await supabase
        .from('tickets').select('id', { count: 'exact', head: true })
        .eq('property_id', propertyId).in('status', ['open', 'assigned'])
        .gte('created_at', start).lte('created_at', end) as any;
      counts.open = openCount ?? 0;

      const { count: progressCount } = await supabase
        .from('tickets').select('id', { count: 'exact', head: true })
        .eq('property_id', propertyId).in('status', ['in_progress', 'paused', 'pending_validation'])
        .gte('created_at', start).lte('created_at', end) as any;
      counts.in_progress = progressCount ?? 0;

      const { count: resolvedCount } = await supabase
        .from('tickets').select('id', { count: 'exact', head: true })
        .eq('property_id', propertyId).eq('status', 'resolved')
        .gte('created_at', start).lte('created_at', end) as any;
      counts.resolved = resolvedCount ?? 0;

      const { count: closedCount } = await supabase
        .from('tickets').select('id', { count: 'exact', head: true })
        .eq('property_id', propertyId).eq('status', 'closed')
        .gte('created_at', start).lte('created_at', end) as any;
      counts.closed = closedCount ?? 0;

      setStatusCounts(counts);
    } catch (err) {
      console.error('Error fetching status counts:', err);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchTickets(true);
  };

  const handleCreateTicket = async () => {
    if (!createDescription.trim() || !propertyId || !orgId) return;
    setIsSubmitting(true);
    setCreateError(null);
    try {
      const userId = authUser?.id;
      const { data, error } = await supabase
        .from('tickets')
        .insert({
          title: createTitle.trim() || createDescription.split('\n')[0].slice(0, 80) || 'Untitled Request',
          description: createDescription.trim(),
          priority: createPriority,
          category: createCategory || null,
          property_id: propertyId,
          organization_id: orgId,
          status: 'open',
          raised_by: userId,
        } as any)
        .select()
        .single();

      if (error) throw error;
      setCreateSuccess(true);
      setTimeout(() => {
        setShowCreateModal(false);
        setCreateSuccess(false);
        setCreateTitle('');
        setCreateDescription('');
        setCreatePriority('medium');
        setCreateCategory('');
        setCreateMedia(null);
        fetchTickets(true);
        fetchStatusCounts();
      }, 1500);
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create ticket');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetCreate = () => {
    setCreateTitle('');
    setCreateDescription('');
    setCreatePriority('medium');
    setCreateCategory('');
    setCreateMedia(null);
    setCreateError(null);
    setCreateSuccess(false);
  };

  const renderTicket = ({ item }: { item: Ticket }) => {
    const logs = item.ticket_escalation_logs;
    let escalationChain: { name: string; avatar?: string | null }[] | undefined;
    if (logs && logs.length > 0) {
      const sorted = [...logs].sort(
        (a, b) => new Date(a.escalated_at).getTime() - new Date(b.escalated_at).getTime()
      );
      escalationChain = [];
      sorted.forEach((log, i) => {
        if (i === 0 && log.from_employee?.full_name) {
          escalationChain!.push({ name: log.from_employee.full_name, avatar: log.from_employee.user_photo_url ?? undefined });
        }
        if (log.to_employee?.full_name) {
          escalationChain!.push({ name: log.to_employee.full_name, avatar: log.to_employee.user_photo_url ?? undefined });
        }
      });
      if (escalationChain.length === 0) escalationChain = undefined;
    }
    return (
      <TicketListItem
        id={item.id}
        title={item.title}
        status={item.status}
        priority={item.priority ?? 'medium'}
        ticketNumber={item.ticket_number ?? item.id.slice(0, 8).toUpperCase()}
        createdAt={item.created_at}
        assignedTo={item.assignee?.full_name}
        assigneePhotoUrl={item.assignee?.user_photo_url}
        photoUrl={item.photo_before_url ?? undefined}
        escalationChain={escalationChain}
        onPress={() => router.push(`/property/${propertyId}/tickets/${item.id}`)}
      />
    );
  };

  const bg = isDark ? '#0F1521' : '#F5F0E8';
  const cardBg = isDark ? 'rgba(30,38,55,0.88)' : 'rgba(255,255,255,0.88)';
  const textPrimary = isDark ? '#F0F4F8' : '#1A2332';
  const textSecondary = isDark ? '#A0AEC0' : '#64748B';
  const borderColor = isDark ? 'rgba(80,100,130,0.30)' : 'rgba(180,195,210,0.35)';

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Requests',
          headerBackTitle: 'Back',
          headerStyle: { backgroundColor: bg },
          headerTintColor: textPrimary,
          headerShadowVisible: false,
        }}
      />

      <View style={[styles.container, { backgroundColor: bg, paddingBottom: insets.bottom }]}>
        {/* Filter Tabs */}
        <View style={[styles.tabBar, { backgroundColor: cardBg, borderBottomColor: borderColor }]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabScroll}
          >
            {FILTER_TABS.map(tab => (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.tab,
                  statusFilter === tab.key && {
                    backgroundColor: isDark ? 'rgba(124,185,168,0.15)' : 'rgba(124,185,168,0.12)',
                  },
                ]}
                onPress={() => setStatusFilter(tab.key)}
              >
                <Text
                  style={[
                    styles.tabText,
                    { color: statusFilter === tab.key ? '#7CB9A8' : textSecondary },
                    statusFilter === tab.key && { fontWeight: '700' },
                  ]}
                >
                  {tab.label}
                </Text>
                <View style={[styles.countBadge, {
                  backgroundColor: statusFilter === tab.key
                    ? '#7CB9A8'
                    : (isDark ? 'rgba(124,185,168,0.15)' : 'rgba(124,185,168,0.20)'),
                }]}>
                  <Text style={[styles.countBadgeText, {
                    color: statusFilter === tab.key ? '#FFF' : '#7CB9A8',
                  }]}>
                    {statusCounts[tab.key]}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Date Range Filter */}
        <View style={[styles.dateFilterRow, { borderBottomColor: borderColor }]}>
          <TouchableOpacity
            style={styles.dateFilterBtn}
            onPress={() => setShowDateFilter(!showDateFilter)}
            activeOpacity={0.7}
          >
            <Ionicons name="calendar-outline" size={15} color={textSecondary} />
            <Text style={[styles.dateFilterLabel, { color: textSecondary }]}>
              {DATE_RANGES.find(d => d.key === dateRange)?.label ?? 'All Time'}
            </Text>
            <Ionicons
              name={showDateFilter ? 'chevron-up' : 'chevron-down'}
              size={14}
              color={textSecondary}
            />
          </TouchableOpacity>
        </View>

        {/* Date Range Dropdown */}
        {showDateFilter && (
          <View style={[styles.dateFilterDropdown, { backgroundColor: cardBg, borderColor }]}>
            {DATE_RANGES.map(opt => (
              <TouchableOpacity
                key={opt.key}
                style={[
                  styles.dateFilterOption,
                  dateRange === opt.key && { backgroundColor: isDark ? 'rgba(124,185,168,0.12)' : 'rgba(124,185,168,0.08)' },
                ]}
                onPress={() => { setDateRange(opt.key); setShowDateFilter(false); }}
              >
                <Text style={[styles.dateFilterOptionText, {
                  color: dateRange === opt.key ? '#7CB9A8' : textSecondary,
                  fontWeight: dateRange === opt.key ? '700' : '500',
                }]}>
                  {opt.label}
                </Text>
                {dateRange === opt.key && (
                  <Ionicons name="checkmark" size={16} color="#7CB9A8" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Ticket List */}
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#7CB9A8" />
          </View>
        ) : tickets.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="ticket-outline" size={64} color={isDark ? '#4B5563' : '#CBD5E1'} />
            <Text style={[styles.emptyTitle, { color: textPrimary }]}>No Requests</Text>
            <Text style={[styles.emptySubtitle, { color: textSecondary }]}>
              {statusFilter === 'all'
                ? 'No requests found for this property.'
                : `No ${statusFilter.replace('_', ' ')} requests.`}
            </Text>
            <TouchableOpacity
              style={styles.emptyCreateBtn}
              onPress={() => setShowCreateModal(true)}
            >
              <Text style={styles.emptyCreateBtnText}>Raise a Request</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={tickets}
            renderItem={renderTicket}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#7CB9A8"
                colors={['#7CB9A8']}
              />
            }
            onEndReached={loadMore}
            onEndReachedThreshold={0.3}
            ListFooterComponent={
              loadingMore ? (
                <View style={styles.loadingMore}>
                  <ActivityIndicator size="small" color="#7CB9A8" />
                </View>
              ) : hasMore ? (
                <TouchableOpacity style={styles.loadMoreBtn} onPress={loadMore}>
                  <Text style={styles.loadMoreBtnText}>Load More</Text>
                </TouchableOpacity>
              ) : null
            }
          />
        )}

        {/* Floating Create Button */}
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setShowCreateModal(true)}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={28} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* Create Ticket Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        onRequestClose={() => { setShowCreateModal(false); resetCreate(); }}
      >
        <View style={[styles.modalContainer, { backgroundColor: isDark ? '#0F1521' : '#FFF', paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
          >
            {/* Modal Header */}
            <View style={[styles.modalHeader, { borderBottomColor: borderColor }]}>
              <TouchableOpacity
                onPress={() => { setShowCreateModal(false); resetCreate(); }}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={22} color={textPrimary} />
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: textPrimary }]}>Raise Request</Text>
              <View style={{ width: 40 }} />
            </View>

            <ScrollView
              style={styles.modalForm}
              contentContainerStyle={{ padding: 20 }}
              keyboardShouldPersistTaps="handled"
            >
              {createSuccess ? (
                <View style={styles.successView}>
                  <Ionicons name="checkmark-circle" size={80} color="#10B981" />
                  <Text style={[styles.successText, { color: textPrimary }]}>Request Submitted!</Text>
                  <Text style={[styles.successSubtext, { color: textSecondary }]}>
                    Your ticket has been created and assigned.
                  </Text>
                </View>
              ) : (
                <>
                  {/* Title */}
                  <View style={styles.field}>
                    <Text style={[styles.label, { color: textSecondary }]}>Title (optional)</Text>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          backgroundColor: isDark ? '#1E2633' : '#F8FAFC',
                          color: textPrimary,
                          borderColor: borderColor,
                        },
                      ]}
                      placeholder="Brief title for the request"
                      placeholderTextColor={isDark ? '#6E7681' : '#94A3B8'}
                      value={createTitle}
                      onChangeText={setCreateTitle}
                    />
                  </View>

                  {/* Description */}
                  <View style={styles.field}>
                    <Text style={[styles.label, { color: textSecondary }]}>Description *</Text>
                    <TextInput
                      style={[
                        styles.textArea,
                        {
                          backgroundColor: isDark ? '#1E2633' : '#F8FAFC',
                          color: textPrimary,
                          borderColor: borderColor,
                        },
                      ]}
                      placeholder="Describe the issue in detail..."
                      placeholderTextColor={isDark ? '#6E7681' : '#94A3B8'}
                      multiline
                      value={createDescription}
                      onChangeText={setCreateDescription}
                    />
                  </View>

                  {/* Priority */}
                  <View style={styles.field}>
                    <Text style={[styles.label, { color: textSecondary }]}>Priority</Text>
                    <View style={styles.chipRow}>
                      {(['low', 'medium', 'high', 'critical'] as const).map(p => (
                        <TouchableOpacity
                          key={p}
                          style={[
                            styles.chip,
                            { backgroundColor: isDark ? '#1E2633' : '#F1F5F9', borderColor: borderColor },
                            createPriority === p && {
                              backgroundColor: isDark ? 'rgba(124,185,168,0.15)' : 'rgba(124,185,168,0.1)',
                              borderColor: '#7CB9A8',
                            },
                          ]}
                          onPress={() => setCreatePriority(p)}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              { color: textSecondary },
                              createPriority === p && { color: '#7CB9A8', fontWeight: '700' },
                            ]}
                          >
                            {p.charAt(0).toUpperCase() + p.slice(1)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Category */}
                  <View style={styles.field}>
                    <Text style={[styles.label, { color: textSecondary }]}>Category (optional)</Text>
                    <View style={styles.chipRow}>
                      {(['electrical', 'plumbing', 'hvac', 'cleaning', 'security', 'other'] as const).map(c => (
                        <TouchableOpacity
                          key={c}
                          style={[
                            styles.chip,
                            { backgroundColor: isDark ? '#1E2633' : '#F1F5F9', borderColor: borderColor },
                            createCategory === c && {
                              backgroundColor: isDark ? 'rgba(124,185,168,0.15)' : 'rgba(124,185,168,0.1)',
                              borderColor: '#7CB9A8',
                            },
                          ]}
                          onPress={() => setCreateCategory(createCategory === c ? '' : c)}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              { color: textSecondary },
                              createCategory === c && { color: '#7CB9A8', fontWeight: '700' },
                            ]}
                          >
                            {c.charAt(0).toUpperCase() + c.slice(1)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Media */}
                  <View style={styles.field}>
                    <Text style={[styles.label, { color: textSecondary }]}>Attachment (optional)</Text>
                    {createMedia ? (
                      <View style={styles.mediaPreview}>
                        {createMedia.type === 'image' && (
                          <Image source={{ uri: createMedia.uri }} style={styles.previewImage} />
                        )}
                        <TouchableOpacity style={styles.removeMedia} onPress={() => setCreateMedia(null)}>
                          <Ionicons name="close" size={14} color="#FFF" />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={[styles.mediaPlaceholder, { borderColor }]}
                        onPress={() => setShowMediaModal(true)}
                      >
                        <Ionicons name="camera-outline" size={28} color={isDark ? '#6E7681' : '#94A3B8'} />
                        <Text style={[styles.mediaPlaceholderText, { color: textSecondary }]}>
                          Add Photo or Video
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {createError && (
                    <Text style={styles.errorText}>{createError}</Text>
                  )}

                  <TouchableOpacity
                    style={[
                      styles.submitBtn,
                      (!createDescription.trim() || isSubmitting) && styles.submitBtnDisabled,
                    ]}
                    onPress={handleCreateTicket}
                    disabled={isSubmitting || !createDescription.trim()}
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
                </>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        </View>

        <MediaCaptureModal
          isOpen={showMediaModal}
          onClose={() => setShowMediaModal(false)}
          onCapture={setCreateMedia}
          title="Capture Evidence"
        />
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabBar: {
    borderBottomWidth: 1,
    paddingVertical: 8,
  },
  tabScroll: {
    paddingHorizontal: 12,
    gap: 6,
    flexDirection: 'row',
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  countBadge: {
    marginLeft: 6,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 1,
    minWidth: 24,
    alignItems: 'center',
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  dateFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  dateFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  dateFilterLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  dateFilterDropdown: {
    marginHorizontal: 16,
    marginTop: 6,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  dateFilterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  dateFilterOptionText: {
    fontSize: 13,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingTop: 12,
    paddingBottom: 100,
  },
  loadingMore: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  loadMoreBtn: {
    marginVertical: 16,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: '#7CB9A8',
    borderRadius: 20,
  },
  loadMoreBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyCreateBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#7CB9A8',
    borderRadius: 12,
  },
  emptyCreateBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#7CB9A8',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  modalContainer: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(124,185,168,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  modalForm: { flex: 1 },
  field: { marginBottom: 20 },
  label: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    height: 120,
    textAlignVertical: 'top',
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  mediaPlaceholder: {
    height: 100,
    borderStyle: 'dashed',
    borderWidth: 2,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  mediaPlaceholderText: {
    fontSize: 12,
    fontWeight: '700',
  },
  mediaPreview: {
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  removeMedia: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
  submitBtn: {
    flexDirection: 'row',
    backgroundColor: '#7CB9A8',
    padding: 18,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
    marginBottom: 40,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  successView: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  successText: {
    fontSize: 22,
    fontWeight: '900',
    marginTop: 20,
    marginBottom: 8,
  },
  successSubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
});
