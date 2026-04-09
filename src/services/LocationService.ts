import * as Location from 'expo-location';
import { supabase } from './SupabaseService';

export class LocationService {
  private static permissionGranted = false;

  /** Call once early (e.g. after login) so permission is ready before an emergency. */
  static async requestPermissions(): Promise<boolean> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      this.permissionGranted = status === 'granted';
      if (!this.permissionGranted) {
        console.warn('[Location] Foreground permission denied.');
      }
      return this.permissionGranted;
    } catch (e) {
      console.error('[Location] Permission request failed:', e);
      return false;
    }
  }

  static async getCurrentLocation() {
    try {
      // Request permission silently if not yet granted
      if (!this.permissionGranted) {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') {
          const result = await Location.requestForegroundPermissionsAsync();
          this.permissionGranted = result.status === 'granted';
        } else {
          this.permissionGranted = true;
        }
      }

      if (!this.permissionGranted) return null;

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced, // faster than High, good enough for SMS link
      });
      return location.coords;
    } catch (error) {
      console.warn('[Location] Could not get location:', error);
      return null;
    }
  }

  static async trackLocation(patientId: string) {
    const coords = await this.getCurrentLocation();
    if (coords && patientId) {
      // Fire-and-forget — don't block the emergency flow
      supabase.from('patient_locations').insert({
        patientid:  patientId,   // DB column is lowercase
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
