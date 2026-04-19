/**
 * useWeather — Sun/Moon-aware ambient weather hook
 *
 * Calculates sun/moon position from device location and current time.
 * Returns period-aware display data including:
 * - period: morning | afternoon | evening | night
 * - greeting: time-appropriate greeting
 * - weatherIcon: sun | moon | partly-cloudy | cloudy | rainy
 * - temperature: current temp (fetched live from OpenWeatherMap, falls back to simulation)
 * - auroraColors: gradient palette for the ambient background
 * - sunAngle: degrees above horizon (-90 to 90)
 * - isDaylight: whether it's currently daylight
 */
import { useState, useEffect, useCallback } from 'react';
import * as Location from 'expo-location';

export type WeatherPeriod = 'morning' | 'afternoon' | 'evening' | 'night';
export type WeatherIconType = 'sun' | 'moon' | 'partly-cloudy' | 'cloudy' | 'rainy';
export type WeatherCondition = 'clear-day' | 'clear-night' | 'cloudy-day' | 'cloudy-night' | 'rainy' | 'dawn' | 'dusk';

export interface AuroraColors {
  // Primary gradient: top → bottom
  primaryTop: string;
  primaryMid: string;
  primaryBottom: string;
  // Accent orb colors
  orb1: string;
  orb2: string;
  orb3: string;
  // Text on glass
  textPrimary: string;
  textSecondary: string;
  glassBg: string;
  glassBorder: string;
}

export interface WeatherData {
  period: WeatherPeriod;
  greeting: string;
  greetingEmoji: string;
  weatherIcon: WeatherIconType;
  condition: WeatherCondition;
  temperature: number | null;
  weatherDescription: string;
  locationName: string | null;
  sunriseHour: number;
  sunsetHour: number;
  isDaylight: boolean;
  sunAngle: number;
  auroraColors: AuroraColors;
  lastUpdated: Date;
}

// Aurora palettes keyed by time period
const AURORA_PALETTES: Record<WeatherPeriod, AuroraColors> = {
  morning: {
    primaryTop: '#1a1a3e',
    primaryMid: '#2d1b4e',
    primaryBottom: '#f4845f',
    orb1: 'rgba(255,140,80,0.45)',
    orb2: 'rgba(255,100,120,0.30)',
    orb3: 'rgba(255,200,100,0.25)',
    textPrimary: '#FFFFFF',
    textSecondary: 'rgba(255,255,255,0.75)',
    glassBg: 'rgba(255,255,255,0.12)',
    glassBorder: 'rgba(255,255,255,0.18)',
  },
  afternoon: {
    primaryTop: '#0f1628',
    primaryMid: '#1e3a5f',
    primaryBottom: '#4a90c4',
    orb1: 'rgba(74,144,196,0.40)',
    orb2: 'rgba(100,180,220,0.25)',
    orb3: 'rgba(150,200,255,0.20)',
    textPrimary: '#FFFFFF',
    textSecondary: 'rgba(255,255,255,0.70)',
    glassBg: 'rgba(255,255,255,0.10)',
    glassBorder: 'rgba(255,255,255,0.15)',
  },
  evening: {
    primaryTop: '#0a0a1a',
    primaryMid: '#1a0a2e',
    primaryBottom: '#6b2d5b',
    orb1: 'rgba(180,80,160,0.40)',
    orb2: 'rgba(220,100,80,0.30)',
    orb3: 'rgba(255,140,80,0.20)',
    textPrimary: '#FFFFFF',
    textSecondary: 'rgba(255,255,255,0.70)',
    glassBg: 'rgba(255,255,255,0.08)',
    glassBorder: 'rgba(255,255,255,0.12)',
  },
  night: {
    primaryTop: '#03030a',
    primaryMid: '#060618',
    primaryBottom: '#0a0a25',
    orb1: 'rgba(80,100,200,0.35)',
    orb2: 'rgba(40,60,160,0.25)',
    orb3: 'rgba(20,30,100,0.20)',
    textPrimary: '#E8ECFF',
    textSecondary: 'rgba(200,210,255,0.60)',
    glassBg: 'rgba(255,255,255,0.06)',
    glassBorder: 'rgba(255,255,255,0.10)',
  },
};

// Greetings keyed by period
const PERIOD_GREETINGS: Record<WeatherPeriod, { text: string; emoji: string }> = {
  morning: { text: 'Good Morning', emoji: 'sunny' },
  afternoon: { text: 'Good Afternoon', emoji: 'sunny' },
  evening: { text: 'Good Evening', emoji: 'partly-sunny' },
  night: { text: 'Good Night', emoji: 'moon' },
};

/**
 * Calculate sun altitude angle (degrees above horizon) based on location and time.
 * Simplified algorithm: uses sinusoidal approximation of solar position.
 */
function calculateSunAngle(lat: number, lng: number, date: Date): number {
  const dayOfYear = Math.floor(
    (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000
  );
  const declination = 23.45 * Math.sin(((360 / 365) * (dayOfYear - 81) * Math.PI) / 180);
  const hourAngle = ((date.getHours() + date.getMinutes() / 60 - 12) * 15);

  const latRad = (lat * Math.PI) / 180;
  const decRad = (declination * Math.PI) / 180;
  const haRad = (hourAngle * Math.PI) / 180;

  const sinAlt = Math.sin(latRad) * Math.sin(decRad) +
    Math.cos(latRad) * Math.cos(decRad) * Math.cos(haRad);

  return (Math.asin(Math.max(-1, Math.min(1, sinAlt))) * 180) / Math.PI;
}

/**
 * Get sunrise/sunset hours (0-24) for a given latitude and date.
 */
function getSunTimes(lat: number, _lng: number, date: Date): { sunrise: number; sunset: number } {
  const dayOfYear = Math.floor(
    (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000
  );
  const declination = 23.45 * Math.sin(((360 / 365) * (dayOfYear - 81) * Math.PI) / 180);
  const latRad = (lat * Math.PI) / 180;
  const decRad = (declination * Math.PI) / 180;

  // Hour angle at sunrise/sunset (when sun is at horizon)
  const cosHourAngle = -Math.tan(latRad) * Math.tan(decRad);
  // Clamp to [-1, 1] to handle polar day/night
  const clamped = Math.max(-1, Math.min(1, cosHourAngle));
  const hourAngle = (Math.acos(clamped) * 180) / Math.PI;

  const solarNoon = 12; // Approximate
  const sunrise = solarNoon - hourAngle / 15;
  const sunset = solarNoon + hourAngle / 15;

  return { sunrise, sunset };
}

function getPeriod(hour: number, isDaylight: boolean): WeatherPeriod {
  if (!isDaylight) return 'night';
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 20) return 'evening';
  return 'night';
}

function getWeatherIcon(temperature: number | null, period: WeatherPeriod, isDaylight: boolean): WeatherIconType {
  // If no temp data, infer from time
  if (temperature === null) {
    if (period === 'night') return 'moon';
    if (period === 'evening') return 'partly-cloudy';
    return 'sun';
  }
  if (temperature > 35) return 'sun'; // Hot = clear
  if (temperature < 15) return 'cloudy';
  if (period === 'night') return 'moon';
  return 'sun';
}

function getWeatherCondition(description: string, isDaylight: boolean, period: WeatherPeriod): WeatherCondition {
  const desc = description.toLowerCase();
  if (desc.includes('rain') || desc.includes('storm') || desc.includes('drizzle')) return 'rainy';
  if (desc.includes('cloud') || desc.includes('overcast')) return isDaylight ? 'cloudy-day' : 'cloudy-night';
  if (period === 'morning' || period === 'evening') return period === 'morning' ? 'dawn' : 'dusk';
  return isDaylight ? 'clear-day' : 'clear-night';
}

async function fetchLiveTemperature(lat: number, lng: number): Promise<{ temp: number; description: string } | null> {
  const apiKey = process.env.EXPO_PUBLIC_OPENWEATHER_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&units=metric&appid=${apiKey}`
    );
    if (!response.ok) return null;
    const data = await response.json();
    return {
      temp: Math.round(data.main.temp),
      description: data.weather?.[0]?.description ?? '',
    };
  } catch {
    return null;
  }
}

async function getLocationName(lat: number, lng: number): Promise<string | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { 'User-Agent': 'FMS-Mobile-App/1.0' } }
    );
    if (!response.ok) return null;
    const data = await response.json();
    return data.address?.city ?? data.address?.town ?? data.address?.village ?? null;
  } catch {
    return null;
  }
}

export function useWeather() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

  const computeWeather = useCallback(async (lat: number, lng: number) => {
    const now = new Date();
    const hour = now.getHours();

    const sunAngle = calculateSunAngle(lat, lng, now);
    const isDaylight = sunAngle > -6; // Civil twilight
    const { sunrise, sunset } = getSunTimes(lat, lng, now);
    const period = getPeriod(hour, isDaylight);
    const greeting = PERIOD_GREETINGS[period].text;
    const greetingEmoji = PERIOD_GREETINGS[period].emoji;

    // Fetch live temperature (non-blocking)
    let temperature: number | null = null;
    let weatherDescription = '';
    const liveWeather = await fetchLiveTemperature(lat, lng);
    if (liveWeather) {
      temperature = liveWeather.temp;
      weatherDescription = liveWeather.description;
    } else {
      // Simulated temperature based on time of day (fallback)
      temperature = period === 'night' ? 22 : period === 'morning' ? 24 : 28;
      weatherDescription = period === 'night' ? 'Clear night' : period === 'morning' ? 'Sunny morning' : 'Partly cloudy';
    }

    const locationName = await getLocationName(lat, lng);

    setWeather({
      period,
      greeting,
      greetingEmoji,
      weatherIcon: getWeatherIcon(temperature, period, isDaylight),
      condition: getWeatherCondition(weatherDescription, isDaylight, period),
      temperature,
      weatherDescription,
      locationName,
      sunriseHour: sunrise,
      sunsetHour: sunset,
      isDaylight,
      sunAngle,
      auroraColors: AURORA_PALETTES[period],
      lastUpdated: now,
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          // Fallback: use default location (New Delhi) or last known
          if (mounted) {
            await computeWeather(28.6139, 77.2090); // Default: New Delhi
          }
          return;
        }

        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Low,
        });
        if (!mounted) return;

        setLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
        await computeWeather(loc.coords.latitude, loc.coords.longitude);
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Location unavailable');
          // Fallback: use default location
          await computeWeather(28.6139, 77.2090);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [computeWeather]);

  // Refresh weather data every 30 minutes
  useEffect(() => {
    if (!location) return;
    const interval = setInterval(async () => {
      await computeWeather(location.lat, location.lng);
    }, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [location, computeWeather]);

  return { weather, loading, error };
}
