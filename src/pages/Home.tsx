import React, { useCallback, useEffect, useReducer, useState } from "react";
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
import { swapHorizontalOutline, powerOutline, ticketOutline, refreshOutline, accessibilityOutline } from "ionicons/icons";
import { useAuth } from "../contexts/AuthContext";
import {
    getFleetByUsername,
    getRouteById,
    getStopoversByRouteId,
    FleetData,
    RouteData,
    Stopover,
    UnitData,
} from "../services/apiService";
import Loading from "../components/Loading";
import TicketActionButton from "../components/TicketActionButton";
import VersionCheck from "../components/VersionCheck";
import { TicketPayload, saveTicket } from "../services/ticketService";
import { generateTicketNumber } from "../utils/ticketNumber";
import { getDrivingDistance, getCachedCumulativeDistances } from "../utils/getDistance";
import { BluetoothSerial } from "@awesome-cordova-plugins/bluetooth-serial";
import { requestBluetoothPermissions } from "../utils/bluetoothPermision";
import { createTicketEscPos } from "../utils/bluetoothSerial";
import { previewReceipt } from "../utils/previewReceipt";
import { useLocationTracker } from "../hooks/useLocationTracker";
import { setAxiosLogout } from "../services/axiosInstance";
import { App } from "@capacitor/app";

// ── Stable empty-array reference, sa labas ng component ──
// Kapag gumawa ng bagong `[]` literal kada render (e.g. `stopOver || []`),
// nasisira ang React.memo ng SearchableSelect dahil laging "bago" ang
// reference kahit walang talagang nagbago. Gamit nalang ito.
const EMPTY_STOPOVERS: { name: string; idNumber?: number }[] = [];

// ── Hiwalay na clock component ──
// ITO LANG ang mag-re-render kada segundo. Dati, ang `currentTime` ay
// state ng buong Home component, kaya kada "tick" ay nare-render ulit
// ang LAHAT — modals, dropdowns, alerts — kahit hindi naman kailangan.
// Ito din pala ang pinagmulan ng "double search" sa SearchableSelect.
const LiveClock: React.FC = () => {
    const [time, setTime] = useState(() => new Date().toLocaleString());

    useEffect(() => {
        const id = setInterval(() => setTime(new Date().toLocaleString()), 1000);
        return () => clearInterval(id);
    }, []);

    return <>{time}</>;
};

// ── Ticket computation state, consolidated ──
// Dating 5 hiwalay na useState (fare, discount, distance, ticketNumber,
// isAutoCapped) na palaging nagbabago nang magkakasama. Reducer para
// hindi na possible ang "partial update" — bawat action ay eksaktong
// kopya ng dating magkakahiwalay na setState calls sa parehong lugar.
interface TicketState {
    ticketNumber: string | null;
    fare: number;
    distance: number;
    discount: number;
    isAutoCapped: boolean;
}

const initialTicketState: TicketState = {
    ticketNumber: null,
    fare: 0,
    distance: 0,
    discount: 0,
    isAutoCapped: false,
};

type TicketAction =
    | { type: "CLEAR_TICKET" }
    | { type: "CLEAR_FARE" }
    | { type: "FULL_RESET" }
    | {
        type: "GENERATE";
        payload: { ticketNumber: string; fare: number; distance: number; discount: number; isAutoCapped: boolean };
    };

const ticketReducer = (state: TicketState, action: TicketAction): TicketState => {
    switch (action.type) {
        case "CLEAR_TICKET":
            return { ...state, ticketNumber: null, fare: 0, distance: 0, isAutoCapped: false };
        case "CLEAR_FARE":
            return { ...state, ticketNumber: null, fare: 0 };
        case "FULL_RESET":
            return { ...initialTicketState };
        case "GENERATE":
            return { ...state, ...action.payload };
        default:
            return state;
    }
};

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
    const [loadingMessage, setLoadingMessage] = useState("Processing...");
    const [isDiscounted, setIsDiscounted] = useState(false);
    const [showLogoutAlert, setShowLogoutAlert] = useState(false);
    const [showBackAlert, setShowBackAlert] = useState(false);

    const [fleet, setFleet] = useState<FleetData | null>(null);
    const [route, setRoute] = useState<RouteData | null>(null);
    const [routeOne, setRouteOne] = useState<RouteData | null>(null);
    const [unit, setUnit] = useState<UnitData | null>(null);

    const [ticket, dispatchTicket] = useReducer(ticketReducer, initialTicketState);
    const { ticketNumber, fare, distance, discount, isAutoCapped } = ticket;
    const [isPrinting, setIsPrinting] = useState(false);
    const [isFirstPrint, setIsFirstPrint] = useState(true);

    // ── Location tracking — pagkatapos ng fleet state ──
    useLocationTracker({
        userId: fleet?._id,
        token,
        enabled: !!user && !!token && !!fleet,
        onError: setError,
    });

    // Active route based on toggle
    const activeRoute = isSwitched ? routeOne : route;

    const [selectedPickup, setSelectedPickup] = useState("");
    const [selectedDropoff, setSelectedDropoff] = useState("");

    // Ticket info rows — ang "Date" ay LiveClock na ngayon, hindi state
    // ng Home, kaya hindi na ito ang dahilan ng pag-re-render ng buong page.
    const ticketInfo = [
        { label: "Date", value: <LiveClock /> },
        { label: "Ref No.", value: ticketNumber || <IonIcon icon={ticketOutline} /> },
        { label: "Plate No.", value: unit?.plateNumber },
        { label: "Distance", value: `${distance} km` },
        { label: "Fare", value: fare ? `₱${fare.toFixed(2)}` : "₱0.00" },
    ];

    // ── Hardware / gesture back button handling ──
    //
    // MAHALAGANG NOTE: dating gamit dito ang `App.addListener("backButton", ...)`
    // mula sa @capacitor/app — pero ito ay RAW native listener lang. Sa likod,
    // may sarili pa ring DEFAULT handler ang IonRouterOutlet na naka-subscribe
    // sa `ionBackButton` DOM event (priority 0), at AUTOMATIC niyang ginagawa
    // ang `router.goBack()` papunta sa Login — kahit anong ilagay natin sa
    // App.addListener, hindi ito na-o-override, dahil ibang listener queue ito.
    //
    // Kaya nung pinindot ang back (hardware o gesture), DALAWA ang tumatakbo:
    //   1. ang sariling code natin (App.addListener) — wala namang ginagawa
    //      kapag may history pa (canGoBack() === true)
    //   2. ang DEFAULT Ionic handler — ito ang sumasagad bumalik agad sa
    //      Login, walang confirmation.
    //
    // AYOS: gamitin ang opisyal na `ionBackButton` event mismo, at magrehistro
    // ng HANDLER na may priority na MAS MATAAS sa default (na 0), gamit ang
    // `ev.detail.register(priority, callback)`. Dito na rin natin ititrato
    // ang "may pa-back pa sa history" bilang logout-intent (dahil ang
    // pinaka-likod na page lang naman sa stack ay Login, hindi natin gustong
    // bumalik diyan nang walang confirmation), at ang "wala nang history"
    // bilang exit-app intent.
    useEffect(() => {
        const handler = (ev: any) => {
            ev.detail.register(10, () => {
                // Sa Home page, ang pag-back (hardware o gesture) ay itrato
                // palaging bilang LOGOUT intent — hindi exit-app — dahil ang
                // Home ang root/landing page pagkatapos mag-login. Hindi na
                // kailangan ang `canGoBack()` check; lagi nang Logout alert.
                setShowLogoutAlert(true);
            });
        };

        document.addEventListener("ionBackButton", handler as EventListener);
        return () => {
            document.removeEventListener("ionBackButton", handler as EventListener);
        };
    }, []);
    const toggleRouteDirection = () => {
        setIsSwitched(prev => !prev);
        setSelectedPickup("");
        setSelectedDropoff("");
        dispatchTicket({ type: "CLEAR_TICKET" });
    };

    // ── Defensive dedupe + sort ──
    // Iniiwan lang ang HULING entry kapag paulit-ulit ang idNumber, tapos
    // isort ayon dito. Safety net lang ito kung sakaling magbalik ang
    // backend ng duplicate record balang araw — hindi nito babaguhin ang
    // normal na behavior kapag malinis naman ang datos.
    const dedupeAndSortStopovers = (list: Stopover[]): Stopover[] =>
        Array.from(new Map(list.map((s) => [s.idNumber, s])).values())
            .sort((a, b) => a.idNumber - b.idNumber);

    useEffect(() => {
        if (!user || !token) return;

        const fetchAllFleetData = async () => {
            setLoading(true);
            setLoadingMessage("Processing...");
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

                // Sort by idNumber (at dedupe bilang safety net) para consistent
                // ang pagkasunod-sunod kahit may bagong siningit na stopover.
                const stopOver = dedupeAndSortStopovers(stopoverData ?? []);
                const stopOverOne = dedupeAndSortStopovers(stopoverDataOne ?? []);

                // ── Pre-compute cumulative distances along the actual route path ──
                // ginagawa lang ito ONCE per route load (hindi kada ticket),
                // at cached sa device para hindi na ulit-ulit ang Directions API call.
                //
                // PARALLEL na tinatakbo ngayon ang dalawang route (dati sunod-
                // sunod), kaya kung wala pang cache ang dalawa, kalahati lang
                // ang hintayan kumpara dati.
                if (stopOver.length > 1 || stopOverOne.length > 1) {
                    setLoadingMessage("Computing route distances...");
                }

                const [cumulativeDistances, cumulativeDistancesOne] = await Promise.all([
                    routeData && stopOver.length > 1
                        ? getCachedCumulativeDistances(routeData._id, stopOver).catch((distErr) => {
                            console.error("Cumulative distance computation failed:", distErr);
                            return [] as number[];
                        })
                        : Promise.resolve([] as number[]),
                    routeDataOne && stopOverOne.length > 1
                        ? getCachedCumulativeDistances(routeDataOne._id, stopOverOne).catch((distErr) => {
                            console.error("Cumulative distance computation failed:", distErr);
                            return [] as number[];
                        })
                        : Promise.resolve([] as number[]),
                ]);

                if (routeData) {
                    setRoute({ ...routeData, stopOver, cumulativeDistances });
                }

                if (routeDataOne) {
                    setRouteOne({ ...routeDataOne, stopOver: stopOverOne, cumulativeDistances: cumulativeDistancesOne });
                }

            } catch (err) {
                console.error("Fleet data fetch error:", err);
                setError("Failed to fetch complete fleet information.");
            } finally {
                setLoading(false);
                setLoadingMessage("Processing...");
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

            // ── Gamit ang index sa stopOver array (sequential order) para hanapin
            // ang distansya base sa pre-computed cumulative distances, hindi
            // sa shortest-path na Directions/Distance Matrix calculation. ──
            const pickupIndex = activeRoute?.stopOver?.findIndex(
                (s) => s.name === selectedPickup
            ) ?? -1;
            const dropoffIndex = activeRoute?.stopOver?.findIndex(
                (s) => s.name === selectedDropoff
            ) ?? -1;

            if (pickupIndex === -1 || dropoffIndex === -1) {
                alert("Invalid pickup or dropoff stop.");
                return;
            }

            if (!activeRoute?.cumulativeDistances?.length) {
                alert("Distance data not available for this route. Please refresh and try again.");
                return;
            }

            const rawDistance = Math.abs(
                activeRoute.cumulativeDistances[dropoffIndex] -
                activeRoute.cumulativeDistances[pickupIndex]
            );
            let calculatedDistance = Math.round(rawDistance * 100) / 100;

            const minFare = activeRoute?.minFare ?? 15;
            const perKmRate = activeRoute?.farePerKm ?? 2.5;
            const computedFare = calculatedDistance <= 4
                ? minFare
                : minFare + (calculatedDistance - 4) * perKmRate;

            const p2pFare = activeRoute?.fareP2P ?? 0;
            const p2pDistance = activeRoute?.fixedDistance ?? 0;

            let baseFare = computedFare;
            let isFullP2PTrip = false;

            // FARE PROTECTION — hindi dapat lumagpas ang babayaran sa flat P2P
            // rate kahit partial trip pa lang, kung mas mahal pala ang per-km
            // computation kaysa sa flat rate.
            if (p2pFare > 0 && computedFare > p2pFare) {
                baseFare = p2pFare;
            }

            // DISTANCE / BADGE — ito lang ang nagdedesisyon kung "buong P2P trip"
            // talaga ito (para sa "Auto-capped" badge at sa pagpapakita ng
            // fixedDistance bilang Distance). HINDI kasabay ng fare protection
            // sa itaas, dahil maiiba ang totoong distansya sa partial trips.
            if (p2pFare > 0 && p2pDistance > 0 && calculatedDistance >= p2pDistance) {
                calculatedDistance = p2pDistance;
                isFullP2PTrip = true;
            }

            // ── Discount fare (Student/Elderly/PWD) ──
            // HIWALAY na formula ito, hindi simpleng "20% off" ng regular
            // fare — sinusunod ang opisyal na nakasaad na rate:
            //   unang 4km = ₱12.00 flat
            //   sumusunod na km = +₱1.76/km
            // Gamit ang `calculatedDistance` (na pwede na ring naka-cap sa
            // p2pDistance kung buong P2P trip), kaya tama rin ang resulta
            // kahit full-trip na ang biyahe.
            const discountMinFare = 12;
            const discountPerKmRate = 1.76;

            let discountAmount = 0;
            let finalFare = parseFloat(baseFare.toFixed(2));

            if (isDiscounted) {
                const discountedFare = calculatedDistance <= 4
                    ? discountMinFare
                    : discountMinFare + (calculatedDistance - 4) * discountPerKmRate;

                finalFare = parseFloat(discountedFare.toFixed(2));
                discountAmount = parseFloat((baseFare - discountedFare).toFixed(2));
            }

            dispatchTicket({
                type: "GENERATE",
                payload: {
                    ticketNumber: generateTicketNumber(),
                    fare: finalFare,
                    distance: calculatedDistance,
                    discount: discountAmount,
                    isAutoCapped: isFullP2PTrip,
                },
            });

        } catch (error) {
            console.error("Ticket generation error:", error);
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
        const pickUpStop = activeRoute?.stopOver?.find((s) => s.name === selectedPickup);
        const dropOffStop = activeRoute?.stopOver?.find((s) => s.name === selectedDropoff);

        return {
            refNumber: currentTicketNumber,
            unitCode: unit?.unitCode ?? "",
            plateNumber: unit?.plateNumber ?? "",
            bodyNumber: unit?.bodyNumber ?? "",
            routeId: activeRoute?.routeId ?? "",
            driverUsername: fleet?.assignedDriverId ?? "",
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
        dispatchTicket({ type: "FULL_RESET" });
        setSelectedPickup("");
        setSelectedDropoff("");
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

            const CONNECT_TIMEOUT_MS = 12000;

            await new Promise<void>((resolve, reject) => {
                let settled = false;

                // BluetoothSerial.connect() ay isang Observable na pwedeng
                // hindi kailanman mag-emit ng `next` o `error` kung ang
                // device ay basta na lang tumigil sa pagsagot (e.g. out of
                // range, naka-pair sa ibang phone) — walang built-in timeout
                // ang plugin, kaya ito mismo ang naghi-hang nang walang
                // feedback sa user. Explicit timeout guard dito.
                const timeoutId = setTimeout(() => {
                    if (settled) return;
                    settled = true;
                    subscription.unsubscribe();
                    alert(`Printer connection timed out: ${printer.name}\nTicket saved but not printed.`);
                    reject(new Error("Bluetooth connection timeout"));
                }, CONNECT_TIMEOUT_MS);

                const subscription = BluetoothSerial.connect(printer.id).subscribe({
                    next: async () => {
                        if (settled) return;
                        settled = true;
                        clearTimeout(timeoutId);
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
                        if (settled) return;
                        settled = true;
                        clearTimeout(timeoutId);
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

                {/* ── Force Update Alert — hiwalay na component na ──
                    Sa loob nito ang version-check fetch logic, ang IonAlert,
                    at ang tamang Play Store / App Store navigation. */}
                <VersionCheck token={token} />

                {fleet ? (
                    <IonCard className="custom-card">
                        <div className="center-text">
                            <h2>iKomyutPH</h2>
                            <IonLabel
                                color="primary"
                                style={{ textTransform: "none", fontWeight: "bold", fontSize: "16px" }}
                            >
                                <div>{activeRoute?.terminalPointA}</div>
                                <div>→ {activeRoute?.terminalPointB}</div>
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
                                options={activeRoute?.stopOver ?? EMPTY_STOPOVERS}
                                value={selectedPickup}
                                onSelect={(val: string) => {
                                    setSelectedPickup(val);
                                    dispatchTicket({ type: "CLEAR_TICKET" });
                                }}
                            />

                            <SearchableSelect
                                label="Drop-off"
                                options={activeRoute?.stopOver ?? EMPTY_STOPOVERS}
                                value={selectedDropoff}
                                onSelect={(val: string) => {
                                    setSelectedDropoff(val);
                                    dispatchTicket({ type: "CLEAR_TICKET" });
                                }}
                            />

                            <IonItem
                                lines="none"
                                style={{
                                    marginTop: "10px",
                                    borderRadius: "10px",
                                    border: isDiscounted ? "1.5px solid #115830" : "1.5px solid #d1d5db",
                                    "--background": isDiscounted ? "#e6f0ea" : "transparent",
                                    "--min-height": "44px",
                                    "--padding-start": "10px",
                                    "--inner-padding-end": "8px",
                                } as React.CSSProperties}
                            >
                                <IonIcon
                                    icon={accessibilityOutline}
                                    slot="start"
                                    color={isDiscounted ? "primary" : "medium"}
                                    style={{ fontSize: "18px", marginRight: "6px" }}
                                />
                                <IonLabel
                                    style={{
                                        fontWeight: 700,
                                        fontSize: "13px",
                                        color: isDiscounted ? "#115830" : undefined,
                                        textAlign: "center",
                                        display: "block",
                                        width: "100%",
                                    }}
                                >
                                    DISCOUNT{" "}
                                    <span style={{
                                        fontSize: "11px",
                                        fontWeight: 600,
                                        letterSpacing: "0.03em",
                                        textTransform: "uppercase",
                                        color: isDiscounted ? "#115830" : "#888",
                                    }}>
                                    </span>
                                </IonLabel>
                                <IonToggle
                                    slot="end"
                                    color="dark"
                                    style={{
                                        "--track-background": "#9ca3af",
                                        "--track-background-checked": "#115830",
                                        "--handle-background": "#374151",
                                        "--handle-background-checked": "#115830",
                                    } as React.CSSProperties}
                                    checked={isDiscounted}
                                    onIonChange={(e) => {
                                        setIsDiscounted(e.detail.checked);
                                        dispatchTicket({ type: "CLEAR_FARE" });
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

                <Loading isOpen={loading} message={loadingMessage} />

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