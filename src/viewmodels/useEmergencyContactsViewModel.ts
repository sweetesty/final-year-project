import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/SupabaseService';
import { EmergencyContact, NewEmergencyContact } from '../models/EmergencyContact';

export const useEmergencyContactsViewModel = (patientId: string) => {
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('emergency_contacts')
      .select('*')
      .eq('patientId', patientId);

    if (error) {
      console.error('Error fetching contacts:', error);
    } else {
      setContacts(data || []);
    }
    setLoading(false);
  }, [patientId]);

  const addContact = async (contact: NewEmergencyContact) => {
    const { data, error } = await supabase
      .from('emergency_contacts')
      .insert({ ...contact, patientId })
      .select()
      .single();

    if (error) {
      alert(error.message);
    } else {
      setContacts([...contacts, data]);
    }
  };

  const deleteContact = async (id: string) => {
    const { error } = await supabase
      .from('emergency_contacts')
      .delete()
      .eq('id', id);

    if (error) {
      alert(error.message);
    } else {
      setContacts(contacts.filter(c => c.id !== id));
    }
  };

  const setPrimary = async (id: string) => {
    // First, set all to false
    await supabase
      .from('emergency_contacts')
      .update({ isPrimary: false })
      .eq('patientId', patientId);

    // Then set the chosen one to true
    const { error } = await supabase
      .from('emergency_contacts')
      .update({ isPrimary: true })
      .eq('id', id);

    if (error) {
      alert(error.message);
    } else {
      await fetchContacts();
    }
  };

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  return {
    contacts,
    loading,
    addContact,
    deleteContact,
    setPrimary,
    refresh: fetchContacts,
  };
};
