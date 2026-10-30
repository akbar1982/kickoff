import React from "react";
import {
  ActivityIndicator, Pressable, StyleProp, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, space, type } from "../lib/theme";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

export function Button({
  title, onPress, variant = "primary", icon, loading, disabled, style,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const bg = { primary: colors.accent, secondary: colors.surfaceHi, ghost: "transparent", danger: "transparent" }[variant];
  const fg = variant === "primary" ? colors.accentInk : variant === "danger" ? colors.danger : colors.text;
  const border = variant === "secondary" ? colors.border : variant === "danger" ? colors.danger : "transparent";
  return (
    <Pressable
      disabled={disabled || loading}
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }}
      style={({ pressed }) => [
        styles.btn, { backgroundColor: bg, borderColor: border, opacity: disabled ? 0.45 : pressed ? 0.85 : 1 }, style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : (
        <>
          {icon && <Ionicons name={icon} size={20} color={fg} style={{ marginRight: 8 }} />}
          <Text style={[styles.btnText, { color: fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

export function Field({ label, error, ...props }: TextInputProps & { label: string; error?: string }) {
  return (
    <View style={{ marginBottom: space.md }}>
      <Text style={[type.label, { marginBottom: 6 }]}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.muted}
        {...props}
        style={[styles.input, error ? { borderColor: colors.danger } : null, props.style]}
      />
      {error ? <Text style={{ color: colors.danger, fontSize: 12, marginTop: 4 }}>{error}</Text> : null}
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Chip({ label, tone = "neutral", icon }: { label: string; tone?: "neutral" | "good" | "warn" | "accent"; icon?: IconName }) {
  const map = {
    neutral: [colors.surfaceHi, colors.muted],
    good: ["rgba(61,220,132,0.14)", colors.success],
    warn: ["rgba(255,179,71,0.14)", colors.warning],
    accent: ["rgba(198,244,50,0.14)", colors.accent],
  }[tone];
  return (
    <View style={[styles.chip, { backgroundColor: map[0] }]}>
      {icon && <Ionicons name={icon} size={12} color={map[1]} style={{ marginRight: 4 }} />}
      <Text style={{ color: map[1], fontSize: 12, fontWeight: "700" }}>{label}</Text>
    </View>
  );
}

/** − 8 +  control used for min / max players. */
export function Stepper({
  label, hint, value, min, max, onChange,
}: { label: string; hint?: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  const step = (d: number) => {
    const next = Math.min(max, Math.max(min, value + d));
    if (next !== value) { Haptics.selectionAsync(); onChange(next); }
  };
  return (
    <View style={styles.stepperRow}>
      <View style={{ flex: 1 }}>
        <Text style={type.body}>{label}</Text>
        {hint ? <Text style={type.small}>{hint}</Text> : null}
      </View>
      <View style={styles.stepper}>
        <Pressable onPress={() => step(-1)} style={styles.stepBtn} hitSlop={8}>
          <Ionicons name="remove" size={20} color={value <= min ? colors.border : colors.text} />
        </Pressable>
        <Text style={styles.stepValue}>{value}</Text>
        <Pressable onPress={() => step(1)} style={styles.stepBtn} hitSlop={8}>
          <Ionicons name="add" size={20} color={value >= max ? colors.border : colors.text} />
        </Pressable>
      </View>
    </View>
  );
}

/** Filled bar showing going vs. min (marker) vs. max. */
export function PlayerMeter({ going, min, max }: { going: number; min: number; max: number }) {
  const pct = Math.min(100, (going / max) * 100);
  const minPct = (min / max) * 100;
  const confirmed = going >= min;
  return (
    <View>
      <View style={styles.meterTrack}>
        <View style={[styles.meterFill, { width: `${pct}%`, backgroundColor: confirmed ? colors.accent : colors.warning }]} />
        <View style={[styles.meterMin, { left: `${minPct}%` }]} />
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
        <Text style={type.small}>{going} going</Text>
        <Text style={type.small}>min {min} · max {max}</Text>
      </View>
    </View>
  );
}

export function Screen({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flex: 1, backgroundColor: colors.bg }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  btn: {
    height: 54, borderRadius: radius.pill, borderWidth: 1, flexDirection: "row",
    alignItems: "center", justifyContent: "center", paddingHorizontal: space.lg,
  },
  btnText: { fontSize: 16, fontWeight: "700", letterSpacing: 0.2 },
  input: {
    height: 52, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1,
    borderColor: colors.border, color: colors.text, paddingHorizontal: space.md, fontSize: 16,
  },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.md },
  chip: { flexDirection: "row", alignItems: "center", borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  stepperRow: { flexDirection: "row", alignItems: "center", paddingVertical: space.sm },
  stepper: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surfaceHi, borderRadius: radius.pill },
  stepBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  stepValue: { color: colors.text, fontSize: 18, fontWeight: "800", minWidth: 32, textAlign: "center" },
  meterTrack: { height: 8, borderRadius: 4, backgroundColor: colors.surfaceHi, overflow: "visible" },
  meterFill: { height: 8, borderRadius: 4 },
  meterMin: { position: "absolute", top: -3, width: 2, height: 14, backgroundColor: colors.text, borderRadius: 1 },
});
