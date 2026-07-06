import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { Calendar, type DateData } from 'react-native-calendars';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, ManropeFamily, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { db } from '@/db/client';
import { useDisplayMoney } from '@/hooks/use-display-money';
import { useEffectiveColorScheme } from '@/hooks/use-effective-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { buildCalendarMonth, toCalendarDateString } from '@/lib/calendar';
import { formatDate, isSameDay } from '@/lib/date';
import { startOfToday } from '@/lib/loan-status';
import { isSameMonth, startOfMonth } from '@/lib/stats';

export default function CalendarScreen() {
  const theme = useTheme();
  const colorScheme = useEffectiveColorScheme();
  const { format } = useDisplayMoney();
  const router = useRouter();
  const today = startOfToday();

  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(today));
  const [selectedDate, setSelectedDate] = useState(today);

  const { data: loanList } = useLiveQuery(
    db.query.loans.findMany({ with: { payments: true, transactions: true } })
  );

  const days = useMemo(
    () => buildCalendarMonth(visibleMonth, loanList),
    [visibleMonth, loanList]
  );
  const selectedDay = days.find((day) => isSameDay(day.date, selectedDate));

  const markedDates = useMemo(() => {
    const marks: Record<
      string,
      { dots?: { key: string; color: string }[]; selected?: boolean; selectedColor?: string }
    > = {};

    for (const day of days) {
      const unpaidDue = day.dueEntries.filter((entry) => !entry.isPaid);
      const dueColor =
        unpaidDue.length === 0
          ? null
          : day.date.getTime() < today.getTime()
            ? theme.danger
            : theme.warning;
      const dots: { key: string; color: string }[] = [];
      if (dueColor) dots.push({ key: 'due', color: dueColor });
      if (day.paidEntries.length > 0) dots.push({ key: 'paid', color: theme.success });
      if (dots.length > 0) marks[toCalendarDateString(day.date)] = { dots };
    }

    const selectedKey = toCalendarDateString(selectedDate);
    marks[selectedKey] = { ...marks[selectedKey], selected: true, selectedColor: theme.primary };
    return marks;
  }, [days, selectedDate, theme, today]);

  function handleMonthChange(month: DateData) {
    const nextMonth = new Date(month.year, month.month - 1, 1);
    setVisibleMonth(nextMonth);
    setSelectedDate((current) =>
      isSameMonth(current, nextMonth) ? current : isSameMonth(nextMonth, today) ? today : nextMonth
    );
  }

  function handleDayPress(day: DateData) {
    setSelectedDate(new Date(day.year, day.month - 1, day.day));
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <View style={[styles.calendarCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Calendar
              // react-native-calendars caches each day cell's colors in a ref on first mount and
              // never recomputes them, so a remount (via key) is required when the theme flips.
              key={colorScheme}
              current={toCalendarDateString(visibleMonth)}
              markedDates={markedDates}
              markingType="multi-dot"
              showSixWeeks
              enableSwipeMonths
              onDayPress={handleDayPress}
              onMonthChange={handleMonthChange}
              theme={{
                calendarBackground: theme.card,
                textSectionTitleColor: theme.textMuted,
                selectedDayBackgroundColor: theme.primary,
                selectedDayTextColor: '#FFFFFF',
                todayTextColor: theme.primary,
                dayTextColor: theme.text,
                textDisabledColor: theme.textMuted,
                textInactiveColor: theme.textMuted,
                monthTextColor: theme.text,
                arrowColor: theme.textSecondary,
                dotColor: theme.primary,
                selectedDotColor: '#FFFFFF',
                textMonthFontFamily: ManropeFamily[700],
                textDayFontFamily: ManropeFamily[500],
                textDayHeaderFontFamily: ManropeFamily[600],
                textMonthFontSize: 16,
                textDayFontSize: 14,
                textDayHeaderFontSize: 12,
              }}
              style={styles.calendar}
            />
          </View>

          <View style={styles.legendRow}>
            <LegendItem color={theme.warning} label="Due" />
            <LegendItem color={theme.danger} label="Overdue" />
            <LegendItem color={theme.success} label="Paid" />
          </View>

          <View style={styles.agendaHeader}>
            <ThemedText type="smallBold" style={styles.agendaTitle}>
              {formatDate(selectedDate)}
            </ThemedText>
          </View>

          {!selectedDay ||
          (selectedDay.dueEntries.length === 0 && selectedDay.paidEntries.length === 0) ? (
            <ThemedText themeColor="textSecondary" style={styles.emptyAgenda}>
              Nothing due or paid on this day.
            </ThemedText>
          ) : (
            <View style={styles.agendaList}>
              {selectedDay.dueEntries.map((entry, index) => (
                <Pressable
                  key={`due-${index}`}
                  onPress={() => router.push(`/loan/${entry.loanId}`)}
                  style={({ pressed }) => pressed && styles.pressed}>
                  <View
                    style={[
                      styles.agendaRow,
                      { backgroundColor: theme.card, borderColor: theme.border },
                    ]}>
                    <View
                      style={[
                        styles.agendaIcon,
                        { backgroundColor: entry.isPaid ? theme.successTint : theme.warningTint },
                      ]}>
                      <SymbolView
                        tintColor={entry.isPaid ? theme.success : theme.warning}
                        name={
                          entry.isPaid
                            ? { ios: 'checkmark', android: 'check', web: 'check' }
                            : { ios: 'clock', android: 'schedule', web: 'schedule' }
                        }
                        size={14}
                      />
                    </View>
                    <View style={styles.agendaLeading}>
                      <ThemedText type="smallBold" numberOfLines={1}>
                        {entry.loanName}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {entry.isPaid ? 'Due · settled' : 'Due'}
                      </ThemedText>
                    </View>
                    <ThemedText
                      type="smallBold"
                      numeric
                      style={{ color: entry.isPaid ? theme.primaryDark : theme.warning }}>
                      {format(entry.amountCents)}
                    </ThemedText>
                  </View>
                </Pressable>
              ))}

              {selectedDay.paidEntries.map((entry, index) => (
                <Pressable
                  key={`paid-${index}`}
                  onPress={() => router.push(`/loan/${entry.loanId}`)}
                  style={({ pressed }) => pressed && styles.pressed}>
                  <View
                    style={[
                      styles.agendaRow,
                      { backgroundColor: theme.card, borderColor: theme.border },
                    ]}>
                    <View style={[styles.agendaIcon, { backgroundColor: theme.successTint }]}>
                      <SymbolView
                        tintColor={theme.success}
                        name={
                          entry.kind === 'extra'
                            ? { ios: 'plus', android: 'add', web: 'add' }
                            : { ios: 'checkmark', android: 'check', web: 'check' }
                        }
                        size={14}
                      />
                    </View>
                    <View style={styles.agendaLeading}>
                      <ThemedText type="smallBold" numberOfLines={1}>
                        {entry.loanName}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {entry.kind === 'extra' ? 'Extra payment' : 'Paid'}
                      </ThemedText>
                    </View>
                    <ThemedText type="smallBold" numeric style={{ color: theme.primaryDark }}>
                      {format(entry.amountCents)}
                    </ThemedText>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
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
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
  },
  pressed: {
    opacity: 0.6,
  },
  calendarCard: {
    borderWidth: 1,
    borderRadius: Radii.card,
    overflow: 'hidden',
    paddingBottom: Spacing.one,
  },
  calendar: {
    borderRadius: Radii.card,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    marginTop: Spacing.three,
    marginBottom: Spacing.three,
    paddingHorizontal: Spacing.two,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  agendaHeader: {
    marginBottom: Spacing.two,
  },
  agendaTitle: {
    fontSize: 15,
  },
  emptyAgenda: {
    paddingVertical: Spacing.two,
  },
  agendaList: {
    gap: Spacing.two,
  },
  agendaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 2,
    borderWidth: 1,
    borderRadius: Radii.row,
    padding: Spacing.three - 2,
  },
  agendaIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agendaLeading: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
});
