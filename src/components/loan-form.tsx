import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { Stack } from 'expo-router';
import { useState } from 'react';
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

import { Spacing } from '@/constants/theme';
import { db } from '@/db/client';
import { useTheme } from '@/hooks/use-theme';
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
};

export type LoanFormInitialValues = {
  name: string;
  lender: string | null;
  categoryId: number | null;
  principal: string;
  termMonths: string;
  interestRate: string;
  notes: string | null;
};

type LoanFormProps = {
  title: string;
  submitLabel?: string;
  initialValues?: LoanFormInitialValues;
  onSubmit: (values: LoanFormValues) => Promise<void>;
};

export function LoanForm({ title, submitLabel = 'Save', initialValues, onSubmit }: LoanFormProps) {
  const theme = useTheme();
  const { data: categories } = useLiveQuery(db.query.categories.findMany());

  const [name, setName] = useState(initialValues?.name ?? '');
  const [lender, setLender] = useState(initialValues?.lender ?? '');
  const [categoryId, setCategoryId] = useState<number | null>(initialValues?.categoryId ?? null);
  const [principal, setPrincipal] = useState(initialValues?.principal ?? '');
  const [interestRate, setInterestRate] = useState(initialValues?.interestRate ?? '');
  const [termMonths, setTermMonths] = useState(initialValues?.termMonths ?? '');
  const [notes, setNotes] = useState(initialValues?.notes ?? '');
  const [submitting, setSubmitting] = useState(false);

  const principalCents = toCents(principal);
  const termMonthsValue = Number.parseInt(termMonths, 10);
  const monthlyRate = (Number.parseFloat(interestRate) || 0) / 100;

  // Flat monthly interest: principal / term, plus interest charged on the full
  // principal each month (not a reducing-balance amortization).
  const monthlyPaymentCents =
    principalCents !== null && Number.isFinite(termMonthsValue) && termMonthsValue > 0
      ? Math.round(principalCents / termMonthsValue + principalCents * monthlyRate)
      : null;

  const isValid =
    name.trim().length > 0 &&
    principalCents !== null &&
    principalCents > 0 &&
    monthlyPaymentCents !== null &&
    monthlyPaymentCents > 0 &&
    Number.isFinite(termMonthsValue) &&
    termMonthsValue > 0;

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
    });

    setSubmitting(false);
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          title,
          headerRight: () => (
            <Pressable onPress={handleSubmit} disabled={!isValid || submitting}>
              <ThemedText
                type="linkPrimary"
                style={!isValid || submitting ? styles.disabledSave : undefined}>
                {submitLabel}
              </ThemedText>
            </Pressable>
          ),
        }}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.formContent}
          keyboardShouldPersistTaps="handled">
          <Field label="Loan name">
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Car loan"
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
            />
          </Field>

          <Field label="Lender (optional)">
            <TextInput
              value={lender}
              onChangeText={setLender}
              placeholder="Bank of America"
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
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
                    <ThemedView
                      type={selected ? 'backgroundSelected' : 'backgroundElement'}
                      style={styles.chip}>
                      {category.color && (
                        <View style={[styles.chipDot, { backgroundColor: category.color }]} />
                      )}
                      <ThemedText type="small">{category.name}</ThemedText>
                    </ThemedView>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Field>

          <View style={styles.row}>
            <Field label="Principal" style={styles.flex}>
              <TextInput
                value={principal}
                onChangeText={setPrincipal}
                placeholder="10000"
                keyboardType="decimal-pad"
                placeholderTextColor={theme.textSecondary}
                style={[
                  styles.input,
                  { color: theme.text, borderColor: theme.backgroundSelected },
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
                  { color: theme.text, borderColor: theme.backgroundSelected },
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
              style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
            />
          </Field>

          <View style={styles.summaryRow}>
            <ThemedText type="small" themeColor="textSecondary">
              Monthly payment
            </ThemedText>
            <ThemedText type="subtitle">
              {monthlyPaymentCents !== null ? formatMoney(monthlyPaymentCents) : '—'}
            </ThemedText>
          </View>

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
                { color: theme.text, borderColor: theme.backgroundSelected },
              ]}
            />
          </Field>
        </ScrollView>
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
      <ThemedText type="small" themeColor="textSecondary">
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
    padding: Spacing.four,
    gap: Spacing.four,
  },
  field: {
    gap: Spacing.one,
  },
  summaryRow: {
    alignItems: 'center',
    gap: Spacing.half,
    paddingVertical: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  notesInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  chipRow: {
    flexDirection: 'row',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    marginRight: Spacing.two,
  },
  chipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  disabledSave: {
    opacity: 0.4,
  },
});
