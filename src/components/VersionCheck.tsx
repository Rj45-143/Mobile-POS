import React, { useEffect, useState } from "react";
import { IonAlert, IonContent, IonPage, isPlatform } from "@ionic/react";

const VersionCheck: React.FC = () => {
  const [latestVersion, setLatestVersion] = useState<string>("");
  const [isUpdateRequired, setIsUpdateRequired] = useState<boolean>(false);
  const [showAlert, setShowAlert] = useState<boolean>(false);

  const currentVersion = import.meta.env.VITE_CURRENT_VERSION;
  const checkForUpdates = async () => {
    try {
      console.log("Checking for updates...");
      const response = await fetch(
        `${import.meta.env.VITE_API_ENDPOINT_DRIVER}/api/AppVersion`
      );
      if (!response.ok) throw new Error("Failed to fetch version info");

      const data = await response.json();

      // Find the driver version only
      const riderData = data.find(
        (item: { Description: string }) =>
          item.Description.toLowerCase() === "rider"
      );

      if (!riderData) {
        console.warn("No driver version data found.");
        return;
      }

      const serverVersion = riderData.LatestVersion;
      setLatestVersion(serverVersion);

      if (
        currentVersion &&
        serverVersion &&
        serverVersion.localeCompare(currentVersion, undefined, {
          numeric: true,
        }) > 0
      ) {
        setIsUpdateRequired(true);
        setShowAlert(true);
      }
    } catch (error) {
      console.error("Error checking version:", error);
    }
  };

  useEffect(() => {
    checkForUpdates();
  }, []);

  const handleUpdateNow = () => {
    if (isPlatform("android")) {
      window.open(
        "https://play.google.com/store/apps/details?id=com.ipick.starter&pcampaignid=web_share",
        "_blank"
      );
    } else if (isPlatform("ios")) {
      window.open(
        "https://apps.apple.com/ph/app/ipick-booking-services/id6738897138",
        "_blank"
      );
    } else {
      alert(
        "Please update your app from the App Store (iOS) or Google Play Store (Android)."
      );
    }
  };

  return (
    <IonPage>
      <IonContent>
        <IonAlert
          isOpen={showAlert}
          backdropDismiss={false}
          header="Update Available!"
          message={`A new version (${latestVersion}) is available. Please update to continue.`}
          buttons={[
            {
              text: "Update Now",
              handler: handleUpdateNow,
            },
          ]}
        />
      </IonContent>
    </IonPage>
  );
};

export default VersionCheck;
