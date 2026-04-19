'use client';
/**
 * DetailModal — Tile detail modal matching reference design
 *
 * Shows:
 *  - 3-column metrics grid
 *  - Custom SVG area chart
 *  - Status breakdown list
 *  - AI analysis section with sparkles
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Defs, LinearGradient as SvgLinearGradient, Rect, Line, Circle } from 'react-native-svg';

export type TileVariant = 'tickets' | 'checklist' | 'health' | 'energy';

export interface ChartPoint {
  label: string;
  value: number;
}

export interface BreakdownItem {
  label: string;
  value: string | number;
  color: string;
}

export interface TileDetail {
  id: string;
  iconName: keyof typeof Ionicons.glyphMap;
  label: string;
  title: string;
  metrics: { label: string; value: string }[];
  chartTitle: string;
  chartData: ChartPoint[];
  chartColor: string;
  trendDirection: 'up' | 'down';
  trendLabel: string;
  breakdownTitle: string;
  breakdown: BreakdownItem[];
  aiAnalysis: string;
}

const fontSans = Platform.OS === 'ios' ? 'System' : 'sans-serif';
const fontDisplay = Platform.OS === 'web' ? 'Poppins' : 'System';

// ─── Custom SVG area chart ────────────────────────────────────────────────────
interface AreaSvgChartProps {
  data: ChartPoint[];
  color: string;
}

function AreaSvgChart({ data, color }: AreaSvgChartProps) {
  const chartW = 300;
  const chartH = 140;
  const padL = 8;
  const padR = 8;
  const padT = 12;
  const padB = 24;
  const innerW = chartW - padL - padR;
  const innerH = chartH - padT - padB;

  const values = data?.map((d) => d.value) || [0];
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;

  const getX = (i: number) => padL + (i / (data.length - 1)) * innerW;
  const getY = (v: number) => padT + innerH - ((v - minVal) / range) * innerH;

  // Build smooth bezier area path
  const pts = data?.map((d, i) => ({ x: getX(i), y: getY(d.value) })) || [];

  const linePath = pts.reduce((acc, pt, i) => {
    if (i === 0) return `M ${pt.x},${pt.y}`;
    const prev = pts[i - 1];
    const cpx1 = prev.x + (pt.x - prev.x) * 0.5;
    const cpx2 = pt.x - (pt.x - prev.x) * 0.5;
    return `${acc} C ${cpx1},${prev.y} ${cpx2},${pt.y} ${pt.x},${pt.y}`;
  }, '');

  const areaPath = `${linePath} L ${pts[pts.length - 1].x},${chartH - padB} L ${pts[0].x},${chartH - padB} Z`;

  const gradientId = `chartGrad_${color.replace(/[^a-z0-9]/gi, '')}`;

  // Horizontal grid lines
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((frac) => {
    const y = padT + frac * innerH;
    return { y, value: Math.round(maxVal - frac * range) };
  });

  return (
    <View style={{ width: chartW, height: chartH }}>
      <Svg width={chartW} height={chartH} viewBox={`0 0 ${chartW} ${chartH}`}>
        <Defs>
          <SvgLinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <Rect x="0" y="0" width={chartW} height={padT + innerH} fill={color} fillOpacity={0.5} />
            <Rect x="0" y={padT + innerH * 0.5} width={chartW} height={padT + innerH * 0.5} fill={color} fillOpacity={0.1} />
            <Rect x="0" y={padT + innerH * 0.8} width={chartW} height={padT + innerH * 0.2} fill={color} fillOpacity={0} />
          </SvgLinearGradient>
        </Defs>

        {/* Grid lines */}
        {gridLines?.map((gl, i) => (
          <Line
            key={i}
            x1={padL}
            y1={gl.y}
            x2={chartW - padR}
            y2={gl.y}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={1}
          />
        ))}

        {/* Area fill */}
        <Path d={areaPath} fill={`url(#${gradientId})`} />

        {/* Line stroke */}
        <Path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {pts?.map((pt, i) => (
          <Circle
            key={i}
            cx={pt.x}
            cy={pt.y}
            r={i === pts.length - 1 ? 4 : 3}
            fill={color}
            stroke="rgba(10,12,20,0.8)"
            strokeWidth={1.5}
          />
        ))}
      </Svg>

      {/* X-axis labels */}
      <View style={[StyleSheet.absoluteFill, { top: chartH - padB + 4 }]}>
        <View style={{ flexDirection: 'row', paddingLeft: padL, paddingRight: padR }}>
          {data?.map((d, i) => (
            <Text
              key={i}
              style={{
                flex: 1,
                textAlign: 'center',
                fontSize: 9,
                color: 'rgba(255,255,255,0.50)',
                fontFamily: fontSans,
              }}
            >
              {d.label}
            </Text>
          ))}
        </View>
      </View>
    </View>
  );
}

function StatusDot({ color }: { color: string }) {
  return (
    <View
      style={[
        styles.statusDot,
        { backgroundColor: color, shadowColor: color, shadowOpacity: 1, shadowRadius: 4, elevation: 3 },
      ]}
    />
  );
}

interface DetailModalProps {
  detail: TileDetail | null;
  onClose: () => void;
}

export default function DetailModal({ detail, onClose }: DetailModalProps) {
  if (!detail) return null;

  return (
    <Modal
      visible={true}
      animationType="slide"
      transparent
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      />

      {/* Modal content */}
      <View style={styles.modalContainer}>
        <BlurView intensity={80} tint="dark" style={styles.modalContent}>
          <View style={{ padding: 28, flex: 1 }}>
            {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.headerLeft}>
              <View style={styles.labelRow}>
                <Ionicons
                  name={detail.iconName}
                  size={14}
                  color="rgba(255,255,255,0.60)"
                />
                <Text style={styles.labelText}>{detail.label.toUpperCase()}</Text>
              </View>
              <Text style={styles.titleText}>{detail.title}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={18} color="rgba(255,255,255,0.80)" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 40 }}
          >
            {/* Metrics row */}
            <View style={styles.metricsRow}>
              {detail.metrics?.map((m) => (
                <View key={m.label} style={styles.metricCell}>
                  <Text style={styles.metricValue}>{m.value}</Text>
                  <Text style={styles.metricLabel}>{m.label.toUpperCase()}</Text>
                </View>
              ))}
            </View>

            {/* Chart card */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{detail.chartTitle}</Text>
                <View
                  style={[
                    styles.trendBadge,
                    {
                      backgroundColor:
                        detail.trendDirection === 'up'
                          ? 'rgba(31,194,110,0.15)'
                          : 'rgba(196,160,0,0.15)',
                    },
                  ]}
                >
                  <Ionicons
                    name={detail.trendDirection === 'up' ? 'trending-up' : 'trending-down'}
                    size={12}
                    color={detail.trendDirection === 'up' ? '#1FC26E' : '#C4A000'}
                  />
                  <Text
                    style={[
                      styles.trendText,
                      {
                        color: detail.trendDirection === 'up' ? '#1FC26E' : '#C4A000',
                      },
                    ]}
                  >
                    {detail.trendLabel}
                  </Text>
                </View>
              </View>

              {/* Custom SVG area chart */}
              <AreaSvgChart data={detail.chartData} color={detail.chartColor} />
            </View>

            {/* Status breakdown */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{detail.breakdownTitle}</Text>
              <View style={styles.breakdownList}>
                {detail.breakdown?.map((item) => (
                  <View key={item.label} style={styles.breakdownRow}>
                    <StatusDot color={item.color} />
                    <Text style={styles.breakdownLabel}>{item.label}</Text>
                    <Text style={[styles.breakdownValue, { color: item.color }]}>
                      {item.value}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* AI Analysis */}
            <View style={styles.aiCard}>
              <View style={styles.aiHeader}>
                <Ionicons name="sparkles" size={16} color="#A78BFA" />
                <Text style={styles.aiTitle}>AI Analysis</Text>
              </View>
              <Text style={styles.aiText}>{detail.aiAnalysis}</Text>
            </View>
          </ScrollView>
          </View>
        </BlurView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.60)',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    flex: 1,
    backgroundColor: 'rgba(10,12,20,0.7)',
    marginTop: 80, // High margin for airy feel
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  headerLeft: {
    flex: 1,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  labelText: {
    fontFamily: fontSans,
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.60)',
    letterSpacing: 0.15 * 10,
    textTransform: 'uppercase',
  },
  titleText: {
    fontFamily: Platform.OS === 'web' ? 'Poppins' : 'System',
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  scrollView: {
    flex: 1,
  },

  // Metrics
  metricsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    padding: 20,
    marginBottom: 16,
  },
  metricCell: {
    flex: 1,
    alignItems: 'center',
  },
  metricValue: {
    fontFamily: Platform.OS === 'web' ? 'Poppins' : 'System',
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  metricLabel: {
    fontFamily: fontSans,
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.50)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 4,
    textAlign: 'center',
  },

  // Chart card
  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    padding: 20,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontFamily: Platform.OS === 'web' ? 'Poppins' : 'System',
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.90)',
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  trendText: {
    fontFamily: fontSans,
    fontSize: 11,
    fontWeight: '600',
  },
  chartContainer: {
    alignItems: 'center',
    marginTop: 8,
  },

  // Breakdown
  breakdownList: {
    gap: 12,
    marginTop: 4,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  breakdownLabel: {
    flex: 1,
    fontFamily: fontSans,
    fontSize: 14,
    color: 'rgba(255,255,255,0.80)',
  },
  breakdownValue: {
    fontFamily: fontSans,
    fontSize: 14,
    fontWeight: '600',
  },

  // AI
  aiCard: {
    backgroundColor: 'rgba(167,139,250,0.12)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.20)',
    padding: 20,
    marginBottom: 12,
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  aiTitle: {
    fontFamily: Platform.OS === 'web' ? 'Poppins' : 'System',
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  aiText: {
    fontFamily: fontSans,
    fontSize: 13,
    color: 'rgba(255,255,255,0.80)',
    lineHeight: 20,
  },
});
