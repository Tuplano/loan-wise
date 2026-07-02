import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDate } from '@/lib/date';

type DateFieldProps = {
  label: string;
  value: Date;
  onChange: (date: Date) => void;
};

export function DateField({ label, value, onChange }: DateFieldProps) {
  const theme = useTheme();
  const [iosPickerOpen, setIosPickerOpen] = useState(false);

  function handleOpen() {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value,
        mode: 'date',
        onChange: (_event, selected) => {
          if (selected) onChange(selected);
        },
      });
      return;
    }
    setIosPickerOpen((open) => !open);
  }

  return (
    <View style={styles.field}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {label}
      </ThemedText>
      <Pressable onPress={handleOpen}>
        <View
          style={[
            styles.input,
            { borderColor: theme.border, backgroundColor: theme.card },
          ]}>
          <ThemedText style={styles.value}>{formatDate(value)}</ThemedText>
        </View>
      </Pressable>
      {Platform.OS === 'ios' && iosPickerOpen && (
        <DateTimePicker
          value={value}
          mode="date"
          display="inline"
          onChange={(_event, selected) => {
            if (selected) onChange(selected);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: Spacing.one + 1,
  },
  input: {
    borderWidth: 1,
    borderRadius: Radii.input,
    paddingHorizontal: Spacing.three - 1,
    height: 50,
    justifyContent: 'center',
  },
  value: {
    fontSize: 15,
    fontWeight: '700',
  },
});
