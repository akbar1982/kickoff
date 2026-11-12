import React, { useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, space, type } from "../lib/theme";
import { localeTag } from "../lib/i18n";

export function DateTimeField({ label, value, onChange }: { label: string; value: Date; onChange: (d: Date) => void }) {
  const [showIos, setShowIos] = useState(false);

  const openAndroid = () => {
    // Android shows a date dialog, then a time dialog.
    DateTimePickerAndroid.open({
      value, mode: "date", minimumDate: new Date(),
      onChange: (_e, date) => {
        if (!date) return;
        DateTimePickerAndroid.open({
          value: date, mode: "time",
          onChange: (_e2, t) => {
            if (!t) return;
            const out = new Date(date);
            out.setHours(t.getHours(), t.getMinutes(), 0, 0);
            onChange(out);
          },
        });
      },
    });
  };

  const text = `${value.toLocaleDateString(localeTag(), { weekday: "short", month: "short", day: "numeric" })} · ${value.toLocaleTimeString(localeTag(), { hour: "numeric", minute: "2-digit" })}`;

  return (
    <View style={{ marginBottom: space.md }}>
      <Text style={[type.label, { marginBottom: 6 }]}>{label}</Text>
      <Pressable
        onPress={() => (Platform.OS === "android" ? openAndroid() : setShowIos((s) => !s))}
        style={{
          height: 52, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
          paddingHorizontal: space.md, flexDirection: "row", alignItems: "center",
        }}>
        <Ionicons name="calendar-outline" size={18} color={colors.muted} />
        <Text style={[type.body, { marginLeft: space.sm, fontSize: 16 }]}>{text}</Text>
      </Pressable>
      {Platform.OS === "ios" && showIos && (
        <DateTimePicker value={value} mode="datetime" display="inline" themeVariant="dark" accentColor={colors.accent} locale={localeTag()}
          minimumDate={new Date()} onChange={(_e, d) => d && onChange(d)} />
      )}
    </View>
  );
}
