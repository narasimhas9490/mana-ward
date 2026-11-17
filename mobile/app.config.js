// Extends app.json. Push needs Firebase: put the Android app's google-services.json next to this file.
const fs = require('fs');
module.exports = ({ config }) => {
  const hasFirebase = fs.existsSync(`${__dirname}/google-services.json`);
  return {
    ...config,
    android: { ...config.android, ...(hasFirebase ? { googleServicesFile: './google-services.json' } : {}) },
    plugins: [...(config.plugins || []), ['expo-notifications', { defaultChannel: 'default' }]],
  };
};
