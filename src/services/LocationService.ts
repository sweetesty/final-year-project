import * as Location from 'expo-location';
import { supabase } from './SupabaseService';

export class LocationService {

  static async requestPermissions(): Promise<boolean> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      return status === 'granted';
    } catch (e) {
      console.warn('[Location] Permission request failed:', e);
      return false;
    }
  }

  static async getCurrentLocation() {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        // Try to request — if it fails or is denied, return null gracefully
        const result = await Location.requestForegroundPermissionsAsync();
        if (result.status !== 'granted') {
          console.warn('[Location] Permission not granted — skipping location.');
          return null;
        }
      }
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      return location.coords;
    } catch (error) {
      // Never throw — location is optional, emergency must still proceed
      console.warn('[Location] Could not get location:', (error as any)?.message ?? error);
      return null;
    }
  }

  static async trackLocation(patientId: string) {
    const coords = await this.getCurrentLocation();
    if (coords && patientId) {
      supabase.from('patient_locations').insert({
        patientid:  patientId,
        latitude:   coords.latitude,
        longitude:  coords.longitude,
        accuracy:   coords.accuracy ?? 0,
        timestamp:  new Date().toISOString(),
      }).then(({ error }) => {
        if (error) console.warn('[Location] Failed to log location:', error.message);
      });
    }
    return coords ?? null;
  }

  static getMapsLink(latitude: number, longitude: number) {
    return `https://maps.google.com/?q=${latitude},${longitude}`;
  }
}
