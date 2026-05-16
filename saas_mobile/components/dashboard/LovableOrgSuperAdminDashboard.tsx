import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  RefreshControl,
  ScrollView,
  ActivityIndicator,
  Platform,
  Modal,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import WeatherBackground from '@/components/dashboard/WeatherBackground';
import SafeBlurView from '@/components/ui/SafeBlurView';
import SignOutModal from '@/components/ui/SignOutModal';
import CassandraSessionModal from '@/components/cassandra/CassandraSessionModal';
import SidekickFace from '@/components/dashboard/SidekickFace';
import {
  SPACING,
} from '@/constants/designSystem';
import {
  GlassTile,
  StatColumns,
  ComplianceGauge,
  ScheduleItem,
} from './DashboardComponents';

const fontSans = Platform.select({ web: 'system-ui, -apple-system, sans-serif', ios: 'System', android: 'sans-serif', default: 'System' });
const fontDisplay = Platform.select({ web: '"SF Pro Display", system-ui, -apple-system, sans-serif', ios: 'System', android: 'sans-serif', default: 'System' });

interface Props {
  propertyId: string;
}

export default function LovableOrgSuperAdminDashboard({ propertyId }: Props) {
  const { signOut, membership } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showSignOut, setShowSignOut] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);

  const fetchData = useCallback(async () => {
    if (!propertyId) return;
    setIsLoading(true);
    try {
      await new Promise(r => setTimeout(r, 600));
    } catch (_) {
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [propertyId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }]}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <WeatherBackground condition="clear-night" />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={fetchData} tintColor="#FFFFFF" />}
      >
        {/* ─── Header ─────────────────────────────────────────────────────────── */}
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.headerHero}>
            <View style={styles.heroLeft}>
              <Text style={styles.welcomeText}>HELLO ADMIN</Text>
              <Text style={styles.propertyName}>{membership?.properties?.find(p => p.id === propertyId)?.name || 'SS Plaza'}</Text>
              <Text style={styles.propertyCode}>{propertyId.slice(0, 8).toUpperCase()} · April 18, 2026</Text>
            </View>
            <View style={styles.heroRight}>
              <View style={styles.tempContainer}>
                <Image
                  source={{ uri: 'https://pngimg.com/uploads/moon/moon_PNG52.png' }}
                  style={styles.moonImage}
                />
                <Text style={styles.tempText}>22°</Text>
                <TouchableOpacity style={styles.headerNotifBtn}>
                  <Ionicons name="notifications" size={18} color="#FFFFFF" />
                  <View style={styles.notifBadge} />
                </TouchableOpacity>
              </View>
              <View style={styles.weatherStatusRow}>
                <Text style={styles.weatherStatusText}>CLEAR NIGHT</Text>
                <Ionicons name="chevron-down" size={12} color="rgba(255,255,255,0.4)" />
              </View>
            </View>
          </View>
        </View>

        {/* ─── Dashboard Cards ─────────────────────────────────────────────────── */}
        <View style={styles.dashboardGrid}>
          <GlassTile label="Tickets" icon="ticket-outline" delay={100}>
            <StatColumns
              data={[
                { label: 'Open', value: 41, color: '#EF4444' },
                { label: 'Progress', value: 34, color: '#F5A000' },
                { label: 'Resolved', value: 354, color: '#1FC26E' },
              ]}
            />
          </GlassTile>

          <GlassTile label="Checklist" icon="checkbox-outline" delay={200}>
            <ComplianceGauge value={70} total={100} />
          </GlassTile>

          <GlassTile label="PPM Schedule" icon="calendar-outline" delay={300}>
            <ScheduleItem date="17" month="Apr" title="VRF AHU" type="Preventive Maintenance" status="PENDING" />
          </GlassTile>
        </View>
      </ScrollView>

      {/* ─── Bottom Navigation ─────────────────────────────────────────────── */}
      <View style={[styles.bottomNavContainer, { bottom: insets.bottom + 8 }]}>
        <SafeBlurView intensity={80} style={styles.bottomNavPill} tint="dark">
          <TouchableOpacity style={styles.navItem} onPress={() => setScreen?.('properties')}>
            <Ionicons name="home-outline" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem}>
            <Ionicons name="business-outline" size={24} color="rgba(255,255,255,0.4)" />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.cassandraOrbBtn} onPress={() => setShowChat(true)}>
            <View style={styles.cassandraOrbWhite}>
              <SidekickFace state="idle" size={28} color="#000" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.navItem}>
            <Ionicons name="stats-chart-outline" size={24} color="rgba(255,255,255,0.4)" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => setShowSignOut(true)}>
            <Ionicons name="person-outline" size={24} color="rgba(255,255,255,0.4)" />
          </TouchableOpacity>
        </SafeBlurView>
      </View>

      <SignOutModal visible={showSignOut} onClose={() => setShowSignOut(false)} onSignOut={signOut} />
      <CassandraSessionModal visible={showChat} onClose={() => setShowChat(false)} orgId={membership?.org_id || ''} />
      
      <Modal visible={showDrawer} transparent animationType="fade" onRequestClose={() => setShowDrawer(false)}>
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <View style={[styles.drawerPanel, { paddingTop: insets.top + 16 }]}>
            <View style={styles.drawerHeader}>
              <Text style={styles.drawerTitle}>Menu</Text>
              <TouchableOpacity onPress={() => setShowDrawer(false)} style={styles.drawerCloseBtn}>
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {[{ label: 'Tickets', route: 'tickets', icon: 'ticket-outline' }, { label: 'Settings', route: 'settings', icon: 'settings-outline' }].map((item) => (
                <TouchableOpacity key={item.route} style={styles.drawerItem} onPress={() => { setShowDrawer(false); router.push(`/property/${propertyId}/${item.route}` as any); }}>
                  <Ionicons name={item.icon as any} size={20} color="rgba(255,255,255,0.6)" />
                  <Text style={styles.drawerItemLabel}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
          <TouchableOpacity style={styles.drawerBackdrop} onPress={() => setShowDrawer(false)} />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  scroll: { flex: 1 },
  header: { paddingHorizontal: SPACING.xl, paddingBottom: 10 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.08)', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  headerHero: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heroLeft: { flex: 1, paddingTop: 4 },
  welcomeText: { fontFamily: fontSans, fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: 1.5 },
  propertyName: { fontFamily: fontDisplay, fontSize: 48, fontWeight: '800', color: '#FFFFFF', marginTop: 0, letterSpacing: -1.5 },
  propertyCode: { fontFamily: fontSans, fontSize: 15, color: 'rgba(255,255,255,0.4)', marginTop: 4, fontWeight: '500' },
  heroRight: { alignItems: 'flex-end' },
  tempContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, position: 'relative' },
  tempText: { fontFamily: fontDisplay, fontSize: 72, fontWeight: '800', color: '#FFFFFF', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 10, zIndex: 10 },
  moonImage: { width: 140, height: 140, position: 'absolute', right: -30, top: -20, opacity: 0.8 },
  headerNotifBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', marginLeft: 10, zIndex: 20 },
  notifBadge: { position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444', borderWidth: 1.5, borderColor: '#222' },
  weatherStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -12, marginRight: 40 },
  weatherStatusText: { fontFamily: fontSans, fontSize: 12, fontWeight: '800', color: 'rgba(255,255,255,0.6)', letterSpacing: 1 },
  dashboardGrid: { paddingVertical: 10, gap: 4 },
  bottomNavContainer: { position: 'absolute', left: 24, right: 24, alignItems: 'center', zIndex: 100 },
  bottomNavPill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 40, width: '100%', maxWidth: 360, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', overflow: 'hidden' },
  navItem: { padding: 10 },
  cassandraOrbBtn: { marginTop: -20 },
  cassandraOrbWhite: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', shadowColor: '#FFF', shadowOpacity: 0.5, shadowRadius: 15, elevation: 10 },
  drawerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  drawerPanel: { width: 280, height: '100%', backgroundColor: '#111', borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 20 },
  drawerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
  drawerTitle: { fontFamily: fontDisplay, fontSize: 24, fontWeight: '700', color: '#FFF' },
  drawerCloseBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center' },
  drawerItem: { flexDirection: 'row', alignItems: 'center', gap: 15, paddingVertical: 15 },
  drawerItemLabel: { fontFamily: fontSans, fontSize: 16, color: '#FFF' },
});
