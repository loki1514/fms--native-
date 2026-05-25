# Autopilot Mobile - Web Preview

This is a web-based preview of the React Native mobile app UI.

## Live Preview

**URL:** https://uk336mta4gj6c.ok.kimi.link

## Features Demonstrated

### Login Screen
- App logo and branding
- Email/password input fields
- Biometric authentication option
- Forgot password link
- Sign up prompt

### Dashboard Screen
- Welcome header with user name
- Notification bell with badge
- Stats cards (Open Tickets, Checked In, Low Stock, Bookings)
- Quick action buttons
- Recent activity section

### Tickets Screen
- Search bar with filter
- Ticket cards with priority badges
- Status indicators
- Floating action button

### Bottom Navigation
- Dashboard, Tickets, Visitors, Inventory, More tabs
- Active state highlighting

## How to Use

1. Open the preview URL on any device
2. On the login screen, click **"Sign In"** to see the dashboard
3. Click **"Tickets"** in the bottom navigation to see the tickets screen
4. Explore the UI on different screen sizes

## Note

This is a static HTML/CSS preview for demonstration purposes. The actual React Native app has:
- Real authentication with Supabase
- Live data from your database
- Push notifications
- Biometric authentication
- Camera/QR scanning
- Offline support

To run the actual React Native app:

```bash
cd /mnt/okcomputer/output/autopilot-mobile
npm install
npx expo start
```

Then scan the QR code with Expo Go app or press 'w' for web.
