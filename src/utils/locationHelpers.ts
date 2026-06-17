export const watchLocation = (
  onSuccess: (position: GeolocationPosition) => void,
  onError?: (error: GeolocationPositionError) => void
): number | null => {
  if (!navigator.geolocation) {
    alert("Geolocation is not supported by this browser.");
    console.error("Geolocation is not supported by this browser.");
    return null;
  }

  const handleError = (error: GeolocationPositionError) => {
    console.error("Geolocation error:", error.message);

    if (error.code === 1) {
      alert(
        "Location access is denied. Please enable location services in your browser or device settings."
      );
    }

    if (onError) {
      onError(error);
    }
  };

  let watchId: number | null = null;

  navigator.geolocation.getCurrentPosition(
    (position) => {
      onSuccess(position);

      watchId = navigator.geolocation.watchPosition(onSuccess, handleError, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      });
    },
    handleError,
    {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: Infinity,
    }
  );

  return watchId;
};
