import { supabase } from '../src/services/SupabaseService';

async function findDoctor() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name')
    .limit(5);
  
  if (error) {
    console.error('Error fetching profiles:', error);
    return;
  }
  
  console.log('Profiles found:', JSON.stringify(data, null, 2));
}

findDoctor();
