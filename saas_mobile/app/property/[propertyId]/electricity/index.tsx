
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/utils/supabase/client';
import {
  Zap,
  ChevronDown,
  X,
  Clock,
  TrendingUp,
  Trash2,
} from 'lucide-react-native';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ElectricityMeter {
  id: string;
  name: string;
  meter_number?: string;
  meter_type?: string;
  max_load_kw?: number;
  status: string;
  last_reading?: number;
}

interface ElectricityReading {
  id: string;
  meter_id: string;
  opening_reading: number;
  closing_reading: number;
  computed_units?: number;
  final_units?: number;
  multiplier_value?: number;
  notes?: string;
  reading_date?: string;
  created_at: string;
}

interface GridTariff {
  id: string;
  rate_per_unit: number;
  utility_provider?: string;
}

// ─── Period Selector ──────────────────────────────────────────────────────────

type Period = 'today' | 'week' | 'month';

const PERIODS: { label: string; value: Period }[] = [
  { label: 'Today', value: 'today' },
  { label: 'Week', value: 'week' },
  { label: 'Month', value: 'month' },
];

function getPeriodDates(period: Period): { start: string; end: string } {
  const now = new Date();
  const end = now.toISOString().split('T')[0];
  let start: string;
  if (period === 'today') { start = end; }
  else if (period === 'week') { const d = new Date(now); d.setDate(d.getDate() - 7); start = d.toISOString().split('T')[0]; }
  else { const d = new Date(now); d.setDate(d.getDate() - 30); start = d.toISOString().split('T')[0]; }
  return { start, end };
}

// ─── Custom Date Picker ─────────────────────────────────────────────────────

function CustomDatePicker({
  visible,
  selectedDate,
  onSelect,
  onClose,
  colors,
}: {
  visible: boolean;
  selectedDate: string;
  onSelect: (date: string) => void;
  onClose: () => void;
  colors: typeof Colors.light;
}) {
  const [viewYear, setViewYear] = useState(() => new Date(selectedDate + 'T00:00:00').getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date(selectedDate + 'T00:00:00').getMonth());

  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const today = new Date().toISOString().split('T')[0];

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfWeek = (year: number, month: number) => new Date(year, month, 1).getDay();

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfWeek(viewYear, viewMonth);
  const cells: (string | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  if (!visible) return null;

  return (
    <View style={[styles.customDatePickerContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {/* Header */}
      <View style={styles.customDateHeader}>
        <TouchableOpacity onPress={prevMonth} style={styles.customDateNavBtn}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.customDateTitle, { color: colors.text }]}>
          {MONTHS[viewMonth]} {viewYear}
        </Text>
        <TouchableOpacity onPress={nextMonth} style={styles.customDateNavBtn}>
          <Ionicons name="chevron-forward" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>
      {/* Day headers */}
      <View style={styles.customDateGrid}>
        {DAYS.map(d => (
          <View key={d} style={styles.customDateCell}>
            <Text style={[styles.customDateDayLabel, { color: colors.textTertiary }]}>{d}</Text>
          </View>
        ))}
        {cells.map((date, idx) => {
          const isSelected = date === selectedDate;
          const isToday = date === today;
          return (
            <View key={idx} style={styles.customDateCell}>
              {date ? (
                <TouchableOpacity
                  style={[
                    styles.customDateDayBtn,
                    isSelected && { backgroundColor: colors.primary },
                    isToday && !isSelected && { borderWidth: 1, borderColor: colors.primary },
                  ]}
                  onPress={() => { onSelect(date); onClose(); }}
                >
                  <Text style={[
                    styles.customDateDayText,
                    { color: isSelected ? '#FFF' : colors.text },
                  ]}>{parseInt(date.split('-')[2])}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          );
        })}
      </View>
      {/* Cancel */}
      <TouchableOpacity style={{ alignItems: 'center', paddingVertical: 10 }} onPress={onClose}>
        <Text style={{ color: colors.textSecondary, fontFamily: 'Urbanist-Medium', fontSize: 13 }}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Meter Card ───────────────────────────────────────────────────────────────

function MeterCard({
  meter,
  latestReading,
  previousClosing,
  tariffRate,
  colors,
  onPress,
}: {
  meter: ElectricityMeter;
  latestReading: ElectricityReading | null;
  previousClosing: number;
  tariffRate: number;
  colors: typeof Colors.light;
  onPress?: () => void;
}) {
  const current = latestReading?.closing_reading ?? meter.last_reading ?? 0;
  const opening = latestReading?.opening_reading ?? previousClosing;
  const units = latestReading?.final_units ?? latestReading?.computed_units ?? (current - opening > 0 ? current - opening : 0);
  const cost = units * tariffRate;

  return (
    <TouchableOpacity activeOpacity={onPress ? 0.7 : 1} onPress={onPress}>
      <View style={[styles.meterCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.meterCardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.meterCardName, { color: colors.text }]}>{meter.name}</Text>
          <Text style={[styles.meterCardMeta, { color: colors.textSecondary }]}>
            {meter.meter_type === 'main' ? 'Main Grid' : meter.meter_type || 'Meter'} · {meter.meter_number || 'No #'}
          </Text>
        </View>
        <View style={[styles.meterStatusBadge, {
          backgroundColor: meter.status === 'active' ? colors.success + '18' : colors.error + '18',
        }]}>
          <View style={[styles.meterStatusDot, {
            backgroundColor: meter.status === 'active' ? colors.success : colors.error,
          }]} />
          <Text style={[styles.meterStatusText, {
            color: meter.status === 'active' ? colors.success : colors.error,
          }]}>
            {meter.status === 'active' ? 'Active' : 'Inactive'}
          </Text>
        </View>
      </View>

      {/* Readings Row */}
      <View style={styles.readingsRow}>
        <View style={styles.readingItem}>
          <Text style={[styles.readingLabel, { color: colors.textTertiary }]}>Previous</Text>
          <Text style={[styles.readingValue, { color: colors.textSecondary }]}>
            {opening.toFixed(0)}
          </Text>
          <Text style={[styles.readingUnit, { color: colors.textTertiary }]}>kVAh</Text>
        </View>
        <View style={[styles.readingDivider, { backgroundColor: colors.border }]} />
        <View style={styles.readingItem}>
          <Text style={[styles.readingLabel, { color: colors.textTertiary }]}>Current</Text>
          <Text style={[styles.readingValue, { color: colors.text }]}>
            {current.toFixed(0)}
          </Text>
          <Text style={[styles.readingUnit, { color: colors.textTertiary }]}>kVAh</Text>
        </View>
        <View style={[styles.readingDivider, { backgroundColor: colors.border }]} />
        <View style={styles.readingItem}>
          <Text style={[styles.readingLabel, { color: colors.textTertiary }]}>Units</Text>
          <Text style={[styles.readingValue, { color: colors.primary }]}>
            {units.toFixed(1)}
          </Text>
          <Text style={[styles.readingUnit, { color: colors.textTertiary }]}>kVAh</Text>
        </View>
      </View>

      {/* Cost Row */}
      <View style={[styles.costRow, { backgroundColor: colors.surface }]}>
        <View style={styles.costItem}>
          <Text style={[styles.costLabel, { color: colors.textTertiary }]}>Tariff</Text>
          <Text style={[styles.costValue, { color: colors.text }]}>
            {tariffRate > 0 ? `$${tariffRate.toFixed(4)}/kVAh` : 'N/A'}
          </Text>
        </View>
        <View style={styles.costItem}>
          <Text style={[styles.costLabel, { color: colors.textTertiary }]}>Est. Cost</Text>
          <Text style={[styles.costValue, { color: colors.success }]}>
            {cost > 0 ? `$${cost.toFixed(2)}` : '-'}
          </Text>
        </View>
      </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Log Reading Modal ──────────────────────────────────────────────────────

function LogReadingModal({
  visible,
  onClose,
  meters,
  propertyId,
  colors,
  onSuccess,
  initialMeterId,
}: {
  visible: boolean;
  onClose: () => void;
  meters: ElectricityMeter[];
  propertyId: string;
  colors: typeof Colors.light;
  onSuccess: () => void;
  initialMeterId?: string | null;
}) {
  const [selectedMeterId, setSelectedMeterId] = useState<string>('');
  const [closingReading, setClosingReading] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showMeterPicker, setShowMeterPicker] = useState(false);
  const [previousClosings, setPreviousClosings] = useState<Record<string, number>>({});
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const today = new Date().toISOString().split('T')[0];
  const [readingDate, setReadingDate] = useState<string>(today);

  const selectedMeter = meters.find(m => m.id === selectedMeterId);
  const opening = previousClosings[selectedMeterId] ?? selectedMeter?.last_reading ?? 0;
  const units = (() => {
    const c = parseFloat(closingReading);
    if (isNaN(c) || !closingReading) return null;
    return Math.max(0, c - opening);
  })();

  // Date options for picker
  const dateOptions = [
    { label: 'Today', value: today },
    { label: 'Yesterday', value: new Date(Date.now() - 86400000).toISOString().split('T')[0] },
    { label: '2 days ago', value: new Date(Date.now() - 172800000).toISOString().split('T')[0] },
    { label: 'Custom...', value: '__custom__' },
  ];

  // Reset form when modal opens with fresh meters
  useEffect(() => {
    if (visible && meters.length > 0) {
      if (initialMeterId) {
        setSelectedMeterId(initialMeterId);
      } else if (!selectedMeterId || !meters.find(m => m.id === selectedMeterId)) {
        setSelectedMeterId(meters[0].id);
      }
    }
  }, [visible, meters, initialMeterId]);

  useEffect(() => {
    if (!visible) return;
    const load = async () => {
      const closings: Record<string, number> = {};
      await Promise.all(meters.map(async (m) => {
        const { data } = await supabase
          .from('electricity_readings')
          .select('closing_reading')
          .eq('property_id', propertyId)
          .eq('meter_id', m.id)
          .order('reading_date', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        closings[m.id] = (data as any)?.closing_reading ?? m.last_reading ?? 0;
      }));
      setPreviousClosings(closings);
    };
    load();
  }, [visible, meters, propertyId]);

  // Reset on close
  useEffect(() => {
    if (!visible) {
      setClosingReading('');
      setNotes('');
      setShowMeterPicker(false);
    }
  }, [visible]);

  const handleSubmit = async () => {
    if (!selectedMeterId || !closingReading) {
      Alert.alert('Missing Fields', 'Please enter a meter reading.');
      return;
    }
    const c = parseFloat(closingReading);
    if (c <= opening) {
      Alert.alert('Invalid Reading', 'Closing reading must be greater than opening reading.');
      return;
    }
    setIsSubmitting(true);
    try {
      const readingDateToUse = readingDate;

      // Insert directly via Supabase
      const { error } = await (supabase.from('electricity_readings') as any)
        .insert({
          property_id: propertyId,
          meter_id: selectedMeterId,
          reading_date: readingDateToUse,
          opening_reading: opening,
          closing_reading: c,
          computed_units: c - opening,
          final_units: c - opening,
          notes: notes || null,
        });

      if (error) throw error;

      // Update meter last_reading
      await (supabase.from('electricity_meters') as any)
        .update({ last_reading: c })
        .eq('id', selectedMeterId);

      onClose();
      onSuccess();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save reading');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
          <View style={[styles.sheetContent, { backgroundColor: colors.card }]}>
            <View style={[styles.sheetHeaderRow, { borderBottomColor: colors.border }]}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>Log Electricity Reading</Text>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
              {/* Meter Picker */}
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Meter</Text>
              <TouchableOpacity
                style={[styles.picker, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => setShowMeterPicker(!showMeterPicker)}
              >
                <Text style={[styles.pickerText, { color: colors.text }]}>
                  {selectedMeter?.name ?? 'Select Meter'}
                </Text>
                <ChevronDown size={16} color={colors.textSecondary} />
              </TouchableOpacity>
              {showMeterPicker && (
                <View style={[styles.pickerDropdown, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  {meters.map(m => (
                    <TouchableOpacity
                      key={m.id}
                      style={[styles.pickerOption, m.id === selectedMeterId && { backgroundColor: colors.primaryLight }]}
                      onPress={() => { setSelectedMeterId(m.id); setShowMeterPicker(false); setClosingReading(''); }}
                    >
                      <Text style={[styles.pickerOptionText, { color: colors.text }]}>{m.name}</Text>
                      <Text style={[styles.pickerOptionSub, { color: colors.textTertiary }]}>{m.meter_number || m.meter_type}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Date Picker */}
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Reading Date</Text>
              <TouchableOpacity
                style={[styles.picker, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => setShowDatePicker(!showDatePicker)}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Clock size={16} color={colors.textSecondary} />
                  <Text style={[styles.pickerText, { color: colors.text }]}>
                    {readingDate === today ? 'Today' :
                     readingDate === new Date(Date.now() - 86400000).toISOString().split('T')[0] ? 'Yesterday' :
                     readingDate === new Date(Date.now() - 172800000).toISOString().split('T')[0] ? '2 days ago' :
                     new Date(readingDate + 'T00:00:00').toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </Text>
                </View>
                <ChevronDown size={16} color={colors.textSecondary} />
              </TouchableOpacity>
              {showDatePicker && (
                <View style={[styles.pickerDropdown, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  {dateOptions.map(opt => (
                    opt.value === '__custom__' ? (
                      <TouchableOpacity
                        key={opt.value}
                        style={[styles.pickerOption, { borderTopWidth: 1, borderTopColor: colors.border }]}
                        onPress={() => { setShowDatePicker(false); setShowCustomDatePicker(true); }}
                      >
                        <Text style={[styles.pickerOptionText, { color: colors.text }]}>Custom Date...</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        key={opt.value}
                        style={[styles.pickerOption, opt.value === readingDate && { backgroundColor: colors.primaryLight }]}
                        onPress={() => { setReadingDate(opt.value); setShowDatePicker(false); }}
                      >
                        <Text style={[styles.pickerOptionText, { color: colors.text }]}>{opt.label}</Text>
                      </TouchableOpacity>
                    )
                  ))}
                </View>
              )}

              {/* Opening info */}
              <View style={[styles.openingInfo, { backgroundColor: colors.surface }]}>
                <View style={styles.openingItem}>
                  <Text style={[styles.openingLabel, { color: colors.textTertiary }]}>Opening Reading</Text>
                  <Text style={[styles.openingValue, { color: colors.text }]}>{opening.toFixed(2)} kVAh</Text>
                </View>
              </View>

              {/* Reading Input */}
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Current Reading (kVAh)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                value={closingReading}
                onChangeText={setClosingReading}
                placeholder="Enter meter reading"
                placeholderTextColor={colors.textTertiary}
                keyboardType="decimal-pad"
              />

              {/* Units Preview */}
              {units !== null && (
                <View style={[styles.unitsPreview, { backgroundColor: colors.primaryLight }]}>
                  <TrendingUp size={14} color={colors.primary} />
                  <Text style={[styles.unitsPreviewText, { color: colors.primary }]}>
                    Units consumed: {units.toFixed(2)} kVAh
                  </Text>
                </View>
              )}

              {/* Notes */}
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Notes (optional)</Text>
              <TextInput
                style={[styles.input, styles.notesInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Any observations..."
                placeholderTextColor={colors.textTertiary}
                multiline
              />

              {/* Submit */}
              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: colors.primary }, (isSubmitting || !closingReading) && { opacity: 0.5 }]}
                onPress={handleSubmit}
                disabled={isSubmitting || !closingReading}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitBtnText}>Save Reading</Text>
                )}
              </TouchableOpacity>

              {/* Custom Date Picker */}
              <CustomDatePicker
                visible={showCustomDatePicker}
                selectedDate={readingDate}
                onSelect={(date) => { setReadingDate(date); setShowCustomDatePicker(false); }}
                onClose={() => setShowCustomDatePicker(false)}
                colors={colors}
              />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ─── Recent Readings ──────────────────────────────────────────────────────────

function RecentReadingsList({
  readings,
  meters,
  colors,
  onDelete,
  deletingId,
}: {
  readings: ElectricityReading[];
  meters: ElectricityMeter[];
  colors: typeof Colors.light;
  onDelete?: (id: string) => void;
  deletingId?: string | null;
}) {
  const meterMap = useMemo(() => {
    const m: Record<string, string> = {};
    meters.forEach(mt => { m[mt.id] = mt.name; });
    return m;
  }, [meters]);

  if (readings.length === 0) return null;

  return (
    <View style={styles.recentSection}>
      <Text style={[styles.recentSectionTitle, { color: colors.text }]}>Recent Readings</Text>
      {readings.slice(0, 10).map(r => {
        const units = r.final_units ?? r.computed_units ?? 0;
        return (
          <View key={r.id} style={[styles.readingRow, { borderColor: colors.border }]}>
            <View style={styles.readingRowLeft}>
              <Text style={[styles.readingGenName, { color: colors.text }]}>
                {meterMap[r.meter_id] ?? 'Unknown Meter'}
              </Text>
              <Text style={[styles.readingTime, { color: colors.textTertiary }]}>
                {r.reading_date ? new Date(r.reading_date + 'T00:00:00').toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'} · {formatRelative(r.created_at)}
              </Text>
            </View>
            <View style={styles.readingRowRight}>
              <Text style={[styles.recentReadingValue, { color: colors.primary }]}>
                {units.toFixed(1)} kVAh
              </Text>
              <Text style={[styles.readingSub, { color: colors.textTertiary }]}>
                {r.closing_reading.toFixed(0)}
              </Text>
            </View>
            {onDelete && (
              <TouchableOpacity
                style={{ padding: 4, marginLeft: 8 }}
                onPress={() => onDelete(r.id)}
                disabled={deletingId === r.id}
              >
                {deletingId === r.id ? (
                  <ActivityIndicator size={14} color="#EF4444" />
                ) : (
                  <Trash2 size={16} color="#EF4444" />
                )}
              </TouchableOpacity>
            )}
          </View>
        );
      })}
    </View>
  );
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function formatRelative(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ElectricityScreen() {
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const colors = Colors[theme];
  const insets = useSafeAreaInsets();

  const [meters, setMeters] = useState<ElectricityMeter[]>([]);
  const [readings, setReadings] = useState<ElectricityReading[]>([]);
  const [previousClosings, setPreviousClosings] = useState<Record<string, number>>({});
  const [activeTariff, setActiveTariff] = useState<GridTariff | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [period, setPeriod] = useState<Period>('today');
  const [showSheet, setShowSheet] = useState(false);
  const [showLoggersMenu, setShowLoggersMenu] = useState(false);
  const [selectedMeterForLogging, setSelectedMeterForLogging] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyReadings, setHistoryReadings] = useState<ElectricityReading[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const handleDeleteReading = async (id: string) => {
    Alert.alert('Delete Reading', 'Are you sure you want to delete this reading entry?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeletingId(id);
          try {
            // Get reading to find meter_id
            const reading = readings.find(r => r.id === id);
            if (!reading) throw new Error('Reading not found');

            // Delete the reading
            const { error: deleteError } = await (supabase
              .from('electricity_readings')
              .delete()
              .eq('id', id) as any);
            if (deleteError) throw deleteError;

            // Update meter last_reading to previous reading
            const { data: remaining } = await (supabase
              .from('electricity_readings')
              .select('closing_reading')
              .eq('meter_id', reading.meter_id)
              .eq('property_id', propertyId)
              .order('reading_date', { ascending: false })
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle() as any);

            await (supabase.from('electricity_meters') as any)
              .update({ last_reading: remaining?.closing_reading ?? 0 })
              .eq('id', reading.meter_id);

            // Refresh data
            await fetchData();
            // Also refresh history if modal is open
            if (showHistoryModal) fetchHistoryReadings();
            setReadings(prev => prev.filter(r => r.id !== id));
          } catch (e: any) {
            Alert.alert('Delete Failed', e.message || 'Could not delete reading');
          } finally {
            setDeletingId(null);
          }
        },
      },
    ]);
  };

  const fetchHistoryReadings = async () => {
    if (!propertyId) return;
    setIsLoadingHistory(true);
    try {
      const { data } = await (supabase
        .from('electricity_readings')
        .select('*')
        .eq('property_id', propertyId)
        .order('reading_date', { ascending: false })
        .order('created_at', { ascending: false }) as any);
      setHistoryReadings((data as ElectricityReading[]) || []);
    } catch (e) {
      console.error('Error fetching history:', e);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const fetchData = useCallback(async () => {
    if (!propertyId) return;
    setIsLoading(true);
    try {
      const [{ data: metersData }, { data: readingsData }] = await Promise.all([
        supabase
          .from('electricity_meters')
          .select('*')
          .eq('property_id', propertyId)
          .is('deleted_at', null)
          .order('name') as any,
        supabase
          .from('electricity_readings')
          .select('*')
          .eq('property_id', propertyId)
          .order('reading_date', { ascending: false })
          .order('created_at', { ascending: false }) as any,
      ]);

      setMeters((metersData as any) || []);
      setReadings((readingsData as any) || []);

      // Fetch previous closings
      const latestReadings: any[] = (readingsData as any) || [];
      const closings: Record<string, number> = {};
      const seen: Record<string, boolean> = {};
      latestReadings.forEach((r: any) => {
        if (!seen[r.meter_id]) {
          seen[r.meter_id] = true;
          closings[r.meter_id] = r.closing_reading;
        }
      });
      setPreviousClosings(closings);

      // Fetch active tariff (non-blocking — don't block loading)
      const today = new Date().toISOString().split('T')[0];
      fetch(`/api/properties/${propertyId}/grid-tariffs?date=${today}`)
        .then(res => res.ok ? res.json() : null)
        .then(t => { if (t) setActiveTariff(t); })
        .catch(() => {});
    } catch (e) {
      console.error('Electricity fetch error:', e);
    } finally {
      setIsLoading(false);
    }
  }, [propertyId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchData().finally(() => setIsRefreshing(false));
  }, [fetchData]);

  const handleOpenSheet = () => {
    setShowSheet(true);
  };

  const periodDates = getPeriodDates(period);
  const filteredReadings = readings.filter(r => {
    const d = r.reading_date || r.created_at;
    return d >= periodDates.start && d <= periodDates.end + 'T23:59:59';
  });

  // Latest reading per meter
  const latestPerMeter: Record<string, ElectricityReading> = {};
  readings.forEach(r => { if (!latestPerMeter[r.meter_id]) latestPerMeter[r.meter_id] = r; });

  // Quick stats
  const totalUnits = filteredReadings.reduce((s, r) => s + (r.final_units ?? r.computed_units ?? 0), 0);
  const tariffRate = activeTariff?.rate_per_unit ?? 0;
  const totalCost = totalUnits * tariffRate;

  const latestGenReadings = useMemo(() => {
    const result: Record<string, ElectricityReading> = {};
    readings.forEach(r => {
      if (!result[r.meter_id]) result[r.meter_id] = r;
    });
    return result;
  }, [readings]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingBottom: 0 }]}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Top Navigation */}
      <View style={[styles.topNav, {
        backgroundColor: colors.surface,
        borderBottomColor: colors.border,
        paddingTop: Math.max(insets.top, 16)
      }]}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={{ padding: 4 }}>
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.topNavTitle, { color: colors.textPrimary }]}>Electricity Logger</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity
            style={[styles.bellButton, { marginRight: 8 }]}
            onPress={() => router.push('/property/' + propertyId + '/stock/scan' as any)}
            activeOpacity={0.7}
          >
            <Ionicons name="qr-code-outline" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.bellButton}
            onPress={() => { Alert.alert('Notifications', 'Notifications coming soon!'); }}
            activeOpacity={0.7}
          >
            <Ionicons name="notifications-outline" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Header Banner */}
      <View style={[styles.header, { backgroundColor: '#708F96' }]}>
        <Text style={styles.headerSubtitle}>
          {meters.length} meter{meters.length !== 1 ? 's' : ''}
        </Text>
        {/* Period Selector */}
        <View style={styles.periodRow}>
          {PERIODS.map(p => (
            <TouchableOpacity
              key={p.value}
              style={[styles.periodBtn, period === p.value && styles.periodBtnActive]}
              onPress={() => setPeriod(p.value)}
            >
              <Text style={[styles.periodBtnText, period === p.value && styles.periodBtnTextActive]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {/* Quick Stats */}
        <View style={styles.quickStatsRow}>
          <View style={styles.quickStat}>
            <Zap size={12} color="rgba(255,255,255,0.7)" />
            <Text style={styles.quickStatText}>{totalUnits.toFixed(1)} kVAh</Text>
          </View>
          <View style={styles.quickStat}>
            <TrendingUp size={12} color="rgba(255,255,255,0.7)" />
            <Text style={styles.quickStatText}>
              {totalCost > 0 ? `$${totalCost.toFixed(2)}` : '-'}
            </Text>
          </View>
        </View>
        {tariffRate > 0 && (
          <Text style={styles.tariffInfo}>Tariff: ${tariffRate.toFixed(4)}/kVAh</Text>
        )}
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
          }
        >


          {/* Meter Cards */}
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Meters</Text>
          {meters.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Zap size={36} color={colors.textTertiary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No meters configured</Text>
              <Text style={[styles.emptySubtext, { color: colors.textTertiary }]}>
                Add meters from the web dashboard
              </Text>
            </View>
          ) : (
            <View style={styles.genCardsList}>
              {meters.map(m => (
                <MeterCard
                  key={m.id}
                  meter={m}
                  latestReading={latestGenReadings[m.id] ?? null}
                  previousClosing={previousClosings[m.id] ?? m.last_reading ?? 0}
                  tariffRate={tariffRate}
                  colors={colors}
                  onPress={() => {
                    setSelectedMeterForLogging(m.id);
                    setShowSheet(true);
                  }}
                />
              ))}
            </View>
          )}

          {/* Recent Readings */}
          <RecentReadingsList
            readings={filteredReadings}
            meters={meters}
            colors={colors}
            onDelete={handleDeleteReading}
            deletingId={deletingId}
          />
          {readings.length > 0 && (
            <TouchableOpacity
              style={[styles.viewHistoryBtn]}
              onPress={() => { fetchHistoryReadings(); setShowHistoryModal(true); }}
            >
              <Text style={[styles.viewHistoryBtnText, { color: colors.primary }]}>View Full History</Text>
            </TouchableOpacity>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {/* Full History Modal */}
      <Modal visible={showHistoryModal} animationType="slide" onRequestClose={() => setShowHistoryModal(false)}>
        <View style={[styles.historyModalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.historyModalHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            <Text style={[styles.historyModalTitle, { color: colors.text }]}>Reading History</Text>
            <TouchableOpacity onPress={() => setShowHistoryModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          {isLoadingHistory ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
              {historyReadings.length === 0 ? (
                <View style={{ alignItems: 'center', paddingTop: 60, gap: 8 }}>
                  <Clock size={48} color={colors.textTertiary} />
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No readings found</Text>
                </View>
              ) : historyReadings.map(r => {
                const units = r.final_units ?? r.computed_units ?? 0;
                const meter = meters.find(m => m.id === r.meter_id);
                return (
                  <View key={r.id} style={[styles.historyRow, { borderColor: colors.border, backgroundColor: colors.card }]}>
                    <View style={styles.historyRowLeft}>
                      <Text style={[styles.historyRowName, { color: colors.text }]}>{meter?.name ?? 'Unknown Meter'}</Text>
                      <Text style={[styles.historyRowDate, { color: colors.textTertiary }]}>
                        {r.reading_date ? new Date(r.reading_date + 'T00:00:00').toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                        {' · '}
                        {new Date(r.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                      </Text>
                      {r.notes && <Text style={[styles.historyRowNotes, { color: colors.textSecondary }]} numberOfLines={1}>{r.notes}</Text>}
                    </View>
                    <View style={styles.historyRowRight}>
                      <Text style={[styles.historyRowUnits, { color: colors.primary }]}>{units.toFixed(1)} kVAh</Text>
                      <Text style={[styles.historyRowClosing, { color: colors.textTertiary }]}>→ {r.closing_reading.toFixed(0)}</Text>
                    </View>
                    <TouchableOpacity
                      style={{ padding: 6 }}
                      onPress={() => handleDeleteReading(r.id)}
                      disabled={deletingId === r.id}
                    >
                      {deletingId === r.id ? (
                        <ActivityIndicator size={14} color="#EF4444" />
                      ) : (
                        <Trash2 size={16} color="#EF4444" />
                      )}
                    </TouchableOpacity>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* Bottom Navigation */}
      <View style={[styles.bottomNav, { 
        backgroundColor: colors.surface, 
        borderTopColor: colors.border,
        paddingBottom: Math.max(insets.bottom, 12)
      }]}>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push(`/property/${propertyId}/mst` as any)}>
          <View style={styles.navIconWrapper}>
            <Ionicons name="grid-outline" size={22} color={colors.textTertiary} />
          </View>
          <Text style={[styles.navText, { color: colors.textTertiary }]}>OVERVIEW</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.navItem} onPress={() => router.push(`/property/${propertyId}/mst` as any)}>
          <View style={styles.navIconWrapper}>
            <Ionicons name="ticket-outline" size={22} color={colors.textTertiary} />
          </View>
          <Text style={[styles.navText, { color: colors.textTertiary }]}>REQUESTS</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.navItemCenter} 
          onPress={() => { Alert.alert('Create Request', 'Please go back to the dashboard to create new requests.'); }}
        >
          <View style={[styles.centerFab, { backgroundColor: colors.primary }]}>
            <Ionicons name="add" size={32} color="#FFF" />
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => setShowLoggersMenu(true)}>
          <View style={[styles.navIconWrapper, { backgroundColor: theme === 'dark' ? 'rgba(112,143,150,0.12)' : 'rgba(112,143,150,0.08)' }]}>
            <Ionicons name="options" size={22} color={colors.primary} />
          </View>
          <Text style={[styles.navText, { color: colors.primary }]}>LOGGERS</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => Alert.alert('More', 'More menu coming soon')}>
          <View style={styles.navIconWrapper}>
            <Ionicons name="ellipsis-horizontal" size={22} color={colors.textTertiary} />
          </View>
          <Text style={[styles.navText, { color: colors.textTertiary }]}>MORE</Text>
        </TouchableOpacity>
      </View>

      {showSheet && (
        <LogReadingModal
          visible={showSheet}
          onClose={() => {
            setShowSheet(false);
            setSelectedMeterForLogging(null);
          }}
          meters={meters}
          propertyId={propertyId!}
          colors={colors}
          onSuccess={fetchData}
          initialMeterId={selectedMeterForLogging}
        />
      )}

      {/* Loggers Modal */}
      <Modal visible={showLoggersMenu} transparent animationType="fade" onRequestClose={() => setShowLoggersMenu(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowLoggersMenu(false)}>
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 16 }}>Loggers</Text>
            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16, gap: 12, borderBottomWidth: 1, borderBottomColor: colors.border }} onPress={() => { setShowLoggersMenu(false); router.push(`/property/${propertyId}/electricity` as any); }}>
              <Ionicons name="flash-outline" size={20} color={colors.primary} />
              <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>Electricity Logger</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16, gap: 12, borderBottomWidth: 1, borderBottomColor: colors.border }} onPress={() => { setShowLoggersMenu(false); router.push(`/property/${propertyId}/diesel` as any); }}>
              <Ionicons name="water-outline" size={20} color={colors.primary} />
              <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>Diesel Logger</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 16 },

  // Header
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  headerTitle: { fontSize: 26, fontFamily: 'Poppins-Bold', color: '#FFFFFF', letterSpacing: -0.3 },
  headerSubtitle: { fontSize: 13, fontFamily: 'Urbanist-Medium', color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  periodRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  periodBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)' },
  periodBtnActive: { backgroundColor: 'rgba(255,255,255,0.9)' },
  periodBtnText: { fontSize: 13, fontFamily: 'Urbanist-Bold', color: 'rgba(255,255,255,0.8)' },
  periodBtnTextActive: { color: '#1A2332' },
  quickStatsRow: { flexDirection: 'row', gap: 16, marginTop: 12, alignItems: 'center' },
  quickStat: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  quickStatText: { fontSize: 12, fontFamily: 'Urbanist-Medium', color: 'rgba(255,255,255,0.75)' },
  analyticsBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, marginLeft: 'auto' },
  analyticsBtnText: { fontSize: 12, fontFamily: 'Urbanist-Bold', color: 'rgba(255,255,255,0.9)' },
  tariffInfo: { fontSize: 11, fontFamily: 'Urbanist-Medium', color: 'rgba(255,255,255,0.6)', marginTop: 6 },

  // Log FAB
  logFab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  logFabText: { fontSize: 16, fontFamily: 'Poppins-Bold', color: '#FFFFFF' },

  // Section
  sectionTitle: { fontSize: 16, fontFamily: 'Poppins-Bold', marginBottom: 12 },

  // Meter Cards
  genCardsList: { gap: 12 },
  meterCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  meterCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  meterCardName: { fontSize: 16, fontFamily: 'Poppins-Bold' },
  meterCardMeta: { fontSize: 12, fontFamily: 'Urbanist-Medium', marginTop: 2 },
  meterStatusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  meterStatusDot: { width: 6, height: 6, borderRadius: 3 },
  meterStatusText: { fontSize: 11, fontFamily: 'Urbanist-Bold' },

  // Readings row
  readingsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  readingItem: { flex: 1, alignItems: 'center' },
  readingDivider: { width: 1, height: 40 },
  readingLabel: { fontSize: 10, fontFamily: 'Urbanist-Bold', textTransform: 'uppercase', letterSpacing: 0.3 },
  readingValue: { fontSize: 18, fontFamily: 'Poppins-Bold', marginTop: 4 },
  readingUnit: { fontSize: 10, fontFamily: 'Urbanist-Medium' },

  // Cost row
  costRow: { flexDirection: 'row', borderRadius: 10, padding: 10 },
  costItem: { flex: 1, alignItems: 'center' },
  costLabel: { fontSize: 10, fontFamily: 'Urbanist-Bold', textTransform: 'uppercase' },
  costValue: { fontSize: 15, fontFamily: 'Poppins-Bold', marginTop: 2 },

  // Recent
  recentSection: { marginTop: 24 },
  recentSectionTitle: { fontSize: 16, fontFamily: 'Poppins-Bold', marginBottom: 12 },
  readingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
  readingRowLeft: { flex: 1 },
  readingGenName: { fontSize: 14, fontFamily: 'Poppins-Bold' },
  readingTime: { fontSize: 11, fontFamily: 'Urbanist-Medium', marginTop: 2 },
  readingRowRight: { alignItems: 'flex-end' },
  recentReadingValue: { fontSize: 14, fontFamily: 'Poppins-Bold' },
  readingSub: { fontSize: 11, fontFamily: 'Urbanist-Medium', marginTop: 2 },

  // Empty
  emptyCard: { borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', padding: 32, alignItems: 'center', gap: 8 },
  emptyText: { fontSize: 15, fontFamily: 'Urbanist-Medium' },
  emptySubtext: { fontSize: 12, fontFamily: 'Urbanist-Regular' },

  // Bottom Sheet
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheetContent: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '90%' },
  sheetHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  sheetTitle: { fontSize: 20, fontFamily: 'Poppins-Bold' },
  fieldLabel: { fontSize: 12, fontFamily: 'Urbanist-Bold', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 14 },
  picker: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderRadius: 12, borderWidth: 1 },
  pickerText: { fontSize: 15, fontFamily: 'Urbanist-Medium' },
  pickerDropdown: { borderRadius: 12, borderWidth: 1, marginTop: 4, overflow: 'hidden' },
  pickerOption: { padding: 12, paddingHorizontal: 16 },
  pickerOptionText: { fontSize: 14, fontFamily: 'Urbanist-Medium' },
  pickerOptionSub: { fontSize: 11, fontFamily: 'Urbanist-Regular', marginTop: 1 },
  openingInfo: { flexDirection: 'row', gap: 16, padding: 12, borderRadius: 10, marginTop: 14 },
  openingItem: { flex: 1 },
  openingLabel: { fontSize: 11, fontFamily: 'Urbanist-Medium' },
  openingValue: { fontSize: 18, fontFamily: 'Poppins-Bold', marginTop: 2 },
  input: { padding: 14, borderRadius: 12, borderWidth: 1, fontSize: 15, fontFamily: 'Urbanist-Medium' },
  notesInput: { height: 80, textAlignVertical: 'top' },
  unitsPreview: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10, marginTop: 14 },
  unitsPreviewText: { fontSize: 14, fontFamily: 'Urbanist-Bold' },
  submitBtn: { padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 20 },
  submitBtnText: { fontSize: 16, fontFamily: 'Poppins-Bold', color: '#FFFFFF' },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    zIndex: 10,
  },
  topNavTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  bellButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  bottomNav: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
  },
  navItemCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
  },
  navIconWrapper: {
    width: 44,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  centerFab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  navText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // History modal
  historyModalContainer: { flex: 1 },
  historyModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: Math.max(60, 20),
    borderBottomWidth: 1,
  },
  historyModalTitle: { fontSize: 20, fontFamily: 'Poppins-Bold' },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
    gap: 8,
  },
  historyRowLeft: { flex: 1 },
  historyRowName: { fontSize: 14, fontFamily: 'Poppins-Bold', marginBottom: 2 },
  historyRowDate: { fontSize: 11, fontFamily: 'Urbanist-Medium' },
  historyRowNotes: { fontSize: 11, fontFamily: 'Urbanist-Regular', marginTop: 2 },
  historyRowRight: { alignItems: 'flex-end' },
  historyRowUnits: { fontSize: 15, fontFamily: 'Poppins-Bold' },
  historyRowClosing: { fontSize: 11, fontFamily: 'Urbanist-Medium', marginTop: 2 },
  viewHistoryBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 4,
  },
  viewHistoryBtnText: {
    fontSize: 13,
    fontFamily: 'Poppins-Bold',
  },

  // Custom Date Picker
  customDatePickerContainer: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginTop: 12,
  },
  customDateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  customDateNavBtn: {
    padding: 6,
  },
  customDateTitle: {
    fontSize: 16,
    fontFamily: 'Poppins-Bold',
  },
  customDateGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  customDateCell: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  customDateDayLabel: {
    fontSize: 11,
    fontFamily: 'Urbanist-Bold',
  },
  customDateDayBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  customDateDayText: {
    fontSize: 14,
    fontFamily: 'Urbanist-Bold',
  },
});
