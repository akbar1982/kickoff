// Skips Android's "lint vital" check on release builds.
// @stripe/stripe-react-native references play-services-tapandpay (only used for card push
// provisioning, which Kickoff doesn't use). It isn't on public Maven, so release lint fails
// trying to resolve it and the whole build stops.
const { withAppBuildGradle } = require("expo/config-plugins");

module.exports = (config) =>
  withAppBuildGradle(config, (cfg) => {
    if (!cfg.modResults.contents.includes("checkReleaseBuilds false")) {
      cfg.modResults.contents = cfg.modResults.contents.replace(
        /android\s*\{/,
        "android {\n    lint {\n        checkReleaseBuilds false\n    }",
      );
    }
    return cfg;
  });
