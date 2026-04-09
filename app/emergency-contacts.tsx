import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView, FlatList, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { Colors, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useEmergencyContactsViewModel } from '@/src/viewmodels/useEmergencyContactsViewModel';

export default function EmergencyContactsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const themeColors = Colors[colorScheme as 'light' | 'dark'];
  
  // Hardcoded patientId for now, ideally comes from useAuthViewModel
  const { contacts, loading, addContact, deleteContact, setPrimary } = useEmergencyContactsViewModel('patient-123');

  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRelationship, setNewRelationship] = useState('');

  const handleAdd = async () => {
    if (!newName || !newPhone) return;
    await addContact({
      name: newName,
      phone: newPhone,
      relationship: newRelationship,
      isPrimary: contacts.length === 0, // First contact is primary by default
    });
    setNewName('');
    setNewPhone('');
    setNewRelationship('');
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Stack.Screen options={{ title: 'Emergency Contacts', headerShown: true }} />
      
      <View style={styles.addSection}>
        <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Add New Contact</Text>
        <TextInput
          style={[styles.input, { borderColor: themeColors.border, color: themeColors.text, backgroundColor: themeColors.card }]}
          placeholder="Contact Name"
          placeholderTextColor={themeColors.muted}
          value={newName}
          onChangeText={setNewName}
        />
        <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
          <TextInput
            style={[styles.input, { flex: 1, borderColor: themeColors.border, color: themeColors.text, backgroundColor: themeColors.card }]}
            placeholder="Phone Number"
            placeholderTextColor={themeColors.muted}
            value={newPhone}
            onChangeText={setNewPhone}
            keyboardType="phone-pad"
          />
          <TextInput
            style={[styles.input, { flex: 1, borderColor: themeColors.border, color: themeColors.text, backgroundColor: themeColors.card }]}
            placeholder="Relationship"
            placeholderTextColor={themeColors.muted}
            value={newRelationship}
            onChangeText={setNewRelationship}
          />
        </View>
        <TouchableOpacity 
          style={[styles.addButton, { backgroundColor: themeColors.tint }]}
          onPress={handleAdd}
        >
          <Text style={styles.addButtonText}>Add Contact</Text>
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1, padding: Spacing.lg }}>
        <Text style={[styles.sectionTitle, { color: themeColors.text, marginBottom: Spacing.md }]}>Your Contacts</Text>
        {loading ? (
          <ActivityIndicator size="large" color={themeColors.tint} />
        ) : (
          <FlatList
            data={contacts}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={[styles.contactCard, { backgroundColor: themeColors.card, borderColor: item.isPrimary ? themeColors.tint : themeColors.border }]}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={[styles.contactName, { color: themeColors.text }]}>{item.name}</Text>
                    {item.isPrimary && (
                      <View style={[styles.primaryBadge, { backgroundColor: themeColors.tint }]}>
                        <Text style={styles.primaryText}>PRIMARY</Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ color: themeColors.muted }}>{item.relationship} • {item.phone}</Text>
                </View>
                <View style={styles.actions}>
                  {!item.isPrimary && (
                    <TouchableOpacity onPress={() => setPrimary(item.id)}>
                      <Text style={{ color: themeColors.tint, fontWeight: '600' }}>Make Primary</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => deleteContact(item.id)}>
                    <Text style={{ color: themeColors.emergency, fontWeight: '600' }}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            ListEmptyComponent={
              <Text style={{ textAlign: 'center', color: themeColors.muted, marginTop: Spacing.xl }}>
                No emergency contacts added yet.
              </Text>
            }
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  addSection: {
    padding: Spacing.lg,
    gap: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm,
  },
  addButton: {
    height: 48,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  contactCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    marginBottom: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    ...Shadows.light,
  },
  contactName: {
    fontSize: 18,
    fontWeight: '700',
  },
  primaryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  primaryText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
  },
  actions: {
    alignItems: 'flex-end',
    gap: 8,
  },
});
