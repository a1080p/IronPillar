import { Platform } from 'react-native';
import { AppleMaps, GoogleMaps } from 'expo-maps';
import { useTheme } from '../contexts/ThemeContext';
import type { RoutePoint } from '../types/models';

// Thin cross-platform wrapper — expo-maps ships separate AppleMaps/GoogleMaps
// components rather than one unified API, so callers just get a route drawn
// on whichever the platform provides. Android needs android.config.googleMaps
// .apiKey set in app.json to render at all; iOS (Apple Maps) needs no key.
export function MapRoute({ route, style }: { route: RoutePoint[]; style?: object }) {
  const { colors } = useTheme();
  const coordinates = route.map((p) => ({ latitude: p.lat, longitude: p.lng }));
  const last = coordinates[coordinates.length - 1] ?? { latitude: 0, longitude: 0 };

  const polylines =
    coordinates.length > 1 ? [{ coordinates, color: colors.primary, width: 4 }] : [];
  const markers = coordinates.length > 0 ? [{ coordinates: last }] : [];

  if (Platform.OS === 'ios') {
    return (
      <AppleMaps.View
        style={style}
        cameraPosition={{ coordinates: last, zoom: 15 }}
        polylines={polylines}
        markers={markers}
      />
    );
  }

  return (
    <GoogleMaps.View
      style={style}
      cameraPosition={{ coordinates: last, zoom: 15 }}
      polylines={polylines}
      markers={markers}
    />
  );
}
