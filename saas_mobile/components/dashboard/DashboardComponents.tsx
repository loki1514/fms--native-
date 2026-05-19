import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { STATUS_COLORS } from '@/constants/designSystem';
import SafeBlurView from '@/components/ui/SafeBlurView';
import PulseDotBase from './lovable/PulseDot';
import MiniBarChartBase from './lovable/MiniBarChart';

// ─── Re-exports ─────────────────────────────────────────────────────────────
export const PulseDot = PulseDotBase;

interface MiniBarChartProps {
  data: { day: string; count: number }[];
  highlightColor?: string;
}

export function MiniBarChart({ data, highlightColor }: MiniBarChartProps) {
  // highlightColor is accepted for API compatibility but the base component
  // doesn't support it yet — we pass through data only.
  return <MiniBarChartBase data={data} />;
}

// ─── GlassTile ──────────────────────────────────────────────────────────────
interface GlassTileProps {
  label: string;
  icon: string;
  delay?: number;
  status?: 'optimal' | 'watch' | 'critical';
  onPress?: () => void;
  children?: React.ReactNode;
}

export function GlassTile({ label, icon, delay = 0, status, onPress, children }: GlassTileProps) {
  const statusPalette = status ? STATUS_COLORS[status] : null;

  return (
    <Animated.View entering={FadeInUp.delay(delay).duration(500)}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={onPress}
        style={[styles.tileWrapper, { marginHorizontal: 20, marginBottom: 12 }]}
      >
        <SafeBlurView intensity={70} style={styles.tileBlur} tint="dark">
          <View style={styles.tileContent}>
            <View style={styles.tileHeader}>
              <View style={styles.tileHeaderLeft}>
                <Ionicons name={icon as any} size={16} color="rgba(255,255,255,0.5)" />
                <Text style={styles.tileLabel}>{label}</Text>
              </View>
              {statusPalette && (
                <View style={[styles.statusPill, { backgroundColor: statusPalette.surface, borderColor: statusPalette.border }]}>
                  <PulseDotBase color={statusPalette.bg} />
                  <Text style={[styles.statusText, { color: statusPalette.text }]}>{status.toUpperCase()}</Text>
                </View>
              )}
              <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.25)" />
            </View>
            {children}
          </View>
        </SafeBlurView>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── ProgressBar ────────────────────────────────────────────────────────────
interface ProgressBarProps {
  percent: number;
  color: string;
}

export function ProgressBar({ percent, color }: ProgressBarProps) {
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${Math.min(percent, 100)}%`, backgroundColor: color }]} />
    </View>
  );
}

// ─── AttentionCard ──────────────────────────────────────────────────────────
interface AttentionItem {
  id: string;
  entity_type: string;
  entity_id: string;
  title?: string;
  description?: string;
  priority?: string;
}

interface AttentionCardProps {
  item: AttentionItem;
  index: number;
  onAction?: () => void;
}

export function AttentionCard({ item, index, onAction }: AttentionCardProps) {
  return (
    <Animated.View entering={FadeInUp.delay(180 + index * 60).duration(400)}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onAction}
        style={[styles.attentionCard, { marginHorizontal: 20, marginBottom: 8 }]}
      >
        <SafeBlurView intensity={60} style={styles.attentionBlur} tint="dark">
          <View style={styles.attentionContent}>
            <View style={[styles.attentionIcon, { backgroundColor: 'rgba(239,68,68,0.15)', borderColor: 'rgba(239,68,68,0.3)' }]}>
              <Ionicons name="warning-outline" size={16} color="#EF4444" />
            </View>
            <View style={styles.attentionText}>
              <Text style={styles.attentionTitle} numberOfLines={1}>
                {item.title || `${item.entity_type} #${item.entity_id?.slice(0, 6)}`}
              </Text>
              <Text style={styles.attentionDesc} numberOfLines={1}>
                {item.description || 'Requires immediate attention'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.25)" />
          </View>
        </SafeBlurView>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tileWrapper: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  tileBlur: {
    minHeight: 140,
  },
  tileContent: {
    padding: 16,
  },
  tileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  tileHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  tileLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  progressTrack: {
    width: 80,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  attentionCard: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  attentionBlur: {
    minHeight: 56,
  },
  attentionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  attentionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  attentionText: {
    flex: 1,
  },
  attentionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  attentionDesc: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 2,
  },
});
