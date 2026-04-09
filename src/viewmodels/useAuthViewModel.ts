import { useState, useEffect } from 'react';
import { supabase } from '../services/SupabaseService';
import { Session } from '@supabase/supabase-js';
import { BackgroundMonitorService } from '../services/BackgroundMonitorService';

export const useAuthViewModel = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<'patient' | 'doctor' | null>(null);

  useEffect(() => {
    const fetchSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      if (session?.user?.user_metadata?.role) {
        setRole(session.user.user_metadata.role);
      }
      setLoading(false);
    };

    fetchSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session?.user) {
        const userRole = session.user.user_metadata?.role ?? 'patient';
        const fullName = session.user.user_metadata?.full_name ?? '';
        setRole(userRole);

        // On SIGNED_IN after signup, ensure profile exists (trigger may have run,
        // but upsert here is safe because auth.uid() is now set)
        if (_event === 'SIGNED_IN') {
          await supabase.from('profiles').upsert({
            id: session.user.id,
            full_name: fullName,
            role: userRole,
          }, { onConflict: 'id', ignoreDuplicates: true });
        }
      } else {
        setRole(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, fullName: string = '', userRole: 'patient' | 'doctor' = 'patient') => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, role: userRole },
      },
    });
    if (error) throw error;
    // Profile is created by the DB trigger (handle_new_user).
    // We do NOT upsert here — auth.uid() is not yet set in the session
    // so RLS would block the insert.
    return data;
  };

  const signOut = async () => {
    await BackgroundMonitorService.unregister();
    await supabase.auth.signOut();
    setRole(null);
  };

  return {
    session,
    loading,
    role,
    signUp,
    signOut,
    isAuthenticated: !!session,
  };
};
