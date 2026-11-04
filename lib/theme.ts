export const colors = {
  bg: "#0B0F0D",
  surface: "#141A17",
  surfaceHi: "#1C2420",
  border: "#26302B",
  text: "#F4F7F5",
  muted: "#8A9A92",
  accent: "#C6F432",       // pitch-lime
  accentInk: "#0B0F0D",
  success: "#3DDC84",
  warning: "#FFB347",
  danger: "#FF6B6B",
};

export const radius = { sm: 10, md: 16, lg: 24, pill: 999 };
export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };

export const type = {
  display: { fontSize: 34, fontWeight: "800" as const, letterSpacing: -0.8, color: colors.text },
  title: { fontSize: 22, fontWeight: "700" as const, letterSpacing: -0.3, color: colors.text },
  body: { fontSize: 15, color: colors.text },
  small: { fontSize: 13, color: colors.muted },
  label: { fontSize: 12, fontWeight: "700" as const, letterSpacing: 0.8, color: colors.muted, textTransform: "uppercase" as const },
};
