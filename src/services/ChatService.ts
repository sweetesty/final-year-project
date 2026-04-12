import { supabase } from './SupabaseService';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';

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

  static async sendMessage(msg: DirectMessage) {
    const { data, error } = await supabase
      .from('direct_messages')
      .insert(msg)
      .select()
      .single();
    
    if (error) throw error;
    return data;
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
