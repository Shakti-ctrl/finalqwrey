package com.shakti.smartimagecropper;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Enable desktop mode for WebView
        this.bridge.getWebView().getSettings().setUseWideViewPort(true);
        this.bridge.getWebView().getSettings().setLoadWithOverviewMode(true);
        this.bridge.getWebView().getSettings().setSupportZoom(true);
        this.bridge.getWebView().getSettings().setBuiltInZoomControls(true);
        this.bridge.getWebView().getSettings().setDisplayZoomControls(false);
        
        // Set user agent to desktop mode
        String userAgent = this.bridge.getWebView().getSettings().getUserAgentString();
        this.bridge.getWebView().getSettings().setUserAgentString(userAgent.replace("Mobile", "Desktop"));
    }
}