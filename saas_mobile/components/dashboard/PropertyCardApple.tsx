'use client';

/**
 * PropertyCardApple — Compact Apple Weather style property card
 *
 * - Shorter height (~150px) matching Weather app proportions
 * - Full-bleed photo or subtle gradient fallback
 * - Large property name, address, and status badges
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ImageBackground,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Path, Circle } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';

type HealthStatus = 'good' | 'warning' | 'critical';

interface PropertyCardAppleProps {
  property: {
    id: string;
    name: string;
    code?: string;
    address?: string;
    image_url?: string | null;
    healthStatus?: HealthStatus;
    openTickets?: number;
    occupancyPct?: number;
  };
  orgId: string;
}

function isImageUrl(url: string) {
  const lower = url.toLowerCase();
  // Strip query params and hash for extension check
  const path = lower.split('?')[0].split('#')[0];
  const hasImgExt =
    path.endsWith('.jpg') ||
    path.endsWith('.jpeg') ||
    path.endsWith('.png') ||
    path.endsWith('.gif') ||
    path.endsWith('.webp') ||
    path.endsWith('.bmp') ||
    path.endsWith('.svg') ||
    path.endsWith('.ico') ||
    path.endsWith('.avif') ||
    path.endsWith('.jpg_large'); // Twitter/X variant

  const knownHost =
    lower.includes('googleusercontent.com') ||
    lower.includes('cloudinary.com') ||
    lower.includes('amazonaws.com') ||
    lower.includes('supabase.co') ||
    lower.includes('imgur.com') ||
    lower.includes('unsplash.com') ||
    lower.includes('twimg.com') ||
    lower.includes('fbcdn.net') ||
    lower.includes('instagram.com') ||
    lower.includes('pinimg.com') ||
    lower.includes('gstatic.com') ||
    lower.includes('wikimedia.org') ||
    lower.includes('images.unsplash.com') ||
    lower.includes('res.cloudinary.com');

  return hasImgExt || knownHost;
}

// Deterministic badge set based on property name
function getBadgeSetIndex(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 4;
}

function BadgeIcon({ type }: { type: string }) {
  const color = '#FFFFFF';
  const size = 11;
  switch (type) {
    case 'map':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
          <Circle cx="12" cy="10" r="3" />
        </Svg>
      );
    case 'hub':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <Path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <Path d="M9 22V12h6v10" />
        </Svg>
      );
    case 'autopilot':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <Circle cx="12" cy="12" r="10" />
          <Path d="M12 16v-4M12 8h.01" />
        </Svg>
      );
    case 'check':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <Path d="M20 6L9 17l-5-5" />
        </Svg>
      );
    case 'flow':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <Path d="M4 4h16v16H4z" />
          <Path d="M4 12h16M12 4v16" />
        </Svg>
      );
    case 'overview':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <Path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
          <Path d="M22 12A10 10 0 0 0 12 2v10z" />
        </Svg>
      );
    case 'depts':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <Path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <Circle cx="9" cy="7" r="4" />
          <Path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </Svg>
      );
    case 'clock':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <Circle cx="12" cy="12" r="10" />
          <Path d="M12 6v6l4 2" />
        </Svg>
      );
    case 'campus':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <Path d="M22 10v6M2 10l10-5 10 5-10 5z" />
          <Path d="M6 12v5c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2v-5" />
        </Svg>
      );
    case 'parking':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <Path d="M7 3h5a4 4 0 0 1 0 8H7V3z" />
          <Path d="M7 11v10" />
        </Svg>
      );
    default:
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <Circle cx="12" cy="12" r="10" />
        </Svg>
      );
  }
}

export default function PropertyCardApple({ property, orgId }: PropertyCardAppleProps) {
  const router = useRouter();
  const [imgError, setImgError] = useState(false);

  const handlePress = () => {
    router.push(`/org/${orgId}/property/${property.id}`);
  };

  const badgeSetIndex = getBadgeSetIndex(property.name);
  const now = new Date();
  const timeStr = `${now.getHours() % 12 || 12}:${String(now.getMinutes()).padStart(2, '0')} ${now.getHours() >= 12 ? 'PM' : 'AM'}`;

  const badgeSets = [
    [
      { type: 'map', text: 'Site Map Active' },
      { type: 'hub', text: 'Regional Hub Connected' },
    ],
    [
      { type: 'autopilot', text: 'FMS Autopilot engaged' },
      { type: 'check', text: 'Optimal systems' },
      { type: 'flow', text: 'Normal flow' },
    ],
    [
      { type: 'overview', text: 'Operations Overview' },
      { type: 'depts', text: 'Departments all connected' },
      { type: 'clock', text: `Historical Log: ${timeStr}` },
    ],
    [
      { type: 'campus', text: 'Campus Systems Integrated' },
      { type: 'parking', text: 'Parking status optimal' },
    ],
  ];
  const badges = badgeSets[badgeSetIndex];
  const imageUrl = property.image_url;
  // Try to render any non-empty URL; let onError catch broken ones
  const hasValidImage = !!imageUrl && !imgError;

  return (
    <TouchableOpacity style={styles.container} onPress={handlePress} activeOpacity={0.92}>
      {hasValidImage ? (
        <ImageBackground
          source={{ uri: imageUrl }}
          style={styles.background}
          imageStyle={styles.backgroundImage}
          resizeMode="cover"
          onError={() => setImgError(true)}
        >
          <LinearGradient
            colors={['rgba(0,0,0,0.35)', 'rgba(0,0,0,0.05)', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.85)']}
            locations={[0, 0.3, 0.65, 1]}
            style={styles.gradient}
          />
          <CardContent property={property} badges={badges} />
        </ImageBackground>
      ) : (
        <LinearGradient
          colors={['#1C1C1E', '#2C2C2E']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.background}
        >
          <CardContent property={property} badges={badges} />
        </LinearGradient>
      )}
    </TouchableOpacity>
  );
}

function CardContent({
  property,
  badges,
}: {
  property: PropertyCardAppleProps['property'];
  badges: { type: string; text: string }[];
}) {
  return (
    <View style={styles.content} pointerEvents="none">
      <View style={styles.topContent}>
        <Text style={styles.propertyName} numberOfLines={1}>
          {property.name}
        </Text>
        {property.address ? (
          <Text style={styles.address} numberOfLines={1}>
            {property.address}
          </Text>
        ) : null}
      </View>

      <View style={styles.badges}>
        {badges.map((badge, i) => (
          <View key={i} style={styles.badge}>
            <BadgeIcon type={badge.type} />
            <Text style={styles.badgeText}>{badge.text}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const display = Platform.OS === 'ios' ? 'System' : 'sans-serif';

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 20,
    overflow: 'hidden',
    height: 150,
    backgroundColor: '#1a1a1a',
  },
  background: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backgroundImage: {
    borderRadius: 20,
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 14,
  },
  topContent: {
    marginTop: 2,
  },
  propertyName: {
    fontFamily: display,
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.4,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  address: {
    fontFamily: display,
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  badgeText: {
    fontFamily: display,
    fontSize: 10,
    fontWeight: '500',
    color: '#FFFFFF',
  },
});
