import { useMemo, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useCurrency } from '@/hooks/use-currency';
import { useTheme } from '@/hooks/use-theme';
import { formatMoney } from '@/lib/format';

import type { BalancePoint } from '@/lib/analytics';

const CHART_HEIGHT = 140;
const TOP_PADDING = 8;
const BOTTOM_PADDING = 4;

function monthTick(date: Date) {
  return date.toLocaleDateString('en-PH', { month: 'short', year: '2-digit' });
}

type BalanceChartProps = {
  points: BalancePoint[];
};

export function BalanceChart({ points }: BalanceChartProps) {
  const theme = useTheme();
  const currency = useCurrency();
  const [width, setWidth] = useState(0);

  function handleLayout(event: LayoutChangeEvent) {
    setWidth(event.nativeEvent.layout.width);
  }

  const chart = useMemo(() => {
    if (points.length === 0 || width === 0) return null;

    const maxBalance = Math.max(...points.map((point) => point.balanceCents), 1);
    const usableHeight = CHART_HEIGHT - TOP_PADDING - BOTTOM_PADDING;
    const stepX = points.length > 1 ? width / (points.length - 1) : 0;

    const coords = points.map((point, index) => ({
      x: index * stepX,
      y: TOP_PADDING + usableHeight - (point.balanceCents / maxBalance) * usableHeight,
      projected: point.projected,
    }));

    const splitIndex = coords.reduce((acc, coord, index) => (!coord.projected ? index : acc), 0);
    const actualCoords = coords.slice(0, splitIndex + 1);
    const projectedCoords = coords.slice(splitIndex);

    const toPath = (list: typeof coords) =>
      list.map((coord, index) => `${index === 0 ? 'M' : 'L'} ${coord.x} ${coord.y}`).join(' ');

    const actualPath = toPath(actualCoords);
    const projectedPath = projectedCoords.length > 1 ? toPath(projectedCoords) : '';

    const areaPath =
      actualCoords.length > 0
        ? `M ${actualCoords[0].x} ${CHART_HEIGHT} ` +
          actualCoords.map((coord) => `L ${coord.x} ${coord.y}`).join(' ') +
          ` L ${actualCoords[actualCoords.length - 1].x} ${CHART_HEIGHT} Z`
        : '';

    const tickIndices =
      points.length <= 4
        ? points.map((_, index) => index)
        : [0, Math.round((points.length - 1) / 2), points.length - 1];
    const ticks = tickIndices.map((index) => ({ x: coords[index].x, label: monthTick(points[index].month) }));

    return { actualPath, projectedPath, areaPath, ticks };
  }, [points, width]);

  const latest = points[points.length - 1];

  return (
    <View>
      {latest && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.caption}>
          Projected balance {formatMoney(latest.balanceCents, currency)} by {monthTick(latest.month)}
        </ThemedText>
      )}
      <View style={styles.chartArea} onLayout={handleLayout}>
        {chart && width > 0 && (
          <Svg width={width} height={CHART_HEIGHT}>
            <Defs>
              <LinearGradient id="balanceFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={theme.primary} stopOpacity={0.28} />
                <Stop offset="1" stopColor={theme.primary} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            {chart.areaPath !== '' && <Path d={chart.areaPath} fill="url(#balanceFill)" />}
            {chart.actualPath !== '' && (
              <Path d={chart.actualPath} fill="none" stroke={theme.primary} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
            )}
            {chart.projectedPath !== '' && (
              <Path
                d={chart.projectedPath}
                fill="none"
                stroke={theme.textSecondary}
                strokeWidth={2}
                strokeDasharray="5,5"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}
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
    </View>
  );
}

const styles = StyleSheet.create({
  caption: {
    marginBottom: Spacing.two,
  },
  chartArea: {
    width: '100%',
    height: CHART_HEIGHT,
  },
  ticksRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.one,
  },
});
