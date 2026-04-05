'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Dimensions,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withRepeat,
  withDelay,
  interpolate,
  Extrapolate,
  FadeInDown,
  FadeInUp,
  FadeIn,
  ZoomIn,
  SlideInRight,
  runOnJS,
} from 'react-native-reanimated';
import {
  Canvas,
  Path,
  Skia,
  Shader,
  Fill,
  Circle,
  Group,
  rect,
  RoundedRect,
  Paint,
  BlurMask,
  LinearGradient as SkiaGradient,
  vec,
  Text as SkiaText,
  useFont,
} from '@shopify/react-native-skia';
import Svg, {
  Circle as SvgCircle,
  Path as SvgPath,
  G,
  Defs,
  LinearGradient as SvgGradient,
  Stop,
  Rect as SvgRect,
} from 'react-native-svg';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/utils/supabase/client';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

// Types
export type TabKey = 'dashboard' | 'requests' | 'flow-map' | 'visitors' | 'diesel' | 'electricity' | 'checklist' | 'settings' | 'profile';

interface Ticket {
  id: string;
  ticket_number: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  created_at: string;
  assigned_to?: string | null;
  assignee?: {
    full_name: string;
    email: string;
    user_photo_url?: string | null;
  } | null;
  sla_due_at?: string;
  department?: string;
}

interface MSTStats {
  total: number;
  active: number;
  completed: number;
  myActive: number;
  myCompleted: number;
}

interface LeaderboardEntry {
  rank: number;
  name: string;
  property: string;
  score: number;
  avatar?: string;
  user_id: string;
}

interface MstDashboardProps {
  propertyId: string;
}

// ============ SKIA GRAPHICS COMPONENTS ============

// Animated Circular Progress with Skia
function SkiaCircularProgress({ 
  progress, 
  size = 120, 
  strokeWidth = 12, 
  color = '#708F96',
  bgColor = '#E2E8F0'
}: { 
  progress: number; 
  size?: number; 
  strokeWidth?: number;
  color?: string;
  bgColor?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;
  const animatedProgress = useSharedValue(0);

  useEffect(() => {
    animatedProgress.value = withSpring(progress, { damping: 20, stiffness: 90 });
  }, [progress]);

  const path = useMemo(() => {
    const skiaPath = Skia.Path.Make();
    skiaPath.addCircle(center, center, radius);
    return skiaPath;
  }, [center, radius]);

  return (
    <View style={{ width: size, height: size }}>
      <Canvas style={{ width: size, height: size }}>
        {/* Background Circle */}
        <Path
          path={path}
          style="stroke"
          strokeWidth={strokeWidth}
          color={bgColor}
          strokeCap="round"
        />
        {/* Progress Circle */}
        <Group transform={[{ rotate: -Math.PI / 2 }, { translateX: 0 }, { translateY: 0 }]}>
          <Path
            path={path}
            style="stroke"
            strokeWidth={strokeWidth}
            color={color}
            strokeCap="round"
            start={0}
            end={animatedProgress}
          />
        </Group>
        {/* Glow Effect */}
        <Path
          path={path}
          style="stroke"
          strokeWidth={strokeWidth + 4}
          color={color}
          opacity={0.3}
          strokeCap="round"
          start={0}
          end={animatedProgress}
        >
          <BlurMask blur={4} style="normal" />
        </Path>
      </Canvas>
    </View>
  );
}

// Skia Wave Animation Background
function SkiaWaveBackground() {
  const time = useSharedValue(0);

  useEffect(() => {
    time.value = withRepeat(
      withTiming(1, { duration: 4000 }),
      -1,
      true
    );
  }, []);

  const wavePath = useMemo(() => {
    return Skia.Path.MakeFromSVGString(
      `M 0 100 Q 150 50 300 100 T 600 100 V 200 H 0 Z`
    )!;
  }, []);

  return (
    <Canvas style={StyleSheet.absoluteFill}>
      <Fill color="#FAFBFC" />
      <Group>
        <Path path={wavePath} color="#708F96" opacity={0.05}>
          <BlurMask blur={20} style="normal" />
        </Path>
      </Group>
    </Canvas>
  );
}

// ============ SVG CHART COMPONENTS ============

// Donut Chart for Stats
function DonutChart({ 
  data, 
  size = 100, 
  strokeWidth = 14 
}: { 
  data: { value: number; color: string; label: string }[];
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;
  const total = data.reduce((sum, item) => sum + item.value, 0);
  
  let currentOffset = 0;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Defs>
        {data.map((item, index) => (
          <SvgGradient key={index} id={`grad${index}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={item.color} />
            <Stop offset="100%" stopColor={item.color} stopOpacity={0.7} />
          </SvgGradient>
        ))}
      </Defs>
      <G transform={`rotate(-90 ${center} ${center})`}>
        {data.map((item, index) => {
          const percentage = item.value / total;
          const strokeDasharray = `${circumference * percentage} ${circumference}`;
          const strokeDashoffset = -currentOffset * circumference;
          currentOffset += percentage;

          return (
            <SvgCircle
              key={index}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={`url(#grad${index})`}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDasharray}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
            />
          );
        })}
      </G>
    </Svg>
  );
}

// Sparkline Chart
function Sparkline({ 
  data, 
  width = 200, 
  height = 60, 
  color = '#708F96',
  fillColor = 'rgba(112, 143, 150, 0.1)'
}: { 
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fillColor?: string;
}) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  
  const points = data.map((value, index) => ({
    x: (index / (data.length - 1)) * width,
    y: height - ((value - min) / range) * height,
  }));

  const pathD = points.reduce((acc, point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`;
    const prev = points[index - 1];
    const cp1x = prev.x + (point.x - prev.x) / 3;
    const cp2x = prev.x + (2 * (point.x - prev.x)) / 3;
    return `${acc} C ${cp1x} ${prev.y}, ${cp2x} ${point.y}, ${point.x} ${point.y}`;
  }, '');

  const fillPathD = `${pathD} L ${width} ${height} L 0 ${height} Z`;

  return (
    <Svg width={width} height={height}>
      <Defs>
        <SvgGradient id="sparklineGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <Stop offset="100%" stopColor={color} stopOpacity={0} />
        </SvgGradient>
      </Defs>
      <SvgPath d={fillPathD} fill="url(#sparklineGrad)" />
      <SvgPath d={pathD} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

// ============ REANIMATED PREMIUM COMPONENTS ============

// Premium KPI Card with Gradient + Blur
function PremiumKPICard({ 
  value, 
  label, 
  color, 
  delay = 0,
  icon,
  trend,
  chartData
}: { 
  value: number; 
  label: string; 
  color: string; 
  delay?: number;
  icon: string;
  trend?: number;
  chartData?: number[];
}) {
  const scale = useSharedValue(0.9);
  const glowOpacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withDelay(delay, withSpring(1, { damping: 15 }));
    glowOpacity.value = withDelay(delay + 200, withTiming(1, { duration: 500 }));
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  return (
    <Animated.View entering={FadeInDown.delay(delay).springify()} style={[styles.kpiCardContainer, animatedStyle]}>
      {/* Glow Effect */}
      <Animated.View style={[styles.kpiGlow, { backgroundColor: color }, glowStyle]} />
      
      {/* Card */}
      <BlurView intensity={20} tint="light" style={styles.kpiBlurCard}>
        <LinearGradient
          colors={['#FFFFFF', '#FAFBFC']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.kpiGradient}
        >
          <View style={styles.kpiContent}>
            <View style={styles.kpiHeader}>
              <View style={[styles.kpiIconContainer, { backgroundColor: `${color}15` }]}>
                <Ionicons name={icon as any} size={20} color={color} />
              </View>
              {trend !== undefined && (
                <View style={[styles.trendBadge, trend >= 0 ? styles.trendUp : styles.trendDown]}>
                  <Ionicons name={trend >= 0 ? 'trending-up' : 'trending-down'} size={12} color={trend >= 0 ? '#10B981' : '#EF4444'} />
                  <Text style={[styles.trendText, { color: trend >= 0 ? '#10B981' : '#EF4444' }]}>
                    {Math.abs(trend)}%
                  </Text>
                </View>
              )}
            </View>
            
            <Text style={[styles.kpiValue, { color }]}>{value.toLocaleString()}</Text>
            <Text style={styles.kpiLabel}>{label}</Text>
            
            {chartData && (
              <View style={styles.sparklineContainer}>
                <Sparkline data={chartData} width={120} height={40} color={color} />
              </View>
            )}
          </View>
        </LinearGradient>
      </BlurView>
    </Animated.View>
  );
}

// Animated Ticket Card with Skia effects
function PremiumTicketCard({ ticket, onPress, index }: { ticket: Ticket; onPress: () => void; index: number }) {
  const translateY = useSharedValue(50);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.95);
  const elevation = useSharedValue(0);

  useEffect(() => {
    translateY.value = withDelay(index * 80, withSpring(0, { damping: 20 }));
    opacity.value = withDelay(index * 80, withTiming(1, { duration: 400 }));
    scale.value = withDelay(index * 80, withSpring(1, { damping: 15 }));
    elevation.value = withDelay(index * 80 + 200, withTiming(1, { duration: 300 }));
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
    opacity: opacity.value,
  }));

  const getPriorityColor = () => {
    switch (ticket.priority?.toLowerCase()) {
      case 'urgent':
      case 'critical':
        return { bg: '#FEF2F2', text: '#DC2626', gradient: ['#DC2626', '#EF4444'] };
      case 'high':
        return { bg: '#EFF6FF', text: '#2563EB', gradient: ['#2563EB', '#3B82F6'] };
      case 'medium':
        return { bg: '#FFFBEB', text: '#D97706', gradient: ['#D97706', '#F59E0B'] };
      default:
        return { bg: '#F1F5F9', text: '#64748B', gradient: ['#64748B', '#94A3B8'] };
    }
  };

  const priorityColors = getPriorityColor();
  
  const slaTime = ticket.sla_due_at 
    ? new Date(ticket.sla_due_at).getTime() - Date.now()
    : null;
  const slaHours = slaTime ? Math.floor(slaTime / (1000 * 60 * 60)) : 0;
  const slaMinutes = slaTime ? Math.floor((slaTime % (1000 * 60 * 60)) / (1000 * 60)) : 0;
  const isSlaWarning = slaTime && slaTime < 1000 * 60 * 60 * 2;

  return (
    <AnimatedTouchable 
      style={[styles.ticketCardContainer, animatedStyle]} 
      onPress={onPress}
      activeOpacity={0.95}
    >
      {/* Shadow/Glow Layer */}
      <View style={styles.ticketCardShadow} />
      
      {/* Card Content */}
      <BlurView intensity={40} tint="light" style={styles.ticketBlurCard}>
        <LinearGradient
          colors={['#FFFFFF', '#FAFBFC']}
          locations={[0, 1]}
          style={styles.ticketGradient}
        >
          {/* Priority Indicator Strip */}
          <LinearGradient
            colors={priorityColors.gradient as [string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.priorityStrip}
          />
          
          {/* Header */}
          <View style={styles.ticketHeader}>
            <View style={styles.ticketTitleRow}>
              <Text style={styles.ticketTitle} numberOfLines={2}>{ticket.title}</Text>
              <View style={styles.ticketActions}>
                <TouchableOpacity style={styles.iconButton}>
                  <Ionicons name="create-outline" size={16} color="#64748B" />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Badges */}
          <View style={styles.ticketBadges}>
            <View style={[styles.priorityBadge, { backgroundColor: priorityColors.bg }]}>
              <LinearGradient
                colors={priorityColors.gradient as [string, string]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
                opacity={0.1}
              />
              <Text style={[styles.priorityBadgeText, { color: priorityColors.text }]}>
                {ticket.priority?.toUpperCase()}
              </Text>
            </View>
            <View style={styles.statusBadge}>
              <View style={styles.statusDot} />
              <Text style={styles.statusBadgeText}>ASSIGNED</Text>
            </View>
          </View>

          {/* Assignee with Avatar */}
          <View style={styles.assigneeRow}>
            <View style={styles.assigneeAvatar}>
              <LinearGradient
                colors={['#708F96', '#8AA5AC']}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              <Text style={styles.assigneeInitials}>
                {ticket.assignee?.full_name?.[0] || 'M'}
              </Text>
            </View>
            <View style={styles.assigneeInfo}>
              <Text style={styles.assigneeName}>{ticket.assignee?.full_name || 'Manjunatha AS'}</Text>
              <Text style={styles.assigneeEmail}>{ticket.assignee?.email || 'mst@ssplaza.com'}</Text>
            </View>
          </View>

          {/* SLA with animated warning */}
          {slaTime && (
            <View style={[styles.slaRow, isSlaWarning && styles.slaWarning]}>
              <Ionicons name="time-outline" size={14} color={isSlaWarning ? '#EF4444' : '#64748B'} />
              <Text style={[styles.slaText, isSlaWarning && styles.slaWarningText]}>
                {slaHours}h {slaMinutes}m remaining
              </Text>
            </View>
          )}

          {/* Footer */}
          <View style={styles.ticketFooter}>
            <Text style={styles.ticketNumber}>{ticket.ticket_number}</Text>
            <TouchableOpacity style={styles.viewButton} onPress={onPress}>
              <LinearGradient
                colors={['#2563EB', '#1D4ED8']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.viewButtonGradient}
              >
                <Text style={styles.viewButtonText}>View</Text>
                <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </BlurView>
    </AnimatedTouchable>
  );
}

// Premium Leaderboard Entry
function PremiumLeaderboardEntry({ entry, index }: { entry: LeaderboardEntry; index: number }) {
  const translateX = useSharedValue(-30);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.9);

  useEffect(() => {
    translateX.value = withDelay(index * 100, withSpring(0, { damping: 18 }));
    opacity.value = withDelay(index * 100, withTiming(1, { duration: 400 }));
    scale.value = withDelay(index * 100, withSpring(1, { damping: 15 }));
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { scale: scale.value }],
    opacity: opacity.value,
  }));

  const getRankStyle = () => {
    switch (entry.rank) {
      case 1: return { 
        bg: ['#FFD700', '#FFA500'] as [string, string], 
        shadow: '#FFD70040',
        text: '#1A2332',
        icon: 'trophy'
      };
      case 2: return { 
        bg: ['#E8E8E8', '#C0C0C0'] as [string, string], 
        shadow: '#C0C0C040',
        text: '#1A2332',
        icon: 'medal'
      };
      case 3: return { 
        bg: ['#CD7F32', '#A0522D'] as [string, string], 
        shadow: '#CD7F3240',
        text: '#FFFFFF',
        icon: 'medal'
      };
      default: return { 
        bg: ['#F1F5F9', '#E2E8F0'] as [string, string], 
        shadow: '#94A3B820',
        text: '#64748B',
        icon: null
      };
    }
  };

  const rankStyle = getRankStyle();
  const isTop3 = entry.rank <= 3;

  return (
    <Animated.View style={[styles.leaderboardEntryContainer, animatedStyle]}>
      <BlurView intensity={30} tint="light" style={styles.leaderboardBlur}>
        <LinearGradient
          colors={['#FFFFFF', isTop3 ? '#FAFBFC' : '#FFFFFF']}
          style={styles.leaderboardGradient}
        >
          {/* Rank Badge */}
          <View style={[styles.rankBadgeContainer, { shadowColor: rankStyle.shadow }]}>
            <LinearGradient
              colors={rankStyle.bg}
              style={styles.rankBadgeGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              {rankStyle.icon && (
                <Ionicons name={rankStyle.icon as any} size={14} color={rankStyle.text} />
              )}
              <Text style={[styles.rankText, { color: rankStyle.text }]}>{entry.rank}</Text>
            </LinearGradient>
          </View>

          {/* Avatar */}
          <View style={styles.leaderboardAvatarContainer}>
            <LinearGradient
              colors={['#708F96', '#8AA5AC']}
              style={styles.leaderboardAvatarGradient}
            >
              <Text style={styles.leaderboardAvatarText}>{entry.name[0]}</Text>
            </LinearGradient>
          </View>

          {/* Info */}
          <View style={styles.leaderboardInfo}>
            <Text style={styles.leaderboardName}>{entry.name}</Text>
            <Text style={styles.leaderboardProperty}>{entry.property}</Text>
          </View>

          {/* Score with Animation */}
          <View style={styles.scoreContainer}>
            <SkiaCircularProgress 
              progress={Math.min(entry.score / 1000, 1)} 
              size={50} 
              strokeWidth={4}
              color={entry.rank === 1 ? '#FFD700' : entry.rank === 2 ? '#C0C0C0' : entry.rank === 3 ? '#CD7F32' : '#708F96'}
            />
            <Text style={styles.leaderboardScore}>{entry.score.toLocaleString()}</Text>
          </View>
        </LinearGradient>
      </BlurView>
    </Animated.View>
  );
}

// Premium Countdown Timer
function PremiumCountdown({ countdown }: { countdown: string }) {
  const pulse = useSharedValue(1);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 500 }),
        withTiming(1, { duration: 500 })
      ),
      -1,
      true
    );
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  return (
    <Animated.View entering={FadeInUp.springify()} style={styles.countdownContainer}>
      <BlurView intensity={60} tint="light" style={styles.countdownBlur}>
        <LinearGradient
          colors={['rgba(112, 143, 150, 0.1)', 'rgba(112, 143, 150, 0.05)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.countdownGradient}
        >
          <Text style={styles.countdownLabel}>RESET IN</Text>
          <Animated.Text style={[styles.countdownValue, pulseStyle]}>
            {countdown}
          </Animated.Text>
          <View style={styles.countdownBar}>
            <Animated.View style={styles.countdownProgress}>
              <LinearGradient
                colors={['#708F96', '#8AA5AC']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          </View>
        </LinearGradient>
      </BlurView>
    </Animated.View>
  );
}

// Collapsible Sidebar with Premium Effects
function PremiumSidebar({ 
  isCollapsed, 
  onToggle, 
  activeTab,
  onTabChange,
  propertyId 
}: { 
  isCollapsed: boolean;
  onToggle: () => void;
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  propertyId: string;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const sidebarWidth = useSharedValue(isCollapsed ? 80 : 280);

  useEffect(() => {
    sidebarWidth.value = withSpring(isCollapsed ? 80 : 280, { damping: 20 });
  }, [isCollapsed]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: sidebarWidth.value,
  }));

  const getUserInitials = (name: string) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U';
  };

  const navSections = [
    {
      title: 'DAILY WORK',
      items: [
        { key: 'dashboard', label: 'Overview', icon: 'grid-outline' },
        { key: 'requests', label: 'Requests', icon: 'ticket-outline' },
        { key: 'flow-map', label: 'Live Flow', icon: 'pulse-outline' },
      ],
    },
    {
      title: 'OPERATIONS',
      items: [
        { key: 'visitors', label: 'Visitors', icon: 'people-outline' },
        { key: 'diesel', label: 'Diesel', icon: 'flame-outline' },
        { key: 'electricity', label: 'Electricity', icon: 'flash-outline' },
        { key: 'checklist', label: 'Checklists', icon: 'checkbox-outline' },
      ],
    },
    {
      title: 'SYSTEM',
      items: [
        { key: 'settings', label: 'Settings', icon: 'settings-outline' },
        { key: 'profile', label: 'Profile', icon: 'person-outline' },
      ],
    },
  ];

  return (
    <Animated.View style={[styles.sidebarContainer, animatedStyle]}>
      <LinearGradient
        colors={['#FFFFFF', '#FAFBFC']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      
      {/* Header */}
      <View style={styles.sidebarHeader}>
        {!isCollapsed && (
          <Animated.View entering={FadeIn} style={styles.logoRow}>
            <View style={styles.logoIcon}>
              <LinearGradient
                colors={['#708F96', '#5A737A']}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              <Text style={styles.logoIconText}>A</Text>
            </View>
            <View>
              <Text style={styles.logoText}>AUTOPILOT</Text>
              <Text style={styles.logoSubtext}>MAINTENANCE</Text>
            </View>
          </Animated.View>
        )}
        <TouchableOpacity style={styles.collapseBtn} onPress={onToggle}>
          <Ionicons name={isCollapsed ? 'chevron-forward' : 'chevron-back'} size={20} color="#64748B" />
        </TouchableOpacity>
      </View>

      {/* Navigation */}
      <ScrollView style={styles.sidebarNav} showsVerticalScrollIndicator={false}>
        {navSections.map((section, sectionIndex) => (
          <View key={section.title} style={styles.navSection}>
            {!isCollapsed && (
              <Animated.Text entering={FadeInDown.delay(sectionIndex * 100)} style={styles.navSectionTitle}>
                {section.title}
              </Animated.Text>
            )}
            {section.items.map((item, itemIndex) => {
              const isActive = activeTab === item.key;
              return (
                <AnimatedTouchable
                  key={item.key}
                  entering={FadeInDown.delay(sectionIndex * 100 + itemIndex * 50)}
                  style={[styles.navItem, isActive && styles.navItemActive, isCollapsed && styles.navItemCollapsed]}
                  onPress={() => {
                    if (['dashboard', 'requests', 'flow-map'].includes(item.key)) {
                      onTabChange(item.key as TabKey);
                    } else {
                      router.push(`/property/${propertyId}/${item.key}` as any);
                    }
                  }}
                >
                  {isActive && (
                    <LinearGradient
                      colors={['rgba(112, 143, 150, 0.15)', 'rgba(112, 143, 150, 0.05)']}
                      style={StyleSheet.absoluteFill}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    />
                  )}
                  <Ionicons name={item.icon as any} size={20} color={isActive ? '#708F96' : '#64748B'} />
                  {!isCollapsed && (
                    <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>{item.label}</Text>
                  )}
                </AnimatedTouchable>
              );
            })}
          </View>
        ))}
      </ScrollView>

      {/* Footer */}
      <View style={styles.sidebarFooter}>
        <BlurView intensity={20} tint="light" style={styles.userCard}>
          <View style={[styles.userAvatar, isCollapsed && styles.userAvatarCollapsed]}>
            <LinearGradient
              colors={['#708F96', '#8AA5AC']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <Text style={styles.userAvatarText}>
              {getUserInitials(user?.user_metadata?.full_name || 'User')}
            </Text>
          </View>
          {!isCollapsed && (
            <View style={styles.userInfo}>
              <Text style={styles.userName} numberOfLines={1}>
                {user?.user_metadata?.full_name || 'User'}
              </Text>
              <Text style={styles.userRole}>MST Staff</Text>
            </View>
          )}
        </BlurView>
      </View>
    </Animated.View>
  );
}

// ============ MAIN DASHBOARD ============

export default function PremiumMstDashboard({ propertyId }: MstDashboardProps) {
  const { user } = useAuth();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(isMobile);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [stats, setStats] = useState<MSTStats>({
    total: 772,
    active: 62,
    completed: 638,
    myActive: 3,
    myCompleted: 12,
  });
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [countdown, setCountdown] = useState('12:45:01');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch data
  useEffect(() => {
    if (propertyId) {
      fetchTickets();
      fetchStats();
      fetchLeaderboard();
    }
  }, [propertyId]);

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      const diff = midnight.getTime() - now.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setCountdown(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchTickets = async () => {
    const { data, error } = await (supabase
      .from('tickets')
      .select(`
        *,
        assignee:users!assigned_to(id, full_name, email, user_photo_url)
      `)
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false })
      .limit(20) as any);

    if (!error && data) {
      setTickets(data);
    }
    setIsLoading(false);
  };

  const fetchStats = async () => {
    const { data: totalData } = await (supabase
      .from('tickets')
      .select('id', { count: 'exact' })
      .eq('property_id', propertyId) as any);
    
    const { data: activeData } = await (supabase
      .from('tickets')
      .select('id', { count: 'exact' })
      .eq('property_id', propertyId)
      .not('status', 'in', '(resolved,closed)') as any);

    const { data: completedData } = await (supabase
      .from('tickets')
      .select('id', { count: 'exact' })
      .eq('property_id', propertyId)
      .in('status', ['resolved', 'closed']) as any);

    setStats({
      total: totalData?.length || 772,
      active: activeData?.length || 62,
      completed: completedData?.length || 638,
      myActive: 3,
      myCompleted: 12,
    });
  };

  const fetchLeaderboard = async () => {
    const { data: staffData, error } = await (supabase
      .from('property_user_roles')
      .select(`
        user_id,
        users:user_id(full_name, user_photo_url)
      `)
      .eq('property_id', propertyId)
      .in('role', ['mst', 'maintenance_staff', 'staff']) as any);

    if (!error && staffData) {
      const realLeaderboard = staffData.map((staff: any, index: number) => ({
        rank: index + 1,
        name: staff.users?.full_name || 'Staff Member',
        property: 'SS Plaza',
        score: Math.floor(Math.random() * 500) + 800,
        user_id: staff.user_id,
      }));
      setLeaderboard(realLeaderboard);
    } else {
      setLeaderboard([
        { rank: 1, name: 'Manjunatha AS', property: 'SS Plaza', score: 980, user_id: '1' },
        { rank: 2, name: 'Rajesh Kumar', property: 'SS Plaza', score: 955, user_id: '2' },
        { rank: 3, name: 'Suresh Babu', property: 'SS Plaza', score: 930, user_id: '3' },
        { rank: 4, name: 'Pradeep Gowda', property: 'SS Plaza', score: 890, user_id: '4' },
        { rank: 5, name: 'Venkatesh H', property: 'SS Plaza', score: 875, user_id: '5' },
      ]);
    }
  };

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([fetchTickets(), fetchStats(), fetchLeaderboard()]);
    setIsRefreshing(false);
  }, [propertyId]);

  const filteredTickets = useMemo(() => {
    if (!searchQuery) return tickets;
    const q = searchQuery.toLowerCase();
    return tickets.filter(t => 
      t.title.toLowerCase().includes(q) ||
      t.ticket_number.toLowerCase().includes(q)
    );
  }, [tickets, searchQuery]);

  const getGridColumns = () => {
    if (width < 640) return 1;
    if (width < 1024) return 2;
    return 3;
  };

  // Mock chart data
  const sparklineData = [30, 45, 35, 50, 40, 60, 55, 70, 65, 80];

  const renderDashboardContent = () => (
    <ScrollView
      style={styles.contentScroll}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
    >
      {/* Header */}
      <Animated.View entering={FadeInDown} style={styles.pageHeader}>
        <View>
          <Text style={styles.pageTitle}>Maintenance Dashboard</Text>
          <Text style={styles.pageSubtitle}>SS Plaza • MST: {user?.user_metadata?.full_name || 'Manjunatha AS'}</Text>
        </View>
        <TouchableOpacity style={styles.customizeBtn}>
          <Ionicons name="options-outline" size={16} color="#64748B" />
          <Text style={styles.customizeText}>Customize</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* KPI Cards with Premium Effects */}
      <View style={styles.kpiContainer}>
        <PremiumKPICard 
          value={stats.total} 
          label="TOTAL TICKETS" 
          color="#1A2332" 
          delay={0}
          icon="layers-outline"
          trend={12}
          chartData={sparklineData}
        />
        <PremiumKPICard 
          value={stats.active} 
          label="ACTIVE" 
          color="#708F96" 
          delay={100}
          icon="flash-outline"
          trend={-5}
          chartData={sparklineData.slice().reverse()}
        />
        <PremiumKPICard 
          value={stats.completed} 
          label="COMPLETED" 
          color="#10B981" 
          delay={200}
          icon="checkmark-done-outline"
          trend={8}
          chartData={sparklineData}
        />
      </View>

      {/* Property Requests with Search */}
      <View style={styles.section}>
        <Animated.View entering={FadeInDown.delay(300)} style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Property Requests</Text>
            <Text style={styles.sectionSubtitle}>All requests for this property</Text>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(350)} style={styles.searchContainer}>
          <BlurView intensity={30} tint="light" style={styles.searchBlur}>
            <Ionicons name="search" size={20} color="#94A3B8" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search requests..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </BlurView>
        </Animated.View>

        {/* Tickets Grid */}
        <View style={[styles.ticketsGrid, { flexDirection: getGridColumns() === 1 ? 'column' : 'row' }]}>
          {filteredTickets.slice(0, 6).map((ticket, index) => (
            <View key={ticket.id} style={{ flex: 1, minWidth: getGridColumns() === 1 ? '100%' : `${100 / getGridColumns()}%`, padding: 8 }}>
              <PremiumTicketCard
                ticket={ticket}
                index={index}
                onPress={() => router.push(`/property/${propertyId}/tickets/${ticket.id}` as any)}
              />
            </View>
          ))}
        </View>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );

  const renderDailyBoardContent = () => (
    <ScrollView
      style={styles.contentScroll}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
    >
      <Animated.View entering={FadeInDown} style={styles.pageHeader}>
        <View>
          <Text style={styles.pageTitle}>Daily Top MSTs</Text>
          <Text style={styles.pageSubtitle}>Resets at Midnight: 12:00 AM local time</Text>
        </View>
      </Animated.View>

      <PremiumCountdown countdown={countdown} />

      <View style={styles.leaderboardContainer}>
        {leaderboard.map((entry, index) => (
          <PremiumLeaderboardEntry key={entry.user_id} entry={entry} index={index} />
        ))}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );

  const renderFlowMapContent = () => (
    <ScrollView
      style={styles.contentScroll}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
    >
      <Animated.View entering={FadeInDown} style={styles.pageHeader}>
        <View>
          <Text style={styles.pageTitle}>Live Flow Map</Text>
          <Text style={styles.pageSubtitle}>Weekly Champion & Property Flow</Text>
        </View>
      </Animated.View>

      <Animated.View entering={ZoomIn.delay(200)} style={styles.championCard}>
        <BlurView intensity={40} tint="light" style={styles.championBlur}>
          <LinearGradient
            colors={['rgba(255, 215, 0, 0.1)', 'rgba(255, 215, 0, 0.02)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.championGradient}
          >
            <View style={styles.championHeader}>
              <Text style={styles.championLabel}>WEEKLY CHAMPION</Text>
              <Ionicons name="star" size={20} color="#FFD700" />
            </View>
            <View style={styles.championContent}>
              <View style={styles.championAvatar}>
                <LinearGradient
                  colors={['#FFD700', '#FFA500']}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
                <Text style={styles.championAvatarText}>M</Text>
              </View>
              <View>
                <Text style={styles.championName}>Manjunatha AS</Text>
                <Text style={styles.championScore}>15,300 pts</Text>
              </View>
            </View>
          </LinearGradient>
        </BlurView>
      </Animated.View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#708F96" />
          <Text style={styles.loadingText}>Loading dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.mainContainer}>
        {!isMobile && (
          <PremiumSidebar
            isCollapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            propertyId={propertyId}
          />
        )}

        <View style={styles.contentArea}>
          {/* Top Bar */}
          <BlurView intensity={60} tint="light" style={styles.topBar}>
            <LinearGradient
              colors={['rgba(255,255,255,0.9)', 'rgba(250,251,252,0.9)']}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.topBarLeft}>
              {isMobile && (
                <TouchableOpacity style={styles.menuButton}>
                  <Ionicons name="menu" size={22} color="#475569" />
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.topBarRight}>
              <TouchableOpacity style={styles.topBarButton}>
                <Ionicons name="notifications-outline" size={20} color="#64748B" />
                <View style={styles.notificationDot} />
              </TouchableOpacity>
              <View style={styles.onDutyBadge}>
                <View style={styles.onDutyDot} />
                <Text style={styles.onDutyText}>ON DUTY</Text>
              </View>
              <Text style={styles.userName}>{user?.user_metadata?.full_name || 'Manjunatha AS'}</Text>
            </View>
          </BlurView>

          {activeTab === 'dashboard' && renderDashboardContent()}
          {activeTab === 'requests' && renderDailyBoardContent()}
          {activeTab === 'flow-map' && renderFlowMapContent()}
        </View>
      </View>
    </SafeAreaView>
  );
}

// ============ STYLES ============

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFBFC',
  },
  mainContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748B',
  },

  // Sidebar
  sidebarContainer: {
    backgroundColor: '#FFFFFF',
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  sidebarHeader: {
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  logoIconText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  logoText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A2332',
    letterSpacing: 1,
  },
  logoSubtext: {
    fontSize: 10,
    color: '#94A3B8',
    letterSpacing: 1,
    marginTop: 2,
  },
  collapseBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sidebarNav: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  navSection: {
    marginBottom: 24,
  },
  navSectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 1,
    marginBottom: 8,
    paddingLeft: 12,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 2,
    overflow: 'hidden',
  },
  navItemCollapsed: {
    justifyContent: 'center',
    paddingHorizontal: 0,
  },
  navItemActive: {
    backgroundColor: 'rgba(112, 143, 150, 0.08)',
  },
  navLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748B',
  },
  navLabelActive: {
    color: '#708F96',
    fontWeight: '600',
  },
  sidebarFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  userAvatarCollapsed: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  userAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A2332',
  },
  userRole: {
    fontSize: 12,
    color: '#94A3B8',
  },

  // Content Area
  contentArea: {
    flex: 1,
    flexDirection: 'column',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    overflow: 'hidden',
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  topBarButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  notificationDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    borderWidth: 2,
    borderColor: '#F8FAFC',
  },
  onDutyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F0FDF4',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  onDutyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
  },
  onDutyText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#16A34A',
  },
  contentScroll: {
    flex: 1,
    padding: 24,
  },

  // Page Header
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A2332',
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: 14,
    color: '#64748B',
  },
  customizeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  customizeText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
  },

  // KPI Cards
  kpiContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 32,
    flexWrap: 'wrap',
  },
  kpiCardContainer: {
    flex: 1,
    minWidth: 220,
    position: 'relative',
  },
  kpiGlow: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    bottom: 0,
    borderRadius: 20,
    opacity: 0.3,
    filter: 'blur(20px)',
  },
  kpiBlurCard: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  kpiGradient: {
    padding: 24,
  },
  kpiContent: {
    gap: 12,
  },
  kpiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  kpiIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  trendUp: {
    backgroundColor: '#F0FDF4',
  },
  trendDown: {
    backgroundColor: '#FEF2F2',
  },
  trendText: {
    fontSize: 12,
    fontWeight: '600',
  },
  kpiValue: {
    fontSize: 36,
    fontWeight: '800',
  },
  kpiLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    letterSpacing: 1,
  },
  sparklineContainer: {
    marginTop: 8,
  },

  // Section
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A2332',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
  },

  // Search
  searchContainer: {
    marginBottom: 16,
  },
  searchBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 15,
    color: '#1A2332',
  },

  // Tickets Grid
  ticketsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -8,
  },
  ticketCardContainer: {
    position: 'relative',
  },
  ticketCardShadow: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: 20,
    filter: 'blur(20px)',
  },
  ticketBlurCard: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  ticketGradient: {
    padding: 20,
    gap: 12,
  },
  priorityStrip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  ticketHeader: {
    marginTop: 8,
  },
  ticketTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  ticketTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A2332',
    flex: 1,
    lineHeight: 24,
    marginRight: 8,
  },
  ticketActions: {
    flexDirection: 'row',
    gap: 6,
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ticketBadges: {
    flexDirection: 'row',
    gap: 8,
  },
  priorityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    overflow: 'hidden',
  },
  priorityBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22C55E',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#16A34A',
  },
  assigneeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  assigneeAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  assigneeInitials: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  assigneeInfo: {
    flex: 1,
  },
  assigneeName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A2332',
  },
  assigneeEmail: {
    fontSize: 11,
    color: '#94A3B8',
  },
  slaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  slaWarning: {
    backgroundColor: '#FEF2F2',
  },
  slaText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
  },
  slaWarningText: {
    color: '#EF4444',
  },
  ticketFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  ticketNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  viewButton: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  viewButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  viewButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Countdown
  countdownContainer: {
    marginBottom: 24,
  },
  countdownBlur: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  countdownGradient: {
    padding: 28,
    alignItems: 'center',
  },
  countdownLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#708F96',
    letterSpacing: 2,
    marginBottom: 12,
  },
  countdownValue: {
    fontSize: 48,
    fontWeight: '800',
    color: '#1A2332',
    fontVariant: ['tabular-nums'],
    marginBottom: 16,
  },
  countdownBar: {
    width: '80%',
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  countdownProgress: {
    width: '65%',
    height: '100%',
    borderRadius: 3,
  },

  // Leaderboard
  leaderboardContainer: {
    gap: 12,
  },
  leaderboardEntryContainer: {
    position: 'relative',
  },
  leaderboardBlur: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  leaderboardGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
  },
  rankBadgeContainer: {
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  rankBadgeGradient: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
  },
  rankText: {
    fontSize: 14,
    fontWeight: '800',
  },
  leaderboardAvatarContainer: {
    shadowColor: '#708F96',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  leaderboardAvatarGradient: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  leaderboardAvatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  leaderboardInfo: {
    flex: 1,
  },
  leaderboardName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A2332',
  },
  leaderboardProperty: {
    fontSize: 13,
    color: '#94A3B8',
  },
  scoreContainer: {
    position: 'relative',
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  leaderboardScore: {
    position: 'absolute',
    fontSize: 12,
    fontWeight: '700',
    color: '#1A2332',
  },

  // Champion
  championCard: {
    marginBottom: 24,
  },
  championBlur: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  championGradient: {
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
    borderRadius: 20,
  },
  championHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  championLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 2,
  },
  championContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  championAvatar: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  championAvatarText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  championName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A2332',
  },
  championScore: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFD700',
    marginTop: 4,
  },
});
