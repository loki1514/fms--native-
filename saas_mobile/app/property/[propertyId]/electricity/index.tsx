
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { useTheme } from '@/context';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/utils/supabase/client';
import {
  Zap,
  Plus,
  ChevronDown,
  X,
  Clock,
  TrendingUp,
  ArrowRight,
  BarChart3,
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

// ─── Meter Card ───────────────────────────────────────────────────────────────

function MeterCard({
  meter,
  latestReading,
  previousClosing,
  tariffRate,
  colors,
}: {
  meter: ElectricityMeter;
  latestReading: ElectricityReading | null;
  previousClosing: number;
  tariffRate: number;
  colors: typeof Colors.light;
}) {
  const current = latestReading?.closing_reading ?? meter.last_reading ?? 0;
  const opening = latestReading?.opening_reading ?? previousClosing;
  const units = latestReading?.final_units ?? latestReading?.computed_units ?? (current - opening > 0 ? current - opening : 0);
  const cost = units * tariffRate;

  return (
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
  );
}

// ─── Log Reading Bottom Sheet ─────────────────────────────────────────────────

function LogReadingSheet({
  sheetRef,
  snapPoints,
  meters,
  propertyId,
  colors,
  onSuccess,
}: {
  sheetRef: React.RefObject<BottomSheet | null>;
  snapPoints: (number | string)[];
  meters: ElectricityMeter[];
  propertyId: string;
  colors: typeof Colors.light;
  onSuccess: () => void;
}) {
  const [selectedMeterId, setSelectedMeterId] = useState<string>('');
  const [closingReading, setClosingReading] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showMeterPicker, setShowMeterPicker] = useState(false);
  const [previousClosings, setPreviousClosings] = useState<Record<string, number>>({});

  const selectedMeter = meters.find(m => m.id === selectedMeterId);
  const opening = previousClosings[selectedMeterId] ?? selectedMeter?.last_reading ?? 0;
  const units = (() => {
    const c = parseFloat(closingReading);
    if (isNaN(c) || !closingReading) return null;
    return Math.max(0, c - opening);
  })();

  useEffect(() => {
    if (meters.length > 0 && !selectedMeterId) {
      setSelectedMeterId(meters[0].id);
    }
  }, [meters, selectedMeterId]);

  useEffect(() => {
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
  }, [meters, propertyId]);

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
      const today = new Date().toISOString().split('T')[0];
      const res = await fetch(`/api/properties/${propertyId}/electricity-readings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          readings: [{
            meter_id: selectedMeterId,
            reading_date: today,
            opening_reading: opening,
            closing_reading: c,
            computed_units: c - opening,
            final_units: c - opening,
            notes: notes || undefined,
            alert_status: 'normal',
          }],
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save');
      }
      setClosingReading('');
      setNotes('');
      sheetRef.current?.close();
      onSuccess();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      backgroundStyle={{ backgroundColor: colors.card }}
      handleIndicatorStyle={{ backgroundColor: colors.border }}
    >
      <BottomSheetView style={styles.sheetContent}>
        <View style={styles.sheetHeader}>
          <Text style={[styles.sheetTitle, { color: colors.text }]}>Log Electricity Reading</Text>
          <TouchableOpacity onPress={() => sheetRef.current?.close()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <X size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

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
          style={[
            styles.submitBtn,
            { backgroundColor: colors.primary },
            (isSubmitting || !closingReading) && { opacity: 0.5 },
          ]}
          onPress={handleSubmit}
          disabled={isSubmitting || !closingReading}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.submitBtnText}>Save Reading</Text>
          )}
        </TouchableOpacity>
      </BottomSheetView>
    </BottomSheet>
  );
}

// ─── Recent Readings ──────────────────────────────────────────────────────────

function RecentReadingsList({
  readings,
  meters,
  colors,
}: {
  readings: ElectricityReading[];
  meters: ElectricityMeter[];
  colors: typeof Colors.light;
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
                {r.reading_date ? new Date(r.reading_date).toLocaleDateString() : '—'} · {formatRelative(r.created_at)}
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

  const [meters, setMeters] = useState<ElectricityMeter[]>([]);
  const [readings, setReadings] = useState<ElectricityReading[]>([]);
  const [previousClosings, setPreviousClosings] = useState<Record<string, number>>({});
  const [activeTariff, setActiveTariff] = useState<GridTariff | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [period, setPeriod] = useState<Period>('today');
  const [showSheet, setShowSheet] = useState(false);

  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['85%'], []);

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

      // Fetch active tariff
      const today = new Date().toISOString().split('T')[0];
      const tariffRes = await fetch(`/api/properties/${propertyId}/grid-tariffs?date=${today}`);
      if (tariffRes.ok) {
        const t = await tariffRes.json();
        setActiveTariff(t);
      }
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
    setTimeout(() => sheetRef.current?.snapToIndex(0), 100);
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
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: '#708F96' }]}>
        <Text style={styles.headerTitle}>Electricity Logger</Text>
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
          <TouchableOpacity
            style={styles.analyticsBtn}
            onPress={() => router.push(`/property/${propertyId}/electricity/analytics` as any)}
          >
            <BarChart3 size={12} color="rgba(255,255,255,0.9)" />
            <Text style={styles.analyticsBtnText}>Analytics</Text>
          </TouchableOpacity>
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
          {/* Log Reading FAB */}
          <TouchableOpacity
            style={[styles.logFab, { backgroundColor: colors.primary }]}
            onPress={handleOpenSheet}
          >
            <Plus size={22} color="#FFFFFF" />
            <Text style={styles.logFabText}>Log Reading</Text>
          </TouchableOpacity>

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
                />
              ))}
            </View>
          )}

          {/* Recent Readings */}
          <RecentReadingsList readings={filteredReadings} meters={meters} colors={colors} />

          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {showSheet && (
        <LogReadingSheet
          sheetRef={sheetRef}
          snapPoints={snapPoints}
          meters={meters}
          propertyId={propertyId!}
          colors={colors}
          onSuccess={fetchData}
        />
      )}
    </SafeAreaView>
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
  sheetContent: { flex: 1, padding: 20 },
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
});
