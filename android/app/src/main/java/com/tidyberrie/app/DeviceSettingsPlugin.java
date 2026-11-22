package com.tidyberrie.app;

import android.content.ComponentName;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "DeviceSettings")
public class DeviceSettingsPlugin extends Plugin {
    private Intent appDetails() {
        return new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
            Uri.fromParts("package", getContext().getPackageName(), null));
    }

    private boolean launch(Intent intent) {
        try {
            getActivity().startActivity(intent);
            return true;
        } catch (RuntimeException exception) {
            return false;
        }
    }

    @PluginMethod
    public void open(PluginCall call) {
        String screen = call.getString("screen", "app");
        boolean opened = switch (screen) {
            case "battery" -> launch(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS));
            case "notifications" -> Build.VERSION.SDK_INT >= 26 &&
                launch(new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                    .putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName()));
            case "channel" -> Build.VERSION.SDK_INT >= 26 &&
                launch(new Intent(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS)
                    .putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName())
                    .putExtra(Settings.EXTRA_CHANNEL_ID, "tidyberrie-reminders"));
            case "autostart" -> launch(new Intent().setComponent(new ComponentName(
                "com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity")));
            default -> false;
        };
        if (opened || launch(appDetails())) call.resolve();
        else call.reject("Android settings are unavailable.");
    }

    @PluginMethod
    public void info(PluginCall call) {
        try {
            String name = getContext().getPackageName();
            JSObject info = new JSObject();
            info.put("appVersion", getContext().getPackageManager().getPackageInfo(name, 0).versionName);
            info.put("androidVersion", Build.VERSION.RELEASE);
            info.put("model", Build.MODEL);
            call.resolve(info);
        } catch (Exception exception) {
            call.reject("Device version information is unavailable.");
        }
    }
}
