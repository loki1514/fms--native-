# Property Dashboard - React Native

A beautiful property management dashboard with animated weather header, orb loader, and stacked tickets.

## 🎨 Preview

**Live Preview:** https://pjjmnmmnn5rei.ok.kimi.link

## ✨ Features

### 🌤️ Weather Header
- Animated gradient sky background (blue tones)
- Floating clouds with smooth drift animation
- Glowing sun with ray effects
- Dynamic time display
- "Hi Tennanat! Good morning" greeting

### 🌟 Animated Orb
- Centered in bottom navigation between Tickets and Rooms
- 7 rotating polygons with different speeds and origins
- Golden/bronze color scheme with hue rotation
- Glow effects and smooth animations
- No obstruction - properly positioned

### 🎫 Stacked Tickets
- 2 background tickets creating depth effect
- Main ticket card on top with full details
- Glassmorphism design with dark theme

### 📊 Stats Cards
- Open Tickets (3) - Orange
- Checklist Completion (65%) - Green
- Critical Alert (1) - Red

### 🧭 Bottom Navigation
- Home, Tickets, **Orb**, Rooms, Profile
- Orb is centered and elevated above the nav bar

## 🚀 Setup Instructions

### 1. Create a new Expo project

```bash
npx create-expo-app property-dashboard
cd property-dashboard
```

### 2. Install dependencies

```bash
npm install react-native-svg react-native-linear-gradient
```

### 3. Copy the files

Replace `App.js` with:

```javascript
import PropertyDashboard from './PropertyDashboard';

export default function App() {
  return <PropertyDashboard />;
}
```

### 4. Run the app

```bash
npx expo start
```

## 📁 Project Structure

```
property-dashboard/
├── App.js                    # Entry point
├── PropertyDashboard.jsx     # Main dashboard component
├── package.json
└── README.md
```

## 🎨 Design System

### Colors
- **Background**: `#0a0a0a` (Dark)
- **Card Background**: `rgba(30, 30, 35, 0.8)`
- **Primary**: `#667eea` (Purple gradient)
- **Success**: `#4CAF50`
- **Warning**: `#F5A623`
- **Danger**: `#E53935`
- **Orb Gold**: `#ffbf48`
- **Orb Bronze**: `#be4a1d`

### Sky Gradient
```
#1a3a5c → #2d5a87 → #4a7ba7 → #6a9bc7
```

## 🔧 Customization

### Change Orb Colors
Edit the gradient stops in the `OrbLoader` component:

```javascript
<LinearGradient id="orbGradient">
  <Stop offset="30%" stopColor="#ffbf48" />  // Primary color
  <Stop offset="70%" stopColor="#be4a1d" />  // Secondary color
</LinearGradient>
```

### Adjust Cloud Animation Speed
Modify the `duration` prop on `AnimatedCloud`:

```javascript
<AnimatedCloud duration={25000} />  // 25 seconds
```

### Change Greeting Text
Edit in `WeatherHeader` component:

```javascript
<Text style={styles.greetingName}>Hi YourName!</Text>
```

## 📱 Screen Preview

The app uses the entire screen real estate with:
- Full-width weather header with rounded bottom corners
- Edge-to-edge content
- Floating bottom navigation with elevated orb
- Dynamic Island/notch support

## 🛠️ Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| expo | ~50.0.0 | Framework |
| react-native-svg | 14.1.0 | SVG support for orb & clouds |
| react-native-linear-gradient | 2.8.3 | Sky gradient |

## 📄 License

MIT
