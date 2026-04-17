import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Dimensions,
  StatusBar,
} from 'react-native';
import Svg, { 
  Path, 
  Circle, 
  Polygon,
  Defs,
  Mask,
  LinearGradient,
  Stop,
} from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IPHONE_WIDTH = 393;

// ==================== DOT MATRIX NUMBER COMPONENT ====================
const DotMatrixNumber = ({ value, size = 'large' }) => {
  const dotSize = size === 'large' ? 4 : 3;
  const spacing = size === 'large' ? 8 : 6;
  
  // Dot matrix patterns for digits 0-9
  const patterns = {
    '0': [[1,1,1],[1,0,1],[1,0,1],[1,0,1],[1,1,1]],
    '1': [[0,1,0],[1,1,0],[0,1,0],[0,1,0],[1,1,1]],
    '2': [[1,1,1],[0,0,1],[1,1,1],[1,0,0],[1,1,1]],
    '3': [[1,1,1],[0,0,1],[1,1,1],[0,0,1],[1,1,1]],
    '4': [[1,0,1],[1,0,1],[1,1,1],[0,0,1],[0,0,1]],
    '5': [[1,1,1],[1,0,0],[1,1,1],[0,0,1],[1,1,1]],
    '6': [[1,1,1],[1,0,0],[1,1,1],[1,0,1],[1,1,1]],
    '7': [[1,1,1],[0,0,1],[0,0,1],[0,0,1],[0,0,1]],
    '8': [[1,1,1],[1,0,1],[1,1,1],[1,0,1],[1,1,1]],
    '9': [[1,1,1],[1,0,1],[1,1,1],[0,0,1],[1,1,1]],
    '%': [[1,0,1],[0,0,1],[0,1,0],[1,0,0],[1,0,1]],
    '°': [[1,1],[1,1]],
    'k': [[1,0,1],[1,0,1],[1,1,0],[1,0,1],[1,0,1]],
    'V': [[1,0,1],[1,0,1],[1,0,1],[0,1,0],[0,1,0]],
    'A': [[0,1,0],[1,0,1],[1,1,1],[1,0,1],[1,0,1]],
    'h': [[1,0,0],[1,0,0],[1,1,0],[1,0,1],[1,0,1]],
  };

  const renderDigit = (digit, offsetX) => {
    const pattern = patterns[digit] || patterns['0'];
    const dots = [];
    pattern.forEach((row, rowIndex) => {
      row.forEach((dot, colIndex) => {
        if (dot) {
          dots.push(
            <View
              key={`${digit}-${rowIndex}-${colIndex}`}
              style={{
                position: 'absolute',
                left: offsetX + colIndex * spacing,
                top: rowIndex * spacing,
                width: dotSize,
                height: dotSize,
                borderRadius: dotSize / 2,
                backgroundColor: '#fff',
              }}
            />
          );
        }
      });
    });
    return dots;
  };

  const digits = value.toString().split('');
  let offsetX = 0;
  const allDots = [];

  digits.forEach((digit, index) => {
    allDots.push(...renderDigit(digit, offsetX));
    offsetX += (patterns[digit]?.[0]?.length || 3) * spacing + 4;
  });

  return (
    <View style={{ width: offsetX, height: 5 * spacing }}>
      {allDots}
    </View>
  );
};

// ==================== SEMI-CIRCULAR ARC GAUGE ====================
const ArcGauge = ({ value, max = 100, color = '#FF6B9D', size = 80 }) => {
  const progress = value / max;
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <View style={{ width: size, height: size / 2 + 10, alignItems: 'center' }}>
      <Svg width={size} height={size / 2 + 10} viewBox={`0 0 ${size} ${size / 2 + 10}`}>
        {/* Background arc */}
        <Path
          d={`M ${strokeWidth/2} ${size/2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth/2} ${size/2}`}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* Progress arc */}
        <Path
          d={`M ${strokeWidth/2} ${size/2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth/2} ${size/2}`}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
        />
        {/* Indicator dot */}
        <Circle
          cx={size/2 + radius * Math.cos(Math.PI * (1 - progress))}
          cy={size/2 - radius * Math.sin(Math.PI * (1 - progress))}
          r={4}
          fill="#fff"
        />
      </Svg>
    </View>
  );
};

// ==================== SPIROGRAPH PATTERN ====================
const SpirographPattern = ({ color = 'rgba(255,255,255,0.15)' }) => {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox="0 0 200 100" preserveAspectRatio="none">
        {/* Interlocking dotted arcs */}
        <Path
          d="M 20 80 Q 50 20, 100 50 Q 150 80, 180 30"
          fill="none"
          stroke={color}
          strokeWidth="1"
          strokeDasharray="3 6"
        />
        <Path
          d="M 10 50 Q 60 80, 100 40 Q 140 10, 190 60"
          fill="none"
          stroke={color}
          strokeWidth="1"
          strokeDasharray="3 6"
        />
        <Path
          d="M 30 60 Q 70 30, 110 70 Q 150 90, 170 40"
          fill="none"
          stroke={color}
          strokeWidth="1"
          strokeDasharray="3 6"
        />
        {/* Data points */}
        <Circle cx="50" cy="35" r="3" fill="#fff" />
        <Circle cx="100" cy="50" r="3" fill="#fff" />
        <Circle cx="150" cy="65" r="3" fill="#fff" />
        <Circle cx="75" cy="70" r="2" fill="rgba(255,255,255,0.5)" />
      </Svg>
    </View>
  );
};

// ==================== GRADIENT CARD ====================
const GradientCard = ({ children, gradientColors, style, showPattern = false }) => (
  <View style={[styles.gradientCard, style]}>
    <LinearGradient
      colors={gradientColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={StyleSheet.absoluteFill}
    />
    {showPattern && <SpirographPattern />}
    <View style={styles.cardContent}>
      {children}
    </View>
  </View>
);

// ==================== SVG ICONS ====================
const HomeIcon = ({ size = 22, color = '#888' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
    <Path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <Path d="M9 22V12h6v10"/>
  </Svg>
);

const BuildingIcon = ({ size = 22, color = '#888' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
    <Path d="M3 21h18"/>
    <Path d="M5 21V7l8-4 8 4v14"/>
    <Path d="M9 21v-6h6v6"/>
  </Svg>
);

const ChartIcon = ({ size = 22, color = '#888' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
    <Path d="M18 20V10M12 20V4M6 20v-6"/>
  </Svg>
);

const SettingsIcon = ({ size = 22, color = '#888' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
    <Circle cx="12" cy="12" r="3"/>
    <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </Svg>
);

const BellIcon = ({ size = 20, color = '#fff' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
    <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <Path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </Svg>
);

const MenuIcon = ({ size = 20, color = '#fff' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
    <Path d="M3 12h18M3 6h18M3 18h18"/>
  </Svg>
);

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
  const spin5 = rotateAnim5.interpolate({ inputRange: [-360, 0], outputRanges: ['-360deg', '0deg'] });
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

// ==================== MAIN KPI CARD ====================
const MainKpiCard = ({ title, value, subtitle, gradientColors, arcValue, arcColor }) => (
  <GradientCard gradientColors={gradientColors} style={styles.mainKpiCard}>
    <Text style={styles.kpiTitle}>{title}</Text>
    <View style={styles.kpiValueContainer}>
      <DotMatrixNumber value={value} size="large" />
    </View>
    <Text style={styles.kpiSubtitle}>{subtitle}</Text>
    <View style={styles.arcContainer}>
      <ArcGauge value={arcValue} color={arcColor} size={100} />
    </View>
  </GradientCard>
);

// ==================== PROPERTY STATUS CARD ====================
const PropertyStatusCard = () => (
  <GradientCard 
    gradientColors={['#1a1a2e', '#16213e']} 
    style={styles.propertyCard}
    showPattern={true}
  >
    <Text style={styles.propertyTitle}>Property Health</Text>
    <View style={styles.propertyMetrics}>
      <View style={styles.metricItem}>
        <View style={[styles.metricDot, { backgroundColor: '#4CAF50' }]} />
        <Text style={styles.metricLabel}>Optimal</Text>
        <Text style={styles.metricValue}>8</Text>
      </View>
      <View style={styles.metricItem}>
        <View style={[styles.metricDot, { backgroundColor: '#F5A623' }]} />
        <Text style={styles.metricLabel}>Warning</Text>
        <Text style={styles.metricValue}>2</Text>
      </View>
      <View style={styles.metricItem}>
        <View style={[styles.metricDot, { backgroundColor: '#E53935' }]} />
        <Text style={styles.metricLabel}>Critical</Text>
        <Text style={styles.metricValue}>0</Text>
      </View>
    </View>
  </GradientCard>
);

// ==================== TICKET BREAKDOWN CARD ====================
const TicketBreakdownCard = () => (
  <GradientCard gradientColors={['#0f3460', '#16213e']} style={styles.ticketCard}>
    <Text style={styles.ticketTitle}>Ticket Flow</Text>
    <View style={styles.ticketStats}>
      <View style={styles.ticketStat}>
        <Text style={styles.ticketStatValue}>41</Text>
        <Text style={styles.ticketStatLabel}>Open</Text>
      </View>
      <View style={styles.ticketArrow}>
        <Text style={styles.arrowText}>→</Text>
      </View>
      <View style={styles.ticketStat}>
        <Text style={styles.ticketStatValue}>34</Text>
        <Text style={styles.ticketStatLabel}>In Progress</Text>
      </View>
      <View style={styles.ticketArrow}>
        <Text style={styles.arrowText}>→</Text>
      </View>
      <View style={styles.ticketStat}>
        <Text style={styles.ticketStatValue}>354</Text>
        <Text style={styles.ticketStatLabel}>Resolved</Text>
      </View>
    </View>
    <View style={styles.resolutionRate}>
      <Text style={styles.resolutionText}>89.6% Resolution Rate</Text>
    </View>
  </GradientCard>
);

// ==================== OCCUPANCY CARD ====================
const OccupancyCard = () => (
  <GradientCard gradientColors={['#2d1b4e', '#1a1a2e']} style={styles.occupancyCard}>
    <Text style={styles.occupancyTitle}>Occupancy</Text>
    <View style={styles.occupancyContent}>
      <View style={styles.occupancyMain}>
        <DotMatrixNumber value="87" size="large" />
        <Text style={styles.occupancyPercent}>%</Text>
      </View>
      <View style={styles.occupancyDetails}>
        <Text style={styles.occupancyDetail}>21 Visitors Today</Text>
        <Text style={styles.occupancyDetail}>1 / 20 Checked In</Text>
      </View>
    </View>
    <ArcGauge value={87} color="#9C27B0" size={90} />
  </GradientCard>
);

// ==================== REVENUE CARD ====================
const RevenueCard = () => (
  <GradientCard gradientColors={['#1b5e20', '#0d3320']} style={styles.revenueCard}>
    <Text style={styles.revenueTitle}>Revenue</Text>
    <View style={styles.revenueContent}>
      <Text style={styles.revenueCurrency}>₹</Text>
      <DotMatrixNumber value="1.01" size="large" />
      <Text style={styles.revenueUnit}>L</Text>
    </View>
    <Text style={styles.revenueSubtitle}>This Month</Text>
    <View style={styles.revenueCommission}>
      <Text style={styles.commissionText}>Commission: ₹10,140.9</Text>
    </View>
  </GradientCard>
);

// ==================== BOTTOM NAV ====================
const BottomNav = () => (
  <View style={styles.bottomNav}>
    <TouchableOpacity style={styles.navItem}>
      <HomeIcon color="#FF6B9D" />
      <Text style={[styles.navLabel, styles.navLabelActive]}>Home</Text>
    </TouchableOpacity>
    <TouchableOpacity style={styles.navItem}>
      <BuildingIcon />
      <Text style={styles.navLabel}>Properties</Text>
    </TouchableOpacity>
    <View style={styles.orbNavItem}>
      <OriginalOrb />
    </View>
    <TouchableOpacity style={styles.navItem}>
      <ChartIcon />
      <Text style={styles.navLabel}>Analytics</Text>
    </TouchableOpacity>
    <TouchableOpacity style={styles.navItem}>
      <SettingsIcon />
      <Text style={styles.navLabel}>Settings</Text>
    </TouchableOpacity>
  </View>
);

// ==================== MAIN DASHBOARD ====================
const SuperAdminDashboard = () => {
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
      <StatusBar barStyle="light-content" />
      
      {/* Dynamic Island */}
      <View style={styles.dynamicIsland} />
      
      {/* Status Bar */}
      <View style={styles.statusBar}>
        <Text style={styles.statusTime}>{currentTime}</Text>
        <View style={styles.statusIcons}>
          <Text style={styles.statusIconText}>📶</Text>
          <Text style={styles.statusIconText}>🔋</Text>
        </View>
      </View>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton}>
          <MenuIcon size={18} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Super Admin</Text>
        <TouchableOpacity style={styles.headerButton}>
          <BellIcon size={18} />
          <View style={styles.notificationDot} />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.scrollContent}
      >
        {/* Main KPI - Total Tickets */}
        <MainKpiCard 
          title="Total Tickets"
          value="395"
          subtitle="All Properties"
          gradientColors={['#FF6B9D', '#C44569', '#8B3A6B']}
          arcValue={89.6}
          arcColor="#FF6B9D"
        />

        {/* Property Status */}
        <PropertyStatusCard />

        {/* Ticket Breakdown */}
        <TicketBreakdownCard />

        {/* Row: Occupancy + Revenue */}
        <View style={styles.rowCards}>
          <OccupancyCard />
          <RevenueCard />
        </View>
      </ScrollView>

      {/* Bottom Navigation with Orb */}
      <BottomNav />
    </View>
  );
};

// ==================== STYLES ====================
const styles = StyleSheet.create({
  container: {
    width: IPHONE_WIDTH,
    height: 852,
    backgroundColor: '#0a0a0f',
    alignSelf: 'center',
    position: 'relative',
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
  statusIconText: {
    fontSize: 14,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 70,
    paddingBottom: 16,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  notificationDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    backgroundColor: '#FF6B9D',
    borderRadius: 4,
  },

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 120,
  },

  // Gradient Card
  gradientCard: {
    borderRadius: 28,
    overflow: 'hidden',
    marginBottom: 12,
  },
  cardContent: {
    padding: 20,
    position: 'relative',
    zIndex: 1,
  },

  // Main KPI Card
  mainKpiCard: {
    height: 200,
  },
  kpiTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 16,
  },
  kpiValueContainer: {
    marginBottom: 8,
  },
  kpiSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
  arcContainer: {
    position: 'absolute',
    bottom: 10,
    right: 20,
  },

  // Property Card
  propertyCard: {
    height: 120,
  },
  propertyTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 16,
  },
  propertyMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  metricItem: {
    alignItems: 'center',
  },
  metricDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginBottom: 6,
  },
  metricLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },

  // Ticket Card
  ticketCard: {
    padding: 20,
  },
  ticketTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 16,
  },
  ticketStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ticketStat: {
    alignItems: 'center',
  },
  ticketStatValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
  },
  ticketStatLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 4,
  },
  ticketArrow: {
    paddingHorizontal: 8,
  },
  arrowText: {
    fontSize: 20,
    color: 'rgba(255,255,255,0.3)',
  },
  resolutionRate: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  resolutionText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '500',
  },

  // Row Cards
  rowCards: {
    flexDirection: 'row',
    gap: 12,
  },

  // Occupancy Card
  occupancyCard: {
    flex: 1,
    padding: 16,
  },
  occupancyTitle: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 12,
  },
  occupancyContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  occupancyMain: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  occupancyPercent: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 4,
  },
  occupancyDetails: {
    marginLeft: 'auto',
    alignItems: 'flex-end',
  },
  occupancyDetail: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
  },

  // Revenue Card
  revenueCard: {
    flex: 1,
    padding: 16,
  },
  revenueTitle: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 12,
  },
  revenueContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  revenueCurrency: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4CAF50',
    marginRight: 4,
  },
  revenueUnit: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 4,
  },
  revenueSubtitle: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 4,
  },
  revenueCommission: {
    marginTop: 8,
  },
  commissionText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.4)',
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
    paddingTop: 12,
    backgroundColor: 'rgba(10, 10, 15, 0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
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
    marginTop: -18,
    width: 70,
  },
  navLabel: {
    fontSize: 10,
    color: '#666',
    marginTop: 4,
  },
  navLabelActive: {
    color: '#FF6B9D',
    fontWeight: '500',
  },
});

export default SuperAdminDashboard;
