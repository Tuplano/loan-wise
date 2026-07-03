import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useState } from 'react';
import { type LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedProps, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { categoryColors } from '@/db/seed';
import { formatDate } from '@/lib/date';

import type { LoanBalanceLine } from '@/lib/analytics';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const CHART_HEIGHT = 140;
const TOP_PADDING = 8;
const BOTTOM_PADDING = 4;
const DRAW_DURATION = 450;
const FADE_DURATION = 280;

function monthTick(date: Date) {
  return date.toLocaleDateString('en-PH', { month: 'short', year: '2-digit' });
}

/** The first month a loan's balance reaches zero, or null if it's still open at the end of the timeline. */
function payoffMonth(line: LoanBalanceLine): Date | null {
  const zeroPoint = line.points.find((point) => point.balanceCents <= 0);
  return zeroPoint ? zeroPoint.month : null;
}

type Coord = { x: number; y: number };

/** Approximate on-screen length of a polyline, used to drive the stroke-dash "draw" animation. */
function polylineLength(coords: Coord[]): number {
  let length = 0;
  for (let index = 1; index < coords.length; index++) {
    length += Math.hypot(coords[index].x - coords[index - 1].x, coords[index].y - coords[index - 1].y);
  }
  return length || 1;
}

type BalanceChartProps = {
  lines: LoanBalanceLine[];
};

export function BalanceChart({ lines }: BalanceChartProps) {
  const [width, setWidth] = useState(0);
  const [hiddenLoanIds, setHiddenLoanIds] = useState<Set<number>>(new Set());

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

  const chart = useMemo(() => {
    const months = lines[0]?.points.map((point) => point.month) ?? [];
    if (lines.length === 0 || months.length === 0 || width === 0) return null;

    const maxBalance = Math.max(...lines.flatMap((line) => line.points.map((point) => point.balanceCents)), 1);
    const usableHeight = CHART_HEIGHT - TOP_PADDING - BOTTOM_PADDING;
    const stepX = months.length > 1 ? width / (months.length - 1) : 0;

    const lineCoords = lines.map((line, lineIndex) => {
      const color = line.color ?? categoryColors[lineIndex % categoryColors.length];
      const coords = line.points.map((point, index) => ({
        x: index * stepX,
        y: TOP_PADDING + usableHeight - (point.balanceCents / maxBalance) * usableHeight,
        projected: point.projected,
      }));

      const splitIndex = coords.reduce((acc, coord, index) => (!coord.projected ? index : acc), 0);
      const actualCoords = coords.slice(0, splitIndex + 1);
      const projectedCoords = coords.slice(splitIndex);

      const toPath = (list: typeof coords) =>
        list.map((coord, index) => `${index === 0 ? 'M' : 'L'} ${coord.x} ${coord.y}`).join(' ');

      return {
        loanId: line.loanId,
        color,
        actualPath: toPath(actualCoords),
        actualLength: polylineLength(actualCoords),
        projectedPath: projectedCoords.length > 1 ? toPath(projectedCoords) : '',
      };
    });

    const tickIndices =
      months.length <= 4
        ? months.map((_, index) => index)
        : [0, Math.round((months.length - 1) / 2), months.length - 1];
    const ticks = tickIndices.map((index) => ({ x: index * stepX, label: monthTick(months[index]) }));

    return { lineCoords, ticks };
  }, [lines, width]);

  return (
    <View>
      <View style={styles.chartArea} onLayout={handleLayout}>
        {chart && width > 0 && (
          <Svg width={width} height={CHART_HEIGHT}>
            {chart.lineCoords.map((line) => (
              <LoanLinePaths
                key={line.loanId}
                actualPath={line.actualPath}
                actualLength={line.actualLength}
                projectedPath={line.projectedPath}
                color={line.color}
                hidden={hiddenLoanIds.has(line.loanId)}
              />
            ))}
          </Svg>
        )}
      </View>
      {chart && (
        <View style={styles.ticksRow}>
          {chart.ticks.map((tick, index) => (
            <ThemedText key={index} type="small" themeColor="textMuted">
              {tick.label}
            </ThemedText>
          ))}
        </View>
      )}

      <View style={styles.legend}>
        {lines.map((line, index) => {
          const color = line.color ?? categoryColors[index % categoryColors.length];
          const payoff = payoffMonth(line);
          const hidden = hiddenLoanIds.has(line.loanId);
          return (
            <LegendRow
              key={line.loanId}
              label={line.name}
              color={color}
              payoffLabel={payoff ? `ends ${formatDate(payoff)}` : 'ongoing'}
              hidden={hidden}
              onPress={() => toggleLoan(line.loanId)}
            />
          );
        })}
      </View>
    </View>
  );
}

function LoanLinePaths({
  actualPath,
  actualLength,
  projectedPath,
  color,
  hidden,
}: {
  actualPath: string;
  actualLength: number;
  projectedPath: string;
  color: string;
  hidden: boolean;
}) {
  // Drawn in with a stroke-dash reveal (dash length == path length, offset sweeps to 0);
  // hiding reverses the same sweep so the line retracts rather than just vanishing.
  const dashOffset = useSharedValue(hidden ? actualLength : 0);
  const projectedOpacity = useSharedValue(hidden ? 0 : 0.5);

  useEffect(() => {
    dashOffset.value = withTiming(hidden ? actualLength : 0, { duration: DRAW_DURATION });
  }, [hidden, actualLength, dashOffset]);

  useEffect(() => {
    projectedOpacity.value = withTiming(hidden ? 0 : 0.5, { duration: FADE_DURATION });
  }, [hidden, projectedOpacity]);

  const animatedActualProps = useAnimatedProps(() => ({
    strokeDashoffset: dashOffset.value,
  }));
  const animatedProjectedProps = useAnimatedProps(() => ({
    strokeOpacity: projectedOpacity.value,
  }));

  return (
    <>
      <AnimatedPath
        d={actualPath}
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        strokeDasharray={[actualLength, actualLength]}
        animatedProps={animatedActualProps}
      />
      {projectedPath !== '' && (
        <AnimatedPath
          d={projectedPath}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeDasharray="5,5"
          strokeLinejoin="round"
          strokeLinecap="round"
          animatedProps={animatedProjectedProps}
        />
      )}
    </>
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
  chartArea: {
    width: '100%',
    height: CHART_HEIGHT,
  },
  ticksRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.one,
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
