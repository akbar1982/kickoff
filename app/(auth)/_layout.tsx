import { Stack } from "expo-router";
import { colors, readable } from "../../lib/theme";

export default function AuthLayout() {
  return (
    <Stack screenOptions={{
      headerStyle: { backgroundColor: colors.bg },
      headerTintColor: colors.text,
      headerShadowVisible: false,
      headerTitle: "",
      contentStyle: [{ backgroundColor: colors.bg }, readable],
    }}>
      <Stack.Screen name="welcome" options={{ headerShown: false }} />
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="sign-up" />
    </Stack>
  );
}
