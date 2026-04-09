import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

// These should ideally be in an .env file
const supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL || "").trim();
const supabaseAnonKey = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "").trim();

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase credentials NOT found in environment! Check your .env file.');
} else {
  console.log('✅ Supabase initialized with URL:', supabaseUrl.substring(0, 15) + '...');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export class DataService {
  /**
   * General template for fetching data from Supabase
   */
  static async fetchTableData<T>(tableName: string, query?: object): Promise<T[]> {
    const { data, error } = await supabase
      .from(tableName)
      .select('*');
    
    if (error) throw error;
    return data as T[];
  }

  static async insertRow<T>(tableName: string, row: Partial<T>): Promise<T> {
    const { data, error } = await supabase
      .from(tableName)
      .insert(row as any)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async updateUserPushToken(userId: string, token: string): Promise<void> {
    const { error } = await supabase
      .from('profiles')
      .update({ push_token: token })
      .eq('id', userId);

    if (error) throw error;
  }
}

export class AuthService {
  static async signUp(email: string, password: string, fullName: string, role: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: role,
        },
      },
    });
    if (error) throw error;
    return data;
  }

  static async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  }

  static async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  static async getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  }
}
