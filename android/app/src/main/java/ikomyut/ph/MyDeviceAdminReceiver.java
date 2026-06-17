package ikomyut.ph;

import android.app.admin.DeviceAdminReceiver;
import android.content.Context;
import android.content.Intent;
import android.widget.Toast;

public class MyDeviceAdminReceiver extends DeviceAdminReceiver {
    void showToast(Context context, String msg) {
        Toast.makeText(context, msg, Toast.LENGTH_SHORT).show();
    }

    @Override
    public void onEnabled(Context context, Intent intent) {
        showToast(context, "Device Admin Enabled");
    }

    @Override
    public void onDisabled(Context context, Intent intent) {
        showToast(context, "Device Admin Disabled");
    }
}
