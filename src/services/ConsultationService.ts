import * as WebBrowser from 'expo-web-browser';
import { supabase } from './SupabaseService';

export type CallStatus = 'ringing' | 'accepted' | 'declined' | 'ended';

export interface CallSession {
  id: string;
  caller_id: string;
  receiver_id: string;
  type: 'voice' | 'video';
  status: CallStatus;
  meeting_id: string;
  created_at: string;
  caller?: {
    full_name: string;
    avatar_url: string;
  };
}

export class ConsultationService {
  /**
   * Generates a high-security meeting ID for the Jitsi Consultation.
   */
  private static generateMeetingId() {
    return `Kainos-${Math.random().toString(36).substring(2, 10)}-${Date.now().toString().slice(-6)}`;
  }

  /**
   * Initiates a new call session in the database (Signaling).
   */
  static async startCall(callerId: string, receiverId: string, type: 'voice' | 'video' = 'video') {
    const meetingId = this.generateMeetingId();
    
    const { data, error } = await supabase
      .from('call_sessions')
      .insert({
        caller_id: callerId,
        receiver_id: receiverId,
        type: type,
        status: 'ringing',
        meeting_id: meetingId
      })
      .select()
      .single();

    if (error) throw error;
    
    // Open the browser for the caller immediately
    this.openConference(meetingId);
    
    return data as CallSession;
  }

  /**
   * Updates the status of an active call (Accept/Decline/End).
   */
  static async updateCallStatus(callId: string, status: CallStatus) {
    const { error } = await supabase
      .from('call_sessions')
      .update({ status })
      .eq('id', callId);

    if (error) console.error('[ConsultationService] Status update error:', error);
  }

  /**
   * Listens for incoming calls for a specific user.
   */
  static subscribeToIncomingCalls(userId: string, onIncomingCall: (call: CallSession) => void) {
    console.log('[ConsultationService] Subscribing to calls for:', userId);
    
    return supabase
      .channel(`incoming_calls_${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'call_sessions',
        filter: `receiver_id=eq.${userId}`
      }, async (payload: any) => {
        const newCall = payload.new;
        
        // Fetch caller details for the UI
        const { data: caller } = await supabase
          .from('profiles')
          .select('full_name, avatar_url')
          .eq('id', newCall.caller_id)
          .single();
          
        onIncomingCall({ ...newCall, caller });
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'call_sessions',
        filter: `receiver_id=eq.${userId}`
      }, (payload: any) => {
        // Handle remote cancellations or endings if needed
      })
      .subscribe();
  }

  /**
   * Opens the Jitsi conference in the system's in-app browser.
   */
  static async openConference(meetingId: string) {
    const url = `https://meet.jit.si/${meetingId}`;
    try {
      await WebBrowser.openBrowserAsync(url, {
        toolbarColor: '#6366F1',
        enableBarCollapsing: true,
        showTitle: false,
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
      });
    } catch (e) {
      console.error('[ConsultationService] Browser error:', e);
    }
  }
}
