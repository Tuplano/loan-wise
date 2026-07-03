import { LinearGradient } from 'expo-linear-gradient';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import { DateField } from '@/components/ui/date-field';
import { PrimaryButton } from '@/components/ui/primary-button';
import { Radii, Spacing } from '@/constants/theme';
import { db } from '@/db/client';
import { useAppSettings } from '@/hooks/use-app-settings';
import { useTheme } from '@/hooks/use-theme';
import { BASE_CURRENCY } from '@/lib/exchange-rates';
import { formatMoney } from '@/lib/format';

function toCents(value: string) {
  const amount = Number.parseFloat(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) : null;
}

export type LoanFormValues = {
  name: string;
  lender: string | null;
  categoryId: number | null;
  principalCents: number;
  monthlyPaymentCents: number;
  interestRate: number;
  termMonths: number;
  notes: string | null;
  startDate: Date;
  firstPaymentDate: Date;
};

export type LoanFormInitialValues = {
  name: string;
  lender: string | null;
  categoryId: number | null;
  principal: string;
  termMonths: string;
  interestRate: string;
  notes: string | null;
  startDate: Date;
  firstPaymentDate: Date;
};

type LoanFormProps = {
  title: string;
  submitLabel?: string;
  initialValues?: LoanFormInitialValues;
  onSubmit: (values: LoanFormValues) => Promise<void>;
};

export function LoanForm({ title, submitLabel = 'Save loan', initialValues, onSubmit }: LoanFormProps) {
  const theme = useTheme();
  const { data: categories } = useLiveQuery(db.query.categories.findMany());
  const settings = useAppSettings();
  // Loans are always entered/stored in the app's fixed base currency — the display currency
  // in Settings only affects how amounts are shown elsewhere, via a live conversion.
  const currency = BASE_CURRENCY;

  const [name, setName] = useState(initialValues?.name ?? '');
  const [lender, setLender] = useState(initialValues?.lender ?? '');
  const [categoryId, setCategoryId] = useState<number | null>(initialValues?.categoryId ?? null);
  const [principal, setPrincipal] = useState(initialValues?.principal ?? '');
  const [interestRate, setInterestRate] = useState(initialValues?.interestRate ?? '');
  const [termMonths, setTermMonths] = useState(initialValues?.termMonths ?? '');
  const [notes, setNotes] = useState(initialValues?.notes ?? '');
  const [startDate, setStartDate] = useState(initialValues?.startDate ?? new Date());
  const [firstPaymentDate, setFirstPaymentDate] = useState(
    initialValues?.firstPaymentDate ?? new Date()
  );
  const [submitting, setSubmitting] = useState(false);

  // Prefill new loans with the user's default interest rate once settings load —
  // only when adding (no initialValues) and the user hasn't typed anything yet.
  useEffect(() => {
    if (!initialValues && interestRate === '' && settings && settings.defaultInterestRate > 0) {
      setInterestRate(String(settings.defaultInterestRate));
    }
  }, [settings]);

  const principalCents = toCents(principal);
  const termMonthsValue = Number.parseInt(termMonths, 10);
  const monthlyRate = (Number.parseFloat(interestRate) || 0) / 100;

  const hasValidTerm = Number.isFinite(termMonthsValue) && termMonthsValue > 0;
  const basePaymentCents =
    principalCents !== null && hasValidTerm ? Math.round(principalCents / termMonthsValue) : null;
  const interestPaymentCents =
    principalCents !== null ? Math.round(principalCents * monthlyRate) : null;

  // Flat monthly interest: principal / term, plus interest charged on the full
  // principal each month (not a reducing-balance amortization).
  const monthlyPaymentCents =
    basePaymentCents !== null && interestPaymentCents !== null
      ? basePaymentCents + interestPaymentCents
      : null;

  const isValid =
    name.trim().length > 0 &&
    principalCents !== null &&
    principalCents > 0 &&
    monthlyPaymentCents !== null &&
    monthlyPaymentCents > 0 &&
    hasValidTerm;

  async function handleSubmit() {
    if (!isValid || submitting) return;
    setSubmitting(true);

    await onSubmit({
      name: name.trim(),
      lender: lender.trim() || null,
      categoryId,
      principalCents: principalCents!,
      monthlyPaymentCents: monthlyPaymentCents!,
      interestRate: Number.parseFloat(interestRate) || 0,
      termMonths: termMonthsValue,
      notes: notes.trim() || null,
      startDate,
      firstPaymentDate,
    });

    setSubmitting(false);
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title }} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.formContent}
          keyboardShouldPersistTaps="handled">
          <LinearGradient
            colors={['#14855F', '#0B5D42']}
            start={{ x: 0.15, y: 0 }}
            end={{ x: 0.85, y: 1 }}
            style={styles.heroCard}>
            <ThemedText type="small" style={styles.heroLabel}>
              Computed monthly payment
            </ThemedText>
            <ThemedText type="display" numeric style={styles.heroValue}>
              {monthlyPaymentCents !== null ? formatMoney(monthlyPaymentCents, currency) : '—'}
            </ThemedText>
            <View style={styles.heroBreakdownRow}>
              <View style={styles.heroBreakdownItem}>
                <ThemedText type="small" style={styles.heroLabel}>
                  Base ÷ term
                </ThemedText>
                <ThemedText type="smallBold" numeric style={styles.heroBreakdownValue}>
                  {basePaymentCents !== null ? formatMoney(basePaymentCents, currency) : '—'}
                </ThemedText>
              </View>
              <View style={styles.heroBreakdownItem}>
                <ThemedText type="small" style={styles.heroLabel}>
                  Interest {interestRate || 0}%
                </ThemedText>
                <ThemedText type="smallBold" numeric style={styles.heroBreakdownValue}>
                  {interestPaymentCents !== null ? `+ ${formatMoney(interestPaymentCents, currency)}` : '—'}
                </ThemedText>
              </View>
            </View>
          </LinearGradient>

          <ThemedText type="small" themeColor="textMuted" style={styles.baseCurrencyHint}>
            Loans are entered and stored in {BASE_CURRENCY}. Your display currency in Settings
            converts amounts for viewing everywhere else.
          </ThemedText>

          <Field label="Loan name">
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Car loan"
              placeholderTextColor={theme.textSecondary}
              style={[
                styles.input,
                { color: theme.text, borderColor: theme.border, backgroundColor: theme.card },
              ]}
            />
          </Field>

          <Field label="Lender (optional)">
            <TextInput
              value={lender}
              onChangeText={setLender}
              placeholder="Bank of America"
              placeholderTextColor={theme.textSecondary}
              style={[
                styles.input,
                { color: theme.text, borderColor: theme.border, backgroundColor: theme.card },
              ]}
            />
          </Field>

          <Field label="Category">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              {categories.map((category) => {
                const selected = categoryId === category.id;
                return (
                  <Pressable
                    key={category.id}
                    onPress={() => setCategoryId(selected ? null : category.id)}>
                    <View
                      style={[
                        styles.chip,
                        selected
                          ? { backgroundColor: theme.primary }
                          : { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border },
                      ]}>
                      {category.color && !selected && (
                        <View style={[styles.chipDot, { backgroundColor: category.color }]} />
                      )}
                      <ThemedText
                        type="smallBold"
                        style={selected ? styles.chipTextSelected : undefined}>
                        {category.name}
                      </ThemedText>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Field>

          <View style={styles.row}>
            <View style={styles.flex}>
              <DateField label="Start date" value={startDate} onChange={setStartDate} />
            </View>
            <View style={styles.flex}>
              <DateField
                label="First payment due"
                value={firstPaymentDate}
                onChange={setFirstPaymentDate}
              />
            </View>
          </View>

          <View style={styles.row}>
            <Field label={`Principal (${BASE_CURRENCY})`} style={styles.flex}>
              <TextInput
                value={principal}
                onChangeText={setPrincipal}
                placeholder="10000"
                keyboardType="decimal-pad"
                placeholderTextColor={theme.textSecondary}
                style={[
                  styles.input,
                  { color: theme.text, borderColor: theme.border, backgroundColor: theme.card },
                ]}
              />
            </Field>
            <Field label="Term (months)" style={styles.flex}>
              <TextInput
                value={termMonths}
                onChangeText={setTermMonths}
                placeholder="48"
                keyboardType="number-pad"
                placeholderTextColor={theme.textSecondary}
                style={[
                  styles.input,
                  { color: theme.text, borderColor: theme.border, backgroundColor: theme.card },
                ]}
              />
            </Field>
          </View>

          <Field label="Monthly interest rate % (optional)">
            <TextInput
              value={interestRate}
              onChangeText={setInterestRate}
              placeholder="1.5"
              keyboardType="decimal-pad"
              placeholderTextColor={theme.textSecondary}
              style={[
                styles.input,
                { color: theme.text, borderColor: theme.border, backgroundColor: theme.card },
              ]}
            />
          </Field>

          <Field label="Notes (optional)">
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Anything worth remembering about this loan"
              placeholderTextColor={theme.textSecondary}
              multiline
              numberOfLines={3}
              style={[
                styles.input,
                styles.notesInput,
                { color: theme.text, borderColor: theme.border, backgroundColor: theme.card },
              ]}
            />
          </Field>
        </ScrollView>

        <View style={[styles.footer, { backgroundColor: theme.background, borderTopColor: theme.border }]}>
          <PrimaryButton
            label={submitLabel}
            onPress={handleSubmit}
            disabled={!isValid}
            loading={submitting}
            size="large"
          />
        </View>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

function Field({
  label,
  children,
  style,
}: {
  label: string;
  children: React.ReactNode;
  style?: object;
}) {
  return (
    <View style={[styles.field, style]}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {label}
      </ThemedText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  formContent: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
  heroCard: {
    borderRadius: Radii.card,
    padding: Spacing.three + 2,
    marginBottom: Spacing.one,
    shadowColor: '#0B5D42',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  heroLabel: {
    color: 'rgba(255,255,255,0.75)',
  },
  baseCurrencyHint: {
    marginTop: -Spacing.two,
  },
  heroValue: {
    color: '#FFFFFF',
    marginTop: 2,
    marginBottom: Spacing.two,
  },
  heroBreakdownRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  heroBreakdownItem: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: Radii.row - 6,
    padding: Spacing.two + 1,
  },
  heroBreakdownValue: {
    color: '#FFFFFF',
    marginTop: 2,
  },
  field: {
    gap: Spacing.one + 1,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  input: {
    borderWidth: 1,
    borderRadius: Radii.input,
    paddingHorizontal: Spacing.three - 1,
    height: 50,
    fontSize: 15,
    fontWeight: '700',
  },
  notesInput: {
    minHeight: 80,
    height: undefined,
    paddingVertical: Spacing.two + 1,
    textAlignVertical: 'top',
  },
  chipRow: {
    flexDirection: 'row',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three - 1,
    paddingVertical: Spacing.two + 1,
    borderRadius: Radii.row - 6,
    marginRight: Spacing.two,
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
  chipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  footer: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
