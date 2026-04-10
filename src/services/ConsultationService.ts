import * as Linking from 'expo-linking';

export class ConsultationService {
  /**
   * Generates a high-security meeting ID for the Jitsi Consultation.
   */
  private static generateMeetingId(doctorName: string, patientName: string) {
    const cleanDoc = doctorName.replace(/\s+/g, '-');
    const cleanPat = patientName.replace(/\s+/g, '-');
    return `VitalsFusion-${cleanDoc}-${cleanPat}-${Date.now().toString().slice(-6)}`;
  }

  /**
   * Triggers a video consultation via Jitsi Meet.
   */
  static async startVideoCall(doctorName: string, patientName: string) {
    const meetingId = this.generateMeetingId(doctorName, patientName);
    const url = `https://meet.jit.si/${meetingId}`;

    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        // Note: In a real app, you would send a push notification to the patient here.
        await Linking.openURL(url);
        return meetingId;
      } else {
        console.error("Could not launch Jitsi video call, URL not supported.");
        return null;
      }
    } catch (error: any) {
      console.error("Linking error:", error);
      // Fallback for emulators that can't open URLs
      return meetingId; 
    }
  }

  /**
   * Join an existing consultation.
   */
  static async joinVideoCall(meetingId: string) {
    const url = `https://meet.jit.si/${meetingId}`;
    await Linking.openURL(url);
  }
}
