// Build every native module from source on EAS instead of using Expo's precompiled
// module binaries. The precompiled versions of a few modules (image, location, media
// library, contacts) made the development build close right after opening.
const { withPodfileProperties } = require('expo/config-plugins');

module.exports = function withSourceBuiltModules(config) {
  return withPodfileProperties(config, (c) => {
    c.modResults.EXPO_USE_PRECOMPILED_MODULES = 'false';
    return c;
  });
};
