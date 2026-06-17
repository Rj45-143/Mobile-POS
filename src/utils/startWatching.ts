import { reverseGeocodeWithGoogle } from "../utils/geocodeUtils";
import { watchLocation } from "./locationHelpers";

interface UseWatchLocationProps {
  setPickupCoords: React.Dispatch<
    React.SetStateAction<{ latitude: number | null; longitude: number | null }>
  >;
  setPickupAddress: React.Dispatch<React.SetStateAction<string>>;
}

// Haversine formula to calculate distance (in meters) between two lat/lng points
function getDistanceFromLatLonInMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function deg2rad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function startWatchingLocation({
  setPickupCoords,
  setPickupAddress,
}: UseWatchLocationProps) {
  let watchId: number | null = null;

  // Store the last coordinates for distance comparison
  let lastCoords: { latitude: number | null; longitude: number | null } = {
    latitude: null,
    longitude: null,
  };

  watchId = watchLocation(
    async (position) => {
      const { latitude, longitude } = position.coords;

      // If first time or moved more than 10 meters, update location and reverse geocode
      if (
        lastCoords.latitude === null ||
        lastCoords.longitude === null ||
        getDistanceFromLatLonInMeters(
          lastCoords.latitude,
          lastCoords.longitude,
          latitude,
          longitude
        ) > 10 // meters
      ) {
        lastCoords = { latitude, longitude };
        setPickupCoords({ latitude, longitude });

        try {
          const locationName = await reverseGeocodeWithGoogle(
            latitude,
            longitude,
            import.meta.env.VITE_APP_GOOGLE_MAP_KEY
          );

          setPickupAddress((prev) =>
            prev !== locationName ? locationName : prev
          );
        } catch (error) {
          console.error("Reverse geocoding failed:", error);
        }
      }
    },
    (error) => {
      console.error("Watch location error:", error.message);
      // Optional: setPickupAddress("Location permission denied");
    }
  );

  // Cleanup function to clear watch on unmount or stop
  return () => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
    }
  };
}
