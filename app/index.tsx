import { Redirect } from 'expo-router';

export default function RootIndex() {
  // Gracefully redirect root / to the main tabs group
  // This prevents "Unmatched Route" if the app lands here accidentally
  return <Redirect href="/(tabs)" />;
}
