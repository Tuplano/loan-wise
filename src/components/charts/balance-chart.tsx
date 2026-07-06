import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, View, Pressable } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { categoryColors } from '@/db/seed';
import { useDisplayMoney } from '@/hooks/use-display-money';
import { useTheme } from '@/hooks/use-theme';
import { formatCompactMoney, formatMoney } from '@/lib/format';

import type { LoanBalanceLine } from '@/lib/analytics';

const CHART_HEIGHT = 180;
const Y_AXIS_LABEL_WIDTH = 44;
const MAX_X_LABELS = 4;
const TOOLTIP_WIDTH = 152;
const FADE_DURATION = 280;

/** Window width in months, or null for the full timeline. Windows are centered on "today"
 * (the actual/projected boundary) rather than trailing, since projected months matter as much
 * as history here. */
const RANGE_OPTIONS: { key: string; label: string; months: number | null }[] = [
  { key: '3m', label: '3M', months: 3 },
  { key: '6m', label: '6M', months: 6 },
  { key: '1y', label: '1Y', months: 12 },
  { key: 'all', label: 'All', months: null },
];

function monthTick(date: Date) {
  return date.toLocaleDateString('en-PH', { month: 'short', year: '2-digit' });
}

function fullDate(date: Date) {
  return date.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
}

/** Evenly spaced point indices to label on the x-axis, so a long timeline doesn't crowd every tick. */
function pickLabelIndices(pointCount: number, maxLabels: number): Set<number> {
  if (pointCount <= 1) return new Set([0]);
  const n = Math.min(pointCount, maxLabels);
  const span = pointCount - 1;
  return new Set(Array.from({ length: n }, (_, i) => Math.round((i * span) / (n - 1))));
}

/** Inclusive [start, end] slice centered on `anchorIndex`, clamped to the available months. */
function computeRangeWindow(monthCount: number, anchorIndex: number, windowMonths: number | null) {
  if (windowMonths === null || windowMonths >= monthCount) return { start: 0, end: monthCount - 1 };
  const before = Math.floor((windowMonths - 1) / 2);
  const after = windowMonths - 1 - before;
  let start = anchorIndex - before;
  let end = anchorIndex + after;
  if (start < 0) {
    end -= start;
    start = 0;
  }
  if (end > monthCount - 1) {
    start -= end - (monthCount - 1);
    end = monthCount - 1;
  }
  return { start: Math.max(start, 0), end: Math.min(end, monthCount - 1) };
}

type BalanceChartProps = {
  lines: LoanBalanceLine[];
};

export function BalanceChart({ lines }: BalanceChartProps) {
  const theme = useTheme();
  const { rate, currency } = useDisplayMoney();
  const [width, setWidth] = useState(0);
  const [hiddenLoanIds, setHiddenLoanIds] = useState<Set<number>>(new Set());
  const [rangeKey, setRangeKey] = useState('all');

  const coloredLines = useMemo(
    () => lines.map((line, index) => ({ ...line, color: line.color ?? categoryColors[index % categoryColors.length] })),
    [lines]
  );

  function handleLayout(event: LayoutChangeEvent) {
    setWidth(event.nativeEvent.layout.width);
  }

  function toggleLoan(loanId: number) {
    Haptics.selectionAsync();
    setHiddenLoanIds((current) => {
      const next = new Set(current);
      if (next.has(loanId)) next.delete(loanId);
      else next.add(loanId);
      return next;
    });
  }

  const allMonths = coloredLines[0]?.points.map((point) => point.month) ?? [];
  const visibleLines = coloredLines.filter((line) => !hiddenLoanIds.has(line.loanId));

  const todayIndex = useMemo(() => {
    const projectedStart = coloredLines[0]?.points.findIndex((point) => point.projected) ?? -1;
    return projectedStart === -1 ? Math.max(allMonths.length - 1, 0) : projectedStart;
  }, [coloredLines, allMonths.length]);

  const selectedRange = RANGE_OPTIONS.find((option) => option.key === rangeKey) ?? RANGE_OPTIONS[RANGE_OPTIONS.length - 1];
  const rangeWindow = useMemo(
    () => computeRangeWindow(allMonths.length, todayIndex, selectedRange.months),
    [allMonths.length, todayIndex, selectedRange.months]
  );

  const months = allMonths.slice(rangeWindow.start, rangeWindow.end + 1);
  const labelIndices = useMemo(() => pickLabelIndices(months.length, MAX_X_LABELS), [months.length]);

  const dataSet = useMemo(
    () =>
      visibleLines.map((line) => ({
        data: line.points.slice(rangeWindow.start, rangeWindow.end + 1).map((point, index) => ({
          value: (point.balanceCents * rate) / 100,
          label: labelIndices.has(index) ? monthTick(point.month) : '',
        })),
        color: line.color,
        thickness: 2.5,
        hideDataPoints: true,
        dataPointsColor: line.color,
      })),
    [visibleLines, rate, labelIndices, rangeWindow]
  );

  if (coloredLines.length === 0) return null;

  return (
    <View>
      <View style={[styles.rangeRow, { backgroundColor: theme.backgroundElement }]}>
        {RANGE_OPTIONS.map((option) => {
          const selected = option.key === rangeKey;
          return (
            <Pressable
              key={option.key}
              style={styles.rangeButton}
              onPress={() => {
                Haptics.selectionAsync();
                setRangeKey(option.key);
              }}>
              <View
                style={[
                  styles.rangeButtonInner,
                  selected && {
                    backgroundColor: theme.card,
                    shadowColor: '#000',
                    shadowOpacity: 0.08,
                    shadowRadius: 4,
                    shadowOffset: { width: 0, height: 2 },
                    elevation: 1,
                  },
                ]}>
                <ThemedText type={selected ? 'smallBold' : 'small'} themeColor={selected ? 'text' : 'textSecondary'}>
                  {option.label}
                </ThemedText>
              </View>
            </Pressable>
          );
        })}
      </View>

      <View onLayout={handleLayout}>
        {width > 0 && dataSet.length > 0 ? (
          <LineChart
            // react-native-gifted-charts recomputes its drawn path from `dataSet` inside a
            // useEffect whose dependency array never lists `dataSet` (only the legacy
            // `data`/`data2`.../`data5` props) — so changing the range or hiding a loan updates
            // our data but the library silently keeps drawing the old path. Forcing a remount on
            // every window/visibility change sidesteps that internal bug.
            key={`${rangeKey}-${visibleLines.map((line) => line.loanId).join(',')}`}
            dataSet={dataSet}
            width={width - Y_AXIS_LABEL_WIDTH}
            height={CHART_HEIGHT}
            adjustToWidth
            curved={false}
            noOfSections={4}
            yAxisLabelWidth={Y_AXIS_LABEL_WIDTH}
            yAxisTextStyle={{ color: theme.textMuted, fontSize: 10 }}
            yAxisColor={theme.border}
            xAxisColor={theme.border}
            rulesColor={theme.border}
            rulesType="solid"
            xAxisLabelTextStyle={{ color: theme.textMuted, fontSize: 10 }}
            xAxisLabelsHeight={16}
            formatYLabel={(label) => formatCompactMoney(Number(label), currency)}
            isAnimated
            animateOnDataChange
            animationDuration={450}
            onDataChangeAnimationDuration={FADE_DURATION}
            pointerConfig={{
              pointerStripUptoDataPoint: true,
              pointerStripColor: theme.textMuted,
              pointerStripWidth: 1,
              radius: 4,
              pointerColorsForDataSet: visibleLines.map((line) => line.color),
              activatePointersInstantlyOnTouch: true,
              autoAdjustPointerLabelPosition: true,
              pointerLabelWidth: TOOLTIP_WIDTH,
              pointerLabelHeight: 24 + visibleLines.length * 20,
              pointerVanishDelay: 0,
              pointerLabelComponent: (items: { value?: number }[], _secondary: unknown, pointerIndex: number) => {
                const monthDate = months[pointerIndex];
                return (
                  <View
                    style={[
                      styles.tooltip,
                      { backgroundColor: theme.card, borderColor: theme.border, width: TOOLTIP_WIDTH },
                    ]}>
                    <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                      {monthDate ? fullDate(monthDate) : ''}
                    </ThemedText>
                    {visibleLines.map((line, index) => (
                      <View key={line.loanId} style={styles.tooltipRow}>
                        <View style={[styles.legendDot, { backgroundColor: line.color }]} />
                        <ThemedText type="smallBold" numeric numberOfLines={1}>
                          {formatMoney(Math.round((items[index]?.value ?? 0) * 100), currency)}
                        </ThemedText>
                      </View>
                    ))}
                  </View>
                );
              },
            }}
          />
        ) : (
          <View style={{ height: CHART_HEIGHT }} />
        )}
      </View>

      <ThemedText type="small" themeColor="textMuted" style={styles.hint}>
        Drag to inspect
      </ThemedText>

      <View style={styles.legend}>
        {coloredLines.map((line) => (
          <LegendRow
            key={line.loanId}
            label={line.name}
            color={line.color}
            payoffLabel={`ends ${fullDate(line.endDate)}`}
            hidden={hiddenLoanIds.has(line.loanId)}
            onPress={() => toggleLoan(line.loanId)}
          />
        ))}
      </View>
    </View>
  );
}

function LegendRow({
  label,
  color,
  payoffLabel,
  hidden,
  onPress,
}: {
  label: string;
  color: string;
  payoffLabel: string;
  hidden: boolean;
  onPress: () => void;
}) {
  const opacity = useSharedValue(hidden ? 0.4 : 1);

  useEffect(() => {
    opacity.value = withTiming(hidden ? 0.4 : 1, { duration: FADE_DURATION });
  }, [hidden, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Pressable onPress={onPress}>
      <Animated.View style={[styles.legendRow, animatedStyle]}>
        <View style={[styles.legendDot, { backgroundColor: color }]} />
        <ThemedText type="small" numberOfLines={1} style={[styles.legendName, hidden && styles.legendTextHidden]}>
          {label}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {payoffLabel}
        </ThemedText>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  rangeRow: {
    flexDirection: 'row',
    gap: Spacing.one,
    padding: Spacing.half,
    borderRadius: Radii.input,
    marginBottom: Spacing.two + 2,
    alignSelf: 'flex-start',
  },
  rangeButton: {
    minWidth: 40,
  },
  rangeButtonInner: {
    borderRadius: Radii.input - 4,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    alignItems: 'center',
  },
  tooltip: {
    borderWidth: 1,
    borderRadius: Spacing.one + 2,
    padding: Spacing.one + 2,
    gap: 3,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  tooltipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  hint: {
    marginTop: Spacing.one,
    fontSize: 11,
    textAlign: 'center',
  },
  legend: {
    marginTop: Spacing.three - 2,
    gap: Spacing.one + 2,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 2,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendName: {
    flex: 1,
    minWidth: 0,
  },
  legendTextHidden: {
    textDecorationLine: 'line-through',
  },
});
