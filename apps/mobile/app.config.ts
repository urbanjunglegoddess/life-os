import { COLOR } from '@life-os/tokens';
import type { ExpoConfig } from 'expo/config';

// Expo config as TypeScript rather than app.json so the splash and adaptive-icon
// grounds come from the token module. A hex here would be a second definition of
// a design value, which 4.7 §11 forbids as flatly as it forbids one in a component.
const config: ExpoConfig = {
  name: 'Life OS',
  slug: 'life-os',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: 'lifeos',
  // One theme exists: dark base (4.7). Light and high-contrast are FUTURE-STATE,
  // which the semantic layer is built to make possible later.
  userInterfaceStyle: 'dark',
  backgroundColor: COLOR['bg-base'],
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.urbanjunglegoddess.lifeos',
  },
  android: {
    package: 'com.urbanjunglegoddess.lifeos',
    adaptiveIcon: {
      backgroundColor: COLOR['bg-base'],
      foregroundImage: './assets/android-icon-foreground.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        backgroundColor: COLOR['bg-base'],
        imageWidth: 160,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
};

export default config;
