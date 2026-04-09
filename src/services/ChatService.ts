import { supabase } from './SupabaseService';

export interface DirectMessage {
  id?: string;
  chat_id: string; // Composite: doctorId_patientId
  sender_id: string;
  receiver_id: string;
  message_text: string;
  timestamp?: string;
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
}
