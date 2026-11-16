// Allow plain-http API calls (LAN dev backend) in release builds. Remove once the API is served over HTTPS.
const { withAndroidManifest } = require('expo/config-plugins');
module.exports = (config) =>
  withAndroidManifest(config, (c) => {
    c.modResults.manifest.application[0].$['android:usesCleartextTraffic'] = 'true';
    return c;
  });
