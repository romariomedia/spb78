import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ru.sportbuddy.mobile',
  appName: 'SportBuddy СПб',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    hostname: 'sportbuddy78.pro',
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
    // RuStore release signing is configured in android/app/build.gradle
    buildOptions: {
      keystorePath: 'sportbuddy-release.keystore',
      keystoreAlias: 'sportbuddy',
    },
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#020617',
      androidSplashResourceName: 'splash',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    Geolocation: {
      // Used only for matching athletes in Saint Petersburg
      permissions: ['location'],
    },
    Camera: {
      // Personal photo & sport portfolio (max 5 images)
      permissions: ['camera', 'photos'],
    },
  },
};

export default config;
