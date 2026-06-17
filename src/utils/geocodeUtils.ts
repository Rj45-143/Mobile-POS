// utils/geocodeUtils.ts

import { debounce } from "./debounce";

export const reverseGeocodeWithGoogle = async (
  lat: number,
  lng: number,
  apiKey: string
): Promise<string> => {
  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`
    );
    const data = await response.json();

    if (data.status === "OK" && data.results.length > 0) {
      const formatted = data.results[0].formatted_address;

      // Split by commas and trim whitespace
      const parts = formatted.split(",").map((part: string) => part.trim());

      // Remove plus codes (e.g., P5Q4+P75)
      const filtered = parts.filter(
        (part: string) => !/^[A-Z0-9+]{6,}$/.test(part)
      );

      // Remove numeric-only parts (postal codes) and overly generic parts
      const cleaned = filtered.filter(
        (part: string) =>
          !/^\d{4,}$/.test(part) && // remove pure 4+ digit numbers
          !/^\d{5}(-\d{4})?$/.test(part) && // remove US ZIP+4
          !/Philippines|United States|USA|Canada|India/i.test(part) // add others if desired
      );

      // Return 2-3 most relevant middle parts (e.g. subdivision + city)
      const resultParts =
        cleaned.length >= 3
          ? cleaned.slice(-3, -1) // return 2nd and 3rd from the end
          : cleaned;

      return resultParts.join(", ");
    } else {
      return "Location unavailable";
    }
  } catch (error) {
    console.error("Google Maps API error:", error);
    return "Location error";
  }
};

export const debouncedReverseGeocode = debounce(reverseGeocodeWithGoogle, 500);
