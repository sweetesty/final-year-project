import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Colors, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/src/services/SupabaseService';
import { useAuthViewModel } from '@/src/viewmodels/useAuthViewModel';


export default function MedicalDetailsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const themeColors = Colors[colorScheme as 'light' | 'dark'];
  const router = useRouter();
  const { session } = useAuthViewModel();


  const [details, setDetails] = useState({
    bloodType: '',
    allergies: '',
    chronicConditions: '',
    currentMedications: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
  });

  const handleSave = async () => {
    try {
      if (!session?.user?.id) {
        alert('You must be logged in to save details');
        return;
      }

      const { error } = await supabase
        .from('medical_details')
        .upsert({
          patientid: session.user.id,
          bloodType: details.bloodType,
          allergies: details.allergies,
          chronicConditions: details.chronicConditions,
          currentMedications: details.currentMedications,
        });

      if (error) {
        alert('Error saving details: ' + error.message);
      } else {
        alert('Medical details saved successfully!');
        router.replace('/(tabs)');
      }
    } catch (err: any) {
      alert('An unexpected error occurred: ' + err.message);
    }
  };


  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: themeColors.background }]}
    >
      <Stack.Screen options={{ title: 'Medical Profile', headerShown: true }} />
      
      <ScrollView contentContainerStyle={styles.scrollInner}>
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>General Information</Text>
          <InputField 
            label="Blood Type" 
            placeholder="e.g. O+" 
            value={details.bloodType} 
            onChange={(val: string) => setDetails({...details, bloodType: val})}
            theme={themeColors}
          />
          <InputField 
            label="Allergies" 
            placeholder="List any allergies" 
            value={details.allergies} 
            onChange={(val: string) => setDetails({...details, allergies: val})}
            multiline
            theme={themeColors}
          />
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Medical History</Text>
          <InputField 
            label="Chronic Conditions" 
            placeholder="e.g. Diabetes, Hypertension" 
            value={details.chronicConditions} 
            onChange={(val: string) => setDetails({...details, chronicConditions: val})}
            multiline
            theme={themeColors}
          />
          <InputField 
            label="Current Medications" 
            placeholder="List your medications" 
            value={details.currentMedications} 
            onChange={(val: string) => setDetails({...details, currentMedications: val})}
            multiline
            theme={themeColors}
          />
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Emergency Contacts</Text>
          <Text style={{ color: themeColors.muted, marginBottom: Spacing.sm }}>
            Manage the people who should be notified in case of an emergency.
          </Text>
          <TouchableOpacity 
            style={[styles.manageButton, { borderColor: themeColors.tint }]}
            onPress={() => router.push('/emergency-contacts')}
          >
            <Text style={[styles.manageButtonText, { color: themeColors.tint }]}>Manage Contacts</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={[styles.saveButton, { backgroundColor: themeColors.tint }]}
          onPress={handleSave}
        >
          <Text style={styles.saveButtonText}>Save Profile</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function InputField({ label, placeholder, value, onChange, multiline, keyboardType, theme }: any) {
  return (
    <View style={styles.inputGroup}>
      <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
      <TextInput
        style={[
          styles.input, 
          { borderColor: theme.border, color: theme.text, backgroundColor: theme.card },
          multiline && { height: 80, paddingTop: Spacing.sm }
        ]}
        placeholder={placeholder}
        placeholderTextColor={theme.muted}
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        keyboardType={keyboardType}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollInner: {
    padding: Spacing.lg,
    gap: Spacing.xl,
  },
  section: {
    gap: Spacing.md,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: Spacing.xs,
  },
  inputGroup: {
    gap: Spacing.xs,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm,
    fontSize: 16,
  },
  saveButton: {
    height: 56,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.lg,
    marginBottom: Spacing.xxl,
    ...Shadows.medium,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  manageButton: {
    height: 56,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.light,
  },
  manageButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
