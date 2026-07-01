import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { eq } from 'drizzle-orm';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { db } from '@/db/client';
import { appSettings, categories } from '@/db/schema';
import { categoryColors } from '@/db/seed';
import { useTheme } from '@/hooks/use-theme';
import { ensureNotificationPermission, isNotificationsAvailable } from '@/lib/notifications';

const MIN_DAYS_BEFORE = 1;
const MAX_DAYS_BEFORE = 30;

export default function SettingsScreen() {
  const theme = useTheme();
  const { data: categoryList } = useLiveQuery(db.query.categories.findMany());
  const { data: settings } = useLiveQuery(db.query.appSettings.findFirst());

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

  async function handleToggleReminders(value: boolean) {
    if (!settings) return;
    if (value) {
      if (!isNotificationsAvailable()) {
        Alert.alert(
          'Reminders unavailable',
          'Local notifications require a development build here — they were removed from Expo Go on Android. This will work once the app is built outside Expo Go.'
        );
        return;
      }
      const granted = await ensureNotificationPermission();
      if (!granted) {
        Alert.alert(
          'Notifications disabled',
          'Enable notifications for Loan Wise in your device settings to get payment reminders.'
        );
        return;
      }
    }
    await db.update(appSettings).set({ remindersEnabled: value }).where(eq(appSettings.id, settings.id));
  }

  async function handleDaysBeforeChange(delta: number) {
    if (!settings) return;
    const next = Math.min(
      MAX_DAYS_BEFORE,
      Math.max(MIN_DAYS_BEFORE, settings.reminderDaysBefore + delta)
    );
    await db.update(appSettings).set({ reminderDaysBefore: next }).where(eq(appSettings.id, settings.id));
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <ThemedText type="subtitle">Settings</ThemedText>
          </View>

          <ThemedText type="small" themeColor="textSecondary" style={styles.sectionLabel}>
            Categories
          </ThemedText>
          <ThemedView type="backgroundElement" style={styles.group}>
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

            <View style={styles.addRowGroup}>
              <View style={styles.colorRow}>
                {categoryColors.map((color) => (
                  <Pressable key={color} onPress={() => setNewColor(color)}>
                    <View
                      style={[
                        styles.colorSwatch,
                        { backgroundColor: color },
                        newColor === color && [
                          styles.colorSwatchSelected,
                          { borderColor: color },
                        ],
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
                    tintColor={theme.text}
                    name={{ ios: 'plus.circle.fill', android: 'add_circle', web: 'add_circle' }}
                    size={26}
                  />
                </Pressable>
              </View>
            </View>
          </ThemedView>

          <ThemedText type="small" themeColor="textSecondary" style={styles.sectionLabel}>
            Notifications
          </ThemedText>
          <ThemedView type="backgroundElement" style={styles.group}>
            <View style={[styles.row, { borderBottomColor: theme.backgroundSelected }]}>
              <ThemedText style={styles.rowLabel}>Payment reminders</ThemedText>
              <Switch
                value={settings?.remindersEnabled ?? true}
                onValueChange={handleToggleReminders}
                trackColor={{ false: theme.backgroundSelected, true: '#208AEF' }}
                thumbColor="#ffffff"
              />
            </View>
            <View style={styles.row}>
              <ThemedText style={styles.rowLabel}>Remind me before due date</ThemedText>
              <View style={styles.stepper}>
                <Pressable
                  hitSlop={8}
                  onPress={() => handleDaysBeforeChange(-1)}
                  style={({ pressed }) => pressed && styles.pressed}>
                  <SymbolView
                    tintColor={theme.text}
                    name={{ ios: 'minus.circle', android: 'remove_circle', web: 'remove_circle' }}
                    size={22}
                  />
                </Pressable>
                <ThemedText style={styles.stepperValue}>
                  {settings?.reminderDaysBefore ?? 3}d
                </ThemedText>
                <Pressable
                  hitSlop={8}
                  onPress={() => handleDaysBeforeChange(1)}
                  style={({ pressed }) => pressed && styles.pressed}>
                  <SymbolView
                    tintColor={theme.text}
                    name={{ ios: 'plus.circle', android: 'add_circle', web: 'add_circle' }}
                    size={22}
                  />
                </Pressable>
              </View>
            </View>
          </ThemedView>
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
    alignItems: 'center',
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  scrollContent: {
    paddingBottom: BottomTabInset + Spacing.four,
  },
  header: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  sectionLabel: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.one,
    paddingTop: Spacing.three,
  },
  group: {
    marginHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
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
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  stepperValue: {
    minWidth: 28,
    textAlign: 'center',
  },
});
