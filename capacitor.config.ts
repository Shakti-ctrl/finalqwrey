import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.shakti.smartimagecropper',
  appName: 'Smart Image Cropper',
  webDir: 'build',
  server: {
    androidScheme: 'https'
  },
  android: {
    webContentsDebuggingEnabled: true,
    allowMixedContent: true
  },
  plugins: {
    Browser: {
      packageName: 'com.android.chrome'
    }
  }
};

export default config;