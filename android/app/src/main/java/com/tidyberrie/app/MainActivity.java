package com.tidyberrie.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(ReminderSettingsPlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (getBridge() != null) {
            getBridge().eval("window.dispatchEvent(new Event('tidyberrie-reminder-refresh'))", null);
        }
    }
}
