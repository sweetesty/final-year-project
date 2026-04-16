import { supabase } from './SupabaseService';
import { NotificationService } from './NotificationService';

export type CallType = 'voice' | 'video';

export interface CallSession {
  channelName: string;
  callType: CallType;
  callerId: string;
  callerName: string;
  calleeId: string;
  calleeName: string;
}

export class AgoraCallService {
  static readonly APP_ID = process.env.EXPO_PUBLIC_AGORA_APP_ID ?? '';

  /**
   * Generates a deterministic channel name for two users.
   * Using sorted IDs ensures both sides derive the same channel.
   */
  static getChannelName(uid1: string, uid2: string): string {
    return [uid1, uid2].sort().join('_call_');
  }

  /**
   * Notifies the callee via push notification so they can join.
   */
  static async notifyCallee(session: CallSession): Promise<void> {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('push_token')
        .eq('id', session.calleeId)
        .single();

      if (!profile?.push_token) return;

      const title = session.callType === 'video'
        ? `📹 ${session.callerName} is calling you`
        : `📞 ${session.callerName} is calling you`;

      await NotificationService.sendPushToToken(
        profile.push_token,
        title,
        'Tap to join the call',
        {
          type: 'incoming_call',
          channelName: session.channelName,
          callType: session.callType,
          callerId: session.callerId,
          callerName: session.callerName,
        }
      );
    } catch (e) {
      console.warn('[AgoraCallService] notify callee failed:', e);
    }
  }
}
