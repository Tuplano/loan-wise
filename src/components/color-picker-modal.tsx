import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import ColorPicker, { HueSlider, InputWidget, Panel1, Preview, Swatches } from 'reanimated-color-picker';

import { ThemedText } from '@/components/themed-text';
import { PrimaryButton } from '@/components/ui/primary-button';
import { Radii, Spacing } from '@/constants/theme';
import { categoryColors } from '@/db/seed';
import { useTheme } from '@/hooks/use-theme';

type ColorPickerModalProps = {
  visible: boolean;
  initialColor: string;
  onConfirm: (hex: string) => void;
  onClose: () => void;
};

export function ColorPickerModal({ visible, initialColor, onConfirm, onClose }: ColorPickerModalProps) {
  const theme = useTheme();
  const [hex, setHex] = useState(initialColor);
  // ColorPickerModal is a single persistent instance (categories.tsx always renders it, just
  // toggling `visible`) — reseed `hex` whenever the target color changes, since useState's
  // initial value only applies on first mount and would otherwise go stale on reopen.
  const [seededColor, setSeededColor] = useState(initialColor);
  if (initialColor !== seededColor) {
    setSeededColor(initialColor);
    setHex(initialColor);
  }

  function handleConfirm() {
    onConfirm(hex);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <ThemedText type="smallBold">Pick a color</ThemedText>

          {visible && (
            // Keyed by the seed color so reopening for a different category (or "new") remounts
            // with a fresh initial value instead of carrying over the previous selection.
            <ColorPicker
              key={initialColor}
              value={initialColor}
              onChangeJS={(colors) => setHex(colors.hex)}
              style={styles.picker}>
              <Preview hideText style={styles.previewBar} />
              <Panel1 style={styles.panel} thumbShape="ring" />
              <HueSlider style={styles.hueSlider} thumbShape="ring" />
              <InputWidget
                defaultFormat="HEX"
                formats={['HEX']}
                inputStyle={[
                  styles.hexInput,
                  { color: theme.text, borderColor: theme.border, backgroundColor: theme.background },
                ]}
                inputTitleStyle={{ color: theme.textSecondary }}
                iconColor={theme.textSecondary}
              />
              <Swatches colors={[...categoryColors]} style={styles.swatches} />
            </ColorPicker>
          )}

          <View style={styles.actions}>
            <Pressable onPress={onClose} hitSlop={8} style={styles.cancelButton}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                Cancel
              </ThemedText>
            </Pressable>
            <PrimaryButton label="Use color" onPress={handleConfirm} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    borderRadius: Radii.card,
    padding: Spacing.three + 2,
    gap: Spacing.three - 2,
  },
  picker: {
    gap: Spacing.three - 2,
  },
  previewBar: {
    height: 36,
    borderRadius: Radii.input,
  },
  panel: {
    width: '100%',
    height: 200,
    borderRadius: Radii.input,
  },
  hueSlider: {
    height: 28,
    borderRadius: 14,
  },
  hexInput: {
    borderWidth: 1,
    borderRadius: Radii.input,
    fontSize: 15,
    fontWeight: '700',
  },
  swatches: {
    gap: Spacing.two,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.three,
  },
  cancelButton: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
  },
});
