
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
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
  Fuel,
  Plus,
  ChevronDown,
  X,
  Clock,
  TrendingUp,
  AlertTriangle,
  BarChart3,
  ArrowRight,
} from 'lucide-react-native';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Generator {
  id: string;
  name: string;
  make?: string;
  capacity_kva?: number;
  tank_capacity_litres?: number;
  status: string;
  initial_run_hours?: number;
  initial_kwh_reading?: number;
  initial_diesel_level?: number;
}

interface DieselReading {
  id: string;
  generator_id: string;
  opening_hours: number;
  closing_hours: number;
  opening_kwh?: number;
  closing_kwh?: number;
  opening_diesel_level: number;
  closing_diesel_level: number;
  diesel_added_litres: number;
  computed_consumed_litres?: number;
  notes?: string;
  reading_date?: string;
  created_at: string;
}

interface LastClosing {
  hours: number;
  kwh: number;
  diesel: number;
  closing_kwh?: number;
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
  if (period === 'today') {
    start = end;
  } else if (period === 'week') {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    start = d.toISOString().split('T')[0];
  } else {
    const d = new Date(now);
    d.setDate(d.getDate() - 30);
    start = d.toISOString().split('T')[0];
  }
  return { start, end };
}

// ─── Fuel Gauge ──────────────────────────────────────────────────────────────

function FuelGauge({ level, maxLitres, size = 'normal' }: { level: number; maxLitres: number; size?: 'small' | 'normal' }) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const pct = maxLitres > 0 ? Math.min(100, Math.max(0, (level / maxLitres) * 100)) : 0;
  const isLow = pct < 20;

  const gaugeHeight = size === 'small' ? 8 : 12;
  const gaugeRadius = size === 'small' ? 4 : 6;

  return (
    <View style={{ gap: 4 }}>
      <View style={[styles.gaugeTrack, { height: gaugeHeight, backgroundColor: colors.border }]}>
        <View
          style={[
            styles.gaugeFill,
            {
              width: `${pct}%`,
              height: gaugeHeight,
              backgroundColor: isLow ? colors.error : colors.primary,
              borderRadius: gaugeRadius,
            },
          ]}
        />
      </View>
      <Text style={[styles.gaugeLabel, { color: colors.textSecondary }]}>
        {level.toFixed(0)} L / {maxLitres.toFixed(0)} L ({pct.toFixed(0)}%)
      </Text>
    </View>
  );
}

// ─── Generator Card ───────────────────────────────────────────────────────────

function GeneratorCard({
  generator,
  lastClosing,
  latestReading,
  colors,
  onPress,
}: {
  generator: Generator;
  lastClosing: LastClosing | null;
  latestReading: DieselReading | null;
  colors: typeof Colors.light;
  onPress: () => void;
}) {
  const statusColor =
    generator.status === 'active' ? colors.success :
    generator.status === 'inactive' ? colors.error : colors.textTertiary;

  const fuelLevel = latestReading?.closing_diesel_level ?? lastClosing?.diesel ?? 0;
  const tankCapacity = generator.tank_capacity_litres ?? 1000;
  const lastReadingTime = latestReading?.created_at
    ? formatRelative(latestReading.created_at)
    : 'No reading yet';
  const statusLabel =
    fuelLevel > 0 ? 'Running' : 'Idle';

  return (
    <TouchableOpacity
      style={[styles.genCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.72}
    >
      <View style={styles.genCardHeader}>
        <View style={styles.genCardHeaderLeft}>
          <Text style={[styles.genCardName, { color: colors.text }]}>{generator.name}</Text>
          <Text style={[styles.genCardMeta, { color: colors.textSecondary }]}>
            {generator.make || 'DG'} · {generator.capacity_kva ?? '?'} KVA
          </Text>
        </View>
        <View style={[styles.genStatusBadge, { backgroundColor: statusColor + '18' }]}>
          <View style={[styles.genStatusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.genStatusText, { color: statusColor }]}>{statusLabel}</Text>
        </View>
      </View>

      <View style={styles.genCardFuel}>
        <View style={styles.genCardFuelHeader}>
          <Fuel size={14} color={colors.primary} />
          <Text style={[styles.genCardFuelLabel, { color: colors.textSecondary }]}>Fuel Level</Text>
        </View>
        <FuelGauge level={fuelLevel} maxLitres={tankCapacity} size="normal" />
      </View>

      <View style={styles.genCardFooter}>
        <View style={styles.genCardFooterItem}>
          <Clock size={12} color={colors.textTertiary} />
          <Text style={[styles.genCardFooterText, { color: colors.textTertiary }]}>{lastReadingTime}</Text>
        </View>
        <View style={styles.genCardFooterItem}>
          <TrendingUp size={12} color={colors.textTertiary} />
          <Text style={[styles.genCardFooterText, { color: colors.textTertiary }]}>
            {latestReading ? `${(latestReading.closing_hours - latestReading.opening_hours).toFixed(1)}h` : '-'}
          </Text>
        </View>
        <ArrowRight size={14} color={colors.textTertiary} />
      </View>
    </TouchableOpacity>
  );
}

// ─── Log Reading Bottom Sheet ─────────────────────────────────────────────────

function LogReadingSheet({
  sheetRef,
  snapPoints,
  generators,
  propertyId,
  colors,
  onSuccess,
}: {
  sheetRef: React.RefObject<BottomSheet | null>;
  snapPoints: (number | string)[];
  generators: Generator[];
  propertyId: string;
  colors: typeof Colors.light;
  onSuccess: () => void;
}) {
  const [selectedGenId, setSelectedGenId] = useState<string>('');
  const [closingHours, setClosingHours] = useState('');
  const [closingDiesel, setClosingDiesel] = useState('');
  const [dieselAdded, setDieselAdded] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showGenPicker, setShowGenPicker] = useState(false);
  const [lastClosings, setLastClosings] = useState<Record<string, LastClosing>>({});

  const selectedGen = generators.find(g => g.id === selectedGenId);

  useEffect(() => {
    if (generators.length > 0 && !selectedGenId) {
      setSelectedGenId(generators[0].id);
    }
  }, [generators, selectedGenId]);

  useEffect(() => {
    // Load last closings for all generators
    const loadClosings = async () => {
      const closings: Record<string, LastClosing> = {};
      await Promise.all(generators.map(async (gen) => {
        const { data } = await supabase
          .from('diesel_readings')
          .select('closing_hours, closing_diesel_level, closing_kwh, reading_date, created_at')
          .eq('property_id', propertyId)
          .eq('generator_id', gen.id)
          .order('reading_date', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data) {
          const d = data as any;
          closings[gen.id] = {
            hours: d.closing_hours,
            diesel: d.closing_diesel_level,
            kwh: d.closing_kwh,
          };
        } else {
          closings[gen.id] = {
            hours: gen.initial_run_hours ?? 0,
            diesel: gen.initial_diesel_level ?? 0,
            kwh: gen.initial_kwh_reading ?? 0,
          };
        }
      }));
      setLastClosings(closings);
    };
    loadClosings();
  }, [generators, propertyId]);

  const opening = selectedGenId ? (lastClosings[selectedGenId] ?? { hours: 0, diesel: 0, kwh: 0, closing_kwh: 0 }) : { hours: 0, diesel: 0, kwh: 0, closing_kwh: 0 };

  const consumed = (() => {
    const c = parseFloat(closingDiesel) || 0;
    const o = opening.diesel;
    const added = parseFloat(dieselAdded) || 0;
    if (!closingDiesel) return null;
    return Math.max(0, (o + added) - c);
  })();

  const handleSubmit = async () => {
    if (!selectedGenId || !closingHours || !closingDiesel) {
      Alert.alert('Missing Fields', 'Please fill in runtime hours and fuel level.');
      return;
    }
    const o = opening;
    setIsSubmitting(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await fetch(`/api/properties/${propertyId}/diesel-readings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          readings: [{
            generator_id: selectedGenId,
            reading_date: today,
            opening_hours: o.hours,
            closing_hours: parseFloat(closingHours),
            opening_kwh: o.kwh,
            closing_kwh: o.kwh,
            opening_diesel_level: o.diesel,
            closing_diesel_level: parseFloat(closingDiesel),
            diesel_added_litres: parseFloat(dieselAdded) || 0,
            computed_consumed_litres: consumed ?? 0,
            notes: notes || undefined,
            alert_status: 'normal',
          }],
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save');
      }
      // Reset
      setClosingHours('');
      setClosingDiesel('');
      setDieselAdded('');
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
          <Text style={[styles.sheetTitle, { color: colors.text }]}>Log Diesel Reading</Text>
          <TouchableOpacity onPress={() => sheetRef.current?.close()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <X size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Generator Picker */}
        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Generator</Text>
        <TouchableOpacity
          style={[styles.picker, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => setShowGenPicker(!showGenPicker)}
        >
          <Text style={[styles.pickerText, { color: colors.text }]}>
            {selectedGen?.name ?? 'Select Generator'}
          </Text>
          <ChevronDown size={16} color={colors.textSecondary} />
        </TouchableOpacity>
        {showGenPicker && (
          <View style={[styles.pickerDropdown, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {generators.map(g => (
              <TouchableOpacity
                key={g.id}
                style={[styles.pickerOption, g.id === selectedGenId && { backgroundColor: colors.primaryLight }]}
                onPress={() => { setSelectedGenId(g.id); setShowGenPicker(false); }}
              >
                <Text style={[styles.pickerOptionText, { color: colors.text }]}>{g.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Opening Info */}
        <View style={[styles.openingInfo, { backgroundColor: colors.surface }]}>
          <View style={styles.openingItem}>
            <Text style={[styles.openingLabel, { color: colors.textTertiary }]}>Opening Hours</Text>
            <Text style={[styles.openingValue, { color: colors.text }]}>{opening.hours.toFixed(1)}</Text>
          </View>
          <View style={styles.openingItem}>
            <Text style={[styles.openingLabel, { color: colors.textTertiary }]}>Opening Level</Text>
            <Text style={[styles.openingValue, { color: colors.text }]}>{opening.diesel.toFixed(0)} L</Text>
          </View>
        </View>

        {/* Runtime Hours */}
        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Current Runtime Hours</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
          value={closingHours}
          onChangeText={setClosingHours}
          placeholder="e.g. 125.5"
          placeholderTextColor={colors.textTertiary}
          keyboardType="decimal-pad"
        />

        {/* Fuel Level */}
        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Closing Fuel Level (L)</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
          value={closingDiesel}
          onChangeText={setClosingDiesel}
          placeholder="Litres remaining"
          placeholderTextColor={colors.textTertiary}
          keyboardType="decimal-pad"
        />

        {/* Diesel Added */}
        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Diesel Added Today (L)</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
          value={dieselAdded}
          onChangeText={setDieselAdded}
          placeholder="0"
          placeholderTextColor={colors.textTertiary}
          keyboardType="decimal-pad"
        />

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

        {/* Derived consumption */}
        {consumed !== null && (
          <View style={[styles.consumedBadge, { backgroundColor: colors.primaryLight }]}>
            <TrendingUp size={14} color={colors.primary} />
            <Text style={[styles.consumedText, { color: colors.primary }]}>
              Derived consumption: {consumed.toFixed(1)} L
            </Text>
          </View>
        )}

        {/* Submit */}
        <TouchableOpacity
          style={[
            styles.submitBtn,
            { backgroundColor: colors.primary },
            (isSubmitting || !closingHours || !closingDiesel) && { opacity: 0.5 },
          ]}
          onPress={handleSubmit}
          disabled={isSubmitting || !closingHours || !closingDiesel}
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
  generators,
  colors,
}: {
  readings: DieselReading[];
  generators: Generator[];
  colors: typeof Colors.light;
}) {
  const genMap = useMemo(() => {
    const m: Record<string, string> = {};
    generators.forEach(g => { m[g.id] = g.name; });
    return m;
  }, [generators]);

  if (readings.length === 0) return null;

  return (
    <View style={styles.recentSection}>
      <Text style={[styles.recentSectionTitle, { color: colors.text }]}>Recent Readings</Text>
      {readings.slice(0, 10).map(r => (
        <View key={r.id} style={[styles.readingRow, { borderColor: colors.border }]}>
          <View style={styles.readingRowLeft}>
            <Text style={[styles.readingGenName, { color: colors.text }]}>{genMap[r.generator_id] ?? 'Unknown'}</Text>
            <Text style={[styles.readingTime, { color: colors.textTertiary }]}>
              {r.reading_date ? new Date(r.reading_date).toLocaleDateString() : '—'} · {formatRelative(r.created_at)}
            </Text>
          </View>
          <View style={styles.readingRowRight}>
            <Text style={[styles.readingValue, { color: colors.primary }]}>
              {r.closing_diesel_level.toFixed(0)} L
            </Text>
            <Text style={[styles.readingSub, { color: colors.textTertiary }]}>
              {(r.closing_hours - r.opening_hours).toFixed(1)}h run
            </Text>
          </View>
        </View>
      ))}
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

export default function DieselScreen() {
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const colors = Colors[theme];

  const [generators, setGenerators] = useState<Generator[]>([]);
  const [readings, setReadings] = useState<DieselReading[]>([]);
  const [lastClosings, setLastClosings] = useState<Record<string, LastClosing>>({});
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
      // Fetch generators
      const { data: gens } = await supabase
        .from('generators')
        .select('*')
        .eq('property_id', propertyId)
        .order('name');
      setGenerators((gens as any) || []);

      // Fetch latest reading per generator
      const { data: allReadings } = await supabase
        .from('diesel_readings')
        .select('*')
        .eq('property_id', propertyId)
        .order('reading_date', { ascending: false })
        .order('created_at', { ascending: false });

      const readingsData: DieselReading[] = (allReadings as any) || [];

      // Latest per generator
      const latest: Record<string, DieselReading> = {};
      const closings: Record<string, LastClosing> = {};
      readingsData.forEach(r => {
        if (!latest[r.generator_id]) {
          latest[r.generator_id] = r;
          closings[r.generator_id] = {
            hours: r.closing_hours,
            diesel: r.closing_diesel_level,
            kwh: r.closing_kwh ?? 0,
          };
        }
      });
      setReadings(readingsData);
      setLastClosings(closings);
    } catch (e) {
      console.error('Diesel fetch error:', e);
    } finally {
      setIsLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  const latestPerGen: Record<string, DieselReading> = {};
  filteredReadings.forEach(r => {
    if (!latestPerGen[r.generator_id]) latestPerGen[r.generator_id] = r;
  });

  const latestGenReadings = useMemo(() => {
    const result: Record<string, DieselReading> = {};
    readings.forEach(r => {
      if (!result[r.generator_id]) result[r.generator_id] = r;
    });
    return result;
  }, [readings]);

  // Quick stats
  const totalConsumption = filteredReadings.reduce((sum, r) => sum + (r.computed_consumed_litres ?? 0), 0);
  const totalRunHours = filteredReadings.reduce((sum, r) => sum + (r.closing_hours - r.opening_hours), 0);
  const lowFuelGens = generators.filter(g => {
    const latest = latestGenReadings[g.id];
    const level = latest?.closing_diesel_level ?? (lastClosings[g.id]?.diesel ?? 0);
    const cap = g.tank_capacity_litres ?? 1000;
    return (level / cap) < 0.2;
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: '#708F96' }]}>
        <Text style={styles.headerTitle}>Diesel Logger</Text>
        <Text style={styles.headerSubtitle}>
          {generators.length} generator{generators.length !== 1 ? 's' : ''}
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
            <Fuel size={12} color="rgba(255,255,255,0.7)" />
            <Text style={styles.quickStatText}>{totalConsumption.toFixed(0)} L used</Text>
          </View>
          <View style={styles.quickStat}>
            <Clock size={12} color="rgba(255,255,255,0.7)" />
            <Text style={styles.quickStatText}>{totalRunHours.toFixed(1)}h run</Text>
          </View>
          <TouchableOpacity
            style={styles.analyticsBtn}
            onPress={() => router.push(`/property/${propertyId}/diesel/analytics` as any)}
          >
            <BarChart3 size={12} color="rgba(255,255,255,0.9)" />
            <Text style={styles.analyticsBtnText}>Analytics</Text>
          </TouchableOpacity>
        </View>
        {/* Low fuel alerts */}
        {lowFuelGens.length > 0 && (
          <View style={styles.lowFuelAlertRow}>
            <AlertTriangle size={12} color={colors.warning} />
            <Text style={styles.lowFuelAlertText}>
              Low fuel in: {lowFuelGens.map(g => g.name).join(', ')}
            </Text>
          </View>
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

          {/* Generator Cards */}
          <Text style={[styles.sectionTitle, { color: colors.text }]}>DG Sets</Text>
          {generators.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Fuel size={36} color={colors.textTertiary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No generators configured</Text>
              <Text style={[styles.emptySubtext, { color: colors.textTertiary }]}>
                Add generators from the web dashboard
              </Text>
            </View>
          ) : (
            <View style={styles.genCardsList}>
              {generators.map(gen => (
                <GeneratorCard
                  key={gen.id}
                  generator={gen}
                  lastClosing={lastClosings[gen.id] ?? null}
                  latestReading={latestGenReadings[gen.id] ?? null}
                  colors={colors}
                  onPress={() => {
                    // Could navigate to per-generator detail
                    // For now, open the log sheet pre-selected
                    setShowSheet(true);
                    setTimeout(() => {
                      sheetRef.current?.snapToIndex(0);
                    }, 100);
                  }}
                />
              ))}
            </View>
          )}

          {/* Recent Readings */}
          <RecentReadingsList readings={filteredReadings} generators={generators} colors={colors} />

          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {showSheet && (
        <LogReadingSheet
          sheetRef={sheetRef}
          snapPoints={snapPoints}
          generators={generators}
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
  lowFuelAlertRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  lowFuelAlertText: { fontSize: 12, fontFamily: 'Urbanist-Medium', color: '#FFE082' },

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

  // Generator Cards
  genCardsList: { gap: 12 },
  genCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  genCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  genCardHeaderLeft: { flex: 1 },
  genCardName: { fontSize: 16, fontFamily: 'Poppins-Bold' },
  genCardMeta: { fontSize: 12, fontFamily: 'Urbanist-Medium', marginTop: 2 },
  genStatusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  genStatusDot: { width: 6, height: 6, borderRadius: 3 },
  genStatusText: { fontSize: 11, fontFamily: 'Urbanist-Bold' },
  genCardFuel: { marginBottom: 12 },
  genCardFuelHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  genCardFuelLabel: { fontSize: 12, fontFamily: 'Urbanist-Medium' },
  genCardFooter: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  genCardFooterItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  genCardFooterText: { fontSize: 11, fontFamily: 'Urbanist-Medium' },

  // Gauge
  gaugeTrack: { borderRadius: 6, overflow: 'hidden' },
  gaugeFill: {},
  gaugeLabel: { fontSize: 11, fontFamily: 'Urbanist-Medium', marginTop: 3 },

  // Recent
  recentSection: { marginTop: 24 },
  recentSectionTitle: { fontSize: 16, fontFamily: 'Poppins-Bold', marginBottom: 12 },
  readingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
  readingRowLeft: { flex: 1 },
  readingGenName: { fontSize: 14, fontFamily: 'Poppins-Bold' },
  readingTime: { fontSize: 11, fontFamily: 'Urbanist-Medium', marginTop: 2 },
  readingRowRight: { alignItems: 'flex-end' },
  readingValue: { fontSize: 14, fontFamily: 'Poppins-Bold' },
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
  openingInfo: { flexDirection: 'row', gap: 16, padding: 12, borderRadius: 10, marginTop: 14 },
  openingItem: { flex: 1 },
  openingLabel: { fontSize: 11, fontFamily: 'Urbanist-Medium' },
  openingValue: { fontSize: 18, fontFamily: 'Poppins-Bold', marginTop: 2 },
  input: { padding: 14, borderRadius: 12, borderWidth: 1, fontSize: 15, fontFamily: 'Urbanist-Medium' },
  notesInput: { height: 80, textAlignVertical: 'top' },
  consumedBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10, marginTop: 14 },
  consumedText: { fontSize: 14, fontFamily: 'Urbanist-Bold' },
  submitBtn: { padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 20 },
  submitBtnText: { fontSize: 16, fontFamily: 'Poppins-Bold', color: '#FFFFFF' },
});
