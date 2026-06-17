import React, {
  useEffect,
  useRef,
  useState,
  useMemo,
  useCallback,
} from "react";
import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";
import Directions from "./Directions";


interface MapProps {
  onIdle?: () => void;
  onMapLoad?: (map: google.maps.Map) => void;
  externalLocation?: google.maps.LatLngLiteral;
  showCenterPin?: boolean;
  isHomeScreen?: boolean;
  zoom?: number;
  fitToBoundsTrigger?: number;
  fullScreen?: boolean; // 🔹 new prop
}

const fallbackLocation: google.maps.LatLngLiteral = {
  lat: 14.5995,
  lng: 120.9842,
};

const Map: React.FC<MapProps> = ({
  onIdle,
  onMapLoad,
  externalLocation,
  showCenterPin = false,
  isHomeScreen = false,
  zoom,
  fitToBoundsTrigger = 5,
  fullScreen = true,
}) => {


  const [drivers, setDrivers] = useState<google.maps.LatLngLiteral[]>([]);
  const [currentLocation, setCurrentLocation] =
    useState<google.maps.LatLngLiteral>(fallbackLocation);
  const mapRef = useRef<google.maps.Map | null>(null);

  /** Memoized map options */
  const mapOptions = useMemo(
    () => ({
      disableDefaultUI: true,
      zoomControl: false,
      mapTypeControl: false,
      scaleControl: false,
      streetViewControl: false,
      rotateControl: true,
      fullscreenControl: false,
      mapId: import.meta.env.VITE_GOOGLE_MAP_ID,
      gestureHandling: "greedy",
      routingPreference: "TRAFFIC_AWARE",
      computeAlternativeRoutes: false
    }),
    []
  );


  /** Stable handlers */
  const handleMapLoad = useCallback(
    (map: google.maps.Map) => {
      mapRef.current = map;
      onMapLoad?.(map);
    },
    [onMapLoad]
  );

  const handleIdle = useCallback(() => {
    if (!isHomeScreen) {
      onIdle?.();
    }
  }, [isHomeScreen, onIdle]);

  /** Smooth zoom updates */
  useEffect(() => {
    if (mapRef.current && zoom) {
      mapRef.current.setZoom(zoom);
    }
  }, [zoom]);


  /** Pan smoothly to external location */
  useEffect(() => {
    if (externalLocation && mapRef.current) {
      mapRef.current.panTo(externalLocation);
    }
  }, [externalLocation]);

  /** Track user location */
  useEffect(() => {
    if (!isHomeScreen) return;

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setCurrentLocation(loc);
          mapRef.current?.panTo(loc);
        },
        () => { },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, [isHomeScreen]);

  const resolvedCenter = externalLocation ?? currentLocation;

  return (
    <div
      style={{
        width: "100%",
        height: fullScreen ? "100vh" : "100%", // 🔹 Responsive
        flexGrow: 1, // 🔹 lets map fill parent if not fullscreen
        position: "relative",
      }}
    >
      {showCenterPin && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -100%)",
            zIndex: 2,
            pointerEvents: "none",
          }}
        >
          <img
            src="/assets/markers/placeholder.png"
            alt="center-pin"
            height={40}
          />
        </div>
      )}

      <GoogleMap
        mapContainerStyle={{ width: "100%", height: "100%" }}
        center={resolvedCenter}
        zoom={zoom ?? 15}
        options={mapOptions}
        onIdle={handleIdle}
        onLoad={handleMapLoad}
      >
      </GoogleMap>

    </div>
  );
};

export default Map;
