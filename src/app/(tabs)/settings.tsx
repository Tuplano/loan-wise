import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { eq } from 'drizzle-orm';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { db } from '@/db/client';
import { categories } from '@/db/schema';
import { categoryColors } from '@/db/seed';
import { useTheme } from '@/hooks/use-theme';

export default function SettingsScreen() {
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
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.content}>
          <View style={styles.header}>
            <ThemedText type="subtitle">Settings</ThemedText>
          </View>

          <ThemedText type="small" themeColor="textSecondary" style={styles.sectionLabel}>
            Categories
          </ThemedText>

          <View style={styles.list}>
            {categoryList.map((category) => {
              const isEditing = editingId === category.id;
              return (
                <View
                  key={category.id}
                  style={[styles.row, { borderBottomColor: theme.backgroundSelected }]}>
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
          </View>

          <View style={styles.addSection}>
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
                placeholder="New category"
                placeholderTextColor={theme.textSecondary}
                onSubmitEditing={handleAdd}
                style={[
                  styles.input,
                  { color: theme.text, borderColor: theme.backgroundSelected },
                ]}
              />
              <Pressable onPress={handleAdd} style={({ pressed }) => pressed && styles.pressed}>
                <ThemedView type="backgroundElement" style={styles.addButton}>
                  <SymbolView
                    tintColor={theme.text}
                    name={{ ios: 'plus', android: 'add', web: 'add' }}
                    size={18}
                  />
                </ThemedView>
              </Pressable>
            </View>
          </View>
        </View>
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
    alignItems: 'center',
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingBottom: BottomTabInset + Spacing.three,
  },
  header: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  sectionLabel: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.one,
  },
  list: {
    paddingHorizontal: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.one,
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
  addSection: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
  },
  colorRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  colorSwatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
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
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
