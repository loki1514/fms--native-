
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/context';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/utils/supabase/client';
import {
  Fuel,
  TrendingUp,
  AlertTriangle,
  ArrowLeft,
  DollarSign,
  BarChart3,
} from 'lucide-react-native';

const { width: SCREEN_W } = Dimensions.get('window');

// ─── Types ────────────────────────────────────────────────────────────────────

interface Generator {
  id: string;
  name: string;
  capacity_kva?: number;
  tank_capacity_litres?: number;
  status: string;
}

interface DieselReading {
  id: string;
  generator_id: string;
  opening_hours: number;
  closing_hours: number;
  opening_diesel_level: number;
  closing_diesel_level: number;
  diesel_added_litres: number;
  computed_consumed_litres?: number;
  tariff_rate?: number;
  reading_date?: string;
  created_at: string;
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
        {/* Y axis labels */}
        <View style={styles.barChartYAxis}>
          <Text style={[styles.barChartYLabel, { color: labelColor }]}>{formatValue ? formatValue(maxVal) : maxVal.toFixed(0)}</Text>
          <Text style={[styles.barChartYLabel, { color: labelColor }]}>{formatValue ? formatValue(maxVal / 2) : (maxVal / 2).toFixed(0)}</Text>
          <Text style={[styles.barChartYLabel, { color: labelColor }]}>0</Text>
        </View>
        {/* Bars */}
        <View style={styles.barChartBars}>
          {data.map((d, i) => {
            const pct = maxVal > 0 ? (d.value / maxVal) * 100 : 0;
            return (
              <View key={i} style={[styles.barWrapper, { width: barW }]}>
                <View style={[styles.barChartTrack, { backgroundColor: barColor + '20' }]}>
                  <View
                    style={[
                      styles.barChartBar,
                      {
                        backgroundColor: barColor,
                        height: `${Math.max(pct, 1)}%`,
                      },
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

// ─── Custom Line Chart ───────────────────────────────────────────────────────

function LineChart({
  data,
  height = 160,
  lineColor,
  labelColor,
  fillColor,
}: {
  data: { label: string; value: number }[];
  height?: number;
  lineColor: string;
  labelColor: string;
  fillColor: string;
}) {
  if (data.length < 2) return null;
  const maxVal = Math.max(...data.map(d => d.value), 1);
  const minVal = 0;
  const range = maxVal - minVal || 1;
  const chartH = height - 28;
  const chartW = SCREEN_W - 64;
  const numPoints = data.length;
  const stepX = (chartW - 16) / Math.max(numPoints - 1, 1);

  const points = data.map((d, i) => ({
    x: i * stepX + 8,
    y: chartH - ((d.value - minVal) / range) * chartH,
    value: d.value,
    label: d.label,
  }));

  // Build SVG-like path using View positioning
  return (
    <View style={{ height }}>
      <View style={[styles.lineChartInner, { height: chartH }]}>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => (
          <View
            key={i}
            style={[styles.lineChartGrid, { top: pct * chartH, backgroundColor: labelColor + '20' }]}
          />
        ))}
        {/* Y labels */}
        <View style={styles.lineChartYAxis}>
          <Text style={[styles.barChartYLabel, { color: labelColor }]}>{maxVal.toFixed(0)}</Text>
          <Text style={[styles.barChartYLabel, { color: labelColor }]}>{maxVal.toFixed(0)}</Text>
          <Text style={[styles.barChartYLabel, { color: labelColor }]}>0</Text>
        </View>
        {/* Points */}
        <View style={styles.lineChartPoints}>
          {points.map((p, i) => (
            <View
              key={i}
              style={[
                styles.lineChartDot,
                {
                  left: p.x - 3,
                  top: p.y - 3,
                  backgroundColor: lineColor,
                },
              ]}
            />
          ))}
          {/* Connection dots */}
          {points.map((p, i) => (
            <View key={`line-${i}`} style={styles.lineChartLineContainer}>
              {i < points.length - 1 && (
                <View
                  style={[
                    styles.lineChartLine,
                    {
                      backgroundColor: lineColor,
                      width: Math.sqrt(Math.pow(points[i + 1].x - p.x, 2) + Math.pow(points[i + 1].y - p.y, 2)),
                      transform: [
                        { translateX: 0 },
                        {
                          rotate: `${Math.atan2(points[i + 1].y - p.y, points[i + 1].x - p.x)}rad`,
                        },
                        { translateX: 0 },
                      ],
                      left: p.x,
                      top: p.y,
                    },
                  ]}
                />
              )}
            </View>
          ))}
        </View>
      </View>
      {/* X labels */}
      <View style={styles.lineChartXLabels}>
        {data.length <= 14 && data.map((d, i) => (
          <Text key={i} style={[styles.barChartXLabel, { color: labelColor }]} numberOfLines={1}>
            {d.label}
          </Text>
        ))}
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

// ─── Alert Item ───────────────────────────────────────────────────────────────

function AlertItem({ message, color }: { message: string; color: string }) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  return (
    <View style={[styles.alertItem, { backgroundColor: color + '15', borderColor: color + '30' }]}>
      <AlertTriangle size={14} color={color} />
      <Text style={[styles.alertText, { color }]}>{message}</Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function DieselAnalyticsScreen() {
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const colors = Colors[theme];

  const [generators, setGenerators] = useState<Generator[]>([]);
  const [readings, setReadings] = useState<DieselReading[]>([]);
  const [tariffs, setTariffs] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [period, setPeriod] = useState<Period>('month');

  const periodDates = getPeriodDates(period);

  const fetchData = useCallback(async () => {
    if (!propertyId) return;
    setIsLoading(true);
    try {
      const [gensRes, readingsRes] = await Promise.all([
        supabase.from('generators').select('*').eq('property_id', propertyId).order('name'),
        supabase.from('diesel_readings').select('*').eq('property_id', propertyId).gte('reading_date', periodDates.start),
      ]);

      setGenerators((gensRes.data as any) || []);
      setReadings((readingsRes.data as any) || []);

      const today = new Date().toISOString().split('T')[0];
      const tariffRes = await fetch(`/api/properties/${propertyId}/dg-tariffs?date=${today}`);
      if (tariffRes.ok) {
        const tData = await tariffRes.json();
        if (tData) setTariffs({ [tData.id]: tData.cost_per_litre });
      }
    } catch (e) {
      console.error('Diesel analytics fetch error:', e);
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
  const totalConsumption = useMemo(
    () => readings.reduce((s, r) => s + (r.computed_consumed_litres ?? 0), 0),
    [readings]
  );
  const avgDaily = periodDates.days > 0 ? totalConsumption / periodDates.days : 0;
  const avgTariff = generators.length > 0
    ? Object.values(tariffs).reduce((a, b) => a + b, 0) / Object.values(tariffs).length || 0
    : 0;
  const estimatedCost = totalConsumption * avgTariff;

  const perGenTotals = useMemo(() => {
    const m: Record<string, number> = {};
    generators.forEach(g => { (m as any)[g.id] = 0; });
    readings.forEach(r => { (m as any)[r.generator_id] = ((m as any)[r.generator_id] ?? 0) + (r.computed_consumed_litres ?? 0); });
    return m;
  }, [readings, generators]);

  const topGenId = Object.entries(perGenTotals).sort((a, b) => b[1] - a[1])[0]?.[0] as string | undefined;
  const topGen = generators.find(g => g.id === topGenId);

  // Chart data - daily trend
  const trendData = useMemo(() => {
    const buckets: Record<string, number> = {};
    const now = new Date();
    for (let i = periodDates.days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      buckets[d.toISOString().split('T')[0]] = 0;
    }
    readings.forEach(r => {
      const d = r.reading_date || (r.created_at as string)?.split('T')[0];
      if (d && d in buckets) {
        (buckets as any)[d] += r.computed_consumed_litres ?? 0;
      }
    });
    const labelStep = periodDates.days <= 7 ? 1 : periodDates.days <= 30 ? 5 : 15;
    return Object.entries(buckets).map(([date, value], i) => ({
      label: i % labelStep === 0 ? new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '',
      value: Math.round(value * 10) / 10,
    }));
  }, [readings, periodDates]);

  // Gen comparison chart
  const compData = useMemo(() => {
    return generators.map(g => ({
      label: g.name.length > 14 ? g.name.substring(0, 14) + '..' : g.name,
      value: Math.round(((perGenTotals as any)[g.id] ?? 0) * 10) / 10,
    }));
  }, [generators, perGenTotals]);

  // Low fuel alerts
  const latestPerGen: Record<string, DieselReading> = {};
  readings.forEach(r => { if (!latestPerGen[r.generator_id]) latestPerGen[r.generator_id] = r; });
  const lowFuelAlerts = generators.filter(g => {
    const latest = latestPerGen[g.id];
    const level = latest?.closing_diesel_level ?? 0;
    const cap = g.tank_capacity_litres ?? 1000;
    return level < cap * 0.2;
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <ArrowLeft size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Diesel Analytics</Text>
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
              label="Total Consumed"
              value={totalConsumption.toFixed(0)}
              unit="Litres"
              icon={<Fuel size={18} color={colors.primary} />}
              color={colors.primary}
              subtitle={`${avgDaily.toFixed(1)} L/day avg`}
            />
            <SummaryCard
              label="Est. Cost"
              value={estimatedCost > 0 ? `$${estimatedCost.toFixed(0)}` : '-'}
              unit={avgTariff > 0 ? `@ $${avgTariff.toFixed(2)}/L` : ''}
              icon={<DollarSign size={18} color={colors.success} />}
              color={colors.success}
            />
            <SummaryCard
              label="Top Consumer"
              value={topGen?.name ?? '-'}
              unit={topGenId ? `${(perGenTotals as any)[topGenId]?.toFixed(0)} L` : ''}
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

          {/* Consumption Trend Chart */}
          <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.chartTitle, { color: colors.text }]}>Consumption Trend</Text>
            <Text style={[styles.chartSub, { color: colors.textSecondary }]}>Litres consumed per day</Text>
            {trendData.length > 1 ? (
              <BarChart
                data={trendData}
                height={180}
                barColor={colors.primary}
                labelColor={colors.textSecondary}
                formatValue={(v) => `${v.toFixed(0)}L`}
              />
            ) : (
              <View style={styles.chartEmpty}>
                <Text style={[styles.chartEmptyText, { color: colors.textTertiary }]}>Not enough data to display chart</Text>
              </View>
            )}
          </View>

          {/* Per-Generator Comparison */}
          <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.chartTitle, { color: colors.text }]}>Per-Generator Comparison</Text>
            <Text style={[styles.chartSub, { color: colors.textSecondary }]}>Total litres consumed</Text>
            {compData.length > 0 && compData.some(d => d.value > 0) ? (
              <BarChart
                data={compData}
                height={Math.max(160, generators.length * 50)}
                barColor={colors.primary}
                labelColor={colors.textSecondary}
                formatValue={(v) => `${v.toFixed(0)}L`}
              />
            ) : (
              <View style={styles.chartEmpty}>
                <Text style={[styles.chartEmptyText, { color: colors.textTertiary }]}>No consumption data</Text>
              </View>
            )}
          </View>

          {/* Low Fuel Alerts */}
          {lowFuelAlerts.length > 0 && (
            <View style={styles.alertsSection}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Low Fuel Alerts</Text>
              {lowFuelAlerts.map(g => (
                <AlertItem
                  key={g.id}
                  message={`${g.name}: fuel level below 20% of tank capacity`}
                  color={colors.warning}
                />
              ))}
            </View>
          )}

          {/* Generator Table */}
          <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.chartTitle, { color: colors.text }]}>Generator Summary</Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableH, { color: colors.textSecondary, flex: 2 }]}>Generator</Text>
              <Text style={[styles.tableH, { color: colors.textSecondary, textAlign: 'right' }]}>Total L</Text>
              <Text style={[styles.tableH, { color: colors.textSecondary, textAlign: 'right' }]}>Avg/Day</Text>
            </View>
            {generators.map(g => {
              const total = (perGenTotals as any)[g.id] ?? 0;
              const days = periodDates.days;
              return (
                <View key={g.id} style={[styles.tableRow, { borderColor: colors.border }]}>
                  <View style={{ flex: 2 }}>
                    <Text style={[styles.tableGenName, { color: colors.text }]}>{g.name}</Text>
                    <Text style={[styles.tableGenMeta, { color: colors.textTertiary }]}>
                      {g.capacity_kva ?? '?'} KVA · {g.tank_capacity_litres ?? '?'} L tank
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
    </SafeAreaView>
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

  // Line Chart
  lineChartInner: { position: 'relative', marginLeft: 32 },
  lineChartGrid: { position: 'absolute', left: 0, right: 0, height: 1 },
  lineChartYAxis: { position: 'absolute', left: -30, top: 0, bottom: 0, justifyContent: 'space-between', paddingVertical: 4 },
  lineChartPoints: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  lineChartDot: { position: 'absolute', width: 6, height: 6, borderRadius: 3 },
  lineChartLineContainer: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 },
  lineChartLine: { position: 'absolute', height: 2, transformOrigin: 'left center' },
  lineChartXLabels: { flexDirection: 'row', marginLeft: 32, justifyContent: 'space-between', height: 20 },

  // Chart
  chartCard: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 16, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 6, elevation: 2 },
  chartTitle: { fontSize: 16, fontFamily: 'Poppins-Bold' },
  chartSub: { fontSize: 12, fontFamily: 'Urbanist-Medium', marginTop: 2, marginBottom: 8 },
  chartEmpty: { height: 120, justifyContent: 'center', alignItems: 'center' },
  chartEmptyText: { fontSize: 13, fontFamily: 'Urbanist-Medium' },

  // Alerts
  alertsSection: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: 'Poppins-Bold', marginBottom: 10 },
  alertItem: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 8 },
  alertText: { fontSize: 13, fontFamily: 'Urbanist-Medium', flex: 1 },

  // Table
  tableHeader: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, marginBottom: 4 },
  tableH: { fontSize: 11, fontFamily: 'Urbanist-Bold', textTransform: 'uppercase', letterSpacing: 0.3 },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
  tableGenName: { fontSize: 14, fontFamily: 'Poppins-Bold' },
  tableGenMeta: { fontSize: 11, fontFamily: 'Urbanist-Regular', marginTop: 2 },
  tableVal: { fontSize: 14, fontFamily: 'Poppins-Bold', flex: 1 },
});
