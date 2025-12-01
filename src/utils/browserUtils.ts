import { Browser } from '@capacitor/browser';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/**
 * Opens a URL in the system browser (Chrome/Safari) instead of WebView
 * This is necessary for downloads and shares to work properly in mobile apps
 * @param url The URL to open in the browser
 */
export const openInSystemBrowser = async (url: string): Promise<void> => {
  try {
    // For Android, this will open in Chrome
    // For iOS, this will open in Safari
    await Browser.open({ url });
  } catch (error) {
    console.error('Error opening URL in system browser:', error);
    // Fallback to opening in the same window if Browser plugin fails
    window.open(url, '_system');
  }
};

/**
 * Saves a file to the device using Capacitor Filesystem and shares it
 * @param blob The file blob to save
 * @param filename The name to save the file as
 * @param mimeType The MIME type of the file
 */
export const saveFileToDevice = async (blob: Blob, filename: string, mimeType: string): Promise<void> => {
  try {
    // Convert blob to base64
    const base64Data = await blobToBase64(blob);
    
    // Save file to device
    const result = await Filesystem.writeFile({
      path: filename,
      data: base64Data,
      directory: Directory.Documents,
      recursive: true
    });
    
    console.log('File saved successfully:', result.uri);
    
    // Share the file
    await Share.share({
      title: filename,
      text: 'Check out this file',
      url: result.uri,
      dialogTitle: 'Share File'
    });
    
  } catch (error) {
    console.error('Error saving file to device:', error);
    // Fallback to opening in system browser
    const url = URL.createObjectURL(blob);
    await openInSystemBrowser(url);
    URL.revokeObjectURL(url);
  }
};

/**
 * Converts a Blob to base64 string
 * @param blob The blob to convert
 * @returns Promise resolving to base64 string
 */
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      // Remove the data URL prefix (e.g., "data:image/png;base64,")
      const base64String = (reader.result as string).split(',')[1];
      resolve(base64String);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

/**
 * Triggers a file download by creating a temporary link and opening it
 * In a Capacitor app, this will open the file in the system browser for download
 * @param blob The file blob to download
 * @param filename The name to save the file as
 */
export const downloadBlob = async (blob: Blob, filename: string): Promise<void> => {
  try {
    // Create a temporary URL for the blob
    const url = URL.createObjectURL(blob);
    
    // Create a temporary anchor element
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    
    // For web browsers, trigger the download directly
    if (!isCapacitorNative()) {
      link.click();
      // Clean up the URL object after a delay
      setTimeout(() => URL.revokeObjectURL(url), 100);
      return;
    }
    
    // For Capacitor apps, save to device and share
    await saveFileToDevice(blob, filename, blob.type || 'application/octet-stream');
    
    // Clean up the URL object
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error downloading blob:', error);
  }
};

/**
 * Checks if the app is running in a Capacitor native environment
 * @returns true if running in Capacitor native, false otherwise
 */
export const isCapacitorNative = (): boolean => {
  // Check if we're in a Capacitor native environment
  return !!(window as any).Capacitor?.isNativePlatform?.();
};

/**
 * Handles file export operations by either triggering direct download (web) 
 * or saving to device and sharing (Capacitor)
 * @param blob The file blob to export
 * @param filename The name to save the file as
 */
export const handleFileExport = async (blob: Blob, filename: string): Promise<void> => {
  try {
    if (isCapacitorNative()) {
      // In Capacitor native environment, save to device and share
      await saveFileToDevice(blob, filename, blob.type || 'application/octet-stream');
    } else {
      // In web browser, trigger direct download
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 100);
    }
  } catch (error) {
    console.error('Error handling file export:', error);
  }
};