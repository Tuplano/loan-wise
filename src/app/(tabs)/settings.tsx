import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { eq } from 'drizzle-orm';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useState } from 'react';
import Constants from 'expo-constants';
import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LockScreen } from '@/components/lock-screen';
import { PinSetupModal } from '@/components/pin-setup-modal';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { db } from '@/db/client';
import { appSettings, type AppearanceMode } from '@/db/schema';
import { useTheme } from '@/hooks/use-theme';
import { clearPin, setPin } from '@/lib/app-lock';
import { exportBackup, exportPaymentsCsv, importBackup, validateBackup } from '@/lib/backup';
import { CURRENCY_OPTIONS, type CurrencyCode } from '@/lib/currency';
import { ensureNotificationPermission, isNotificationsAvailable } from '@/lib/notifications';

const MIN_DAYS_BEFORE = 1;
const MAX_DAYS_BEFORE = 30;

const APPEARANCE_OPTIONS: { value: AppearanceMode; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export default function SettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { data: categoryList } = useLiveQuery(db.query.categories.findMany());
  const { data: settings } = useLiveQuery(db.query.appSettings.findFirst());

  const [editingProfileField, setEditingProfileField] = useState<'name' | 'email' | null>(null);
  const [profileDraft, setProfileDraft] = useState('');
  const [expandedPicker, setExpandedPicker] = useState<'currency' | 'appearance' | null>(null);
  const [editingInterestRate, setEditingInterestRate] = useState(false);
  const [interestRateDraft, setInterestRateDraft] = useState('');
  const [dataBusy, setDataBusy] = useState(false);
  const [pinSetupVisible, setPinSetupVisible] = useState(false);
  const [verifyToDisableVisible, setVerifyToDisableVisible] = useState(false);

  async function handleToggleReminders(value: boolean) {
    if (!settings) return;
    Haptics.selectionAsync();
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
    Haptics.selectionAsync();
    const next = Math.min(
      MAX_DAYS_BEFORE,
      Math.max(MIN_DAYS_BEFORE, settings.reminderDaysBefore + delta)
    );
    await db.update(appSettings).set({ reminderDaysBefore: next }).where(eq(appSettings.id, settings.id));
  }

  function startEditingProfile(field: 'name' | 'email') {
    if (!settings) return;
    setEditingProfileField(field);
    setProfileDraft(field === 'name' ? settings.displayName : (settings.email ?? ''));
  }

  async function commitProfileEdit() {
    if (!settings || !editingProfileField) return;
    const value = profileDraft.trim();
    if (editingProfileField === 'name') {
      await db
        .update(appSettings)
        .set({ displayName: value || 'You' })
        .where(eq(appSettings.id, settings.id));
    } else {
      await db
        .update(appSettings)
        .set({ email: value || null })
        .where(eq(appSettings.id, settings.id));
    }
    setEditingProfileField(null);
  }

  async function handleSelectCurrency(currency: CurrencyCode) {
    if (!settings) return;
    Haptics.selectionAsync();
    await db.update(appSettings).set({ currency }).where(eq(appSettings.id, settings.id));
    setExpandedPicker(null);
  }

  async function handleSelectAppearance(mode: AppearanceMode) {
    if (!settings) return;
    Haptics.selectionAsync();
    await db.update(appSettings).set({ appearance: mode }).where(eq(appSettings.id, settings.id));
    setExpandedPicker(null);
  }

  function startEditingInterestRate() {
    if (!settings) return;
    setInterestRateDraft(settings.defaultInterestRate ? String(settings.defaultInterestRate) : '');
    setEditingInterestRate(true);
  }

  async function commitInterestRate() {
    if (!settings) return;
    const parsed = Number.parseFloat(interestRateDraft);
    await db
      .update(appSettings)
      .set({ defaultInterestRate: Number.isFinite(parsed) ? Math.max(parsed, 0) : 0 })
      .where(eq(appSettings.id, settings.id));
    setEditingInterestRate(false);
  }

  async function handleExportBackup() {
    if (dataBusy) return;
    setDataBusy(true);
    try {
      await exportBackup();
    } catch (error) {
      Alert.alert('Export failed', error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setDataBusy(false);
    }
  }

  async function handleExportCsv() {
    if (dataBusy) return;
    setDataBusy(true);
    try {
      await exportPaymentsCsv();
    } catch (error) {
      Alert.alert('Export failed', error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setDataBusy(false);
    }
  }

  async function handleImportBackup() {
    if (dataBusy) return;

    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/json',
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;

    setDataBusy(true);
    try {
      const raw = JSON.parse(await new File(result.assets[0].uri).text());
      const validation = validateBackup(raw);
      if (!validation.ok) {
        Alert.alert('Invalid backup', validation.error);
        return;
      }

      Alert.alert(
        'Replace all data?',
        "Importing will delete your current loans, payments, categories, and settings, and replace them with this backup. This can't be undone.",
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Import',
            style: 'destructive',
            onPress: async () => {
              try {
                await importBackup(validation.data);
                Alert.alert('Import complete', 'Your data has been restored from the backup.');
              } catch (error) {
                Alert.alert('Import failed', error instanceof Error ? error.message : 'Something went wrong.');
              }
            },
          },
        ]
      );
    } catch {
      Alert.alert('Invalid backup', 'Could not read that file as a backup.');
    } finally {
      setDataBusy(false);
    }
  }

  function handleToggleAppLock(value: boolean) {
    if (!settings) return;
    Haptics.selectionAsync();
    if (value) {
      setPinSetupVisible(true);
    } else {
      setVerifyToDisableVisible(true);
    }
  }

  async function handlePinSetupComplete(pin: string) {
    if (!settings) return;
    await setPin(pin);
    await db.update(appSettings).set({ appLockEnabled: true }).where(eq(appSettings.id, settings.id));
    setPinSetupVisible(false);
  }

  async function handleDisableVerified() {
    if (!settings) return;
    await clearPin();
    await db.update(appSettings).set({ appLockEnabled: false }).where(eq(appSettings.id, settings.id));
    setVerifyToDisableVisible(false);
  }

  const initials = (settings?.displayName ?? 'You')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'Y';

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <ThemedText type="title">Settings</ThemedText>
          </View>

          <View
            style={[
              styles.profileCard,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}>
            <View style={[styles.avatar, { backgroundColor: theme.primaryDark }]}>
              <ThemedText type="smallBold" style={styles.avatarText}>
                {initials}
              </ThemedText>
            </View>
            <View style={styles.profileFields}>
              {editingProfileField === 'name' ? (
                <TextInput
                  value={profileDraft}
                  onChangeText={setProfileDraft}
                  autoFocus
                  placeholder="Your name"
                  placeholderTextColor={theme.textSecondary}
                  onSubmitEditing={commitProfileEdit}
                  onBlur={commitProfileEdit}
                  style={[styles.profileNameInput, { color: theme.text }]}
                />
              ) : (
                <Pressable onPress={() => startEditingProfile('name')}>
                  <ThemedText type="smallBold" style={styles.profileName}>
                    {settings?.displayName ?? 'You'}
                  </ThemedText>
                </Pressable>
              )}
              {editingProfileField === 'email' ? (
                <TextInput
                  value={profileDraft}
                  onChangeText={setProfileDraft}
                  autoFocus
                  placeholder="you@email.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholderTextColor={theme.textSecondary}
                  onSubmitEditing={commitProfileEdit}
                  onBlur={commitProfileEdit}
                  style={[styles.profileEmailInput, { color: theme.textSecondary }]}
                />
              ) : (
                <Pressable onPress={() => startEditingProfile('email')}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {settings?.email || 'Add email'}
                  </ThemedText>
                </Pressable>
              )}
            </View>
          </View>

          <ThemedText type="sectionLabel" themeColor="textMuted" style={styles.sectionLabel}>
            Preferences
          </ThemedText>
          <View style={[styles.group, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Pressable
              onPress={() => setExpandedPicker(expandedPicker === 'currency' ? null : 'currency')}>
              <View style={[styles.row, { borderBottomColor: theme.divider }]}>
                <IconBadge
                  icon={{ ios: 'coloncurrencysign.circle', android: 'payments', web: 'payments' }}
                  tint={theme.primary}
                  bg={theme.primaryTint}
                />
                <ThemedText style={styles.rowLabel}>Currency</ThemedText>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  {settings?.currency ?? 'PHP'}
                </ThemedText>
                <SymbolView
                  tintColor={theme.textMuted}
                  name={{
                    ios: expandedPicker === 'currency' ? 'chevron.up' : 'chevron.down',
                    android: 'expand_more',
                    web: 'expand_more',
                  }}
                  size={16}
                  style={styles.chevron}
                />
              </View>
            </Pressable>
            {expandedPicker === 'currency' && (
              <View style={[styles.optionRow, { borderBottomColor: theme.divider }]}>
                {CURRENCY_OPTIONS.map((option) => {
                  const selected = settings?.currency === option.code;
                  return (
                    <Pressable key={option.code} onPress={() => handleSelectCurrency(option.code)}>
                      <View
                        style={[
                          styles.optionChip,
                          selected
                            ? { backgroundColor: theme.primary }
                            : { backgroundColor: theme.backgroundElement },
                        ]}>
                        <ThemedText
                          type="smallBold"
                          style={selected ? styles.optionChipTextSelected : undefined}>
                          {option.code}
                        </ThemedText>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}

            <Pressable
              onPress={() => setExpandedPicker(expandedPicker === 'appearance' ? null : 'appearance')}>
              <View
                style={[
                  styles.row,
                  expandedPicker === 'appearance' && { borderBottomColor: theme.divider },
                  expandedPicker !== 'appearance' && styles.rowNoBorder,
                ]}>
                <IconBadge
                  icon={{ ios: 'circle.lefthalf.filled', android: 'contrast', web: 'contrast' }}
                  tint="#6B4FBB"
                  bg="#F0EDF9"
                />
                <ThemedText style={styles.rowLabel}>Appearance</ThemedText>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  {APPEARANCE_OPTIONS.find((o) => o.value === (settings?.appearance ?? 'system'))
                    ?.label ?? 'System'}
                </ThemedText>
                <SymbolView
                  tintColor={theme.textMuted}
                  name={{
                    ios: expandedPicker === 'appearance' ? 'chevron.up' : 'chevron.down',
                    android: 'expand_more',
                    web: 'expand_more',
                  }}
                  size={16}
                  style={styles.chevron}
                />
              </View>
            </Pressable>
            {expandedPicker === 'appearance' && (
              <View style={styles.optionRow}>
                {APPEARANCE_OPTIONS.map((option) => {
                  const selected = (settings?.appearance ?? 'system') === option.value;
                  return (
                    <Pressable key={option.value} onPress={() => handleSelectAppearance(option.value)}>
                      <View
                        style={[
                          styles.optionChip,
                          selected
                            ? { backgroundColor: theme.primary }
                            : { backgroundColor: theme.backgroundElement },
                        ]}>
                        <ThemedText
                          type="smallBold"
                          style={selected ? styles.optionChipTextSelected : undefined}>
                          {option.label}
                        </ThemedText>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>

          <ThemedText type="sectionLabel" themeColor="textMuted" style={styles.sectionLabel}>
            Notifications
          </ThemedText>
          <View style={[styles.group, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={[styles.row, { borderBottomColor: theme.divider }]}>
              <IconBadge
                icon={{ ios: 'bell.fill', android: 'notifications', web: 'notifications' }}
                tint={theme.primary}
                bg={theme.primaryTint}
              />
              <ThemedText style={styles.rowLabel}>Payment reminders</ThemedText>
              <Switch
                value={settings?.remindersEnabled ?? true}
                onValueChange={handleToggleReminders}
                trackColor={{ false: theme.backgroundSelected, true: theme.primary }}
                thumbColor="#ffffff"
              />
            </View>
            <View style={[styles.row, styles.rowNoBorder]}>
              <IconBadge
                icon={{ ios: 'calendar', android: 'event', web: 'event' }}
                tint={theme.primary}
                bg={theme.primaryTint}
              />
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
                <ThemedText type="smallBold" style={styles.stepperValue}>
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
          </View>

          <ThemedText type="sectionLabel" themeColor="textMuted" style={styles.sectionLabel}>
            Loan defaults
          </ThemedText>
          <View style={[styles.group, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={[styles.row, { borderBottomColor: theme.divider }]}>
              <IconBadge
                icon={{ ios: 'percent', android: 'percent', web: 'percent' }}
                tint="#3F5B75"
                bg="#E8EEF4"
              />
              <ThemedText style={styles.rowLabel}>Default interest rate</ThemedText>
              {editingInterestRate ? (
                <TextInput
                  value={interestRateDraft}
                  onChangeText={setInterestRateDraft}
                  autoFocus
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={theme.textSecondary}
                  onSubmitEditing={commitInterestRate}
                  onBlur={commitInterestRate}
                  style={[styles.rateInput, { color: theme.text }]}
                />
              ) : (
                <Pressable onPress={startEditingInterestRate} style={styles.rowValueGroup}>
                  <ThemedText type="smallBold" themeColor="textSecondary">
                    {settings?.defaultInterestRate ?? 0}% / mo
                  </ThemedText>
                  <SymbolView
                    tintColor={theme.textMuted}
                    name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
                    size={14}
                    style={styles.chevron}
                  />
                </Pressable>
              )}
            </View>

            <Pressable onPress={() => router.push('/categories')}>
              <View style={[styles.row, styles.rowNoBorder]}>
                <IconBadge
                  icon={{ ios: 'square.grid.2x2', android: 'grid_view', web: 'grid_view' }}
                  tint={theme.primary}
                  bg={theme.primaryTint}
                />
                <ThemedText style={styles.rowLabel}>Categories</ThemedText>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  {categoryList.length}
                </ThemedText>
                <SymbolView
                  tintColor={theme.textMuted}
                  name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
                  size={14}
                  style={styles.chevron}
                />
              </View>
            </Pressable>
          </View>

          {Platform.OS !== 'web' && (
            <>
              <ThemedText type="sectionLabel" themeColor="textMuted" style={styles.sectionLabel}>
                Data
              </ThemedText>
              <View style={[styles.group, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Pressable onPress={handleExportBackup} disabled={dataBusy}>
                  <View style={[styles.row, { borderBottomColor: theme.divider }]}>
                    <IconBadge
                      icon={{ ios: 'square.and.arrow.up', android: 'ios_share', web: 'ios_share' }}
                      tint={theme.primary}
                      bg={theme.primaryTint}
                    />
                    <ThemedText style={styles.rowLabel}>Export backup</ThemedText>
                    <SymbolView
                      tintColor={theme.textMuted}
                      name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
                      size={14}
                      style={styles.chevron}
                    />
                  </View>
                </Pressable>
                <Pressable onPress={handleExportCsv} disabled={dataBusy}>
                  <View style={[styles.row, { borderBottomColor: theme.divider }]}>
                    <IconBadge
                      icon={{ ios: 'tablecells', android: 'table_chart', web: 'table_chart' }}
                      tint={theme.primary}
                      bg={theme.primaryTint}
                    />
                    <ThemedText style={styles.rowLabel}>Export payments (CSV)</ThemedText>
                    <SymbolView
                      tintColor={theme.textMuted}
                      name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
                      size={14}
                      style={styles.chevron}
                    />
                  </View>
                </Pressable>
                <Pressable onPress={handleImportBackup} disabled={dataBusy}>
                  <View style={[styles.row, styles.rowNoBorder]}>
                    <IconBadge
                      icon={{ ios: 'square.and.arrow.down', android: 'file_download', web: 'file_download' }}
                      tint={theme.danger}
                      bg={theme.dangerTint}
                    />
                    <ThemedText style={styles.rowLabel}>Import backup</ThemedText>
                    <SymbolView
                      tintColor={theme.textMuted}
                      name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
                      size={14}
                      style={styles.chevron}
                    />
                  </View>
                </Pressable>
              </View>
            </>
          )}

          {Platform.OS !== 'web' && (
            <>
              <ThemedText type="sectionLabel" themeColor="textMuted" style={styles.sectionLabel}>
                Security
              </ThemedText>
              <View style={[styles.group, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <View style={[styles.row, styles.rowNoBorder]}>
                  <IconBadge
                    icon={{ ios: 'lock.fill', android: 'lock', web: 'lock' }}
                    tint={theme.danger}
                    bg={theme.dangerTint}
                  />
                  <ThemedText style={styles.rowLabel}>App lock</ThemedText>
                  <Switch
                    value={settings?.appLockEnabled ?? false}
                    onValueChange={handleToggleAppLock}
                    trackColor={{ false: theme.backgroundSelected, true: theme.primary }}
                    thumbColor="#ffffff"
                  />
                </View>
              </View>
            </>
          )}

          <ThemedText type="sectionLabel" themeColor="textMuted" style={styles.sectionLabel}>
            About
          </ThemedText>
          <View style={[styles.group, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={[styles.row, styles.rowNoBorder]}>
              <IconBadge
                icon={{ ios: 'info.circle', android: 'info', web: 'info' }}
                tint={theme.textSecondary}
                bg={theme.backgroundElement}
              />
              <ThemedText style={styles.rowLabel}>About Loan Wise</ThemedText>
              <ThemedText type="smallBold" themeColor="textSecondary">
                v{Constants.expoConfig?.version ?? '1.0.0'}
              </ThemedText>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
      <PinSetupModal
        visible={pinSetupVisible}
        onComplete={handlePinSetupComplete}
        onCancel={() => setPinSetupVisible(false)}
      />
      <Modal
        visible={verifyToDisableVisible}
        animationType="slide"
        onRequestClose={() => setVerifyToDisableVisible(false)}>
        <LockScreen onUnlock={handleDisableVerified} onCancel={() => setVerifyToDisableVisible(false)} />
      </Modal>
    </ThemedView>
  );
}

function IconBadge({
  icon,
  tint,
  bg,
}: {
  icon: SymbolViewProps['name'];
  tint: string;
  bg: string;
}) {
  return (
    <View style={[styles.iconBadge, { backgroundColor: bg }]}>
      <SymbolView tintColor={tint} name={icon} size={16} />
    </View>
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
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    marginHorizontal: Spacing.three,
    borderWidth: 1,
    borderRadius: Radii.card - 2,
    padding: Spacing.three,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 17,
  },
  profileFields: {
    flex: 1,
    gap: 2,
  },
  profileName: {
    fontSize: 17,
  },
  profileNameInput: {
    fontSize: 17,
    fontWeight: '700',
    paddingVertical: 0,
  },
  profileEmailInput: {
    fontSize: 13,
    paddingVertical: 0,
  },
  sectionLabel: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.two,
    paddingTop: Spacing.three,
  },
  group: {
    marginHorizontal: Spacing.three,
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
  rowNoBorder: {
    borderBottomWidth: 0,
  },
  rowLabel: {
    flex: 1,
  },
  chevron: {
    marginLeft: Spacing.one,
  },
  rowValueGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
  },
  optionChip: {
    paddingHorizontal: Spacing.three - 1,
    paddingVertical: Spacing.two - 1,
    borderRadius: Radii.pill,
  },
  optionChipTextSelected: {
    color: '#FFFFFF',
  },
  rateInput: {
    fontSize: 15,
    fontWeight: '700',
    minWidth: 60,
    textAlign: 'right',
    paddingVertical: 0,
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
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
