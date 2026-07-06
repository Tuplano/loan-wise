import { eq } from "drizzle-orm";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { Stack } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ColorPickerModal } from "@/components/color-picker-modal";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Radii, Spacing } from "@/constants/theme";
import { db } from "@/db/client";
import { categories } from "@/db/schema";
import { categoryColors } from "@/db/seed";
import { useTheme } from "@/hooks/use-theme";

const CUSTOM_SWATCH_COLORS = [
  "#FF0000",
  "#FFFF00",
  "#00FF00",
  "#00FFFF",
  "#0000FF",
  "#FF00FF",
] as const;

export default function CategoriesScreen() {
  const theme = useTheme();
  const { data: categoryList } = useLiveQuery(db.query.categories.findMany());

  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(categoryColors[0]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [colorPickerTarget, setColorPickerTarget] = useState<
    "new" | number | null
  >(null);

  async function handleAdd() {
    const name = newName.trim();
    if (!name) return;
    try {
      await db.insert(categories).values({ name, color: newColor });
      setNewName("");
      setNewColor(categoryColors[0]);
    } catch {
      // categories.name is unique — most likely cause of a failed insert here.
      Alert.alert(
        "Name already used",
        `A category named "${name}" already exists.`,
      );
    }
  }

  function startEditing(id: number, currentName: string) {
    setEditingId(id);
    setEditingName(currentName);
  }

  async function commitEditing() {
    const name = editingName.trim();
    if (editingId !== null && name) {
      try {
        await db
          .update(categories)
          .set({ name })
          .where(eq(categories.id, editingId));
      } catch {
        Alert.alert(
          "Name already used",
          `A category named "${name}" already exists.`,
        );
        return;
      }
    }
    setEditingId(null);
  }

  function handleDelete(id: number, name: string) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      "Delete category",
      `Delete "${name}"? Loans using it will become uncategorized.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            // db.delete(...) is a lazy "thenable" — it only actually executes once awaited/`.then()`'d,
            // so this must be awaited rather than just returned (Alert's onPress discards the return value).
            await db.delete(categories).where(eq(categories.id, id));
          },
        },
      ],
    );
  }

  function openColorPicker(target: "new" | number) {
    Haptics.selectionAsync();
    setColorPickerTarget(target);
  }

  async function handleColorConfirm(hex: string) {
    if (colorPickerTarget === "new") {
      setNewColor(hex);
    } else if (colorPickerTarget !== null) {
      await db
        .update(categories)
        .set({ color: hex })
        .where(eq(categories.id, colorPickerTarget));
    }
  }

  const pickerInitialColor =
    colorPickerTarget === "new"
      ? newColor
      : (categoryList.find((category) => category.id === colorPickerTarget)
          ?.color ?? categoryColors[0]);
  const isCustomNewColor = !categoryColors.includes(newColor);

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: "Categories" }} />
      <SafeAreaView style={styles.safeArea} edges={["left", "right", "bottom"]}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View
            style={[
              styles.group,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            {categoryList.map((category) => {
              const isEditing = editingId === category.id;
              return (
                <View
                  key={category.id}
                  style={[styles.row, { borderBottomColor: theme.divider }]}
                >
                  <Pressable
                    hitSlop={8}
                    onPress={() => openColorPicker(category.id)}
                  >
                    <View
                      style={[
                        styles.dot,
                        { backgroundColor: category.color ?? undefined },
                      ]}
                    />
                  </Pressable>
                  {isEditing ? (
                    <TextInput
                      value={editingName}
                      onChangeText={setEditingName}
                      autoFocus
                      onSubmitEditing={commitEditing}
                      onBlur={commitEditing}
                      style={[styles.editInput, { color: theme.text }]}
                    />
                  ) : (
                    <Pressable
                      style={styles.rowLabel}
                      onPress={() => startEditing(category.id, category.name)}
                    >
                      <ThemedText>{category.name}</ThemedText>
                    </Pressable>
                  )}
                  <Pressable
                    hitSlop={8}
                    onPress={() => handleDelete(category.id, category.name)}
                    style={({ pressed }) => pressed && styles.pressed}
                  >
                    <SymbolView
                      tintColor={theme.textSecondary}
                      name={{ ios: "trash", android: "delete", web: "delete" }}
                      size={18}
                    />
                  </Pressable>
                </View>
              );
            })}

            <View style={styles.addRowGroup}>
              <View style={styles.colorRow}>
                {categoryColors.map((color) => (
                  <Pressable key={color} onPress={() => setNewColor(color)}>
                    <View
                      style={[
                        styles.colorSwatch,
                        { backgroundColor: color },
                        newColor === color && [
                          styles.colorSwatchSelected,
                          { borderColor: color },
                        ],
                      ]}
                    />
                  </Pressable>
                ))}
                <Pressable onPress={() => openColorPicker("new")}>
                  <LinearGradient
                    colors={CUSTOM_SWATCH_COLORS}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[
                      styles.customSwatch,
                      isCustomNewColor && [
                        styles.colorSwatchSelected,
                        { borderColor: newColor },
                      ],
                    ]}
                  >
                    <ThemedText
                      type="smallBold"
                      style={styles.customSwatchPlus}
                    >
                      +
                    </ThemedText>
                  </LinearGradient>
                </Pressable>
              </View>
              <View style={styles.addRow}>
                <TextInput
                  value={newName}
                  onChangeText={setNewName}
                  placeholder="Add category"
                  placeholderTextColor={theme.textSecondary}
                  onSubmitEditing={handleAdd}
                  style={[styles.input, { color: theme.text }]}
                />
                <Pressable onPress={handleAdd} hitSlop={8}>
                  <SymbolView
                    tintColor={theme.primary}
                    name={{
                      ios: "plus.circle.fill",
                      android: "add_circle",
                      web: "add_circle",
                    }}
                    size={26}
                  />
                </Pressable>
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>

      <ColorPickerModal
        visible={colorPickerTarget !== null}
        initialColor={pickerInitialColor}
        onConfirm={handleColorConfirm}
        onClose={() => setColorPickerTarget(null)}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.three,
  },
  group: {
    borderRadius: Radii.card - 2,
    borderWidth: 1,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two + 2,
    paddingVertical: Spacing.three - 2,
    paddingHorizontal: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: {
    flex: 1,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  editInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 0,
  },
  pressed: {
    opacity: 0.6,
  },
  addRowGroup: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  colorRow: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  colorSwatch: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  colorSwatchSelected: {
    borderWidth: 2,
  },
  customSwatch: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  customSwatchPlus: {
    color: "#FFFFFF",
    fontSize: 15,
    lineHeight: 15,
  },
  addRow: {
    flexDirection: "row",
    gap: Spacing.two,
    alignItems: "center",
  },
  input: {
    flex: 1,
    fontSize: 16,
  },
});
