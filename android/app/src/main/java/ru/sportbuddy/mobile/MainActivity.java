package ru.sportbuddy.mobile;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;
import android.content.pm.ApplicationInfo;
import android.webkit.WebView;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Enabled only for debuggable Android builds; release APK remains locked down.
        if ((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
            WebView.setWebContentsDebuggingEnabled(true);
        }
        super.onCreate(savedInstanceState);
    }
}
