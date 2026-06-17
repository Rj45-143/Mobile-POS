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
