import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/SupabaseService';
import { EmergencyContact, NewEmergencyContact } from '../models/EmergencyContact';

export const useEmergencyContactsViewModel = (patientId: string) => {
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchContacts = useCallback(async () => {
    if (!patientId) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from('emergency_contacts')
      .select('*')
      .eq('patientid', patientId)          // DB: patientid (lowercase)
      .order('created_at', { ascending: true }); // DB: created_at (underscore)

    if (error) console.error('[EmergencyContacts] Fetch error:', error);
    // Map DB lowercase → camelCase for the UI
    else setContacts((data ?? []).map(mapRow));
    setLoading(false);
  }, [patientId]);

  const addContact = async (contact: NewEmergencyContact) => {
    const { data, error } = await supabase
      .from('emergency_contacts')
      .insert({
        patientid:    patientId,           // DB: patientid
        name:         contact.name,
        phone:        contact.phone,
        relationship: contact.relationship,
        isprimary:    contact.isPrimary ?? false,  // DB: isprimary
      })
      .select()
      .single();

    if (error) { alert(error.message); return; }
    setContacts(prev => [...prev, mapRow(data)]);
  };

  const deleteContact = async (id: string) => {
    const { error } = await supabase.from('emergency_contacts').delete().eq('id', id);
    if (error) { alert(error.message); return; }
    setContacts(prev => prev.filter(c => c.id !== id));
  };

  const setPrimary = async (id: string) => {
    // Clear all primaries first
    await supabase
      .from('emergency_contacts')
      .update({ isprimary: false })        // DB: isprimary
      .eq('patientid', patientId);

    const { error } = await supabase
      .from('emergency_contacts')
      .update({ isprimary: true })
      .eq('id', id);

    if (error) { alert(error.message); return; }
    setContacts(prev => prev.map(c => ({ ...c, isPrimary: c.id === id })));
  };

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  return { contacts, loading, addContact, deleteContact, setPrimary, refresh: fetchContacts };
};

// Map DB row → EmergencyContact
function mapRow(row: any): EmergencyContact {
  return {
    id:           row.id,
    patientId:    row.patientid,
    name:         row.name,
    phone:        row.phone,
    relationship: row.relationship,
    isPrimary:    row.isprimary,
    createdAt:    row.created_at, // Use created_at from SQL
  };
}
