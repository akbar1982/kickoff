import React from "react";
import { Pressable, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { showSheet } from "./ActionSheet";
import { radiusChoices, radiusLabel, setRadius, useRadius } from "../lib/hooks";
import { colors } from "../lib/theme";
import { t } from "../lib/i18n";

/** "Within 100 mi ▾": opens a sheet to widen or narrow the search radius. */
export function RadiusButton() {
  const km = useRadius();
  const pick = () => showSheet({
    title: t("radius.title"),
    options: radiusChoices().map((c) => ({
      label: (c === km ? "✓  " : "") + radiusLabel(c),
      onPress: () => setRadius(c),
    })),
  });
  return (
    <Pressable onPress={pick} hitSlop={10} accessibilityRole="button"
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 4, opacity: pressed ? 0.6 : 1 })}>
      <Ionicons name="locate" size={14} color={colors.accent} />
      <Text style={{ color: colors.accent, fontSize: 13, fontWeight: "700" }}>{radiusLabel(km)}</Text>
      <Ionicons name="chevron-down" size={14} color={colors.accent} />
    </Pressable>
  );
}
