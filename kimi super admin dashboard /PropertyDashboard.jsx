import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  TextInput,
} from 'react-native';
import Svg, { 
  Path, 
  Circle, 
  Polygon,
  Defs,
  Mask,
  Ellipse,
} from 'react-native-svg';

const IPHONE_WIDTH = 393;

// ==================== ANIMATED CLOUDS ====================
const AnimatedClouds = () => {
  const cloud1Pos = useRef(new Animated.Value(-200)).current;
  const cloud2Pos = useRef(new Animated.Value(400)).current;
  const cloud3Pos = useRef(new Animated.Value(-150)).current;
  const cloud4Pos = useRef(new Animated.Value(350)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(cloud1Pos, { toValue: 450, duration: 35000, useNativeDriver: true })
    ).start();
    Animated.loop(
      Animated.timing(cloud2Pos, { toValue: -250, duration: 28000, useNativeDriver: true })
    ).start();
    Animated.loop(
      Animated.timing(cloud3Pos, { toValue: 500, duration: 22000, useNativeDriver: true })
    ).start();
    Animated.loop(
      Animated.timing(cloud4Pos, { toValue: -200, duration: 40000, useNativeDriver: true })
    ).start();
  }, []);

  const CloudShape = ({ width, height, opacity }) => (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Ellipse cx={width * 0.33} cy={height * 0.625} rx={width * 0.28} ry={height * 0.31} fill={`rgba(255,255,255,${opacity})`} />
      <Ellipse cx={width * 0.57} cy={height * 0.56} rx={width * 0.31} ry={height * 0.375} fill={`rgba(255,255,255,${opacity - 0.05})`} />
      <Ellipse cx={width * 0.8} cy={height * 0.625} rx={width * 0.22} ry={height * 0.275} fill={`rgba(255,255,255,${opacity - 0.1})`} />
    </Svg>
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[styles.cloud, { top: '5%', transform: [{ translateX: cloud1Pos }] }]}>
        <CloudShape width={180} height={80} opacity={0.8} />
      </Animated.View>
      <Animated.View style={[styles.cloud, { top: '15%', transform: [{ translateX: cloud2Pos }] }]}>
        <CloudShape width={150} height={70} opacity={0.6} />
      </Animated.View>
      <Animated.View style={[styles.cloud, { top: '25%', transform: [{ translateX: cloud3Pos }] }]}>
        <CloudShape width={120} height={55} opacity={0.5} />
      </Animated.View>
      <Animated.View style={[styles.cloud, { top: '8%', transform: [{ translateX: cloud4Pos }] }]}>
        <CloudShape width={200} height={90} opacity={0.4} />
      </Animated.View>
    </View>
  );
};

// ==================== SVG ICONS ====================
const Icons = {
  Menu: ({size=20, color='#fff'}) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <Path d="M3 12h18M3 6h18M3 18h18"/>
    </Svg>
  ),
  Bell: ({size=20, color='#fff'}) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round">
      <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <Path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </Svg>
  ),
  Search: ({size=18, color='rgba(255,255,255,0.6)'}) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <Circle cx="11" cy="11" r="8"/>
      <Path d="m21 21-4.35-4.35"/>
    </Svg>
  ),
  Home: ({size=24, color='#fff'}) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round">
      <Path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <Path d="M9 22V12h6v10"/>
    </Svg>
  ),
  Building: ({size=24, color='rgba(255,255,255,0.5)'}) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round">
      <Path d="M3 21h18"/>
      <Path d="M5 21V7l8-4 8 4v14"/>
      <Path d="M9 21v-6h6v6"/>
    </Svg>
  ),
  Chart: ({size=24, color='rgba(255,255,255,0.5)'}) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round">
      <Path d="M18 20V10M12 20V4M6 20v-6"/>
    </Svg>
  ),
  User: ({size=24, color='rgba(255,255,255,0.5)'}) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round">
      <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <Circle cx="12" cy="7" r="4"/>
    </Svg>
  ),
  Sun: ({size=28, color='#FFD700'}) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round">
      <Circle cx="12" cy="12" r="5" fill={color} fillOpacity="0.3"/>
      <Circle cx="12" cy="12" r="5"/>
      <Path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
    </Svg>
  ),
  ArrowRight: ({size=16, color='rgba(255,255,255,0.5)'}) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <Path d="M5 12h14M12 5l7 7-7 7"/>
    </Svg>
  ),
  Check: ({size=16, color='#34C759'}) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M20 6L9 17l-5-5"/>
    </Svg>
  ),
  Clock: ({size=16, color='#FF9500'}) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <Circle cx="12" cy="12" r="10"/>
      <Path d="M12 6v6l4 2"/>
    </Svg>
  ),
  Alert: ({size=16, color='#FF3B30'}) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <Circle cx="12" cy="12" r="10"/>
      <Path d="M12 8v4M12 16h.01"/>
    </Svg>
  ),
  Wrench: ({size=18, color='#fff'}) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round">
      <Path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
    </Svg>
  ),
  Package: ({size=18, color='#fff'}) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round">
      <Path d="M16.5 9.4 7.5 4.21"/>
      <Path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
      <Path d="M3.27 6.96 12 12.01l8.73-5.05"/>
      <Path d="M12 22.08V12"/>
    </Svg>
  ),
};

// ==================== ORIGINAL ORB ====================
const OriginalOrb = () => {
  const rotateAnim2 = useRef(new Animated.Value(0)).current;
  const rotateAnim3 = useRef(new Animated.Value(0)).current;
  const rotateAnim4 = useRef(new Animated.Value(0)).current;
  const rotateAnim5 = useRef(new Animated.Value(0)).current;
  const rotateAnim6 = useRef(new Animated.Value(0)).current;
  const rotateAnim7 = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const timeAnimation = 2000;
    Animated.loop(Animated.timing(rotateAnim2, { toValue: -360, duration: timeAnimation, useNativeDriver: true })).start();
    Animated.loop(Animated.timing(rotateAnim3, { toValue: 360, duration: timeAnimation, useNativeDriver: true })).start();
    Animated.loop(Animated.timing(rotateAnim4, { toValue: -360, duration: timeAnimation, useNativeDriver: true })).start();
    Animated.loop(Animated.timing(rotateAnim5, { toValue: -360, duration: timeAnimation, useNativeDriver: true })).start();
    Animated.loop(Animated.timing(rotateAnim6, { toValue: 360, duration: timeAnimation, useNativeDriver: true })).start();
    Animated.loop(Animated.timing(rotateAnim7, { toValue: 360, duration: timeAnimation, useNativeDriver: true })).start();
    Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.05, duration: 1000, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
    ])).start();
  }, []);

  const spin2 = rotateAnim2.interpolate({ inputRange: [-360, 0], outputRange: ['-360deg', '0deg'] });
  const spin3 = rotateAnim3.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] });
  const spin4 = rotateAnim4.interpolate({ inputRange: [-360, 0], outputRange: ['-360deg', '0deg'] });
  const spin5 = rotateAnim5.interpolate({ inputRange: [-360, 0], outputRange: ['-360deg', '0deg'] });
  const spin6 = rotateAnim6.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] });
  const spin7 = rotateAnim7.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] });

  const AnimatedPolygon = Animated.createAnimatedComponent(Polygon);

  return (
    <Animated.View style={[styles.orbWrapper, { transform: [{ scale: pulseAnim }] }]}>
      <View style={styles.orbContainer}>
        <View style={styles.orbOuterRing} />
        <View style={styles.orbInnerCircle} />
        <Svg width={56} height={56} viewBox="0 0 100 100" style={styles.orbSvg}>
          <Defs>
            <Mask id="clipping">
              <Polygon points="0,0 100,0 100,100 0,100" fill="black" />
              <Polygon points="25,25 75,25 50,75" fill="white" />
              <AnimatedPolygon points="50,25 75,75 25,75" fill="white" style={{ transformOrigin: '50px 50px', transform: [{ rotate: spin2 }] }} />
              <AnimatedPolygon points="35,35 65,35 50,65" fill="white" style={{ transformOrigin: '50px 60px', transform: [{ rotate: spin3 }] }} />
              <AnimatedPolygon points="35,35 65,35 50,65" fill="white" style={{ transformOrigin: '40px 40px', transform: [{ rotate: spin4 }] }} />
              <AnimatedPolygon points="35,35 65,35 50,65" fill="white" style={{ transformOrigin: '40px 40px', transform: [{ rotate: spin5 }] }} />
              <AnimatedPolygon points="35,35 65,35 50,65" fill="white" style={{ transformOrigin: '60px 40px', transform: [{ rotate: spin6 }] }} />
              <AnimatedPolygon points="35,35 65,35 50,65" fill="white" style={{ transformOrigin: '60px 40px', transform: [{ rotate: spin7 }] }} />
            </Mask>
          </Defs>
        </Svg>
        <View style={styles.orbMaskedBox} />
      </View>
    </Animated.View>
  );
};

// ==================== STATUS DOT ====================
const StatusDot = ({ status }) => {
  const colors = {
    good: '#34C759',
    warning: '#FF9500',
    critical: '#FF3B30'
  };
  return (
    <View style={[styles.statusDot, { backgroundColor: colors[status] || colors.good }]} />
  );
};

// ==================== GLASS CARD ====================
const GlassCard = ({ children, style }) => (
  <View style={[styles.glassCard, style]}>
    {children}
  </View>
);

// ==================== HEADER ====================
const Header = () => (
  <View style={styles.header}>
    <View style={styles.headerLeft}>
      <TouchableOpacity style={styles.headerButton}>
        <Icons.Menu size={18} />
      </TouchableOpacity>
      <View>
        <Text style={styles.headerTitle}>Hello Harsh</Text>
        <Text style={styles.headerSubtitle}>16th April, 2026</Text>
      </View>
    </View>
    <View style={styles.headerRight}>
      <View style={styles.weatherBadge}>
        <Icons.Sun size={22} />
        <Text style={styles.weatherTemp}>29°</Text>
      </View>
      <TouchableOpacity style={styles.headerButton}>
        <Icons.Bell size={18} />
        <View style={styles.notificationDot} />
      </TouchableOpacity>
    </View>
  </View>
);

// ==================== SEARCH BAR ====================
const SearchBar = () => (
  <GlassCard style={styles.searchContainer}>
    <Icons.Search size={18} />
    <TextInput
      style={styles.searchInput}
      placeholder="Search"
      placeholderTextColor="rgba(255,255,255,0.4)"
    />
  </GlassCard>
);

// ==================== TICKET CARDS ====================
const TicketCards = () => {
  const tickets = [
    { count: 41, label: 'Open', status: 'critical' },
    { count: 34, label: 'In Progress', status: 'warning' },
    { count: 354, label: 'Resolved', status: 'good' },
  ];

  return (
    <View style={styles.ticketSection}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Tickets</Text>
        <TouchableOpacity style={styles.seeAllButton}>
          <Text style={styles.seeAllText}>See All</Text>
          <Icons.ArrowRight size={14} />
        </TouchableOpacity>
      </View>
      <View style={styles.ticketRow}>
        {tickets.map((ticket, i) => (
          <GlassCard key={i} style={styles.ticketCard}>
            <StatusDot status={ticket.status} />
            <Text style={styles.ticketCount}>{ticket.count}</Text>
            <Text style={styles.ticketLabel}>{ticket.label}</Text>
          </GlassCard>
        ))}
      </View>
    </View>
  );
};

// ==================== CHECKLIST & PPM ROW ====================
const ChecklistRow = () => (
  <View style={styles.rowContainer}>
    <GlassCard style={styles.checklistCard}>
      <View style={styles.cardHeader}>
        <Icons.Check size={16} />
        <Text style={styles.cardTitle}>Checklist</Text>
      </View>
      <View style={styles.checklistValue}>
        <Text style={styles.checklistNumber}>7</Text>
        <Text style={styles.checklistTotal}>/ 100</Text>
      </View>
      <View style={styles.progressBarBg}>
        <View style={[styles.progressBarFill, { width: '7%', backgroundColor: '#34C759' }]} />
      </View>
    </GlassCard>

    <GlassCard style={styles.ppmCard}>
      <View style={styles.cardHeader}>
        <Icons.Wrench size={16} />
        <Text style={styles.cardTitle}>PPM Scheduled</Text>
      </View>
      <Text style={styles.ppmDate}>17th April</Text>
      <Text style={styles.ppmTask}>VRF/AC Service</Text>
      <View style={styles.ppmStatus}>
        <StatusDot status="warning" />
        <Text style={styles.ppmStatusText}>Pending</Text>
      </View>
    </GlassCard>
  </View>
);

// ==================== DSR CARD ====================
const DSRCard = () => (
  <GlassCard style={styles.dsrCard}>
    <View style={styles.dsrHeader}>
      <Icons.Package size={18} />
      <Text style={styles.dsrTitle}>Daily Stock Consumption</Text>
    </View>
    <View style={styles.dsrContent}>
      <View>
        <Text style={styles.dsrNumber}>05</Text>
        <Text style={styles.dsrUnit}>Items</Text>
      </View>
      <View style={styles.barChart}>
        {[35, 55, 25, 70, 45].map((h, i) => (
          <View 
            key={i} 
            style={[
              styles.bar, 
              { height: `${h}%`, backgroundColor: i === 3 ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.2)' }
            ]} 
          />
        ))}
      </View>
    </View>
    <View style={styles.dsrFooter}>
      <Text style={styles.dsrFooterText}>Q1A Consumption</Text>
      <View style={styles.dsrTrend}>
        <StatusDot status="good" />
        <Text style={styles.dsrTrendText}>+12%</Text>
      </View>
    </View>
  </GlassCard>
);

// ==================== BOTTOM NAV ====================
const BottomNav = () => (
  <View style={styles.bottomNav}>
    <TouchableOpacity style={styles.navItem}>
      <Icons.Home size={24} color="#fff" />
    </TouchableOpacity>
    <TouchableOpacity style={styles.navItem}>
      <Icons.Building size={24} />
    </TouchableOpacity>
    <View style={styles.orbNavItem}>
      <OriginalOrb />
    </View>
    <TouchableOpacity style={styles.navItem}>
      <Icons.Chart size={24} />
    </TouchableOpacity>
    <TouchableOpacity style={styles.navItem}>
      <Icons.User size={24} />
    </TouchableOpacity>
  </View>
);

// ==================== MAIN DASHBOARD ====================
const Dashboard = () => {
  const [currentTime, setCurrentTime] = useState('9:41');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      setCurrentTime(`${hours}:${minutes}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.container}>
      {/* Animated Clouds Background */}
      <AnimatedClouds />

      {/* Dynamic Island */}
      <View style={styles.dynamicIsland} />
      
      {/* Status Bar */}
      <View style={styles.statusBar}>
        <Text style={styles.statusTime}>{currentTime}</Text>
        <View style={styles.statusIcons}>
          <Text style={styles.statusIcon}>📶</Text>
          <Text style={styles.statusIcon}>🔋</Text>
        </View>
      </View>

      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <Header />
        <SearchBar />
        <TicketCards />
        <ChecklistRow />
        <DSRCard />
      </ScrollView>

      <BottomNav />
    </View>
  );
};

// ==================== STYLES ====================
const styles = StyleSheet.create({
  container: {
    width: IPHONE_WIDTH,
    height: 852,
    backgroundColor: '#4A90D9',
    backgroundGradient: {
      colors: ['#4A90D9', '#5BA3E8', '#87CEEB', '#B8D4E8'],
      locations: [0, 0.3, 0.6, 1],
    },
    alignSelf: 'center',
    position: 'relative',
  },

  // Clouds
  cloud: {
    position: 'absolute',
    opacity: 0.7,
  },

  // Dynamic Island
  dynamicIsland: {
    position: 'absolute',
    top: 12,
    left: '50%',
    marginLeft: -63,
    width: 126,
    height: 37,
    backgroundColor: '#000',
    borderRadius: 20,
    zIndex: 100,
  },

  // Status Bar
  statusBar: {
    position: 'absolute',
    top: 14,
    left: 30,
    right: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 101,
  },
  statusTime: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  statusIcons: {
    flexDirection: 'row',
    gap: 5,
  },
  statusIcon: {
    fontSize: 14,
  },

  // Glass Card
  glassCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },

  // Scroll
  scrollView: {
    flex: 1,
    zIndex: 10,
  },
  scrollContent: {
    paddingTop: 70,
    paddingHorizontal: 16,
    paddingBottom: 100,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '300',
    color: '#fff',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
  },
  weatherBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  weatherTemp: {
    fontSize: 16,
    fontWeight: '400',
    color: '#fff',
  },
  notificationDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    backgroundColor: '#FF3B30',
    borderRadius: 4,
  },

  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    height: 42,
    marginBottom: 20,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
    color: '#fff',
    fontWeight: '400',
  },

  // Status Dot
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // Tickets
  ticketSection: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  seeAllText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
  },
  ticketRow: {
    flexDirection: 'row',
    gap: 10,
  },
  ticketCard: {
    flex: 1,
    padding: 14,
    alignItems: 'center',
  },
  ticketCount: {
    fontSize: 28,
    fontWeight: '300',
    color: '#fff',
    marginTop: 8,
    marginBottom: 4,
  },
  ticketLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
  },

  // Row Container
  rowContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },

  // Checklist
  checklistCard: {
    flex: 1,
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
  },
  checklistValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  checklistNumber: {
    fontSize: 32,
    fontWeight: '300',
    color: '#fff',
  },
  checklistTotal: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.4)',
  },
  progressBarBg: {
    marginTop: 10,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },

  // PPM
  ppmCard: {
    flex: 1.5,
    padding: 14,
  },
  ppmDate: {
    fontSize: 13,
    color: '#FF9500',
    marginBottom: 4,
  },
  ppmTask: {
    fontSize: 15,
    color: '#fff',
    marginBottom: 6,
  },
  ppmStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ppmStatusText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
  },

  // DSR
  dsrCard: {
    padding: 16,
    marginBottom: 16,
  },
  dsrHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  dsrTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
  },
  dsrContent: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  dsrNumber: {
    fontSize: 36,
    fontWeight: '300',
    color: '#fff',
  },
  dsrUnit: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    marginLeft: 4,
  },
  barChart: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    height: 50,
    paddingBottom: 8,
  },
  bar: {
    flex: 1,
    borderRadius: 3,
  },
  dsrFooter: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dsrFooterText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
  dsrTrend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dsrTrendText: {
    fontSize: 12,
    color: '#34C759',
  },

  // Orb
  orbWrapper: {
    shadowColor: '#ffbf48',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 20,
  },
  orbContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  orbOuterRing: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderTopColor: '#ffbf48',
    borderBottomColor: '#be4a1d',
    backgroundColor: 'rgba(255, 191, 72, 0.25)',
  },
  orbInnerCircle: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(190, 74, 29, 0.3)',
  },
  orbSvg: {
    position: 'absolute',
  },
  orbMaskedBox: {
    width: 56,
    height: 56,
    backgroundColor: 'transparent',
  },

  // Bottom Navigation
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 85,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
    paddingTop: 10,
    backgroundColor: 'rgba(74, 144, 217, 0.3)',
    zIndex: 40,
  },
  navItem: {
    alignItems: 'center',
    paddingTop: 6,
    flex: 1,
  },
  orbNavItem: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -15,
    width: 70,
  },
});

export default Dashboard;
