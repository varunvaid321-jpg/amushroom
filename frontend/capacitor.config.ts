import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.orangutany.app',
  appName: 'Orangutany',
  webDir: 'out',
  server: {
    // Load the live site directly — makes cookies, API calls, OAuth all work
    // See /docs/adr/001-mobile-app-capacitor.md for rationale
    url: 'https://orangutany.com',
    cleartext: false,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 2000,
      backgroundColor: '#0a0a0a',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0a0a0a',
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
    Camera: {
      // Permissions are set in native projects (Info.plist / AndroidManifest)
    },
  },
  ios: {
    contentInset: 'always',
    preferredContentMode: 'mobile',
    scheme: 'orangutany',
  },
  android: {
    backgroundColor: '#0a0a0a',
  },
};

export default config;
