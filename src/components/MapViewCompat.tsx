// Re-exports react-native-maps.
// In Expo Go, Metro replaces the package with src/mocks/react-native-maps.js
// (when started with `npm run start:go`) so this import never crashes.
export {
  default,
  Marker,
  Circle,
  Polyline,
  Callout,
  Polygon,
  PROVIDER_GOOGLE,
  PROVIDER_DEFAULT,
} from 'react-native-maps';
