import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context';
import { useAuth } from '@/hooks/useAuth';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/utils/supabase/client';
import { Calendar, DateData } from 'react-native-calendars';
import {
  Wrench,
  CalendarDays,
  FileText,
  ChevronRight,
  X,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Building2,
  RefreshCw,
  Plus,
} from 'lucide-react-native';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PPMSchedule {
  id: string;
  asset_name: string;
  asset_id?: string;
  schedule_type: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual';
  next_due: string;
  last_completed?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'overdue';
  property_id: string;
  description?: string;
}

interface AMCContract {
  id: string;
  vendor_name: string;
  asset_name: string;
  start_date: string;
  end_date: string;
  status: 'active' | 'expiring_soon' | 'expired';
  contract_value?: number;
  property_id: string;
  description?: string;
}

// ─── Utility ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function daysUntil(dateStr: string): number {
  if (!dateStr) return 999;
  const target = new Date(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / 86400000);
}

function getMarkedDates(
  schedules: PPMSchedule[],
  selectedDate: string | null
): Record<string, any> {
  const marked: Record<string, any> = {};

  // Mark schedule due dates
  schedules.forEach((s) => {
    if (!s.next_due) return;
    const dateKey = s.next_due.split('T')[0];
    const existing = marked[dateKey];
    const color = s.status === 'overdue' ? '#EF6B6B' : s.status === 'completed' ? '#3A8C6D' : '#F59E0B';
    marked[dateKey] = {
      selected: dateKey === selectedDate,
      selectedColor: '#7CB9A8',
      dots: [
        ...(existing?.dots || []),
        { key: s.id, color },
      ].slice(0, 3),
      marked: true,
    };
  });

  // Mark selected
  if (selectedDate) {
    marked[selectedDate] = {
      ...marked[selectedDate],
      selected: true,
      selectedColor: '#7CB9A8',
    };
  }

  return marked;
}

// ─── Main Screen ───────────────────────────────────────────────────────────────

type PPMTab = 'calendar' | 'schedules' | 'amc';

export default function PPMScreen() {
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();
  const { theme } = useTheme();
  const { membership } = useAuth();
  const colors = Colors[theme];
  const insets = useSafeAreaInsets();
  const screenWidth = Dimensions.get('window').width;

  // ── State ────────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<PPMTab>('calendar');
  const [schedules, setSchedules] = useState<PPMSchedule[]>([]);
  const [contracts, setContracts] = useState<AMCContract[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSchedule, setSelectedSchedule] = useState<PPMSchedule | null>(null);
  const [showScheduleDetail, setShowScheduleDetail] = useState(false);
  const [showAddSchedule, setShowAddSchedule] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Add schedule form
  const [formAssetName, setFormAssetName] = useState('');
  const [formScheduleType, setFormScheduleType] = useState<PPMSchedule['schedule_type']>('monthly');
  const [formNextDue, setFormNextDue] = useState('');
  const [formDescription, setFormDescription] = useState('');

  // ── Computed ────────────────────────────────────────────────────────────────
  const isAdmin = useMemo(() => {
    if (!membership || !propertyId) return false;
    const prop = membership.properties.find((p) => p.id === propertyId);
    return prop ? ['property_admin', 'org_admin', 'org_super_admin', 'master_admin'].includes(prop.role.toLowerCase()) : false;
  }, [membership, propertyId]);

  const markedDates = useMemo(() => getMarkedDates(schedules, selectedDate), [schedules, selectedDate]);

  const selectedDaySchedules = useMemo(() => {
    if (!selectedDate) return [];
    return schedules.filter((s) => s.next_due && s.next_due.split('T')[0] === selectedDate);
  }, [schedules, selectedDate]);

  const overdueSchedules = useMemo(() => {
    return schedules.filter((s) => s.status === 'overdue' || (s.next_due && daysUntil(s.next_due) < 0));
  }, [schedules]);

  const expiringContracts = useMemo(() => {
    return contracts.filter((c) => c.status === 'expiring_soon' || c.status === 'expired');
  }, [contracts]);

  // Calendar min/max dates
  const calendarTheme = useMemo(() => ({
    backgroundColor: colors.card,
    calendarBackground: colors.card,
    textSectionTitleColor: colors.textSecondary,
    selectedDayBackgroundColor: colors.primary,
    selectedDayTextColor: '#FFFFFF',
    todayTextColor: colors.primary,
    dayTextColor: colors.text,
    textDisabledColor: colors.textTertiary,
    dotColor: colors.primary,
    arrowColor: colors.primary,
    monthTextColor: colors.text,
    textDayFontFamily: 'Urbanist-Regular',
    textMonthFontFamily: 'Poppins-Bold',
    textDayHeaderFontFamily: 'Urbanist-Bold',
    textDayFontSize: 13,
    textMonthFontSize: 16,
    textDayHeaderFontSize: 11,
  }), [colors]);

  // ── Fetch ───────────────────────────────────────────────────────────────────
  const fetchSchedules = useCallback(async () => {
    if (!propertyId) return;
    try {
      const { data, error } = await supabase
        .from('ppm_schedules')
        .select('*')
        .eq('property_id', propertyId)
        .order('next_due');
      if (error) throw error;
      setSchedules((data || []) as PPMSchedule[]);
    } catch (err) {
      console.error('Error fetching PPM schedules:', err);
    }
  }, [propertyId]);

  const fetchContracts = useCallback(async () => {
    if (!propertyId) return;
    try {
      const { data, error } = await supabase
        .from('amc_contracts')
        .select('*')
        .eq('property_id', propertyId)
        .order('end_date');
      if (error) throw error;
      // Compute status
      const enriched = (data || []).map((c: any) => {
        const days = daysUntil(c.end_date);
        let status: AMCContract['status'] = 'active';
        if (days < 0) status = 'expired';
        else if (days <= 30) status = 'expiring_soon';
        return { ...c, status } as AMCContract;
      });
      setContracts(enriched);
    } catch (err) {
      console.error('Error fetching AMC contracts:', err);
    }
  }, [propertyId]);

  const fetchAll = useCallback(async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);
    try {
      await Promise.all([fetchSchedules(), fetchContracts()]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [fetchSchedules, fetchContracts]);

  useEffect(() => {
    if (propertyId) fetchAll();
  }, [propertyId, fetchAll]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleRefresh = () => fetchAll(true);

  const handleDayPress = (day: DateData) => {
    setSelectedDate(selectedDate === day.dateString ? null : day.dateString);
  };

  const handleSchedulePress = (schedule: PPMSchedule) => {
    setSelectedSchedule(schedule);
    setShowScheduleDetail(true);
  };

  const handleAddSchedule = async () => {
    if (!formAssetName.trim() || !propertyId) {
      Alert.alert('Error', 'Asset name is required');
      return;
    }
    setIsSaving(true);
    try {
      const { error } = await (supabase.from('ppm_schedules') as any).insert({
        property_id: propertyId,
        asset_name: formAssetName.trim(),
        schedule_type: formScheduleType,
        next_due: formNextDue || new Date().toISOString(),
        description: formDescription.trim() || null,
        status: 'pending',
      });
      if (error) throw error;
      setShowAddSchedule(false);
      resetForm();
      await fetchSchedules();
      Alert.alert('Success', 'PPM schedule created');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create schedule');
    } finally {
      setIsSaving(false);
    }
  };

  const handleMarkComplete = async (schedule: PPMSchedule) => {
    try {
      const { error } = await (supabase.from('ppm_schedules') as any)
        .update({ status: 'completed', last_completed: new Date().toISOString(), next_due: getNextDueDate(schedule.schedule_type) })
        .eq('id', schedule.id);
      if (error) throw error;
      setShowScheduleDetail(false);
      await fetchSchedules();
      Alert.alert('Done', 'PPM task marked as complete');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const resetForm = () => {
    setFormAssetName('');
    setFormScheduleType('monthly');
    setFormNextDue('');
    setFormDescription('');
  };

  function getNextDueDate(scheduleType: string): string {
    const d = new Date();
    switch (scheduleType) {
      case 'daily': d.setDate(d.getDate() + 1); break;
      case 'weekly': d.setDate(d.getDate() + 7); break;
      case 'monthly': d.setMonth(d.getMonth() + 1); break;
      case 'quarterly': d.setMonth(d.getMonth() + 3); break;
      case 'annual': d.setFullYear(d.getFullYear() + 1); break;
    }
    return d.toISOString();
  }

  // ─── Render ─────────────────────────────────────────────────────────────────
  const bgColor = theme === 'light' ? '#FBF8F4' : colors.background;

  if (isLoading && schedules.length === 0 && contracts.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: bgColor, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading PPM...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: bgColor, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* ── Header ── */}
      <View style={[styles.headerSection, { backgroundColor: '#708F96' }]}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>Preventive Maintenance</Text>
          {isAdmin && (
            <TouchableOpacity
              style={[styles.headerBtn, { backgroundColor: 'rgba(255,255,255,0.25)' }]}
              onPress={() => setShowAddSchedule(true)}
            >
              <Plus size={20} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>

        {/* Tab bar */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'calendar' ? { backgroundColor: 'rgba(255,255,255,0.25)' } : null]}
            onPress={() => setActiveTab('calendar')}
          >
            <CalendarDays size={14} color="rgba(255,255,255,0.8)" />
            <Text style={[styles.tabText, { color: 'rgba(255,255,255,0.8)' }]}>Calendar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'schedules' ? { backgroundColor: 'rgba(255,255,255,0.25)' } : null]}
            onPress={() => setActiveTab('schedules')}
          >
            <Wrench size={14} color="rgba(255,255,255,0.8)" />
            <Text style={[styles.tabText, { color: 'rgba(255,255,255,0.8)' }]}>Schedules</Text>
            {overdueSchedules.length > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{overdueSchedules.length}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'amc' ? { backgroundColor: 'rgba(255,255,255,0.25)' } : null]}
            onPress={() => setActiveTab('amc')}
          >
            <FileText size={14} color="rgba(255,255,255,0.8)" />
            <Text style={[styles.tabText, { color: 'rgba(255,255,255,0.8)' }]}>AMC</Text>
            {expiringContracts.length > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{expiringContracts.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Calendar Tab ── */}
      {activeTab === 'calendar' && (
        <ScrollView
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
          contentContainerStyle={styles.calendarContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.calendarCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Calendar
              onDayPress={handleDayPress}
              markingType="multi-dot"
              markedDates={markedDates}
              theme={calendarTheme as any}
              style={styles.calendar}
            />
          </View>

          {/* Legend */}
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#EF6B6B' }]} />
              <Text style={[styles.legendText, { color: colors.textSecondary }]}>Overdue</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
              <Text style={[styles.legendText, { color: colors.textSecondary }]}>Pending</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#3A8C6D' }]} />
              <Text style={[styles.legendText, { color: colors.textSecondary }]}>Completed</Text>
            </View>
          </View>

          {/* Selected day details */}
          {selectedDate && (
            <View style={styles.dayDetailSection}>
              <Text style={[styles.dayDetailTitle, { color: colors.text }]}>
                {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </Text>
              {selectedDaySchedules.length === 0 ? (
                <View style={[styles.emptyDay, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <CheckCircle2 size={24} color={colors.textTertiary} />
                  <Text style={[styles.emptyDayText, { color: colors.textTertiary }]}>No schedules for this day</Text>
                </View>
              ) : (
                selectedDaySchedules.map((schedule) => (
                  <TouchableOpacity
                    key={schedule.id}
                    style={[styles.scheduleCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                    onPress={() => handleSchedulePress(schedule)}
                  >
                    <View style={styles.scheduleCardLeft}>
                      <View style={[styles.scheduleIconWrap, { backgroundColor: (schedule.status === 'overdue' ? colors.errorBg : colors.warningBg) }]}>
                        <Wrench size={16} color={schedule.status === 'overdue' ? colors.error : colors.warning} />
                      </View>
                    </View>
                    <View style={styles.scheduleCardContent}>
                      <Text style={[styles.scheduleName, { color: colors.text }]}>{schedule.asset_name}</Text>
                      <Text style={[styles.scheduleMeta, { color: colors.textSecondary }]}>
                        {schedule.schedule_type} · {schedule.description || 'No description'}
                      </Text>
                    </View>
                    <View style={styles.scheduleCardRight}>
                      <View style={[styles.statusBadge, {
                        backgroundColor: schedule.status === 'overdue' ? colors.errorBg : schedule.status === 'completed' ? colors.successBg : colors.warningBg
                      }]}>
                        <Text style={[styles.statusBadgeText, {
                          color: schedule.status === 'overdue' ? colors.error : schedule.status === 'completed' ? colors.success : colors.warning
                        }]}>
                          {schedule.status.toUpperCase()}
                        </Text>
                      </View>
                      <ChevronRight size={14} color={colors.textTertiary} />
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}

          {/* Overdue alert */}
          {overdueSchedules.length > 0 && (
            <View style={styles.overdueAlert}>
              <View style={styles.overdueAlertHeader}>
                <AlertTriangle size={16} color={colors.error} />
                <Text style={[styles.overdueAlertTitle, { color: colors.error }]}>
                  {overdueSchedules.length} overdue task(s)
                </Text>
              </View>
              {overdueSchedules.slice(0, 3).map((s) => (
                <TouchableOpacity key={s.id} style={styles.overdueItem} onPress={() => handleSchedulePress(s)}>
                  <Text style={[styles.overdueItemText, { color: colors.text }]}>{s.asset_name}</Text>
                  <ChevronRight size={14} color={colors.textTertiary} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* ── Schedules Tab ── */}
      {activeTab === 'schedules' && (
        <FlatList
          data={schedules}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            overdueSchedules.length > 0 ? (
              <View style={[styles.overdueBanner, { backgroundColor: colors.errorBg }]}>
                <AlertTriangle size={14} color={colors.error} />
                <Text style={[styles.overdueBannerText, { color: colors.error }]}>
                  {overdueSchedules.length} overdue task(s)
                </Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Wrench size={48} color={colors.textTertiary} />
              <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>No schedules yet</Text>
              {isAdmin && (
                <TouchableOpacity style={[styles.createBtn, { backgroundColor: colors.primary }]} onPress={() => setShowAddSchedule(true)}>
                  <Text style={styles.createBtnText}>Add Schedule</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          renderItem={({ item: schedule }) => {
            const days = schedule.next_due ? daysUntil(schedule.next_due) : 999;
            const isOverdue = days < 0;
            const isDueSoon = days >= 0 && days <= 3;

            return (
              <TouchableOpacity
                style={[styles.scheduleCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => handleSchedulePress(schedule)}
              >
                <View style={styles.scheduleCardLeft}>
                  <View style={[styles.scheduleIconWrap, {
                    backgroundColor: isOverdue ? colors.errorBg : isDueSoon ? colors.warningBg : colors.successBg
                  }]}>
                    <Wrench size={16} color={isOverdue ? colors.error : isDueSoon ? colors.warning : colors.success} />
                  </View>
                </View>
                <View style={styles.scheduleCardContent}>
                  <Text style={[styles.scheduleName, { color: colors.text }]} numberOfLines={1}>{schedule.asset_name}</Text>
                  <Text style={[styles.scheduleMeta, { color: colors.textSecondary }]}>
                    {schedule.schedule_type} · Due: {schedule.next_due ? formatDate(schedule.next_due) : '-'}
                  </Text>
                </View>
                <View style={styles.scheduleCardRight}>
                  {isOverdue ? (
                    <View style={[styles.statusBadge, { backgroundColor: colors.errorBg }]}>
                      <Text style={[styles.statusBadgeText, { color: colors.error }]}>OVERDUE</Text>
                    </View>
                  ) : days <= 3 ? (
                    <View style={[styles.statusBadge, { backgroundColor: colors.warningBg }]}>
                      <Text style={[styles.statusBadgeText, { color: colors.warning }]}>DUE SOON</Text>
                    </View>
                  ) : (
                    <View style={[styles.statusBadge, { backgroundColor: colors.successBg }]}>
                      <Text style={[styles.statusBadgeText, { color: colors.success }]}>OK</Text>
                    </View>
                  )}
                  <ChevronRight size={14} color={colors.textTertiary} />
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* ── AMC Tab ── */}
      {activeTab === 'amc' && (
        <FlatList
          data={contracts}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <FileText size={48} color={colors.textTertiary} />
              <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>No AMC contracts</Text>
            </View>
          }
          renderItem={({ item: contract }) => {
            const days = daysUntil(contract.end_date);
            const isExpired = days < 0;
            const isExpiringSoon = days >= 0 && days <= 30;
            const statusColor = isExpired ? colors.error : isExpiringSoon ? colors.warning : colors.success;
            const statusBg = isExpired ? colors.errorBg : isExpiringSoon ? colors.warningBg : colors.successBg;

            return (
              <TouchableOpacity style={[styles.contractCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.contractHeader}>
                  <View style={[styles.contractIcon, { backgroundColor: statusBg }]}>
                    <Building2 size={18} color={statusColor} />
                  </View>
                  <View style={styles.contractContent}>
                    <Text style={[styles.contractAsset, { color: colors.text }]} numberOfLines={1}>{contract.asset_name}</Text>
                    <Text style={[styles.contractVendor, { color: colors.textSecondary }]}>{contract.vendor_name}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
                    <Text style={[styles.statusBadgeText, { color: statusColor }]}>
                      {isExpired ? 'EXPIRED' : isExpiringSoon ? 'EXPIRING' : 'ACTIVE'}
                    </Text>
                  </View>
                </View>
                <View style={styles.contractDates}>
                  <View style={styles.dateItem}>
                    <Text style={[styles.dateLabel, { color: colors.textTertiary }]}>Start</Text>
                    <Text style={[styles.dateValue, { color: colors.text }]}>{formatDate(contract.start_date)}</Text>
                  </View>
                  <View style={styles.dateDivider} />
                  <View style={styles.dateItem}>
                    <Text style={[styles.dateLabel, { color: colors.textTertiary }]}>End</Text>
                    <Text style={[styles.dateValue, { color: isExpired ? colors.error : colors.text }]}>{formatDate(contract.end_date)}</Text>
                  </View>
                  {contract.contract_value && (
                    <>
                      <View style={styles.dateDivider} />
                      <View style={styles.dateItem}>
                        <Text style={[styles.dateLabel, { color: colors.textTertiary }]}>Value</Text>
                        <Text style={[styles.dateValue, { color: colors.text }]}>₹{contract.contract_value.toLocaleString()}</Text>
                      </View>
                    </>
                  )}
                </View>
                {isExpiringSoon && !isExpired && (
                  <View style={[styles.expiryAlert, { backgroundColor: colors.warningBg }]}>
                    <Clock size={12} color={colors.warning} />
                    <Text style={[styles.expiryAlertText, { color: colors.warning }]}>
                      Expires in {days} day{days !== 1 ? 's' : ''}
                    </Text>
                  </View>
                )}
                {contract.description && (
                  <Text style={[styles.contractDesc, { color: colors.textTertiary }]} numberOfLines={2}>{contract.description}</Text>
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* ── Schedule Detail Bottom Sheet ── */}
      <Modal visible={showScheduleDetail} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowScheduleDetail(false)} />
          <View style={[styles.detailSheet, { backgroundColor: colors.card }]}>
            <View style={styles.modalHandle} />
            {selectedSchedule && (
              <>
                <View style={styles.detailHeader}>
                  <View style={[styles.detailIconWrap, { backgroundColor: colors.primary + '18' }]}>
                    <Wrench size={24} color={colors.primary} />
                  </View>
                  <View style={styles.detailHeaderContent}>
                    <Text style={[styles.detailTitle, { color: colors.text }]}>{selectedSchedule.asset_name}</Text>
                    <Text style={[styles.detailSubtitle, { color: colors.textSecondary }]}>
                      {selectedSchedule.schedule_type} schedule
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setShowScheduleDetail(false)}>
                    <X size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                <View style={styles.detailStatsRow}>
                  <View style={[styles.detailStatCard, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.detailStatLabel, { color: colors.textTertiary }]}>Next Due</Text>
                    <Text style={[styles.detailStatValue, { color: colors.text }]}>{formatDate(selectedSchedule.next_due)}</Text>
                  </View>
                  <View style={[styles.detailStatCard, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.detailStatLabel, { color: colors.textTertiary }]}>Status</Text>
                    <Text style={[styles.detailStatValue, { color: selectedSchedule.status === 'overdue' ? colors.error : colors.success }]}>
                      {selectedSchedule.status}
                    </Text>
                  </View>
                  <View style={[styles.detailStatCard, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.detailStatLabel, { color: colors.textTertiary }]}>Last Done</Text>
                    <Text style={[styles.detailStatValue, { color: colors.text }]}>
                      {selectedSchedule.last_completed ? formatDate(selectedSchedule.last_completed) : 'Never'}
                    </Text>
                  </View>
                </View>

                {selectedSchedule.description && (
                  <View style={[styles.descBanner, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.descText, { color: colors.textSecondary }]}>{selectedSchedule.description}</Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.markCompleteBtn, { backgroundColor: colors.success }]}
                  onPress={() => handleMarkComplete(selectedSchedule)}
                >
                  <CheckCircle2 size={20} color="#FFFFFF" />
                  <Text style={styles.markCompleteBtnText}>Mark as Complete</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ── Add Schedule Modal ── */}
      <Modal visible={showAddSchedule} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Add PPM Schedule</Text>
                <TouchableOpacity onPress={() => { setShowAddSchedule(false); resetForm(); }}>
                  <X size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Asset / Equipment Name *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                  placeholder="e.g. HVAC Unit A1"
                  placeholderTextColor={colors.textTertiary}
                  value={formAssetName}
                  onChangeText={setFormAssetName}
                />
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Schedule Type</Text>
                <View style={styles.scheduleTypeRow}>
                  {(['daily', 'weekly', 'monthly', 'quarterly', 'annual'] as const).map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[styles.typeChip, formScheduleType === type ? { backgroundColor: colors.primary + '18', borderColor: colors.primary } : { backgroundColor: colors.surface, borderColor: colors.border }]}
                      onPress={() => setFormScheduleType(type)}
                    >
                      <Text style={[styles.typeChipText, { color: formScheduleType === type ? colors.primary : colors.textSecondary }]}>{type}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Description</Text>
                <TextInput
                  style={[styles.input, styles.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                  placeholder="Optional description or instructions"
                  placeholderTextColor={colors.textTertiary}
                  multiline
                  numberOfLines={3}
                  value={formDescription}
                  onChangeText={setFormDescription}
                />
              </ScrollView>
              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: colors.primary }, isSaving && { opacity: 0.6 }]}
                onPress={handleAddSchedule}
                disabled={isSaving}
              >
                {isSaving ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.submitBtnText}>Create Schedule</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  loadingText: { fontSize: 14, fontFamily: 'Urbanist-Medium' },

  headerSection: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  headerTitle: { fontSize: 22, fontFamily: 'Poppins-Bold', color: '#FFFFFF', letterSpacing: -0.3 },
  headerBtn: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },

  tabBar: { flexDirection: 'row', gap: 8 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 },
  tabText: { fontSize: 12, fontFamily: 'Urbanist-Bold' },
  badge: { backgroundColor: '#EF6B6B', borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  badgeText: { color: '#FFFFFF', fontSize: 10, fontFamily: 'Urbanist-Bold' },

  calendarContent: { padding: 16, paddingBottom: 100 },
  calendarCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  calendar: { borderRadius: 16 },
  legendRow: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginTop: 12, marginBottom: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, fontFamily: 'Urbanist-Medium' },

  dayDetailSection: { marginTop: 16 },
  dayDetailTitle: { fontSize: 16, fontFamily: 'Poppins-Bold', marginBottom: 12 },
  emptyDay: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, borderWidth: 1, paddingVertical: 24 },
  emptyDayText: { fontSize: 13, fontFamily: 'Urbanist-Medium' },

  overdueAlert: { marginTop: 16, backgroundColor: '#FDEEEE', borderRadius: 12, padding: 12 },
  overdueAlertHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  overdueAlertTitle: { fontSize: 13, fontFamily: 'Urbanist-Bold' },
  overdueItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  overdueItemText: { fontSize: 13, fontFamily: 'Urbanist-Medium' },

  listContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 100 },
  overdueBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, padding: 10, marginBottom: 12 },
  overdueBannerText: { fontSize: 12, fontFamily: 'Urbanist-Bold' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 12 },
  emptyTitle: { fontSize: 16, fontFamily: 'Poppins-Bold' },
  createBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  createBtnText: { color: '#FFFFFF', fontSize: 13, fontFamily: 'Poppins-Bold' },

  scheduleCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, padding: 12, marginBottom: 10, gap: 12 },
  scheduleCardLeft: {},
  scheduleIconWrap: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  scheduleCardContent: { flex: 1 },
  scheduleName: { fontSize: 14, fontFamily: 'Poppins-Bold', marginBottom: 2 },
  scheduleMeta: { fontSize: 11, fontFamily: 'Urbanist-Regular' },
  scheduleCardRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusBadgeText: { fontSize: 9, fontFamily: 'Urbanist-Bold', letterSpacing: 0.5 },

  contractCard: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 10 },
  contractHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  contractIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  contractContent: { flex: 1 },
  contractAsset: { fontSize: 15, fontFamily: 'Poppins-Bold', marginBottom: 2 },
  contractVendor: { fontSize: 11, fontFamily: 'Urbanist-Regular' },
  contractDates: { flexDirection: 'row', alignItems: 'center' },
  dateItem: { flex: 1, alignItems: 'center' },
  dateLabel: { fontSize: 9, fontFamily: 'Urbanist-Medium', textTransform: 'uppercase', letterSpacing: 0.3 },
  dateValue: { fontSize: 12, fontFamily: 'Poppins-Bold', marginTop: 2 },
  dateDivider: { width: 1, height: 24, backgroundColor: 'rgba(0,0,0,0.08)' },
  expiryAlert: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginTop: 10 },
  expiryAlertText: { fontSize: 11, fontFamily: 'Urbanist-Bold' },
  contractDesc: { fontSize: 11, fontFamily: 'Urbanist-Regular', marginTop: 8, lineHeight: 16 },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingBottom: 34 },
  modalHandle: { width: 36, height: 4, backgroundColor: '#D1D5DB', borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontFamily: 'Poppins-Bold' },
  modalBody: { maxHeight: 400 },
  inputLabel: { fontSize: 11, fontFamily: 'Urbanist-Bold', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 12 },
  input: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: 'Urbanist-Regular' },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  scheduleTypeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  typeChipText: { fontSize: 12, fontFamily: 'Urbanist-Medium', textTransform: 'capitalize' },
  submitBtn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  submitBtnText: { color: '#FFFFFF', fontSize: 15, fontFamily: 'Poppins-Bold' },

  // Detail sheet
  detailSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingBottom: 34 },
  detailHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  detailIconWrap: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  detailHeaderContent: { flex: 1 },
  detailTitle: { fontSize: 18, fontFamily: 'Poppins-Bold' },
  detailSubtitle: { fontSize: 12, fontFamily: 'Urbanist-Regular', marginTop: 2 },
  detailStatsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  detailStatCard: { flex: 1, borderRadius: 10, padding: 12, alignItems: 'center' },
  detailStatLabel: { fontSize: 9, fontFamily: 'Urbanist-Medium', textTransform: 'uppercase', letterSpacing: 0.3 },
  detailStatValue: { fontSize: 14, fontFamily: 'Poppins-Bold', marginTop: 4, textAlign: 'center' },
  descBanner: { borderRadius: 10, padding: 12, marginBottom: 16 },
  descText: { fontSize: 13, fontFamily: 'Urbanist-Regular', lineHeight: 20 },
  markCompleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, paddingVertical: 14 },
  markCompleteBtnText: { color: '#FFFFFF', fontSize: 15, fontFamily: 'Poppins-Bold' },
});
