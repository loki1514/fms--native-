/**
 * weather.ts — Weather mode enum + UI metadata for the WeatherToggle dropdown.
 *
 * Responsibility: Define the four supported atmospheric scenes and the
 *   label/temp/icon-key shown in the toggle menu.
 * Used by: WeatherScene (renders sky/clouds/stars per mode), WeatherToggle
 *   (dropdown), dashboard.$propertyId (initial mode by current hour).
 *
 * Gotcha: `icon` is a string key, not a component — WeatherToggle maps it to
 *   a lucide icon. Adding a mode requires updating both arrays + WeatherScene.
 */

export type WeatherMode = "clear-night" | "sunny" | "cloudy" | "rainy";

export const weatherModes: {
  id: WeatherMode;
  label: string;
  temp: string;
  icon: "moon" | "sun" | "cloud" | "rain";
}[] = [
  { id: "clear-night", label: "Clear Night", temp: "22°", icon: "moon" },
  { id: "sunny", label: "Sunny", temp: "31°", icon: "sun" },
  { id: "cloudy", label: "Cloudy", temp: "26°", icon: "cloud" },
  { id: "rainy", label: "Rainy", temp: "19°", icon: "rain" },
];

/**
 * Pick an initial WeatherMode from the device's local hour.
 * Shared between WeatherBackdrop and any page that wants to seed its own state.
 */
export function getInitialMode(): WeatherMode {
  const h = new Date().getHours();
  if (h >= 6 && h < 11) return "sunny";
  if (h >= 11 && h < 16) return "cloudy";
  if (h >= 16 && h < 19) return "rainy";
  return "clear-night";
}
