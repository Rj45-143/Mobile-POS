// utils/getDistance.ts

export const getDrivingDistance = (
  origin: google.maps.LatLngLiteral,
  destination: google.maps.LatLngLiteral
): Promise<number> => {
  return new Promise((resolve, reject) => {
    if (!window.google || !window.google.maps) {
      return reject("Google Maps JS API not loaded");
    }

    const service = new google.maps.DistanceMatrixService();

    service.getDistanceMatrix(
      {
        origins: [origin],
        destinations: [destination],
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (response, status) => {
        if (status !== "OK" || !response) {
          reject(status);
          return;
        }

        const element = response.rows[0]?.elements[0];
        if (!element || element.status !== "OK") {
          reject(element?.status || "No element found");
          return;
        }

        const distanceInMeters = element.distance.value;
        const distanceInKm = distanceInMeters / 1000;

        resolve(distanceInKm);
      }
    );
  });
};

// ── Bagong functions para sa route-based (stopover-aware) distance ──

const toLatLng = (stop: any): google.maps.LatLngLiteral => ({
  lat: stop.location.coordinates[1],
  lng: stop.location.coordinates[0],
});

/**
 * Kinukwenta ang cumulative distance (sa km) mula sa unang stopover
 * papunta sa bawat susunod na stopover, sundan ang aktwal na ruta
 * (hindi ang shortest path). Hinahati sa chunks para hindi malagpasan
 * ang waypoint limit ng Google Directions API.
 *
 * IMPORTANT: ang pagkasunod-sunod ng `stopOverList` ang basehan ng
 * computation na ito. Siguraduhing naka-sort ito ayon sa `idNumber`
 * BAGO ito ipasa dito (ginagawa na ito sa Home.tsx).
 */
export const buildCumulativeDistances = async (
  stopOverList: any[]
): Promise<number[]> => {
  if (!window.google || !window.google.maps) {
    throw new Error("Google Maps JS API not loaded");
  }
  if (stopOverList.length < 2) return [0];

  const directionsService = new google.maps.DirectionsService();
  const cumulative: number[] = [0];
  const CHUNK_SIZE = 23; // ligtas na bilang ng waypoints bawat request
  let runningTotal = 0;

  for (let start = 0; start < stopOverList.length - 1; start += CHUNK_SIZE) {
    const end = Math.min(start + CHUNK_SIZE, stopOverList.length - 1);
    const chunkStops = stopOverList.slice(start, end + 1);

    const origin = toLatLng(chunkStops[0]);
    const destination = toLatLng(chunkStops[chunkStops.length - 1]);
    const waypoints = chunkStops.slice(1, -1).map((s) => ({
      location: toLatLng(s),
      stopover: true,
    }));

    const result = await new Promise<google.maps.DirectionsResult>((resolve, reject) => {
      directionsService.route(
        {
          origin,
          destination,
          waypoints,
          optimizeWaypoints: false, // CRITICAL — huwag baguhin ang pagkasunod-sunod
          travelMode: google.maps.TravelMode.DRIVING,
        },
        (res, status) => {
          if (status === google.maps.DirectionsStatus.OK && res) resolve(res);
          else reject(new Error("Directions failed: " + status));
        }
      );
    });

    result.routes[0].legs.forEach((leg) => {
      runningTotal += (leg.distance?.value || 0) / 1000; // km
      cumulative.push(runningTotal);
    });
  }

  return cumulative;
};

/**
 * Cached version — isang beses lang tatawagin ang Directions API kada route,
 * tapos i-store sa localStorage.
 *
 * Ang cache key ay base na sa AKTWAL na sequence ng idNumber (hindi lang
 * bilang ng stopovers), kaya kapag may na-insert, na-delete, o na-reorder
 * na stopover (kahit pareho ang total count), automatic na mag-recompute
 * dahil magbabago ang key.
 */
export const getCachedCumulativeDistances = async (
  routeId: string,
  stopOverList: any[]
): Promise<number[]> => {
  const idSequence = stopOverList.map((s) => s.idNumber).join("-");
  const cacheKey = `cumdist_${routeId}_${idSequence}`;

  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch {
    // ignore corrupted cache, recompute below
  }

  const computed = await buildCumulativeDistances(stopOverList);

  try {
    localStorage.setItem(cacheKey, JSON.stringify(computed));
  } catch (e) {
    console.warn("Failed to cache cumulative distances:", e);
  }

  return computed;
};