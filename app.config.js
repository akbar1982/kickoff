// Fills in values that shouldn't be committed to git. Locally they come from .env; on EAS Build
// from the project's environment variables (eas env:create).
//   GOOGLE_MAPS_ANDROID_KEY  Google Maps SDK for Android key (restricted to com.akbar.soccer)
module.exports = ({ config }) => ({
  ...config,
  plugins: config.plugins.map((p) =>
    Array.isArray(p) && p[0] === "react-native-maps"
      ? [p[0], { ...p[1], androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_ANDROID_KEY ?? "" }]
      : p,
  ),
});
