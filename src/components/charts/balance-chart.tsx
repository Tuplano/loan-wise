import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, View, Pressable } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedProps, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { categoryColors } from '@/db/seed';
import { useDisplayMoney } from '@/hooks/use-display-money';
import { useTheme } from '@/hooks/use-theme';
import { niceTicks } from '@/lib/chart-ticks';
import { formatCompactMoney } from '@/lib/format';

import type { LoanBalanceLine } from '@/lib/analytics';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const CHART_HEIGHT = 160;
const TOP_PADDING = 8;
const BOTTOM_PADDING = 4;
const Y_AXIS_WIDTH = 46;
const Y_TICK_COUNT = 4;
const MIN_VISIBLE_POINTS = 3;
const TOOLTIP_WIDTH = 152;
const X_TICK_LABEL_WIDTH = 44;
const DRAW_DURATION = 450;
const FADE_DURATION = 280;

function monthTick(date: Date) {
  return date.toLocaleDateString('en-PH', { month: 'short', year: '2-digit' });
}

function fullDate(date: Date) {
  return date.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
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

type Domain = { start: number; end: number };

type BalanceChartProps = {
  lines: LoanBalanceLine[];
};

export function BalanceChart({ lines }: BalanceChartProps) {
  // React Compiler can't prove refs read inside react-native-gesture-handler's builder
  // callbacks (.onStart/.onUpdate) are deferred rather than run during render — they are,
  // this is RNGH's documented pattern for reading live values — so this component opts out.
  'use no memo';

  const theme = useTheme();
  const { format, rate, currency } = useDisplayMoney();
  const [width, setWidth] = useState(0);
  const [hiddenLoanIds, setHiddenLoanIds] = useState<Set<number>>(new Set());
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);

  const pointCount = lines[0]?.points.length ?? 0;
  const fullDomain: Domain = { start: 0, end: Math.max(pointCount - 1, 0) };
  const [domain, setDomainState] = useState<Domain>(fullDomain);
  const domainRef = useRef(domain);
  const gestureStartRef = useRef({ start: 0, end: 0, focalIndex: 0 });

  // A different loan set (or point count) invalidates any zoom/pan the user had going.
  useEffect(() => {
    domainRef.current = fullDomain;
    setDomainState(fullDomain);
    setScrubIndex(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointCount]);

  function setDomain(next: Domain) {
    domainRef.current = next;
    setDomainState(next);
  }

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

  const minSpan = Math.max(1, Math.min(MIN_VISIBLE_POINTS, pointCount - 1));

  const gesture = useMemo(() => {
    const pinch = Gesture.Pinch()
      .runOnJS(true)
      .onStart((event) => {
        const { start, end } = domainRef.current;
        const span = end - start;
        const focalIndex = start + clamp(event.focalX / Math.max(width, 1), 0, 1) * span;
        gestureStartRef.current = { start, end, focalIndex };
      })
      .onUpdate((event) => {
        const { start, end, focalIndex } = gestureStartRef.current;
        const span = end - start;
        const newSpan = clamp(span / event.scale, minSpan, Math.max(pointCount - 1, minSpan));
        const ratio = span > 0 ? (focalIndex - start) / span : 0.5;
        let newStart = focalIndex - ratio * newSpan;
        let newEnd = newStart + newSpan;
        if (newStart < 0) {
          newEnd -= newStart;
          newStart = 0;
        }
        if (newEnd > pointCount - 1) {
          newStart -= newEnd - (pointCount - 1);
          newEnd = pointCount - 1;
        }
        setDomain({ start: Math.max(newStart, 0), end: newEnd });
      });

    const doubleTap = Gesture.Tap()
      .runOnJS(true)
      .numberOfTaps(2)
      .onStart(() => {
        Haptics.selectionAsync();
        setDomain({ start: 0, end: Math.max(pointCount - 1, 0) });
      });

    const scrub = Gesture.Pan()
      .runOnJS(true)
      .minPointers(1)
      .maxPointers(1)
      .activeOffsetX([-8, 8])
      .failOffsetY([-12, 12])
      .onStart((event) => {
        Haptics.selectionAsync();
        const { start, end } = domainRef.current;
        const span = end - start;
        const index = Math.round(start + clamp(event.x / Math.max(width, 1), 0, 1) * span);
        setScrubIndex(clamp(index, 0, pointCount - 1));
      })
      .onUpdate((event) => {
        const { start, end } = domainRef.current;
        const span = end - start;
        const index = Math.round(start + clamp(event.x / Math.max(width, 1), 0, 1) * span);
        setScrubIndex(clamp(index, 0, pointCount - 1));
      })
      .onEnd(() => setScrubIndex(null))
      .onFinalize(() => setScrubIndex(null));

    return Gesture.Simultaneous(pinch, Gesture.Exclusive(doubleTap, scrub));
  }, [width, pointCount, minSpan]);

  const chart = useMemo(() => {
    const months = lines[0]?.points.map((point) => point.month) ?? [];
    if (lines.length === 0 || months.length === 0 || width === 0) return null;

    const span = Math.max(domain.end - domain.start, 0.0001);
    const stepX = width / span;
    const usableHeight = CHART_HEIGHT - TOP_PADDING - BOTTOM_PADDING;

    const visStart = Math.max(0, Math.floor(domain.start) - 1);
    const visEnd = Math.min(months.length - 1, Math.ceil(domain.end) + 1);

    let maxVisibleCents = 1;
    for (const line of lines) {
      if (hiddenLoanIds.has(line.loanId)) continue;
      for (let index = visStart; index <= visEnd; index++) {
        const cents = line.points[index]?.balanceCents ?? 0;
        if (cents > maxVisibleCents) maxVisibleCents = cents;
      }
    }

    const maxVisibleMajor = (maxVisibleCents * rate) / 100;
    const yTickMajors = niceTicks(0, maxVisibleMajor, Y_TICK_COUNT);
    const topTickMajor = yTickMajors[yTickMajors.length - 1] || 1;
    const topTickCents = (topTickMajor * 100) / rate;

    const yTicks = yTickMajors.map((major) => ({
      value: major,
      y: TOP_PADDING + usableHeight - (major / topTickMajor) * usableHeight,
      label: formatCompactMoney(major, currency),
    }));

    const lineCoords = lines.map((line, lineIndex) => {
      const color = line.color ?? categoryColors[lineIndex % categoryColors.length];
      const points: (Coord & { index: number; projected?: boolean })[] = [];
      for (let index = visStart; index <= visEnd; index++) {
        const point = line.points[index];
        if (!point) continue;
        points.push({
          index,
          x: (index - domain.start) * stepX,
          y: TOP_PADDING + usableHeight - (point.balanceCents / topTickCents) * usableHeight,
          projected: point.projected,
        });
      }

      const splitIndex = points.reduce((acc, coord, index) => (!coord.projected ? index : acc), 0);
      const actualCoords = points.slice(0, splitIndex + 1);
      const projectedCoords = points.slice(splitIndex);

      const toPath = (list: typeof points) =>
        list.map((coord, index) => `${index === 0 ? 'M' : 'L'} ${coord.x} ${coord.y}`).join(' ');

      return {
        loanId: line.loanId,
        color,
        points,
        actualPath: toPath(actualCoords),
        actualLength: polylineLength(actualCoords),
        projectedPath: projectedCoords.length > 1 ? toPath(projectedCoords) : '',
      };
    });

    const visStartInt = Math.round(domain.start);
    const visEndInt = Math.round(domain.end);
    const visSpanInt = Math.max(visEndInt - visStartInt, 1);
    const xTickCount = Math.min(visSpanInt + 1, 4);
    const rawXTickIndices =
      xTickCount <= 1
        ? [visStartInt]
        : Array.from({ length: xTickCount }, (_, i) =>
            Math.round(visStartInt + (i * visSpanInt) / (xTickCount - 1))
          );
    const xTickIndices = [...new Set(rawXTickIndices.map((index) => clamp(index, 0, months.length - 1)))];
    const xTicks = xTickIndices.map((index) => ({
      x: (index - domain.start) * stepX,
      label: monthTick(months[index]),
    }));

    return { lineCoords, yTicks, xTicks, stepX, usableHeight };
  }, [lines, width, domain, hiddenLoanIds, rate, currency]);

  const scrub = useMemo(() => {
    if (!chart || scrubIndex === null) return null;
    const x = clamp((scrubIndex - domain.start) * chart.stepX, 0, width);
    const rows = chart.lineCoords
      .filter((line) => !hiddenLoanIds.has(line.loanId))
      .map((line) => {
        const point = line.points.find((p) => p.index === scrubIndex);
        const source = lines.find((l) => l.loanId === line.loanId);
        const balanceCents = source?.points[scrubIndex]?.balanceCents ?? 0;
        return point ? { loanId: line.loanId, color: line.color, y: point.y, balanceCents } : null;
      })
      .filter((row): row is { loanId: number; color: string; y: number; balanceCents: number } => row !== null);
    if (rows.length === 0) return null;

    const minY = Math.min(...rows.map((row) => row.y));
    const tooltipHeight = 20 + rows.length * 18;
    const tooltipTop = clamp(minY - tooltipHeight - 10, 0, CHART_HEIGHT - tooltipHeight);
    const tooltipLeft = clamp(x - TOOLTIP_WIDTH / 2, 4, Math.max(width - TOOLTIP_WIDTH - 4, 4));

    return { x, rows, tooltipTop, tooltipLeft, dateLabel: lines[0].points[scrubIndex]?.month };
  }, [chart, scrubIndex, domain.start, width, hiddenLoanIds, lines]);

  return (
    <View>
      <View style={styles.row}>
        <View style={styles.yAxis}>
          {chart?.yTicks.map((tick) => (
            <ThemedText
              key={tick.value}
              type="small"
              themeColor="textMuted"
              numberOfLines={1}
              style={[styles.yTickLabel, { top: tick.y - 7 }]}>
              {tick.label}
            </ThemedText>
          ))}
        </View>
        <GestureDetector gesture={gesture}>
          <View style={styles.chartArea} onLayout={handleLayout} collapsable={false}>
            {chart && width > 0 && (
              <Svg width={width} height={CHART_HEIGHT}>
                {chart.yTicks.map((tick) => (
                  <Line
                    key={tick.value}
                    x1={0}
                    x2={width}
                    y1={tick.y}
                    y2={tick.y}
                    stroke={theme.border}
                    strokeWidth={1}
                  />
                ))}
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
                {scrub && (
                  <>
                    <Line
                      x1={scrub.x}
                      x2={scrub.x}
                      y1={TOP_PADDING}
                      y2={CHART_HEIGHT - BOTTOM_PADDING}
                      stroke={theme.textMuted}
                      strokeWidth={1}
                      strokeDasharray="3,4"
                    />
                    {scrub.rows.map((row) => (
                      <Circle key={row.loanId} cx={scrub.x} cy={row.y} r={4} fill={row.color} stroke={theme.card} strokeWidth={1.5} />
                    ))}
                  </>
                )}
              </Svg>
            )}
            {scrub && (
              <View
                pointerEvents="none"
                style={[
                  styles.tooltip,
                  {
                    top: scrub.tooltipTop,
                    left: scrub.tooltipLeft,
                    width: TOOLTIP_WIDTH,
                    backgroundColor: theme.card,
                    borderColor: theme.border,
                  },
                ]}>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                  {scrub.dateLabel ? fullDate(scrub.dateLabel) : ''}
                </ThemedText>
                {scrub.rows.map((row) => (
                  <View key={row.loanId} style={styles.tooltipRow}>
                    <View style={[styles.legendDot, { backgroundColor: row.color }]} />
                    <ThemedText type="smallBold" numeric numberOfLines={1}>
                      {format(row.balanceCents)}
                    </ThemedText>
                  </View>
                ))}
              </View>
            )}
          </View>
        </GestureDetector>
      </View>

      {chart && (
        <View style={styles.xAxisRow}>
          {chart.xTicks.map((tick, index) => (
            <ThemedText
              key={index}
              type="small"
              themeColor="textMuted"
              numberOfLines={1}
              style={[
                styles.xTickLabel,
                { left: clamp(Y_AXIS_WIDTH + tick.x - X_TICK_LABEL_WIDTH / 2, 0, Y_AXIS_WIDTH + width - X_TICK_LABEL_WIDTH) },
              ]}>
              {tick.label}
            </ThemedText>
          ))}
        </View>
      )}

      <ThemedText type="small" themeColor="textMuted" style={styles.hint}>
        Pinch to zoom · drag to inspect
      </ThemedText>

      <View style={styles.legend}>
        {lines.map((line, index) => {
          const color = line.color ?? categoryColors[index % categoryColors.length];
          const hidden = hiddenLoanIds.has(line.loanId);
          return (
            <LegendRow
              key={line.loanId}
              label={line.name}
              color={color}
              payoffLabel={`ends ${fullDate(line.endDate)}`}
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
  const prevHiddenRef = useRef(hidden);

  useEffect(() => {
    // Zooming/panning changes actualLength on every gesture frame — only run the draw-in
    // sweep when visibility actually toggles, otherwise just snap to keep zoom responsive.
    const toggled = prevHiddenRef.current !== hidden;
    prevHiddenRef.current = hidden;
    const target = hidden ? actualLength : 0;
    dashOffset.value = toggled ? withTiming(target, { duration: DRAW_DURATION }) : target;
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
  row: {
    flexDirection: 'row',
  },
  yAxis: {
    width: Y_AXIS_WIDTH,
    height: CHART_HEIGHT,
  },
  yTickLabel: {
    position: 'absolute',
    left: 0,
    right: 6,
    textAlign: 'right',
    fontSize: 10,
  },
  chartArea: {
    flex: 1,
    height: CHART_HEIGHT,
  },
  tooltip: {
    position: 'absolute',
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
  xAxisRow: {
    height: 16,
    marginTop: Spacing.one,
  },
  xTickLabel: {
    position: 'absolute',
    width: X_TICK_LABEL_WIDTH,
    textAlign: 'center',
    fontSize: 10,
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
