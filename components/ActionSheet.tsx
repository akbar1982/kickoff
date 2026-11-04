import React, { useEffect, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius, space, type } from "../lib/theme";
import { column, widths } from "../lib/layout";

export interface SheetOption { label: string; destructive?: boolean; onPress: () => void }
interface Sheet { title?: string; message?: string; options: SheetOption[] }

// Alert can only show three buttons on Android, so menus with more choices use this sheet instead.
let present: ((s: Sheet) => void) | null = null;
export const showSheet = (s: Sheet) => present?.(s);

/** Mount once near the root of the app. */
export function ActionSheetHost() {
  const insets = useSafeAreaInsets();
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [open, setOpen] = useState(false);     // the sheet's content stays while it slides away
  useEffect(() => { present = (s) => { setSheet(s); setOpen(true); }; return () => { present = null; }; }, []);

  // iOS can't show an Alert while a modal is still closing, so the choice runs once the sheet is gone.
  const pick = (o?: SheetOption) => { setOpen(false); if (o) setTimeout(o.onPress, 350); };

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={() => pick()}>
      {/* dimmed backdrop behind and beside the sheet (it is narrower than the screen on iPad) */}
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }}>
        <Pressable style={{ flex: 1 }} onPress={() => pick()} />
        <View style={[{ backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg,
          padding: space.md, paddingBottom: insets.bottom + space.md }, column(widths.form)]}>
          {sheet?.title && <Text style={[type.body, { fontWeight: "700", textAlign: "center" }]}>{sheet.title}</Text>}
          {sheet?.message && <Text style={[type.small, { textAlign: "center", marginTop: 4 }]}>{sheet.message}</Text>}
          <View style={{ marginTop: space.sm }}>
            {sheet?.options.map((o) => (
              <Pressable key={o.label} onPress={() => pick(o)}
                style={({ pressed }) => ({ paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: colors.border,
                  opacity: pressed ? 0.6 : 1 })}>
                <Text style={{ fontSize: 17, textAlign: "center", color: o.destructive ? colors.danger : colors.text }}>{o.label}</Text>
              </Pressable>
            ))}
            <Pressable onPress={() => pick()} style={{ paddingVertical: 15 }}>
              <Text style={{ fontSize: 17, textAlign: "center", fontWeight: "700", color: colors.muted }}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
