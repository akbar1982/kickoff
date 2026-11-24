// Fills in values that shouldn't be committed to git. Locally they come from .env; on EAS Build
// from the project's environment variables (eas env:create).
//   GOOGLE_MAPS_ANDROID_KEY  Google Maps SDK for Android key (restricted to com.akbar.soccer)
//   GOOGLE_SERVICES_JSON     path to Firebase's google-services.json (an EAS "file" variable), for Android push
//                            notifications. Locally, drop the file in the project root (it's gitignored).
const fs = require("fs");

const googleServices = process.env.GOOGLE_SERVICES_JSON ?? "./google-services.json";

module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    // without it the app still builds and runs; Android phones just don't get push notifications
    ...(fs.existsSync(googleServices) && { googleServicesFile: googleServices }),
  },
  plugins: config.plugins.map((p) =>
    Array.isArray(p) && p[0] === "react-native-maps"
      ? [p[0], { ...p[1], androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_ANDROID_KEY ?? "" }]
      : p,
  ),
});
