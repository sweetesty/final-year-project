import * as Location from 'expo-location';
import { supabase } from './SupabaseService';

export class LocationService {
  static async requestPermissions() {
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    if (foregroundStatus !== 'granted') {
      console.warn('Foreground location permission denied');
      return false;
    }

    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
    if (backgroundStatus !== 'granted') {
      console.warn('Background location permission denied');
      // Background location is not strictly required for foreground testing
    }
    return true;
  }

  static async getCurrentLocation() {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      return location.coords;
    } catch (error) {
      console.error('Error getting current location:', error);
      return null;
    }
  }

  static async trackLocation(patientId: string) {
    const coords = await this.getCurrentLocation();
    if (coords) {
      await supabase.from('patient_locations').insert({
        patientId,
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy || 0,
        timestamp: new Date().toISOString(),
      });
      return coords;
    }
    return null;
  }

  static getMapsLink(latitude: number, longitude: number) {
    return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
  }
}
