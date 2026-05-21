import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
  ActivityIndicator,
  Platform,
  Image,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Props {
  visible: boolean;
  onClose: () => void;
  propertyId: string;
}

type TabKey = 'notifications' | 'pending';

interface PendingAction {
  id: string;
  title: string;
  body: string;
  type: 'procurement' | 'approval';
  status: string;
  created_at: string;
  requester_name?: string;
  total_amount?: number;
  items?: { name: string; quantity: number }[];
  raw: any;
}

export default function NotificationModal({ visible, onClose, propertyId }: Props) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>('notifications');
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible && user) {
      fetchNotifications();
      fetchPendingActions();
    }
  }, [visible, user]);

  const fetchNotifications = async () => {
    setIsLoading(true);
    const supabase = createClient();
    try {
      const userId = user?.id;
      if (!userId) return;
      const { data, error } = await supabase
        .from('notifications')
        .select('*, ticket:tickets(id, description, photo_before_url)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);

      let finalData = data as any[] | null;

      if (error || !data) {
        const fallbackRes = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(20);

        if (fallbackRes.data && fallbackRes.data.length > 0) {
          finalData = fallbackRes.data;
          const ticketIds = (finalData as any[])
            .map((n: any) => n.ticket_id)
            .filter(Boolean);

          if (ticketIds.length > 0) {
            const { data: ticketsData } = await supabase
              .from('tickets')
              .select('id, description, photo_before_url')
              .in('id', ticketIds);

            const ticketList = ticketsData as any[] | null;
            if (ticketList) {
              const ticketMap: any = {};
              ticketList.forEach(t => ticketMap[t.id] = t);
              finalData = (finalData as any[]).map((n: any) => {
                const tid = n.ticket_id;
                if (tid && ticketMap[tid]) {
                  return { ...n, ticket: ticketMap[tid] };
                }
                return n;
              });
            }
          }
        }
      }

      if (finalData && finalData.length > 0) {
        setNotifications(finalData);
      } else {
        setNotifications([]);
      }
    } catch (e) {
      setNotifications([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPendingActions = useCallback(async () => {
    if (!user?.id || !propertyId) return;
    setPendingLoading(true);
    const supabase = createClient();
    try {
      // Fetch material_requests pending approval where current user is a target approver
      const { data: requests, error } = await supabase
        .from('material_requests')
        .select(`
          *,
          requester:requested_by(full_name),
          items:material_request_items(name, quantity)
        `)
        .eq('property_id', propertyId)
        .eq('status', 'pending')
        .or(`target_approver_id.eq.${user.id},target_approver_ids.cs.{${user.id}}`)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('[PendingActions] fetch error:', error);
        setPendingActions([]);
        return;
      }

      const mapped: PendingAction[] = (requests || []).map((req: any) => ({
        id: req.id,
        title: req.ticket?.title || `Material Request #${req.id.slice(0, 6).toUpperCase()}`,
        body: req.notes || `Requested by ${req.requester?.full_name || 'Unknown'}`,
        type: 'procurement',
        status: req.status,
        created_at: req.created_at,
        requester_name: req.requester?.full_name,
        total_amount: req.total_amount,
        items: req.items || [],
        raw: req,
      }));

      setPendingActions(mapped);
    } catch (e) {
      console.warn('[PendingActions] exception:', e);
      setPendingActions([]);
    } finally {
      setPendingLoading(false);
    }
  }, [user?.id, propertyId]);

  const handleProcurementAction = async (actionId: string, status: 'approved' | 'rejected') => {
    setActionLoadingId(actionId);
    const supabase = createClient();
    try {
      const { error } = await (supabase
        .from('material_requests') as any)
        .update({
          status,
          [`${status === 'approved' ? 'approved' : 'rejected'}_by`]: user?.id,
          [`${status === 'approved' ? 'approved' : 'rejected'}_at`]: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', actionId);

      if (error) {
        Alert.alert('Error', error.message);
      } else {
        setPendingActions(prev => prev.filter(a => a.id !== actionId));
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to update request');
    } finally {
      setActionLoadingId(null);
    }
  };

  const getIconName = (type?: string) => {
    switch (type) {
      case 'TICKET_CREATED':
      case 'ticket_assigned': return 'time';
      case 'TICKET_ESCALATED':
      case 'sla_warning': return 'timer';
      case 'visitor_arrived': return 'person';
      default: return 'notifications';
    }
  };

  const getIconColor = (type?: string) => {
    switch (type) {
      case 'TICKET_CREATED':
      case 'ticket_assigned': return '#3B82F6';
      case 'TICKET_ESCALATED':
      case 'sla_warning': return '#F59E0B';
      case 'visitor_arrived': return '#10B981';
      default: return '#708F96';
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const isToday = date.getDate() === today.getDate() &&
                    date.getMonth() === today.getMonth() &&
                    date.getFullYear() === today.getFullYear();
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ', ' +
           date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleNotificationPress = (item: any) => {
    const ticketId = item.ticket_id || item.reference_id || item.ticket?.id;
    if (ticketId || item.notification_type === 'ticket_assigned' || item.notification_type === 'TICKET_CREATED') {
      onClose();
      router.push(`/(app)/property/${propertyId}/tickets/${ticketId || 'mock-123'}` as any);
    }
  };

  const renderNotificationItem = ({ item }: { item: any }) => {
    const photoUrl = item.ticket?.photo_before_url || item.photo_before_url || item.ticket?.before_photo || item.before_photo;
    const descText = item.ticket?.description || item.description || item.message || item.body;
    const isRead = item.is_read !== undefined ? item.is_read : item.read;
    const type = item.notification_type || item.type;

    return (
      <TouchableOpacity
        style={[styles.itemCard, !isRead && styles.unreadItem]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.8}
      >
        {photoUrl ? (
          <Image source={{ uri: photoUrl }} style={styles.notificationImage} />
        ) : (
          <View style={[styles.iconContainer, { backgroundColor: getIconColor(type) + '20' }]}>
            <Ionicons name={getIconName(type)} size={20} color={getIconColor(type)} />
          </View>
        )}
        <View style={styles.textContainer}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.body} numberOfLines={2}>{descText}</Text>
          <Text style={styles.time}>{formatTime(item.created_at)}</Text>
        </View>
        {!isRead && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  const renderPendingActionItem = ({ item }: { item: PendingAction }) => {
    const isLoading = actionLoadingId === item.id;
    return (
      <View style={styles.itemCard}>
        <View style={[styles.iconContainer, { backgroundColor: '#F59E0B20' }]}>
          <Ionicons name="cart" size={20} color="#F59E0B" />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.body}>{item.body}</Text>
          {item.items && item.items.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.itemsScroll} showsVerticalScrollIndicator={false}>
              {item.items.map((it, idx) => (
                <View key={idx} style={styles.itemChip}>
                  <Text style={styles.itemChipText}>{it.name} × {it.quantity}</Text>
                </View>
              ))}
            </ScrollView>
          )}
          {item.total_amount !== undefined && item.total_amount > 0 && (
            <Text style={styles.amountText}>₹{item.total_amount.toLocaleString()}</Text>
          )}
          <Text style={styles.time}>{formatTime(item.created_at)}</Text>
          <View style={styles.actionButtonsRow}>
            <TouchableOpacity
              style={[styles.approveBtn, isLoading && { opacity: 0.5 }]}
              onPress={() => handleProcurementAction(item.id, 'approved')}
              disabled={isLoading}
              activeOpacity={0.7}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.approveBtnText}>Approve</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.rejectBtn, isLoading && { opacity: 0.5 }]}
              onPress={() => handleProcurementAction(item.id, 'rejected')}
              disabled={isLoading}
              activeOpacity={0.7}
            >
              <Text style={styles.rejectBtnText}>Decline</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const pendingCount = pendingActions.length;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />

        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <Text style={styles.headerTitle}>Notifications Center</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* Tab Switcher */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'notifications' && styles.activeTab]}
            onPress={() => setActiveTab('notifications')}
          >
            <Text style={[styles.tabText, activeTab === 'notifications' && styles.activeTabText]}>
              Notifications {notifications.length > 0 && `(${notifications.length})`}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'pending' && styles.activeTab]}
            onPress={() => setActiveTab('pending')}
          >
            <Text style={[styles.tabText, activeTab === 'pending' && styles.activeTabText]}>
              Pending Actions {pendingCount > 0 && `(${pendingCount})`}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {activeTab === 'notifications' ? (
            isLoading ? (
              <View style={styles.centerContent}>
                <ActivityIndicator size="large" color="#3B82F6" />
              </View>
            ) : notifications.length === 0 ? (
              <View style={styles.centerContent}>
                <Ionicons name="notifications-off-outline" size={48} color="rgba(255,255,255,0.2)" />
                <Text style={styles.emptyText}>No notifications yet</Text>
              </View>
            ) : (
              <FlatList
                data={notifications}
                keyExtractor={(item) => item.id}
                renderItem={renderNotificationItem}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
              />
            )
          ) : (
            pendingLoading ? (
              <View style={styles.centerContent}>
                <ActivityIndicator size="large" color="#3B82F6" />
              </View>
            ) : pendingActions.length === 0 ? (
              <View style={styles.centerContent}>
                <Ionicons name="checkmark-circle-outline" size={48} color="rgba(255,255,255,0.2)" />
                <Text style={styles.emptyText}>All caught up!</Text>
              </View>
            ) : (
              <FlatList
                data={pendingActions}
                keyExtractor={(item) => item.id}
                renderItem={renderPendingActionItem}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
              />
            )
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(10,10,10,0.5)',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: -0.5,
  },
  closeBtn: {
    padding: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#3B82F6',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
  },
  activeTabText: {
    color: '#FFF',
  },
  content: {
    flex: 1,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
  },
  emptyText: {
    color: 'rgba(255,255,255,0.4)',
    marginTop: 12,
    fontSize: 16,
  },
  listContent: {
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  itemCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  unreadItem: {
    backgroundColor: 'rgba(59,130,246,0.08)',
    borderColor: 'rgba(59,130,246,0.2)',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  notificationImage: {
    width: 48,
    height: 48,
    borderRadius: 12,
    marginRight: 16,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 4,
  },
  body: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 8,
    lineHeight: 20,
  },
  time: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 4,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3B82F6',
    marginLeft: 12,
    alignSelf: 'center',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  approveBtn: {
    backgroundColor: '#10B981',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  approveBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  rejectBtn: {
    backgroundColor: 'transparent',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  rejectBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  itemsScroll: {
    marginTop: 4,
    marginBottom: 8,
  },
  itemChip: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  itemChipText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
  amountText: {
    color: '#F59E0B',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
});
