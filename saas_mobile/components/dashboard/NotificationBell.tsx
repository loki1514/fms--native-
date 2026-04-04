import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Modal,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { createClient } from '@/utils/supabase/client';

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
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const fetchNotifications = useCallback(async () => {
    setIsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await (supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20) as any);

    if (!error && data) {
      setNotifications(data);
      setUnreadCount(data.filter((n: any) => !n.is_read).length);
    }
    setIsLoading(false);
  }, [supabase]);

  useEffect(() => {
    let channel: any;

    const init = async () => {
      await fetchNotifications();

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      channel = supabase
        .channel(`notif-bell-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
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
  }, [fetchNotifications, supabase]);

  const markAsRead = async (id: string) => {
    const { error } = await (supabase as any)
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);

    if (!error) {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(count => Math.max(0, count - 1));
    }
  };

  const markAllAsRead = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await (supabase as any)
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .neq('is_read', true);

    if (!error) {
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    }
  };

  const handleNotificationPress = (notif: Notification) => {
    setIsOpen(false);
    if (!notif.is_read) markAsRead(notif.id);

    if (notif.ticket_id) {
      router.push(`/tickets/${notif.ticket_id}` as any);
    } else if (notif.deep_link) {
      router.push(notif.deep_link as any);
    }
  };

  const getIconName = (type: string): keyof typeof Ionicons.glyphMap => {
    switch (type) {
      case 'TICKET_CREATED': return 'alert-circle-outline';
      case 'TICKET_ASSIGNED': return 'time-outline';
      case 'TICKET_COMPLETED': return 'checkmark-circle-outline';
      default: return 'information-circle-outline';
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

  return (
    <>
      <TouchableOpacity style={styles.bellButton} onPress={() => setIsOpen(true)}>
        <Ionicons name="notifications-outline" size={22} color="#64748B" />
        {unreadCount > 0 && <View style={styles.badge} />}
      </TouchableOpacity>

      <Modal
        visible={isOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Notifications</Text>
              <View style={styles.headerActions}>
                {unreadCount > 0 && (
                  <TouchableOpacity onPress={markAllAsRead}>
                    <Text style={styles.markAllText}>Mark all read</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => setIsOpen(false)} style={styles.closeButton}>
                  <Ionicons name="close" size={22} color="#64748B" />
                </TouchableOpacity>
              </View>
            </View>

            {/* List */}
            {isLoading ? (
              <View style={styles.emptyState}>
                <ActivityIndicator size="small" color="#7C3AED" />
              </View>
            ) : notifications.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="notifications-off-outline" size={32} color="#E2E8F0" />
                <Text style={styles.emptyText}>No notifications yet</Text>
              </View>
            ) : (
              <FlatList
                data={notifications}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.notifItem, !item.is_read && styles.notifUnread]}
                    onPress={() => handleNotificationPress(item)}
                    activeOpacity={0.6}
                  >
                    <View style={[styles.notifIcon, !item.is_read && styles.notifIconUnread]}>
                      <Ionicons
                        name={getIconName(item.notification_type)}
                        size={18}
                        color={!item.is_read ? '#7C3AED' : '#94A3B8'}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.notifTitle, !item.is_read && { color: '#1A2332' }]}>
                        {item.title}
                      </Text>
                      <Text style={styles.notifMessage} numberOfLines={2}>
                        {item.message}
                      </Text>
                      <Text style={styles.notifTime}>{getTimeAgo(item.created_at)}</Text>
                    </View>
                    {!item.is_read && <View style={styles.unreadDot} />}
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bellButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#F43F5E',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    minHeight: '50%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A2332',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  markAllText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#7C3AED',
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
    fontSize: 12,
    fontWeight: '500',
    color: '#94A3B8',
  },
  notifItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  notifUnread: {
    backgroundColor: 'rgba(59,130,246,0.03)',
  },
  notifIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  notifIconUnread: {
    backgroundColor: 'rgba(124,58,237,0.06)',
    borderColor: 'rgba(124,58,237,0.1)',
  },
  notifTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 2,
  },
  notifMessage: {
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 18,
  },
  notifTime: {
    fontSize: 11,
    fontWeight: '500',
    color: '#CBD5E1',
    marginTop: 4,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#7C3AED',
    marginTop: 6,
  },
});
