// src/hooks/useLocationTracker.ts
import { useEffect, useRef } from "react";
import { Geolocation } from "@capacitor/geolocation";
import axiosInstance from "../services/axiosInstance";

interface UseLocationTrackerOptions {
  userId: string | undefined;
  token: string | undefined | null;
  enabled: boolean;
  // Called for user-facing failures only (permission denied, tracker
  // failed to start) — NOT for every transient location-update API call,
  // since those retry on the next watchPosition tick and would spam the UI.
  onError?: (message: string) => void;
}

const getDistanceInMeters = (
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number => {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const MIN_DISTANCE_METERS = 10;   // ← minimum distance bago mag-send
const MIN_INTERVAL_MS = 10000;    // ← minimum 10 seconds bago mag-send ulit

export const useLocationTracker = ({
  userId,
  token,
  enabled,
  onError,
}: UseLocationTrackerOptions) => {
  const watchIdRef = useRef<string | null>(null);
  const lastPositionRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastSentTimeRef = useRef<number>(0);  // ← track kung kailan last na-send

  // Ref para hindi kailangang isama sa effect deps — kung caller ay
  // nagpapasa ng bagong inline function kada render, hindi na
  // mare-restart ang buong watchPosition subscription.
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    if (!enabled || !userId || !token) return;

    const startTracking = async () => {
      try {
        const permission = await Geolocation.requestPermissions();
        if (
          permission.location !== "granted" &&
          permission.coarseLocation !== "granted"
        ) {
          console.warn("Location permission not granted.");
          onErrorRef.current?.("Location permission not granted. Your position won't be tracked.");
          return;
        }

        watchIdRef.current = await Geolocation.watchPosition(
          {
            enableHighAccuracy: true,
            timeout: 10000,
          },
          async (position, err) => {
            if (err || !position) {
              console.error("Location watch error:", err);
              return;
            }

            const { latitude, longitude } = position.coords;
            const now = Date.now();

            // ── Check 1: Time throttle ──
            if (now - lastSentTimeRef.current < MIN_INTERVAL_MS) return;

            // ── Check 2: Distance threshold ──
            if (lastPositionRef.current) {
              const distance = getDistanceInMeters(
                lastPositionRef.current.lat,
                lastPositionRef.current.lng,
                latitude,
                longitude
              );
              if (distance < MIN_DISTANCE_METERS) return;
            }

            // ── Both checks passed — update ──
            lastPositionRef.current = { lat: latitude, lng: longitude };
            lastSentTimeRef.current = now;

            try {
              await axiosInstance.patch(
                `/fleet/${userId}/location`,
                {
                  location: {
                    type: "Point",
                    coordinates: [longitude, latitude],
                  },
                },
                {
                  headers: { Authorization: `Bearer ${token}` },
                }
              );
            } catch (apiErr) {
              console.error("Failed to update location:", apiErr);
            }
          }
        );
      } catch (err) {
        console.error("Failed to start location tracking:", err);
        onErrorRef.current?.("Failed to start location tracking.");
      }
    };

    startTracking();

    return () => {
      if (watchIdRef.current !== null) {
        Geolocation.clearWatch({ id: watchIdRef.current });
        watchIdRef.current = null;
      }
      lastPositionRef.current = null;
      lastSentTimeRef.current = 0;
    };
  }, [enabled, userId, token]);
};