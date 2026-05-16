import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Modal,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useTheme } from '@/context';
import { GlassCard } from '@/constants/designSystem';
import { updateMaterialRequestStatus } from '@/utils/api/mobileApi';

interface Notification {
  id: string;
  notification_type: string;
  title: string;
  message: string;
  deep_link: string;
  ticket_id?: string;
  is_read: boolean;
  created_at: string;
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const { user: authUser } = useAuth();
  const { theme } = useTheme();
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();
  const { capabilities } = useCapabilities(propertyId);
  const isDark = theme === 'dark';

  const canApprove = capabilities.procurement?.includes('approve');

  const fetchNotifications = useCallback(async () => {
    if (!authUser?.id) return;
    setIsLoading(true);

    const { data, error } = await (supabase
      .from('notifications')
      .select('*')
      .eq('user_id', authUser.id)
      .order('created_at', { ascending: false })
      .limit(50) as any);

    if (!error && data) {
      setNotifications(data);
      setUnreadCount(data.filter((n: any) => !n.is_read).length);
    }
    setIsLoading(false);
  }, [supabase, authUser?.id]);

  useEffect(() => {
    let channel: any;

    const init = async () => {
      await fetchNotifications();
      if (!authUser?.id) return;

      channel = supabase
        .channel(`notif-bell-${authUser.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${authUser.id}`,
          },
          (payload) => {
            setNotifications((prev) => [payload.new as Notification, ...prev]);
            setUnreadCount((count) => count + 1);
          }
        )
        .subscribe();
    };

    init();
    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [fetchNotifications, supabase, authUser?.id]);

  const markAsRead = async (id: string) => {
    const { error } = await (supabase as any)
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);

    if (!error) {
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
      setUnreadCount((count) => Math.max(0, count - 1));
    }
  };

  const markAllAsRead = async () => {
    if (!authUser?.id) return;
    const { error } = await (supabase as any)
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', authUser.id)
      .neq('is_read', true);

    if (!error) {
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    }
  };

  const handleNotificationPress = (notif: Notification) => {
    setIsOpen(false);
    if (!notif.is_read) markAsRead(notif.id);

    if (notif.ticket_id) {
      router.push(`/tickets/${notif.ticket_id}` as any);
    } else if (notif.deep_link) {
      // Convert web deep links to mobile routes
      const mobileRoute = convertDeepLink(notif.deep_link);
      router.push(mobileRoute as any);
    }
  };

  const convertDeepLink = (deepLink: string): string => {
    // Web: /procurement?tab=approvals → Mobile: /property/{propertyId}/stock (closest module)
    if (deepLink.includes('/procurement')) {
      return propertyId ? `/property/${propertyId}/stock` : '/dashboard';
    }
    if (deepLink.includes('/tickets/')) {
      const match = deepLink.match(/\/tickets\/([^?]+)/);
      if (match) return `/tickets/${match[1]}`;
    }
    return deepLink;
  };

  const handleMaterialAction = async (
    notif: Notification,
    status: 'approved' | 'rejected'
  ) => {
    // Extract material request ID from deep_link or notification data
    // The deep_link is /procurement?tab=approvals — we need the request ID
    // Unfortunately the notification table doesn't store request_id directly
    // We'll need to fetch pending approvals and match by ticket/title
    setActionLoading(notif.id);
    try {
      Alert.alert(
        status === 'approved' ? 'Approve Request' : 'Reject Request',
        `Are you sure you want to ${status} this material request?`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => setActionLoading(null) },
          {
            text: status === 'approved' ? 'Approve' : 'Reject',
            style: status === 'approved' ? 'default' : 'destructive',
            onPress: async () => {
              // Since we don't have request_id in notification, we show a message
              // In a full implementation, the notification should include metadata
              Alert.alert(
                'Navigate to Approve',
                'Please go to the Stock module to view and approve this request with full details.',
                [
                  {
                    text: 'Go to Stock',
                    onPress: () => {
                      markAsRead(notif.id);
                      setIsOpen(false);
                      if (propertyId) {
                        router.push(`/property/${propertyId}/stock` as any);
                      }
                    },
                  },
                  { text: 'Cancel', style: 'cancel' },
                ]
              );
              setActionLoading(null);
            },
          },
        ]
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to process');
      setActionLoading(null);
    }
  };

  const getIconName = (type: string): keyof typeof Ionicons.glyphMap => {
    switch (type) {
      case 'TICKET_CREATED': return 'alert-circle-outline';
      case 'TICKET_ASSIGNED': return 'time-outline';
      case 'TICKET_COMPLETED': return 'checkmark-circle-outline';
      case 'TICKET_CRITICAL': return 'warning-outline';
      case 'TICKET_PENDING_VALIDATION': return 'eye-outline';
      case 'TICKET_ESCALATED': return 'trending-up-outline';
      case 'SLA_BREACH': return 'flash-outline';
      case 'SLA_WARNING': return 'timer-outline';
      case 'MATERIAL_REQUEST_PENDING': return 'cube-outline';
      case 'MATERIAL_REQUEST_ASSIGNED': return 'cube-outline';
      case 'MATERIAL_REQUEST_STATUS_CHANGE': return 'cube-outline';
      case 'ROOM_BOOKED': return 'calendar-outline';
      case 'VISITOR_CHECKED_IN': return 'person-outline';
      case 'SOP_REMINDER': return 'clipboard-outline';
      case 'SOP_RATING': return 'star-outline';
      case 'PPM_REMINDER': return 'construct-outline';
      default: return 'information-circle-outline';
    }
  };

  const getIconColor = (type: string): string => {
    switch (type) {
      case 'TICKET_CRITICAL':
      case 'SLA_BREACH': return '#EF4444';
      case 'TICKET_CREATED': return '#2997FF';
      case 'TICKET_COMPLETED': return '#10B981';
      case 'MATERIAL_REQUEST_PENDING': return '#FF9F0A';
      case 'MATERIAL_REQUEST_STATUS_CHANGE': return '#AF52DE';
      case 'SLA_WARNING': return '#FF9F0A';
      default: return '#708F96';
    }
  };

  const getTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr.endsWith('Z') ? dateStr : dateStr + 'Z');
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const renderNotificationItem = ({ item }: { item: Notification }) => {
    const isMaterialPending =
      item.notification_type === 'MATERIAL_REQUEST_PENDING' && canApprove;

    return (
      <View style={[styles.notifItem, !item.is_read && styles.notifUnread]}>
        <TouchableOpacity
          style={styles.notifMain}
          onPress={() => handleNotificationPress(item)}
          activeOpacity={0.6}
        >
          <View
            style={[
              styles.notifIcon,
              { backgroundColor: `${getIconColor(item.notification_type)}12`, borderColor: `${getIconColor(item.notification_type)}20` },
            ]}
          >
            <Ionicons
              name={getIconName(item.notification_type)}
              size={18}
              color={getIconColor(item.notification_type)}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={[
                styles.notifTitle,
                !item.is_read && { color: isDark ? '#F8FAFC' : '#1A2332' },
                isDark && item.is_read && { color: 'rgba(230,235,238,0.6)' },
              ]}
            >
              {item.title}
            </Text>
            <Text
              style={[
                styles.notifMessage,
                isDark && { color: 'rgba(230,235,238,0.45)' },
              ]}
              numberOfLines={2}
            >
              {item.message}
            </Text>
            <Text
              style={[
                styles.notifTime,
                isDark && { color: 'rgba(230,235,238,0.3)' },
              ]}
            >
              {getTimeAgo(item.created_at)}
            </Text>
          </View>
          {!item.is_read && <View style={styles.unreadDot} />}
        </TouchableOpacity>

        {/* Take Action — Material Request Approval */}
        {isMaterialPending && (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.rejectBtn]}
              onPress={() => handleMaterialAction(item, 'rejected')}
              disabled={actionLoading === item.id}
              activeOpacity={0.7}
            >
              <Ionicons name="close-circle" size={14} color="#EF4444" />
              <Text style={styles.rejectText}>Reject</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.approveBtn]}
              onPress={() => handleMaterialAction(item, 'approved')}
              disabled={actionLoading === item.id}
              activeOpacity={0.7}
            >
              <Ionicons name="checkmark-circle" size={14} color="#10B981" />
              <Text style={styles.approveText}>Approve</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <>
      <TouchableOpacity style={styles.bellButton} onPress={() => setIsOpen(true)}>
        <Ionicons
          name="notifications-outline"
          size={22}
          color={isDark ? 'rgba(230,235,238,0.6)' : '#64748B'}
        />
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      <Modal
        visible={isOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsOpen(false)}
        statusBarTranslucent
      >
        <View style={[styles.modalOverlay, { backgroundColor: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.3)' }]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setIsOpen(false)} activeOpacity={1} />
          <GlassCard style={[styles.modalContent, ...(isDark ? [{ backgroundColor: 'rgba(30,30,30,0.95)' }] : [])]}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text
                style={[
                  styles.modalTitle,
                  { color: isDark ? '#F8FAFC' : '#1A2332' },
                ]}
              >
                Notifications
              </Text>
              <View style={styles.headerActions}>
                {unreadCount > 0 && (
                  <TouchableOpacity onPress={markAllAsRead}>
                    <Text style={styles.markAllText}>Mark all read</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => setIsOpen(false)} style={styles.closeButton}>
                  <Ionicons name="close" size={22} color={isDark ? 'rgba(230,235,238,0.6)' : '#64748B'} />
                </TouchableOpacity>
              </View>
            </View>

            {/* List */}
            {isLoading ? (
              <View style={styles.emptyState}>
                <ActivityIndicator size="small" color="#708F96" />
              </View>
            ) : notifications.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="notifications-off-outline" size={32} color={isDark ? 'rgba(255,255,255,0.15)' : '#E2E8F0'} />
                <Text style={[styles.emptyText, isDark && { color: 'rgba(230,235,238,0.4)' }]}>
                  No notifications yet
                </Text>
              </View>
            ) : (
              <FlatList
                data={notifications}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                renderItem={renderNotificationItem}
                contentContainerStyle={{ paddingBottom: 24 }}
              />
            )}
          </GlassCard>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bellButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#F43F5E',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontFamily: 'Poppins-Bold',
    fontSize: 9,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    minHeight: '40%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(112,143,150,0.1)',
  },
  modalTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  markAllText: {
    fontFamily: 'Poppins-Medium',
    fontSize: 13,
    fontWeight: '600',
    color: '#708F96',
  },
  closeButton: {
    padding: 4,
  },
  emptyState: {
    padding: 48,
    alignItems: 'center',
    gap: 12,
  },
  emptyText: {
    fontFamily: 'Urbanist-Medium',
    fontSize: 13,
    fontWeight: '500',
    color: '#94A3B8',
  },
  notifItem: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(112,143,150,0.08)',
  },
  notifUnread: {
    backgroundColor: 'rgba(41,151,255,0.03)',
  },
  notifMain: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
  },
  notifIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  notifTitle: {
    fontFamily: 'Poppins-Medium',
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 2,
  },
  notifMessage: {
    fontFamily: 'Urbanist-Regular',
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 18,
  },
  notifTime: {
    fontFamily: 'Urbanist-Medium',
    fontSize: 11,
    fontWeight: '500',
    color: '#CBD5E1',
    marginTop: 4,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#708F96',
    marginTop: 6,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 14,
    paddingTop: 4,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
  },
  rejectBtn: {
    backgroundColor: 'rgba(239,68,68,0.06)',
    borderColor: 'rgba(239,68,68,0.18)',
  },
  rejectText: {
    fontFamily: 'Poppins-Medium',
    fontSize: 12,
    fontWeight: '600',
    color: '#EF4444',
  },
  approveBtn: {
    backgroundColor: 'rgba(16,185,129,0.06)',
    borderColor: 'rgba(16,185,129,0.18)',
  },
  approveText: {
    fontFamily: 'Poppins-Medium',
    fontSize: 12,
    fontWeight: '600',
    color: '#10B981',
  },
});
