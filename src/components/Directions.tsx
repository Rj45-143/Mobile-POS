import React, { useEffect, useRef, useState } from "react";
import { DirectionsRenderer, Marker, OverlayView } from "@react-google-maps/api";

interface DirectionsProps {
  map: google.maps.Map | null;
  autoZoom?: boolean;
  driverLoc?: google.maps.LatLngLiteral | null;
  pickupCoords?: google.maps.LatLngLiteral | null;
  dropoffCoords?: google.maps.LatLngLiteral | null;
  inTransit?: number;
  onDistanceChange?: (distance: number) => void;
  onEtaChange?: (eta: number) => void;
  onDurationInTrafficChange?: (duration: number) => void;
}

const Directions: React.FC<DirectionsProps> = ({
  map,
  autoZoom = true,
  driverLoc = null,
  pickupCoords = null,
  dropoffCoords = null,
  inTransit = 0,
  onDistanceChange,
  onEtaChange,
  onDurationInTrafficChange,
}) => {
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRequestedOrigin = useRef<google.maps.LatLngLiteral | null>(null);
  const lastRequestedDestination = useRef<google.maps.LatLngLiteral | null>(null);
  const previousLocationRef = useRef<google.maps.LatLngLiteral | null>(null);
  const [animatedCarPosition, setAnimatedCarPosition] = useState<google.maps.LatLngLiteral | null>(null);
  const [carHeading, setCarHeading] = useState<number>(0);

  // Simple heading calculation (no external util needed)
  const calculateHeading = (from: google.maps.LatLngLiteral, to: google.maps.LatLngLiteral): number => {
    const dLng = to.lng - from.lng;
    const y = Math.sin(dLng) * Math.cos(to.lat);
    const x =
      Math.cos(from.lat) * Math.sin(to.lat) -
      Math.sin(from.lat) * Math.cos(to.lat) * Math.cos(dLng);
    return (Math.atan2(y, x) * 180) / Math.PI;
  };

  // Simple interpolate (no external util needed)
  const interpolatePosition = (
    from: google.maps.LatLngLiteral,
    to: google.maps.LatLngLiteral,
    progress: number
  ): google.maps.LatLngLiteral => ({
    lat: from.lat + (to.lat - from.lat) * progress,
    lng: from.lng + (to.lng - from.lng) * progress,
  });

  // Simple distance in meters (no external util needed)
  const calculateDistance = (
    a: google.maps.LatLngLiteral,
    b: google.maps.LatLngLiteral
  ): number => {
    const R = 6371000;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const x =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  };

  useEffect(() => {
    if (!driverLoc) return;
    const prev = previousLocationRef.current;
    previousLocationRef.current = driverLoc;

    if (!prev) {
      setAnimatedCarPosition(driverLoc);
      return;
    }

    const heading = calculateHeading(prev, driverLoc);
    setCarHeading(heading);

    let frame = 0;
    const totalFrames = 30;
    const animate = () => {
      frame++;
      const progress = frame / totalFrames;
      const newPos = interpolatePosition(prev, driverLoc, progress);
      setAnimatedCarPosition(newPos);
      if (frame < totalFrames) requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }, [driverLoc]);

  useEffect(() => {
    if (!pickupCoords || !dropoffCoords || !window.google?.maps) return;

    let origin: google.maps.LatLngLiteral;
    let destination: google.maps.LatLngLiteral;

    if ((inTransit === 1 || inTransit === 2) && driverLoc) {
      origin = driverLoc;
      destination = pickupCoords!;
    } else if (inTransit === 3 && driverLoc) {
      origin = driverLoc;
      destination = dropoffCoords!;
    } else {
      origin = pickupCoords!;
      destination = dropoffCoords!;
    }

    const originChanged =
      !lastRequestedOrigin.current ||
      calculateDistance(origin, lastRequestedOrigin.current) >= 500;
    const destinationChanged =
      !lastRequestedDestination.current ||
      destination.lat !== lastRequestedDestination.current.lat ||
      destination.lng !== lastRequestedDestination.current.lng;

    if (autoZoom && map && (originChanged || destinationChanged)) {
      if (pickupCoords && dropoffCoords) {
        const bounds = new google.maps.LatLngBounds();
        bounds.extend(origin);
        bounds.extend(destination);
        map.fitBounds(bounds);
      } else {
        const singlePoint = pickupCoords || dropoffCoords || driverLoc;
        if (singlePoint) {
          map.setCenter(singlePoint);
          map.setZoom(18);
        }
      }
    }

    if (!originChanged && !destinationChanged) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      const directionsService = new google.maps.DirectionsService();
      setLoading(true);
      setError(null);

      directionsService.route(
        {
          origin,
          destination,
          travelMode: google.maps.TravelMode.DRIVING,
          drivingOptions: {
            departureTime: new Date(),
            trafficModel: google.maps.TrafficModel.BEST_GUESS,
          },
        },
        (result, status) => {
          setLoading(false);
          if (status === google.maps.DirectionsStatus.OK && result) {
            setDirections(result);
            lastRequestedOrigin.current = origin;
            lastRequestedDestination.current = destination;

            const leg = result.routes[0]?.legs[0];
            if (leg) {
              onDistanceChange?.(leg.distance?.value || 0);
              onEtaChange?.(leg.duration?.value || 0);
              if (leg.duration_in_traffic?.value) {
                onDurationInTrafficChange?.(leg.duration_in_traffic.value);
              }
            }
          } else {
            setError("Failed to fetch directions.");
          }
        }
      );
    }, 1000);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [pickupCoords, dropoffCoords, driverLoc, inTransit, autoZoom, map]);

  if (error) return <div style={{ color: "red" }}>{error}</div>;
  if (loading && !directions) return <div>Loading route...</div>;

  const renderMarker = (
    position: google.maps.LatLngLiteral,
    url: string,
    size = 40
  ) => (
    <Marker
      position={position}
      icon={{
        url,
        scaledSize: new google.maps.Size(size, size),
        anchor: new google.maps.Point(size / 2, size),
      }}
    />
  );

  const CarOverlay = animatedCarPosition && (
    <OverlayView
      position={animatedCarPosition}
      mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
    >
      <div
        style={{
          transform: `rotate(${carHeading}deg)`,
          transformOrigin: "center",
          width: "40px",
          height: "40px",
          transition: "transform 0.2s linear",
        }}
      >
        <img src="/assets/markers/hood.png" alt="Car" style={{ width: "100%", height: "100%" }} />
      </div>
    </OverlayView>
  );

  if (!directions) return null;

  return (
    <>
      <DirectionsRenderer
        directions={directions}
        options={{
          suppressMarkers: true,
          polylineOptions: {
            strokeColor: "#008000",
            strokeWeight: 6,
            strokeOpacity: 1,
            zIndex: 10,
          },
        }}
      />
      <DirectionsRenderer
        directions={directions}
        options={{
          suppressMarkers: true,
          polylineOptions: {
            strokeColor: "#000000",
            strokeWeight: 8,
            strokeOpacity: 0.8,
            zIndex: 5,
          },
        }}
      />

      {inTransit === 0 && (
        <>
          {pickupCoords && renderMarker(pickupCoords, "/assets/markers/user.png")}
          {dropoffCoords && renderMarker(dropoffCoords, "/assets/markers/placeholder.png")}
        </>
      )}

      {(inTransit === 1 || inTransit === 2) && driverLoc && (
        <>
          {CarOverlay}
          {pickupCoords && renderMarker(pickupCoords, "/assets/markers/user.png")}
        </>
      )}

      {inTransit === 3 && driverLoc && (
        <>
          {CarOverlay}
          {dropoffCoords && renderMarker(dropoffCoords, "/assets/markers/placeholder.png", 30)}
        </>
      )}
    </>
  );
};

export default Directions;