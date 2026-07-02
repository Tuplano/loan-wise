import { eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { Stack } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radii, Spacing } from '@/constants/theme';
import { db } from '@/db/client';
import { categories } from '@/db/schema';
import { categoryColors } from '@/db/seed';
import { useTheme } from '@/hooks/use-theme';

export default function CategoriesScreen() {
  const theme = useTheme();
  const { data: categoryList } = useLiveQuery(db.query.categories.findMany());

  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(categoryColors[0]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');

  async function handleAdd() {
    const name = newName.trim();
    if (!name) return;
    await db.insert(categories).values({ name, color: newColor });
    setNewName('');
    setNewColor(categoryColors[0]);
  }

  function startEditing(id: number, currentName: string) {
    setEditingId(id);
    setEditingName(currentName);
  }

  async function commitEditing() {
    const name = editingName.trim();
    if (editingId !== null && name) {
      await db.update(categories).set({ name }).where(eq(categories.id, editingId));
    }
    setEditingId(null);
  }

  function handleDelete(id: number, name: string) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert('Delete category', `Delete "${name}"? Loans using it will become uncategorized.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => db.delete(categories).where(eq(categories.id, id)),
      },
    ]);
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: 'Categories' }} />
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={[styles.group, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {categoryList.map((category) => {
              const isEditing = editingId === category.id;
              return (
                <View key={category.id} style={[styles.row, { borderBottomColor: theme.divider }]}>
                  <View style={[styles.dot, { backgroundColor: category.color ?? undefined }]} />
                  {isEditing ? (
                    <TextInput
                      value={editingName}
                      onChangeText={setEditingName}
                      autoFocus
                      onSubmitEditing={commitEditing}
                      onBlur={commitEditing}
                      style={[styles.editInput, { color: theme.text }]}
                    />
                  ) : (
                    <Pressable
                      style={styles.rowLabel}
                      onPress={() => startEditing(category.id, category.name)}>
                      <ThemedText>{category.name}</ThemedText>
                    </Pressable>
                  )}
                  <Pressable
                    hitSlop={8}
                    onPress={() => handleDelete(category.id, category.name)}
                    style={({ pressed }) => pressed && styles.pressed}>
                    <SymbolView
                      tintColor={theme.textSecondary}
                      name={{ ios: 'trash', android: 'delete', web: 'delete' }}
                      size={18}
                    />
                  </Pressable>
                </View>
              );
            })}

            <View style={styles.addRowGroup}>
              <View style={styles.colorRow}>
                {categoryColors.map((color) => (
                  <Pressable key={color} onPress={() => setNewColor(color)}>
                    <View
                      style={[
                        styles.colorSwatch,
                        { backgroundColor: color },
                        newColor === color && [styles.colorSwatchSelected, { borderColor: color }],
                      ]}
                    />
                  </Pressable>
                ))}
              </View>
              <View style={styles.addRow}>
                <TextInput
                  value={newName}
                  onChangeText={setNewName}
                  placeholder="Add category"
                  placeholderTextColor={theme.textSecondary}
                  onSubmitEditing={handleAdd}
                  style={[styles.input, { color: theme.text }]}
                />
                <Pressable onPress={handleAdd} hitSlop={8}>
                  <SymbolView
                    tintColor={theme.primary}
                    name={{ ios: 'plus.circle.fill', android: 'add_circle', web: 'add_circle' }}
                    size={26}
                  />
                </Pressable>
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.three,
  },
  group: {
    borderRadius: Radii.card - 2,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 2,
    paddingVertical: Spacing.three - 2,
    paddingHorizontal: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: {
    flex: 1,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  editInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 0,
  },
  pressed: {
    opacity: 0.6,
  },
  addRowGroup: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  colorRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  colorSwatch: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  colorSwatchSelected: {
    borderWidth: 2,
  },
  addRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    fontSize: 16,
  },
});
