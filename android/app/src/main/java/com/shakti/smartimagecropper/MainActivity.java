
package com.shakti.smartimagecropper;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Enable hardware acceleration
        this.bridge.getWebView().setLayerType(android.view.View.LAYER_TYPE_HARDWARE, null);
        
        // Enable desktop mode for WebView
        this.bridge.getWebView().getSettings().setUseWideViewPort(true);
        this.bridge.getWebView().getSettings().setLoadWithOverviewMode(true);
        this.bridge.getWebView().getSettings().setSupportZoom(true);
        this.bridge.getWebView().getSettings().setBuiltInZoomControls(true);
        this.bridge.getWebView().getSettings().setDisplayZoomControls(false);
        
        // Performance optimizations
        this.bridge.getWebView().getSettings().setDomStorageEnabled(true);
        this.bridge.getWebView().getSettings().setDatabaseEnabled(true);
        this.bridge.getWebView().getSettings().setCacheMode(android.webkit.WebSettings.LOAD_DEFAULT);
        
        // Set user agent to desktop mode
        String userAgent = this.bridge.getWebView().getSettings().getUserAgentString();
        this.bridge.getWebView().getSettings().setUserAgentString(userAgent.replace("Mobile", "Desktop"));
    }
    
    @Override
    public void onPause() {
        super.onPause();
        // Pause WebView to free resources
        this.bridge.getWebView().onPause();
    }
    
    @Override
    public void onResume() {
        super.onResume();
        // Resume WebView
        this.bridge.getWebView().onResume();
    }
}
