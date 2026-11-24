// Marks the portrait screen as optional on Android.
// "orientation": "portrait" makes Google Play assume the app requires a portrait screen, so it hides
// the app from tablets, Chromebooks and XR headsets and blocks the release. The app still opens in
// portrait; this only stops Play from filtering those devices out.
const { withAndroidManifest } = require("expo/config-plugins");

const FEATURE = "android.hardware.screen.portrait";

module.exports = (config) =>
  withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    const features = (manifest["uses-feature"] ??= []);
    if (!features.some((f) => f.$["android:name"] === FEATURE)) {
      features.push({ $: { "android:name": FEATURE, "android:required": "false" } });
    }
    return cfg;
  });
