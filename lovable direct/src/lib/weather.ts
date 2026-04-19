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
