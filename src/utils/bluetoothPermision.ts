export async function requestBluetoothPermissions(): Promise<boolean> {
  const permissions = (window as any).cordova.plugins.permissions;

  const requiredPermissions = [
    permissions.BLUETOOTH_SCAN,
    permissions.BLUETOOTH_CONNECT,
    permissions.ACCESS_FINE_LOCATION, // Still needed on Android <12 for discovery
  ];

  return new Promise((resolve) => {
    permissions.requestPermissions(
      requiredPermissions,
      (status: any) => {
        const allGranted = requiredPermissions.every(
          (p) =>
            status.hasPermission || status[p] === permissions.PERMISSION_GRANTED
        );
        resolve(allGranted);
      },
      (err: any) => {
        console.error("Permission request failed", err);
        resolve(false);
      }
    );
  });
}
