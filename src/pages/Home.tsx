import React, { useCallback, useEffect, useState } from "react";
import SearchableSelect from "../components/SearchableSelect";
import {
    IonPage,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonIcon,
    IonContent,
    IonCard,
    IonCardContent,
    IonItem,
    IonLabel,
    IonToast,
    IonToggle,
    IonAlert,
    useIonRouter,
    IonAvatar,
} from "@ionic/react";
import { App } from "@capacitor/app";
import { swapHorizontalOutline, powerOutline, ticketOutline, refreshOutline } from "ionicons/icons";
import { useAuth } from "../contexts/AuthContext";
import { getFleetByUsername, getRouteById, getStopoversByRouteId, getUnitByCode } from "../services/apiService";
import Loading from "../components/Loading";
import TicketActionButton from "../components/TicketActionButton";
import { TicketPayload, saveTicket } from "../services/ticketService";
import { generateTicketNumber } from "../utils/ticketNumber";
import { getDrivingDistance } from "../utils/getDistance";
import { BluetoothSerial } from "@awesome-cordova-plugins/bluetooth-serial";
import { requestBluetoothPermissions } from "../utils/bluetoothPermision";
import { createTicketEscPos } from "../utils/bluetoothSerial";
import { previewReceipt } from "../utils/previewReceipt";
import { useLocationTracker } from "../hooks/useLocationTracker";
import { setAxiosLogout } from "../services/axiosInstance";
import axiosInstance from "../services/axiosInstance";

const Home: React.FC = () => {
    const { user, logout, token } = useAuth();
    const ionRouter = useIonRouter();

    // ── Register logout with axios interceptor ──
    useEffect(() => {
        setAxiosLogout(logout);
    }, [logout]);

    // ── States ──
    const [isSwitched, setIsSwitched] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [isDiscounted, setIsDiscounted] = useState(false);
    const [showLogoutAlert, setShowLogoutAlert] = useState(false);
    const [showBackAlert, setShowBackAlert] = useState(false);

    const [fleet, setFleet] = useState<any>(null);
    const [route, setRoute] = useState<any>(null);
    const [routeOne, setRouteOne] = useState<any>(null);
    const [unit, setUnit] = useState<any>(null);

    const [currentTime, setCurrentTime] = useState(() => new Date().toLocaleString());
    const [fare, setFare] = useState<number>(0);
    const [discount, setDiscounts] = useState<number>(0);
    const [distance, setDistance] = useState<number>(0);
    const [ticketNumber, setTicketNumber] = useState<string | null>(null);
    const [isPrinting, setIsPrinting] = useState(false);
    const [isFirstPrint, setIsFirstPrint] = useState(true);
    const [isAutoCapped, setIsAutoCapped] = useState(false);

    // ── Version check states ──
    const [isOutdated, setIsOutdated] = useState(false);
    const [latestVersion, setLatestVersion] = useState<string | null>(null);

    // ── Location tracking — pagkatapos ng fleet state ──
    useLocationTracker({
        userId: fleet?._id,
        token,
        enabled: !!user && !!token && !!fleet,
    });

    // ── Version check — runs once after login ──
    useEffect(() => {
        if (!token) return;

        const checkVersion = async () => {
            try {
                const response = await axiosInstance.get("/versions", {
                    headers: { Authorization: `Bearer ${token}` },
                });

                const versions = response.data;
                const latest = Array.isArray(versions) ? versions[versions.length - 1] : versions;
                const latestVer = latest?.latestVersion;
                const currentVer = import.meta.env.VITE_CURRENT_VERSION;

                if (latestVer && latestVer !== currentVer) {
                    setLatestVersion(latestVer);
                    setIsOutdated(true);
                }
            } catch (err) {
                console.error("Version check failed:", err);
            }
        };

        checkVersion();
    }, [token]);

    // Active route based on toggle
    const activeRoute = isSwitched ? routeOne : route;

    const [selectedPickup, setSelectedPickup] = useState("");
    const [selectedDropoff, setSelectedDropoff] = useState("");

    // Ticket info rows
    const ticketInfo = [
        { label: "Date", value: currentTime },
        { label: "Ref No.", value: ticketNumber || <IonIcon icon={ticketOutline} /> },
        { label: "Plate No.", value: unit?.plateNumber },
        { label: "Fare", value: fare ? `₱${fare.toFixed(2)}` : "₱0.00" },
        ...(isAutoCapped ? [
            { label: "Distance", value: `${activeRoute?.fixedDistance ?? 0} km` },
        ] : []),
    ];

    // Intercept hardware back button
    useEffect(() => {
        const handler = App.addListener("backButton", ({ canGoBack }) => {
            if (!ionRouter.canGoBack()) {
                setShowBackAlert(true);
            }
        });
        return () => {
            handler.then(h => h.remove());
        };
    }, [ionRouter]);

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date().toLocaleString());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const toggleRouteDirection = () => {
        setIsSwitched(prev => !prev);
        setSelectedPickup("");
        setSelectedDropoff("");
        setTicketNumber(null);
        setFare(0);
        setIsAutoCapped(false);
    };

    const fetchFleetData = async (type: "routes" | "units", id: string) => {
        if (!token) { setError("Token missing."); return null; }
        try {
            const data = type === "routes"
                ? await getRouteById(id, token)
                : await getUnitByCode(id, token);
            return data;
        } catch (err: any) {
            console.error(err.message || "Unable to fetch data.");
            return null;
        }
    };

    useEffect(() => {
        if (!user || !token) return;

        const fetchAllFleetData = async () => {
            setLoading(true);
            setError("");
            try {
                const fleetResponse = await getFleetByUsername(token);
                const fleetData = Array.isArray(fleetResponse) ? fleetResponse[0] : fleetResponse;

                if (!fleetData) {
                    setError("No assigned fleet for you. Please ask your management.");
                    return;
                }

                if (fleetData.status === "Archived") {
                    setFleet(null);
                    setError("Your fleet assignment has been archived. Please contact your management.");
                    return;
                }

                setFleet(fleetData);

                const unitParts = fleetData.unitCodeDetails?.split(" | ") ?? [];
                setUnit({
                    unitCode: fleetData.assignUnitCode ?? unitParts[2] ?? "",
                    plateNumber: unitParts[1] ?? "",
                    bodyNumber: unitParts[0] ?? "",
                });

                const { assignedRouteId, assignedRouteIdOne } = fleetData;

                const [routeData, routeDataOne, stopoverData, stopoverDataOne] = await Promise.all([
                    assignedRouteId ? getRouteById(assignedRouteId, token) : null,
                    assignedRouteIdOne ? getRouteById(assignedRouteIdOne, token) : null,
                    assignedRouteId ? getStopoversByRouteId(assignedRouteId, token) : null,
                    assignedRouteIdOne ? getStopoversByRouteId(assignedRouteIdOne, token) : null,
                ]);

                if (routeData) setRoute({ ...routeData, stopOver: stopoverData ?? [] });
                if (routeDataOne) setRouteOne({ ...routeDataOne, stopOver: stopoverDataOne ?? [] });

            } catch (err) {
                console.error("Fleet data fetch error:", err);
                setError("Failed to fetch complete fleet information.");
            } finally {
                setLoading(false);
            }
        };

        fetchAllFleetData();
    }, [user, token]);

    const handleGenerate = useCallback(async () => {
        if (!selectedPickup?.trim() || !selectedDropoff?.trim())
            return alert("Please select both pick-up and drop-off");
        if (!user?.username || !token) return alert("Not authenticated");

        setLoading(true);
        try {
            const fleetResponse = await getFleetByUsername(token);
            const fleetData = Array.isArray(fleetResponse) ? fleetResponse[0] : fleetResponse;
            if (!fleetData) {
                alert("Failed to retrieve fleet data.");
                window.location.reload();
                return;
            }
            if (fleetData.status === "Archived") {
                alert("Your fleet assignment has been archived. You can no longer issue tickets.");
                setFleet(null);
                return;
            }

            const stopPickup = activeRoute?.stopOver?.find((s: any) => s.name === selectedPickup);
            const stopDropoff = activeRoute?.stopOver?.find((s: any) => s.name === selectedDropoff);

            if (
                !stopPickup?.location?.coordinates ||
                stopPickup.location.coordinates.length !== 2 ||
                !stopDropoff?.location?.coordinates ||
                stopDropoff.location.coordinates.length !== 2
            ) {
                alert("Invalid stopover coordinates.");
                return;
            }

            const origin = {
                lat: stopPickup.location.coordinates[1],
                lng: stopPickup.location.coordinates[0],
            };
            const destination = {
                lat: stopDropoff.location.coordinates[1],
                lng: stopDropoff.location.coordinates[0],
            };

            const rawDistance = await getDrivingDistance(origin, destination);
            let calculatedDistance = Math.round(rawDistance * 100) / 100;

            const minFare = activeRoute?.minFare ?? 15;
            const perKmRate = activeRoute?.farePerKm ?? 2.5;
            const computedFare = calculatedDistance <= 4
                ? minFare
                : minFare + (calculatedDistance - 4) * perKmRate;

            const p2pFare = activeRoute?.fareP2P ?? 0;
            const p2pDistance = activeRoute?.fixedDistance ?? 0;

            let baseFare = computedFare;

            if (p2pFare > 0 && computedFare > p2pFare) {
                baseFare = p2pFare;
                calculatedDistance = p2pDistance;
                setIsAutoCapped(true);
            } else {
                setIsAutoCapped(false);
            }

            let discountAmount = 0;
            let finalFare = parseFloat(baseFare.toFixed(2));

            if (isDiscounted) {
                discountAmount = parseFloat((baseFare * 0.2).toFixed(2));
                finalFare = parseFloat((baseFare - discountAmount).toFixed(2));
                setDiscounts(discountAmount);
            } else {
                setDiscounts(0);
            }

            setDistance(calculatedDistance);
            setFare(finalFare);
            setTicketNumber(generateTicketNumber());

        } catch (error) {
            console.error("Ticket generation error:", JSON.stringify(error, null, 2));
            alert("Failed to generate ticket. Please try again.");
        } finally {
            setLoading(false);
        }
    }, [
        selectedPickup,
        selectedDropoff,
        user,
        token,
        route,
        routeOne,
        isSwitched,
        isDiscounted,
        activeRoute,
    ]);

    const buildTicketPayload = (currentTicketNumber: string): TicketPayload => {
        const pickUpStop = activeRoute?.stopOver?.find((s: any) => s.name === selectedPickup);
        const dropOffStop = activeRoute?.stopOver?.find((s: any) => s.name === selectedDropoff);

        return {
            refNumber: currentTicketNumber,
            unitCode: unit?.unitCode,
            plateNumber: unit?.plateNumber,
            bodyNumber: unit?.bodyNumber ?? "",
            routeId: activeRoute?.routeId,
            driverUsername: fleet?.assignedDriverId,
            conductorUsername: user?.username ?? "",
            pickupLoc: {
                type: "Point",
                coordinates: pickUpStop?.location?.coordinates ?? [0, 0],
            },
            dropoffLoc: {
                type: "Point",
                coordinates: dropOffStop?.location?.coordinates ?? [0, 0],
            },
            pickupAddress: pickUpStop?.name ?? "Unknown Pickup",
            dropoffAddress: dropOffStop?.name ?? "Unknown Dropoff",
            timestamp: new Date().toISOString(),
            fare,
            distance,
            discount,
        };
    };

    const resetForm = () => {
        setTicketNumber(null);
        setFare(0);
        setDistance(0);
        setDiscounts(0);
        setSelectedPickup("");
        setSelectedDropoff("");
        setIsAutoCapped(false);
    };

    const handleSave = async () => {
        if (fleet?.status === "Archived") {
            alert("Your fleet assignment has been archived.");
            return;
        }
        if (!ticketNumber || !user || !token) {
            alert("No ticket to save. Please generate a ticket first.");
            return;
        }

        setLoading(true);
        try {
            const payload = buildTicketPayload(ticketNumber);
            const saved = await saveTicket(payload, token);
            if (!saved) {
                alert("Failed to save ticket to system.");
                return;
            }
            alert(`Ticket saved successfully!\nReference no. ${ticketNumber}`);
            resetForm();
        } catch (err) {
            console.error("Save error:", err);
            alert("Something went wrong while saving.");
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = async () => {
        if (fleet?.status === "Archived") {
            alert("Your fleet assignment has been archived.");
            return;
        }
        if (!ticketNumber || !user || !token) {
            alert("No ticket to print. Please generate a ticket first.");
            return;
        }
        if (isPrinting) return;

        const currentTicketNumber = ticketNumber;
        setIsPrinting(true);
        setLoading(true);

        try {
            const payload = buildTicketPayload(currentTicketNumber);
            const saved = await saveTicket(payload, token);
            if (!saved) {
                alert("Failed to save ticket to system.");
                return;
            }

            const hasPermission = await requestBluetoothPermissions();
            if (!hasPermission) {
                alert("Bluetooth permissions not granted.");
                return;
            }

            const isEnabled = await BluetoothSerial.isEnabled();
            if (!isEnabled) {
                alert("Please enable Bluetooth first.");
                return;
            }

            const devices = await BluetoothSerial.list();
            if (devices.length === 0) {
                alert("No paired Bluetooth devices found.");
                return;
            }

            const printer = devices[0];
            const routeName = isSwitched
                ? `${routeOne?.terminalPointA} - ${routeOne?.terminalPointB}`
                : `${route?.terminalPointA} - ${route?.terminalPointB}`;
            const printData = createTicketEscPos(payload, user?.companyName, routeName);

            await new Promise<void>((resolve, reject) => {
                const subscription = BluetoothSerial.connect(printer.id).subscribe({
                    next: async () => {
                        try {
                            if (isFirstPrint) {
                                await new Promise(res => setTimeout(res, 1500));
                                setIsFirstPrint(false);
                            } else {
                                await new Promise(res => setTimeout(res, 500));
                            }

                            const initCommand = new Uint8Array([0x1B, 0x40]);
                            await BluetoothSerial.write(initCommand.buffer);
                            await new Promise(res => setTimeout(res, isFirstPrint ? 800 : 400));
                            await BluetoothSerial.write(printData.buffer);
                            await new Promise(res => setTimeout(res, 3500));

                            alert(`Ticket printed successfully!\nReference no. ${currentTicketNumber}`);
                            resetForm();
                            resolve();
                        } catch (writeErr) {
                            alert("Error sending data to printer. Ticket saved but not printed.");
                            reject(writeErr);
                        } finally {
                            try {
                                await BluetoothSerial.disconnect();
                            } catch (e) {
                                console.error("Disconnect error:", e);
                            }
                            subscription.unsubscribe();
                        }
                    },
                    error: (err) => {
                        alert(`Failed to connect to printer: ${printer.name}\nTicket saved but not printed.`);
                        subscription.unsubscribe();
                        reject(err);
                    },
                });
            });

        } catch (err) {
            console.error("Print error:", err);
            alert("Something went wrong while printing.");
        } finally {
            setLoading(false);
            setIsPrinting(false);
        }
    };

    return (
        <IonPage>
            <IonHeader className="ion-no-border">
                <IonToolbar color="primary">
                    <IonButtons slot="start">
                        <IonAvatar style={{ width: "36px", height: "36px", margin: "0 8px" }}>
                            {user?.profileImage ? (
                                <img
                                    src={user.profileImage}
                                    alt="Profile"
                                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                />
                            ) : (
                                <div style={{
                                    width: "100%",
                                    height: "100%",
                                    borderRadius: "50%",
                                    backgroundColor: "#115830",
                                    border: "2px solid rgba(255,255,255,0.5)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    color: "white",
                                    fontWeight: "bold",
                                    fontSize: "16px",
                                }}>
                                    {user?.firstName?.charAt(0).toUpperCase() ?? "C"}
                                </div>
                            )}
                        </IonAvatar>
                    </IonButtons>

                    <IonTitle>Welcome, {user?.firstName || "Conductor"}</IonTitle>

                    <IonButtons slot="end">
                        {ticketNumber && (
                            <IonButton onClick={resetForm}>
                                <IonIcon icon={refreshOutline} />
                            </IonButton>
                        )}
                        <IonButton onClick={toggleRouteDirection}>
                            <IonIcon icon={swapHorizontalOutline} />
                        </IonButton>
                        <IonButton onClick={() => setShowLogoutAlert(true)}>
                            <IonIcon icon={powerOutline} />
                        </IonButton>
                    </IonButtons>
                </IonToolbar>
            </IonHeader>

            <IonContent className="ion-padding">

                {/* ── Force Update Alert — hindi pwedeng i-dismiss ── */}
                <IonAlert
                    isOpen={isOutdated}
                    backdropDismiss={false}
                    header="🚨 Update Required"
                    message={`Version ${latestVersion} is now available. Please update the app to continue.`}
                    buttons={[
                        {
                            text: "Update Now",
                            handler: () => {
                                window.open(
                                    "https://play.google.com/store/apps/details?id=YOUR_APP_ID",
                                    "_blank"
                                );
                                logout();
                            },
                        },
                    ]}
                />

                {fleet ? (
                    <IonCard className="custom-card">
                        <div className="center-text">
                            <h2>iKomyutPH</h2>
                            <IonLabel
                                color="primary"
                                style={{ textTransform: "none", fontWeight: "bold", fontSize: "16px" }}
                            >
                                {isSwitched
                                    ? `${routeOne?.terminalPointA} → ${routeOne?.terminalPointB}`
                                    : `${route?.terminalPointA} → ${route?.terminalPointB}`}
                            </IonLabel>

                            {isAutoCapped && (
                                <div style={{ display: "flex", justifyContent: "center", marginTop: "6px" }}>
                                    <span style={{
                                        backgroundColor: "#115830",
                                        color: "white",
                                        borderRadius: "999px",
                                        padding: "4px 14px",
                                        fontSize: "11px",
                                        fontWeight: "700",
                                        letterSpacing: "0.08em",
                                        textTransform: "uppercase",
                                        boxShadow: "0 2px 6px rgba(245,158,11,0.35)",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "4px",
                                    }}>
                                        ⚡ Auto-capped to P2P Rate
                                    </span>
                                </div>
                            )}
                        </div>

                        <IonCardContent>
                            {ticketInfo.map((item, index) => (
                                <IonItem key={index}>
                                    <IonLabel style={{ whiteSpace: "nowrap" }}>{item.label}</IonLabel>
                                    <div style={{ width: "70%", textAlign: "right" }}>
                                        <p><strong>{item.value}</strong></p>
                                    </div>
                                </IonItem>
                            ))}

                            <SearchableSelect
                                label="Pick-up"
                                options={activeRoute?.stopOver || []}
                                value={selectedPickup}
                                onSelect={(val: string) => {
                                    setSelectedPickup(val);
                                    setTicketNumber(null);
                                    setFare(0);
                                    setIsAutoCapped(false);
                                }}
                            />

                            <SearchableSelect
                                label="Drop-off"
                                options={activeRoute?.stopOver || []}
                                value={selectedDropoff}
                                onSelect={(val: string) => {
                                    setSelectedDropoff(val);
                                    setTicketNumber(null);
                                    setFare(0);
                                    setIsAutoCapped(false);
                                }}
                            />

                            <IonItem lines="none">
                                <IonLabel>Discount 20%</IonLabel>
                                <IonToggle
                                    slot="end"
                                    checked={isDiscounted}
                                    onIonChange={(e) => {
                                        setIsDiscounted(e.detail.checked);
                                        setTicketNumber(null);
                                        setFare(0);
                                    }}
                                />
                            </IonItem>

                            <TicketActionButton
                                disabled={loading || isPrinting}
                                ticketNumber={ticketNumber}
                                onGenerate={handleGenerate}
                                onPrint={handlePrint}
                                onSave={handleSave}
                            />
                        </IonCardContent>
                    </IonCard>
                ) : (
                    <IonCard className="custom-card">
                        <IonCardContent style={{ textAlign: "center", color: "red", fontWeight: "bold" }}>
                            No assigned fleet for you. Please ask your management.
                            <div style={{ marginTop: "1rem" }}>
                                <IonButton
                                    onClick={() => window.location.reload()}
                                    color="primary"
                                    size="small"
                                    fill="clear"
                                >
                                    Try to Refresh
                                </IonButton>
                            </div>
                        </IonCardContent>
                    </IonCard>
                )}

                <Loading isOpen={loading} message="Processing..." />

                <IonToast
                    isOpen={!!error}
                    message={error}
                    duration={3000}
                    color="danger"
                    onDidDismiss={() => setError("")}
                />

                <IonAlert
                    isOpen={showLogoutAlert}
                    onDidDismiss={() => setShowLogoutAlert(false)}
                    header="Logout"
                    message="Are you sure you want to log out?"
                    buttons={[
                        { text: "Cancel", role: "cancel" },
                        { text: "Logout", role: "destructive", handler: logout },
                    ]}
                />

                <IonAlert
                    isOpen={showBackAlert}
                    onDidDismiss={() => setShowBackAlert(false)}
                    header="Exit App"
                    message="Are you sure you want to exit?"
                    buttons={[
                        { text: "Cancel", role: "cancel" },
                        {
                            text: "Exit",
                            role: "destructive",
                            handler: () => App.exitApp(),
                        },
                    ]}
                />
            </IonContent>
        </IonPage>
    );
};

export default Home;