import { supabase } from './SupabaseService';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import { NotificationService } from './NotificationService';

export interface DirectMessage {
  id?: string;
  chat_id: string; // Composite: doctorId_patientId
  sender_id: string;
  receiver_id: string;
  message_text: string;
  timestamp?: string;
  attachment_url?: string;
  attachment_type?: 'image' | 'video' | 'audio';
  read_at?: string | null;
}

export class ChatService {
  /**
   * Generates a consistent chat ID for a doctor and patient pair.
   */
  static getChatId(id1: string, id2: string) {
    return [id1, id2].sort().join('_');
  }

  static async sendMessage(msg: DirectMessage, senderName?: string) {
    const { data, error } = await supabase
      .from('direct_messages')
      .insert(msg)
      .select()
      .single();

    if (error) throw error;

    // Fire push notification to receiver (non-blocking)
    this._notifyReceiver(msg, senderName).catch(() => {});

    return data;
  }

  private static async _notifyReceiver(msg: DirectMessage, senderName?: string) {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('push_token, full_name')
        .eq('id', msg.receiver_id)
        .single();

      if (!profile?.push_token) return;

      const displayName = senderName || 'Someone';
      const isMedia = msg.attachment_type === 'image'
        ? '📸 sent you an image'
        : msg.attachment_type === 'audio'
        ? '🎙️ sent you a voice note'
        : null;
      const body = isMedia ?? (msg.message_text || '...');

      await NotificationService.sendPushToToken(
        profile.push_token,
        `💬 ${displayName}`,
        body,
        { chatId: msg.chat_id, partnerId: msg.sender_id, partnerName: displayName },
      );
    } catch (e) {
      console.warn('[ChatService] push notify failed:', e);
    }
  }

  static async getMessages(chatId: string) {
    const { data, error } = await supabase
      .from('direct_messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('timestamp', { ascending: true });
    
    if (error) throw error;
    return data;
  }

  /**
   * Subscribe to real-time chat updates.
   */
  static subscribeToChat(chatId: string, onMessage: (msg: DirectMessage) => void) {
    return supabase
      .channel(`chat_${chatId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'direct_messages',
        filter: `chat_id=eq.${chatId}`
      }, (payload) => {
        onMessage(payload.new as DirectMessage);
      })
      .subscribe();
  }

  static async uploadMedia(uri: string, chatId: string, userId: string, type: 'image' | 'video' | 'audio') {
    try {
      const ext = type === 'audio' ? 'm4a' : (uri.split('.').pop() || 'jpg');
      const fileName = `${chatId}/${userId}-${Date.now()}.${ext}`;
      const contentType = type === 'image' ? `image/${ext}`
                        : type === 'audio' ? 'audio/x-m4a'
                        : `video/${ext}`;

      console.log(`[ChatService] Starting upload: ${type} from ${uri}`);

      // READ THE FILE DATA RELIABLY
      // Using expo-file-system to read as base64 is 100% reliable on mobile
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
      const arrayBuffer = decode(base64);
      
      console.log(`[ChatService] File converted. Binary size: ${arrayBuffer.byteLength} bytes`);

      if (arrayBuffer.byteLength === 0) {
        throw new Error('File is empty');
      }

      const { error } = await supabase.storage
        .from('chat_media')
        .upload(fileName, arrayBuffer, { contentType, upsert: false });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('chat_media')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (e) {
      console.error('[ChatService] upload error:', e);
      return null;
    }
  }

  /**
   * Upload an image specifically intended for clinical review (wound, pill bottle, etc.)
   */
  static async uploadClinicalImage(uri: string, patientId: string, description: string) {
    try {
      const ext = uri.split('.').pop() || 'jpg';
      const fileName = `${patientId}/clinical_${Date.now()}.${ext}`;
      
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
      const arrayBuffer = decode(base64);

      const { error: storageError } = await supabase.storage
        .from('clinical-images')
        .upload(fileName, arrayBuffer, { contentType: `image/${ext}`, upsert: false });

      if (storageError) throw storageError;

      const { data: { publicUrl } } = supabase.storage
        .from('clinical-images')
        .getPublicUrl(fileName);

      // Save record to DB for the gallery
      const { data, error: dbError } = await supabase
        .from('clinical_records')
        .insert({
          patientid: patientId,
          image_url: publicUrl,
          description: description,
          timestamp: new Date().toISOString(),
          status: 'pending'
        })
        .select()
        .single();

      if (dbError) throw dbError;
      return data;
    } catch (e) {
      console.error('[ChatService] clinical upload error:', e);
      return null;
    }
  }

  static async getClinicalRecords(patientId: string) {
    const { data, error } = await supabase
      .from('clinical_records')
      .select('*')
      .eq('patientid', patientId)
      .order('timestamp', { ascending: false });
    
    if (error) throw error;
    return data;
  }

  /**
   * Returns all conversations for a user: one entry per unique chat partner,
   * with the latest message text/time and unread count.
   */
  static async getConversations(userId: string) {
    // Fetch all messages where the user is sender or receiver, ordered newest first
    const { data, error } = await supabase
      .from('direct_messages')
      .select('chat_id, sender_id, receiver_id, message_text, timestamp, read_at')
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order('timestamp', { ascending: false });

    if (error) throw error;

    // Collapse into one entry per chat_id (first occurrence = latest message)
    const seen = new Map<string, any>();
    for (const msg of data ?? []) {
      if (!seen.has(msg.chat_id)) seen.set(msg.chat_id, msg);
    }

    // Count unread per chat (messages sent TO me with no read_at)
    const unreadCounts = new Map<string, number>();
    for (const msg of data ?? []) {
      if (msg.receiver_id === userId && !msg.read_at) {
        unreadCounts.set(msg.chat_id, (unreadCounts.get(msg.chat_id) ?? 0) + 1);
      }
    }

    // Resolve partner profile for each chat
    const partnerIds = Array.from(seen.values()).map(msg =>
      msg.sender_id === userId ? msg.receiver_id : msg.sender_id
    );

    if (partnerIds.length === 0) return [];

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, role, last_seen, avatar_url')
      .in('id', partnerIds);

    const profileMap = new Map((profiles ?? []).map(p => [p.id, p]));

    return Array.from(seen.values()).map(msg => {
      const partnerId = msg.sender_id === userId ? msg.receiver_id : msg.sender_id;
      const partner = profileMap.get(partnerId);
      return {
        chatId: msg.chat_id,
        partnerId,
        partnerName: partner?.full_name ?? 'Unknown',
        partnerRole: partner?.role ?? 'patient',
        partnerLastSeen: partner?.last_seen ?? null,
        partnerAvatarUrl: partner?.avatar_url ?? null,
        lastMessage: msg.message_text,
        lastMessageTime: msg.timestamp,
        unreadCount: unreadCounts.get(msg.chat_id) ?? 0,
      };
    });
  }

  /**
   * Marks all unread messages from a partner as read.
   */
  static async markAsRead(chatId: string, receiverId: string) {
    await supabase
      .from('direct_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('chat_id', chatId)
      .eq('receiver_id', receiverId)
      .is('read_at', null);
  }

  /**
   * Subscribe to read receipt updates (UPDATE events on our sent messages).
   */
  static subscribeToReadReceipts(chatId: string, senderId: string, onRead: (ids: string[]) => void) {
    return supabase
      .channel(`read_${chatId}_${senderId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'direct_messages',
        filter: `chat_id=eq.${chatId}`,
      }, (payload: any) => {
        if (payload.new?.read_at && payload.new?.sender_id === senderId) {
          onRead([payload.new.id]);
        }
      })
      .subscribe();
  }

  /**
   * Join a Supabase Presence channel to track exactly who is actively in the chat.
   * This enables 100% accurate real-time Online/Offline status.
   */
  static subscribeToPresence(chatId: string, userId: string, onStateChange: (activeUserIds: string[]) => void) {
    const channel = supabase.channel(`presence_${chatId}`, {
      config: { presence: { key: userId } }
    });

    const updateState = () => {
      const state = channel.presenceState();
      const activeIds = Object.keys(state);
      onStateChange(activeIds);
    };

    channel
      .on('presence', { event: 'sync' }, updateState)
      .on('presence', { event: 'join' }, updateState)
      .on('presence', { event: 'leave' }, updateState)
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ online_at: new Date().toISOString() });
          // Trigger initial state check
          updateState();
        }
      });

    return channel;
  }
}
