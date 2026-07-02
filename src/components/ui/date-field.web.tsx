import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type DateFieldProps = {
  label: string;
  value: Date;
  onChange: (date: Date) => void;
};

function toInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function DateField({ label, value, onChange }: DateFieldProps) {
  const theme = useTheme();

  return (
    <View style={styles.field}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {label}
      </ThemedText>
      <input
        type="date"
        value={toInputValue(value)}
        onChange={(event) => {
          const [year, month, day] = event.target.value.split('-').map(Number);
          if (year && month && day) onChange(new Date(year, month - 1, day));
        }}
        style={{
          border: `1px solid ${theme.border}`,
          borderRadius: Radii.input,
          paddingLeft: Spacing.three - 1,
          paddingRight: Spacing.three - 1,
          height: 50,
          fontSize: 15,
          fontWeight: 700,
          backgroundColor: theme.card,
          color: theme.text,
          fontFamily: 'inherit',
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: Spacing.one + 1,
  },
});
