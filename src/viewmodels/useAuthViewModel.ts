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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user?.user_metadata?.role) {
        setRole(session.user.user_metadata.role);
      } else {
        setRole(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await BackgroundMonitorService.unregister();
    await supabase.auth.signOut();
    setRole(null);
  };

  return {
    session,
    loading,
    role,
    signOut,
    isAuthenticated: !!session,
  };
};
