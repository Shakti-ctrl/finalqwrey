import { Browser } from '@capacitor/browser';
import { Filesystem, Directory } from '@capacitor/filesystem';
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
 * Shows a popup dialog to choose download method
 * @param blob The file blob to export
 * @param filename The name to save the file as
 * @returns Promise that resolves when user makes a choice
 */
const showDownloadOptionsPopup = async (blob: Blob, filename: string): Promise<void> => {
  return new Promise((resolve) => {
    // Create popup overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      animation: fadeIn 0.2s ease;
    `;

    // Create popup dialog
    const dialog = document.createElement('div');
    dialog.style.cssText = `
      background: linear-gradient(135deg, rgba(0, 40, 80, 0.95), rgba(0, 20, 40, 0.98));
      border: 2px solid rgba(0, 255, 255, 0.4);
      border-radius: 16px;
      padding: 24px;
      max-width: 400px;
      width: 90%;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 0 40px rgba(0, 255, 255, 0.2);
      animation: slideIn 0.3s ease;
    `;

    dialog.innerHTML = `
      <style>
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideIn {
          from { transform: translateY(-20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .download-option-btn {
          width: 100%;
          padding: 14px 20px;
          margin: 8px 0;
          border: none;
          border-radius: 10px;
          font-size: 15px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }
        .download-option-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 16px rgba(0, 191, 255, 0.4);
        }
        .download-option-btn:active {
          transform: translateY(0);
        }
        .browser-download {
          background: linear-gradient(45deg, #2196F3, #1976D2);
          color: white;
        }
        .android-share {
          background: linear-gradient(45deg, #4CAF50, #388E3C);
          color: white;
        }
        .cancel-btn {
          background: linear-gradient(45deg, #666, #555);
          color: white;
        }
      </style>
      <h3 style="color: #00ffff; margin: 0 0 8px 0; font-size: 20px; text-align: center;">
        📥 Choose Download Method
      </h3>
      <p style="color: #888; font-size: 13px; text-align: center; margin: 0 0 20px 0;">
        ${filename}
      </p>
      <button class="download-option-btn browser-download" id="browser-download">
        <span style="font-size: 20px;">🌐</span>
        <span>Browser Download</span>
      </button>
      ${isCapacitorNative() ? `
        <button class="download-option-btn android-share" id="android-share">
          <span style="font-size: 20px;">📱</span>
          <span>Save to Device & Share</span>
        </button>
      ` : ''}
      <button class="download-option-btn cancel-btn" id="cancel-download">
        <span style="font-size: 20px;">✕</span>
        <span>Cancel</span>
      </button>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    // Handle browser download
    const browserBtn = dialog.querySelector('#browser-download');
    browserBtn?.addEventListener('click', async () => {
      try {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 100);
      } catch (error) {
        console.error('Browser download error:', error);
      }
      document.body.removeChild(overlay);
      resolve();
    });

    // Handle Android share (if available)
    const androidBtn = dialog.querySelector('#android-share');
    androidBtn?.addEventListener('click', async () => {
      try {
        await saveFileToDevice(blob, filename, blob.type || 'application/octet-stream');
      } catch (error) {
        console.error('Android share error:', error);
      }
      document.body.removeChild(overlay);
      resolve();
    });

    // Handle cancel
    const cancelBtn = dialog.querySelector('#cancel-download');
    cancelBtn?.addEventListener('click', () => {
      document.body.removeChild(overlay);
      resolve();
    });

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        document.body.removeChild(overlay);
        resolve();
      }
    });
  });
};

/**
 * Handles file export operations by showing a popup to choose download method
 * @param blob The file blob to export
 * @param filename The name to save the file as
 */
export const handleFileExport = async (blob: Blob, filename: string): Promise<void> => {
  try {
    await showDownloadOptionsPopup(blob, filename);
  } catch (error) {
    console.error('Error handling file export:', error);
    // Fallback to browser download
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }
};