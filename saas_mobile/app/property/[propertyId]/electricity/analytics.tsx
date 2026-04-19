
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/utils/supabase/client';
import {
  Zap,
  TrendingUp,
  DollarSign,
  BarChart3,
  ArrowLeft,
} from 'lucide-react-native';

const { width: SCREEN_W } = Dimensions.get('window');

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
  reading_date?: string;
  created_at: string;
}

interface GridTariff {
  id: string;
  rate_per_unit: number;
  utility_provider?: string;
}

// ─── Period Selector ──────────────────────────────────────────────────────────

type Period = 'week' | 'month' | 'quarter';

const PERIODS: { label: string; value: Period }[] = [
  { label: 'Week', value: 'week' },
  { label: 'Month', value: 'month' },
  { label: 'Quarter', value: 'quarter' },
];

function getPeriodDates(period: Period): { start: string; days: number } {
  const now = new Date();
  const end = now.toISOString().split('T')[0];
  let start: string;
  let days: number;
  if (period === 'week') { days = 7; const d = new Date(now); d.setDate(d.getDate() - 7); start = d.toISOString().split('T')[0]; }
  else if (period === 'month') { days = 30; const d = new Date(now); d.setDate(d.getDate() - 30); start = d.toISOString().split('T')[0]; }
  else { days = 90; const d = new Date(now); d.setDate(d.getDate() - 90); start = d.toISOString().split('T')[0]; }
  return { start, days };
}

// ─── Custom Bar Chart ─────────────────────────────────────────────────────────

function BarChart({
  data,
  height = 160,
  barColor,
  labelColor,
  formatValue,
}: {
  data: { label: string; value: number }[];
  height?: number;
  barColor: string;
  labelColor: string;
  formatValue?: (v: number) => string;
}) {
  if (data.length === 0) return null;
  const maxVal = Math.max(...data.map(d => d.value), 1);
  const CHART_PADDING = 32;
  const chartW = SCREEN_W - 64;
  const barW = Math.max(8, (chartW - CHART_PADDING) / data.length - 4);

  return (
    <View style={{ height }}>
      <View style={[styles.barChartInner, { height: height - 28 }]}>
        <View style={styles.barChartYAxis}>
          <Text style={[styles.barChartYLabel, { color: labelColor }]}>{formatValue ? formatValue(maxVal) : maxVal.toFixed(0)}</Text>
          <Text style={[styles.barChartYLabel, { color: labelColor }]}>{formatValue ? formatValue(maxVal / 2) : (maxVal / 2).toFixed(0)}</Text>
          <Text style={[styles.barChartYLabel, { color: labelColor }]}>0</Text>
        </View>
        <View style={styles.barChartBars}>
          {data.map((d, i) => {
            const pct = maxVal > 0 ? (d.value / maxVal) * 100 : 0;
            return (
              <View key={i} style={[styles.barWrapper, { width: barW }]}>
                <View style={[styles.barChartTrack, { backgroundColor: barColor + '20' }]}>
                  <View
                    style={[
                      styles.barChartBar,
                      { backgroundColor: barColor, height: `${Math.max(pct, 1)}%` },
                    ]}
                  />
                </View>
                {data.length <= 14 && (
                  <Text style={[styles.barChartXLabel, { color: labelColor }]} numberOfLines={1}>
                    {d.label}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

// ─── Summary Card ─────────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  unit,
  icon,
  color,
  subtitle,
}: {
  label: string;
  value: string;
  unit?: string;
  icon: React.ReactNode;
  color: string;
  subtitle?: string;
}) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.summaryIconWrap, { backgroundColor: color + '18' }]}>
        {icon}
      </View>
      <Text style={[styles.summaryValue, { color: colors.text }]}>{value}</Text>
      {unit && <Text style={[styles.summaryUnit, { color: colors.textSecondary }]}>{unit}</Text>}
      {subtitle && <Text style={[styles.summarySub, { color: colors.textTertiary }]}>{subtitle}</Text>}
      <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ElectricityAnalyticsScreen() {
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const colors = Colors[theme];
  const insets = useSafeAreaInsets();

  const [meters, setMeters] = useState<ElectricityMeter[]>([]);
  const [readings, setReadings] = useState<ElectricityReading[]>([]);
  const [activeTariff, setActiveTariff] = useState<GridTariff | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [period, setPeriod] = useState<Period>('month');

  const periodDates = getPeriodDates(period);

  const fetchData = useCallback(async () => {
    if (!propertyId) return;
    setIsLoading(true);
    try {
      const [metersRes, readingsRes] = await Promise.all([
        supabase
          .from('electricity_meters')
          .select('*')
          .eq('property_id', propertyId)
          .is('deleted_at', null)
          .order('name'),
        supabase
          .from('electricity_readings')
          .select('*')
          .eq('property_id', propertyId)
          .gte('reading_date', periodDates.start),
      ]);

      setMeters((metersRes.data as any) || []);
      setReadings((readingsRes.data as any) || []);

      const todayStr = new Date().toISOString().split('T')[0];
      supabase.rpc('get_active_grid_tariff', {
        p_property_id: propertyId,
        p_date: todayStr
      }).then(({ data: rpcData }) => {
        if (rpcData && (rpcData as any[]).length > 0) {
          setActiveTariff((rpcData as any[])[0]);
        } else {
          // Fallback fetch all
          return supabase
            .from('grid_tariffs')
            .select('*')
            .eq('property_id', propertyId)
            .order('effective_from', { ascending: false })
            .then(({ data: allData }) => {
              if (allData && allData.length > 0) {
                const active = allData.find((t: any) => 
                  !t.effective_to && t.effective_from <= todayStr
                ) || allData[0];
                setActiveTariff(active);
              }
            });
        }
      });
    } catch (e) {
      console.error('Electricity analytics fetch error:', e);
    } finally {
      setIsLoading(false);
    }
  }, [propertyId, periodDates.start]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchData().finally(() => setIsRefreshing(false));
  }, [fetchData]);

  // Metrics
  const totalUnits = useMemo(
    () => readings.reduce((s, r) => s + (r.final_units ?? r.computed_units ?? 0), 0),
    [readings]
  );
  const avgDaily = periodDates.days > 0 ? totalUnits / periodDates.days : 0;
  const tariffRate = activeTariff?.rate_per_unit ?? 0;
  const estimatedCost = totalUnits * tariffRate;

  const perMeterTotals = useMemo(() => {
    const m: Record<string, number> = {};
    meters.forEach(mt => { (m as any)[mt.id] = 0; });
    readings.forEach(r => { (m as any)[r.meter_id] = ((m as any)[r.meter_id] ?? 0) + (r.final_units ?? r.computed_units ?? 0); });
    return m;
  }, [readings, meters]);

  const topMeterId = Object.entries(perMeterTotals).sort((a, b) => b[1] - a[1])[0]?.[0] as string | undefined;
  const topMeter = meters.find(m => m.id === topMeterId);

  // Daily usage stats
  const dailyStats = useMemo(() => {
    const buckets: Record<string, number[]> = {};
    const now = new Date();
    for (let i = periodDates.days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      (buckets as any)[d.toISOString().split('T')[0]] = [];
    }
    readings.forEach(r => {
      const d = r.reading_date || (r.created_at as string)?.split('T')[0];
      if (d && (buckets as any)[d]) {
        ((buckets as any)[d] as number[]).push(r.final_units ?? r.computed_units ?? 0);
      }
    });
    const dailyTotals = (Object.values(buckets as any) as number[][]).map((vals) =>
      vals.reduce((a: number, b: number) => a + b, 0)
    );
    if (dailyTotals.length === 0) return { peak: 0, avg: 0, low: 0 };
    return {
      peak: Math.max(...dailyTotals),
      avg: dailyTotals.reduce((a, b) => a + b, 0) / dailyTotals.length,
      low: Math.min(...dailyTotals),
    };
  }, [readings, periodDates]);

  // Trend chart data
  const trendData = useMemo(() => {
    const buckets: Record<string, number> = {};
    const now = new Date();
    for (let i = periodDates.days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      (buckets as any)[d.toISOString().split('T')[0]] = 0;
    }
    readings.forEach(r => {
      const d = r.reading_date || (r.created_at as string)?.split('T')[0];
      if (d && (buckets as any)[d] !== undefined) {
        (buckets as any)[d] += r.final_units ?? r.computed_units ?? 0;
      }
    });
    const labelStep = periodDates.days <= 7 ? 1 : periodDates.days <= 30 ? 5 : 15;
    return Object.entries(buckets as Record<string, number>).map(([date, value], i) => ({
      label: i % labelStep === 0 ? new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '',
      value: Math.round(value * 10) / 10,
    }));
  }, [readings, periodDates]);

  // Meter comparison
  const compData = useMemo(() => {
    return meters.map(m => ({
      label: m.name.length > 14 ? m.name.substring(0, 14) + '..' : m.name,
      value: Math.round(((perMeterTotals as any)[m.id] ?? 0) * 10) / 10,
    }));
  }, [meters, perMeterTotals]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <ArrowLeft size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Electricity Analytics</Text>
          <View style={{ width: 36 }} />
        </View>
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
          {/* Summary Cards */}
          <View style={styles.summaryGrid}>
            <SummaryCard
              label="Total Consumption"
              value={totalUnits.toFixed(0)}
              unit="kVAh"
              icon={<Zap size={18} color={colors.primary} />}
              color={colors.primary}
              subtitle={`${avgDaily.toFixed(1)} kVAh/day avg`}
            />
            <SummaryCard
              label="Est. Cost"
              value={estimatedCost > 0 ? `₹${estimatedCost.toFixed(0)}` : '-'}
              unit={tariffRate > 0 ? `@ ₹${tariffRate.toFixed(2)}/kVAh` : ''}
              icon={<DollarSign size={18} color={colors.success} />}
              color={colors.success}
            />
            <SummaryCard
              label="Top Consumer"
              value={topMeter?.name ?? '-'}
              unit={topMeterId ? `${((perMeterTotals as any)[topMeterId] ?? 0).toFixed(0)} kVAh` : ''}
              icon={<TrendingUp size={18} color={colors.secondary} />}
              color={colors.secondary}
            />
            <SummaryCard
              label="Readings"
              value={readings.length.toString()}
              unit="total"
              icon={<BarChart3 size={18} color={colors.info} />}
              color={colors.info}
            />
          </View>

          {/* Peak vs Off-Peak Summary */}
          <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.chartTitle, { color: colors.text }]}>Daily Usage Summary</Text>
            <View style={styles.peakRow}>
              <View style={styles.peakItem}>
                <Text style={[styles.peakLabel, { color: colors.textTertiary }]}>Peak Day</Text>
                <Text style={[styles.peakValue, { color: colors.error }]}>{dailyStats.peak.toFixed(1)}</Text>
              </View>
              <View style={styles.peakItem}>
                <Text style={[styles.peakLabel, { color: colors.textTertiary }]}>Average</Text>
                <Text style={[styles.peakValue, { color: colors.primary }]}>{dailyStats.avg.toFixed(1)}</Text>
              </View>
              <View style={styles.peakItem}>
                <Text style={[styles.peakLabel, { color: colors.textTertiary }]}>Lowest</Text>
                <Text style={[styles.peakValue, { color: colors.success }]}>{dailyStats.low.toFixed(1)}</Text>
              </View>
            </View>
            {/* Mini bar chart */}
            {trendData.length > 1 && (
              <BarChart
                data={trendData}
                height={120}
                barColor={colors.primary}
                labelColor={colors.textSecondary}
                formatValue={(v) => `${v.toFixed(0)}`}
              />
            )}
          </View>

          {/* Consumption Trend */}
          <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.chartTitle, { color: colors.text }]}>Consumption Trend</Text>
            <Text style={[styles.chartSub, { color: colors.textSecondary }]}>Total kVAh per day</Text>
            {trendData.length > 1 ? (
              <BarChart
                data={trendData}
                height={180}
                barColor={colors.primary}
                labelColor={colors.textSecondary}
                formatValue={(v) => `${v.toFixed(0)}`}
              />
            ) : (
              <View style={styles.chartEmpty}>
                <Text style={[styles.chartEmptyText, { color: colors.textTertiary }]}>Not enough data</Text>
              </View>
            )}
          </View>

          {/* Per-Meter Comparison */}
          <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.chartTitle, { color: colors.text }]}>Per-Meter Comparison</Text>
            <Text style={[styles.chartSub, { color: colors.textSecondary }]}>Total kVAh consumed</Text>
            {compData.length > 0 && compData.some(d => d.value > 0) ? (
              <BarChart
                data={compData}
                height={Math.max(160, meters.length * 50)}
                barColor={colors.primary}
                labelColor={colors.textSecondary}
                formatValue={(v) => `${v.toFixed(0)}`}
              />
            ) : (
              <View style={styles.chartEmpty}>
                <Text style={[styles.chartEmptyText, { color: colors.textTertiary }]}>No consumption data</Text>
              </View>
            )}
          </View>

          {/* Cost Breakdown */}
          {tariffRate > 0 && (
            <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.chartTitle, { color: colors.text }]}>Cost Breakdown</Text>
              <Text style={[styles.chartSub, { color: colors.textSecondary }]}>By meter</Text>
              {meters.map(m => {
                const units = (perMeterTotals as any)[m.id] ?? 0;
                const cost = units * tariffRate;
                const pct = totalUnits > 0 ? (units / totalUnits) * 100 : 0;
                return (
                  <View key={m.id} style={[styles.costRow, { borderColor: colors.border }]}>
                    <View style={styles.costRowLeft}>
                      <Text style={[styles.costMeterName, { color: colors.text }]}>{m.name}</Text>
                      <View style={[styles.costBarTrack, { backgroundColor: colors.border }]}>
                        <View style={[styles.costBarFill, { width: `${pct}%`, backgroundColor: colors.primary }]} />
                      </View>
                    </View>
                    <View style={styles.costRowRight}>
                      <Text style={[styles.costAmount, { color: colors.success }]}>
                        {cost > 0 ? `₹${cost.toFixed(2)}` : '-'}
                      </Text>
                      <Text style={[styles.costPct, { color: colors.textTertiary }]}>{pct.toFixed(0)}%</Text>
                    </View>
                  </View>
                );
              })}
              <View style={[styles.costTotalRow, { borderColor: colors.border }]}>
                <Text style={[styles.costTotalLabel, { color: colors.text }]}>Total Estimated Cost</Text>
                <Text style={[styles.costTotalAmount, { color: colors.primary }]}>
                  ₹{estimatedCost.toFixed(2)}
                </Text>
              </View>
            </View>
          )}

          {/* Meter Table */}
          <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.chartTitle, { color: colors.text }]}>Meter Summary</Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableH, { color: colors.textSecondary, flex: 2 }]}>Meter</Text>
              <Text style={[styles.tableH, { color: colors.textSecondary, textAlign: 'right' }]}>Total kVAh</Text>
              <Text style={[styles.tableH, { color: colors.textSecondary, textAlign: 'right' }]}>Avg/Day</Text>
            </View>
            {meters.map(m => {
              const total = (perMeterTotals as any)[m.id] ?? 0;
              const days = periodDates.days;
              return (
                <View key={m.id} style={[styles.tableRow, { borderColor: colors.border }]}>
                  <View style={{ flex: 2 }}>
                    <Text style={[styles.tableGenName, { color: colors.text }]}>{m.name}</Text>
                    <Text style={[styles.tableGenMeta, { color: colors.textTertiary }]}>
                      {m.meter_type || 'Meter'} · {m.meter_number || 'No #'}
                    </Text>
                  </View>
                  <Text style={[styles.tableVal, { color: colors.text, textAlign: 'right' }]}>
                    {total.toFixed(0)}
                  </Text>
                  <Text style={[styles.tableVal, { color: colors.textSecondary, textAlign: 'right' }]}>
                    {(total / days).toFixed(1)}
                  </Text>
                </View>
              );
            })}
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 16 },

  // Header
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontFamily: 'Poppins-Bold', color: '#FFFFFF' },
  periodRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  periodBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)' },
  periodBtnActive: { backgroundColor: '#FFFFFF' },
  periodBtnText: { fontSize: 13, fontFamily: 'Urbanist-Bold', color: 'rgba(255,255,255,0.8)' },
  periodBtnTextActive: { color: Colors.light.primary },

  // Summary
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  summaryCard: {
    width: (SCREEN_W - 44) / 2,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  summaryIconWrap: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  summaryValue: { fontSize: 24, fontFamily: 'Poppins-Bold', letterSpacing: -0.5 },
  summaryUnit: { fontSize: 12, fontFamily: 'Urbanist-Medium' },
  summarySub: { fontSize: 10, fontFamily: 'Urbanist-Regular', marginTop: 2 },
  summaryLabel: { fontSize: 11, fontFamily: 'Urbanist-Medium', marginTop: 6, textTransform: 'uppercase', letterSpacing: 0.3 },

  // Bar Chart
  barChartInner: { flexDirection: 'row', alignItems: 'flex-end', paddingLeft: 32 },
  barChartYAxis: { position: 'absolute', left: 0, top: 0, bottom: 20, justifyContent: 'space-between', paddingVertical: 4 },
  barChartYLabel: { fontSize: 9, fontFamily: 'Urbanist-Medium', textAlign: 'right', width: 28 },
  barChartBars: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  barWrapper: { alignItems: 'center', justifyContent: 'flex-end' },
  barChartTrack: { width: '100%', borderRadius: 4, overflow: 'hidden', justifyContent: 'flex-end' },
  barChartBar: { width: '100%', borderRadius: 4 },
  barChartXLabel: { fontSize: 9, fontFamily: 'Urbanist-Medium', marginTop: 4, textAlign: 'center', width: '100%' },

  // Chart
  chartCard: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 16, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 6, elevation: 2 },
  chartTitle: { fontSize: 16, fontFamily: 'Poppins-Bold' },
  chartSub: { fontSize: 12, fontFamily: 'Urbanist-Medium', marginTop: 2, marginBottom: 8 },
  chartEmpty: { height: 120, justifyContent: 'center', alignItems: 'center' },
  chartEmptyText: { fontSize: 13, fontFamily: 'Urbanist-Medium' },

  // Peak
  peakRow: { flexDirection: 'row', marginBottom: 12, gap: 8 },
  peakItem: { flex: 1, alignItems: 'center' },
  peakLabel: { fontSize: 11, fontFamily: 'Urbanist-Bold', textTransform: 'uppercase', letterSpacing: 0.3 },
  peakValue: { fontSize: 20, fontFamily: 'Poppins-Bold', marginTop: 4 },

  // Cost breakdown
  costRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1 },
  costRowLeft: { flex: 1, paddingRight: 12 },
  costMeterName: { fontSize: 13, fontFamily: 'Poppins-Bold', marginBottom: 4 },
  costBarTrack: { height: 4, borderRadius: 2, overflow: 'hidden' },
  costBarFill: { height: '100%', borderRadius: 2 },
  costRowRight: { alignItems: 'flex-end', minWidth: 70 },
  costAmount: { fontSize: 14, fontFamily: 'Poppins-Bold' },
  costPct: { fontSize: 11, fontFamily: 'Urbanist-Medium', marginTop: 2 },
  costTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: 1 },
  costTotalLabel: { fontSize: 14, fontFamily: 'Poppins-Bold' },
  costTotalAmount: { fontSize: 18, fontFamily: 'Poppins-Bold' },

  // Table
  tableHeader: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, marginBottom: 4 },
  tableH: { fontSize: 11, fontFamily: 'Urbanist-Bold', textTransform: 'uppercase', letterSpacing: 0.3 },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
  tableGenName: { fontSize: 14, fontFamily: 'Poppins-Bold' },
  tableGenMeta: { fontSize: 11, fontFamily: 'Urbanist-Regular', marginTop: 2 },
  tableVal: { fontSize: 14, fontFamily: 'Poppins-Bold', flex: 1 },
});
