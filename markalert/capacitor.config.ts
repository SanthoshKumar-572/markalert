import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.college.marks',
  appName: 'CollegeMarks',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 600,
      backgroundColor: '#fdfbef',
      showSpinner: false
    }
  }
};

export default config;
