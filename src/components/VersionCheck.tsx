import React, { useEffect, useState } from "react";
import { IonModal, IonIcon } from "@ionic/react";
import { cloudDownloadOutline, arrowForwardOutline } from "ionicons/icons";
import { App } from "@capacitor/app";
import { AppLauncher } from "@capacitor/app-launcher";
import { Browser } from "@capacitor/browser";
import axiosInstance from "../services/axiosInstance";

interface VersionCheckProps {
    token: string | null;
}

// Android-only muna ang app (wala pang iOS release ang iKomyutPH).
const ANDROID_PACKAGE_ID = "ikomyut.ph";
const ANDROID_PLAY_URL = `https://play.google.com/apps/internaltest/4700960849961892196`;
const ANDROID_MARKET_URI = `market://details?id=${ANDROID_PACKAGE_ID}`;

const VersionCheck: React.FC<VersionCheckProps> = ({ token }) => {
    const [currentVersion] = useState<string>(() => import.meta.env.VITE_CURRENT_VERSION ?? "—");
    const [latestVersion, setLatestVersion] = useState<string | null>(null);
    const [isOutdated, setIsOutdated] = useState(false);

    useEffect(() => {
        if (!token) return;

        let isMounted = true;

        const checkVersion = async () => {
            try {
                const response = await axiosInstance.get("/versions", {
                    headers: { Authorization: `Bearer ${token}` },
                });

                const versions = response.data;
                const latest = Array.isArray(versions) ? versions[versions.length - 1] : versions;
                const latestVer = latest?.latestVersion;

                if (!isMounted) return;

                if (latestVer && latestVer !== currentVersion) {
                    setLatestVersion(latestVer);
                    setIsOutdated(true);
                } else {
                    setIsOutdated(false);
                }
            } catch (err) {
                console.error("Version check failed:", err);
            }
        };

        checkVersion();

        const listenerPromise = App.addListener("appStateChange", (state) => {
            if (state.isActive) checkVersion();
        });

        return () => {
            isMounted = false;
            listenerPromise.then((listener) => listener.remove());
        };
    }, [token, currentVersion]);

    // ── Update navigation ──
    // market://details?id=... ang scheme na inaangkin/claim mismo ng Play
    // Store app sa Android — kaya ito ang PRIMARY path: direktang magbubukas
    // sa Play Store APP (hindi browser) papunta sa page ng ikomyut.ph. Kung
    // naka-enroll na bilang tester ang account sa device (Google Group /
    // internal test invite), dito mismo makikita ang internal test version
    // at ang "Update" button.
    //
    // Ang ANDROID_PLAY_URL (/apps/internaltest/...) ay para lang sa
    // FIRST-TIME opt-in ng bagong tester (browser-based enrollment flow) —
    // kaya iniiwan lang ito bilang FALLBACK, kung sakaling:
    //   (a) hindi pa naka-install ang Play Store app sa device, o
    //   (b) hindi pa naka-enroll bilang tester ang account (kaya kailangan
    //       pa munang dumaan sa opt-in page).
    const handleUpdateNow = async () => {
        try {
            const { completed } = await AppLauncher.openUrl({ url: ANDROID_MARKET_URI });
            if (completed) return;
            throw new Error("market:// intent not handled (completed: false)");
        } catch (err) {
            console.error("market:// open failed, falling back to opt-in link:", err);
            try {
                await Browser.open({ url: ANDROID_PLAY_URL });
            } catch (fallbackErr) {
                console.error("Fallback Browser.open also failed:", fallbackErr);
            }
        }
    };

    return (
        <IonModal
            isOpen={isOutdated}
            backdropDismiss={false}
            canDismiss={false}
            style={{
                "--width": "min(92vw, 360px)",
                "--height": "auto",
                "--border-radius": "20px",
                "--background": "transparent",
                "--box-shadow": "none",
                "--backdrop-opacity": "0.65",
            } as React.CSSProperties}
        >
            <div
                style={{
                    background: "#fff",
                    borderRadius: "20px",
                    padding: "32px 24px 26px",
                    textAlign: "center",
                    boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
                }}
            >
                <div
                    style={{
                        width: "60px",
                        height: "60px",
                        borderRadius: "50%",
                        background: "linear-gradient(135deg, #115830, #1b7a45)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        margin: "0 auto 18px",
                        boxShadow: "0 8px 20px rgba(17,88,48,0.35)",
                    }}
                >
                    <IonIcon icon={cloudDownloadOutline} style={{ fontSize: "26px", color: "#fff" }} />
                </div>

                <p
                    style={{
                        margin: "0 0 6px",
                        fontSize: "11px",
                        fontWeight: 700,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: "#115830",
                    }}
                >
                    New Version Available
                </p>

                <h2 style={{ margin: "0 0 10px", fontSize: "19px", fontWeight: 800, color: "#111827" }}>
                    Update needed to continue
                </h2>

                <p style={{ margin: "0 0 22px", fontSize: "13.5px", lineHeight: 1.5, color: "#4b5563" }}>
                    iKomyutPH works best on the latest version. Update now to keep generating and printing tickets without issues.
                </p>

                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "10px",
                        marginBottom: "24px",
                    }}
                >
                    <div
                        style={{
                            background: "#f3f4f6",
                            borderRadius: "8px",
                            padding: "6px 12px",
                            fontFamily: "'Roboto Mono', monospace",
                            fontSize: "12.5px",
                            fontWeight: 600,
                            color: "#6b7280",
                        }}
                    >
                        v{currentVersion}
                    </div>
                    <IonIcon icon={arrowForwardOutline} style={{ fontSize: "16px", color: "#9ca3af" }} />
                    <div
                        style={{
                            background: "#e6f0ea",
                            borderRadius: "8px",
                            padding: "6px 12px",
                            fontFamily: "'Roboto Mono', monospace",
                            fontSize: "12.5px",
                            fontWeight: 700,
                            color: "#115830",
                        }}
                    >
                        v{latestVersion}
                    </div>
                </div>

                <button
                    onClick={handleUpdateNow}
                    style={{
                        width: "100%",
                        background: "#115830",
                        color: "#fff",
                        border: "none",
                        borderRadius: "12px",
                        padding: "14px",
                        fontSize: "15px",
                        fontWeight: 700,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                        boxShadow: "0 8px 20px rgba(17,88,48,0.3)",
                        cursor: "pointer",
                    }}
                >
                    <IonIcon icon={cloudDownloadOutline} style={{ fontSize: "17px" }} />
                    Update Now
                </button>

                <p style={{ margin: "14px 0 0", fontSize: "11.5px", color: "#9ca3af" }}>
                    You'll be redirected to Google Play
                </p>
            </div>
        </IonModal>
    );
};

export default VersionCheck;