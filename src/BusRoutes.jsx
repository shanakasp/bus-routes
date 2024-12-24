import React, { useEffect, useRef, useState } from "react";

const MapComponent = () => {
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState([]);
  const [allPaths, setAllPaths] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [distance, setDistance] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const mapRef = useRef(null);
  const polylineRef = useRef(null);
  const mouseMoveListenerRef = useRef(null);
  const searchBoxRef = useRef(null);
  const directionsServiceRef = useRef(null);
  const geocoderRef = useRef(null);

  const calculateRealRouteDistance = async (path) => {
    if (path.length < 2) return "0 km";

    try {
      let totalDistance = 0;

      // Calculate route between consecutive points
      for (let i = 0; i < path.length - 1; i++) {
        const response = await new Promise((resolve, reject) => {
          directionsServiceRef.current.route(
            {
              origin: path[i],
              destination: path[i + 1],
              travelMode: "DRIVING",
            },
            (result, status) => {
              if (status === "OK") {
                resolve(result);
              } else {
                reject(status);
              }
            }
          );
        });

        totalDistance += response.routes[0].legs[0].distance.value;
      }

      return (totalDistance / 1000).toFixed(2) + " km";
    } catch (error) {
      console.error("Route calculation failed:", error);
      return calculateStraightLineDistance(path);
    }
  };

  const calculateStraightLineDistance = (path) => {
    let distance = 0;
    for (let i = 0; i < path.length - 1; i++) {
      distance += window.google.maps.geometry.spherical.computeDistanceBetween(
        new window.google.maps.LatLng(path[i].lat, path[i].lng),
        new window.google.maps.LatLng(path[i + 1].lat, path[i + 1].lng)
      );
    }
    return (distance / 1000).toFixed(2) + " km";
  };

  const handleSearch = async () => {
    if (!searchQuery) return;

    try {
      const response = await new Promise((resolve, reject) => {
        geocoderRef.current.geocode(
          { address: searchQuery },
          (results, status) => {
            if (status === "OK") {
              resolve(results);
            } else {
              reject(status);
            }
          }
        );
      });

      setSearchResults(response);
      const location = response[0].geometry.location;
      mapRef.current.setCenter(location);
      mapRef.current.setZoom(15);

      // Create a marker for the searched location
      new window.google.maps.Marker({
        map: mapRef.current,
        position: location,
        title: response[0].formatted_address,
      });
    } catch (error) {
      console.error("Geocoding failed:", error);
      alert("Location not found. Please try again.");
    }
  };

  const exportRoutes = () => {
    const currentDate = new Date().toISOString().split("T")[0];

    const gtfsData = {
      agency: {
        agency_id: "DEMO_AGENCY",
        agency_name: "Demo Transit Agency",
        agency_url: "http://example.com",
        agency_timezone: "America/New_York",
      },
      routes: allPaths.map((path, index) => ({
        route_id: `ROUTE_${index + 1}`,
        route_short_name: `R${index + 1}`,
        route_long_name: `Route ${index + 1}`,
        route_type: 3, // Bus service
        route_color: "FF0000",
      })),
      shapes: allPaths.map((path, index) => ({
        shape_id: `SHAPE_${index + 1}`,
        points: path.map((point, pointIndex) => ({
          shape_pt_lat: point.lat,
          shape_pt_lon: point.lng,
          shape_pt_sequence: pointIndex + 1,
        })),
      })),
    };

    const blob = new Blob([JSON.stringify(gtfsData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gtfs-routes-${currentDate}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleMapClick = (event) => {
    if (!isDrawing) {
      startDrawing(event);
    }
  };

  const startDrawing = (event) => {
    const startPoint = {
      lat: event.latLng.lat(),
      lng: event.latLng.lng(),
    };

    setIsDrawing(true);
    setCurrentPath([startPoint]);
    setSelectedRoute({
      startPoint,
      endPoint: null,
      distance: "Calculating...",
    });
    polylineRef.current.setPath([startPoint]);

    mouseMoveListenerRef.current = mapRef.current.addListener(
      "mousemove",
      async (e) => {
        const newPoint = {
          lat: e.latLng.lat(),
          lng: e.latLng.lng(),
        };

        setCurrentPath((prevPath) => {
          const newPath = [...prevPath, newPoint];
          polylineRef.current.setPath(newPath);
          calculateRealRouteDistance(newPath).then((dist) => setDistance(dist));
          return newPath;
        });
      }
    );
  };

  const stopDrawing = async () => {
    if (mouseMoveListenerRef.current) {
      window.google.maps.event.removeListener(mouseMoveListenerRef.current);
      mouseMoveListenerRef.current = null;
    }

    if (currentPath.length > 0) {
      const endPoint = currentPath[currentPath.length - 1];
      const finalDistance = await calculateRealRouteDistance(currentPath);

      setSelectedRoute((route) => ({
        ...route,
        endPoint,
        distance: finalDistance,
      }));

      setAllPaths((prev) => [...prev, currentPath]);

      new window.google.maps.Polyline({
        map: mapRef.current,
        path: currentPath,
        strokeColor: "#FF0000",
        strokeOpacity: 1.0,
        strokeWeight: 3,
      });

      polylineRef.current.setPath([]);
      setCurrentPath([]);
    }

    setIsDrawing(false);
  };

  const clearMap = () => {
    if (mouseMoveListenerRef.current) {
      window.google.maps.event.removeListener(mouseMoveListenerRef.current);
      mouseMoveListenerRef.current = null;
    }

    // Clear all overlays from the map
    const overlays = mapRef.current?.getOverlays?.();
    if (overlays) {
      overlays.forEach((overlay) => {
        if (
          overlay instanceof window.google.maps.Polyline ||
          overlay instanceof window.google.maps.Marker
        ) {
          overlay.setMap(null);
        }
      });
    }

    setAllPaths([]);
    setCurrentPath([]);
    setIsDrawing(false);
    setSelectedRoute(null);
    setDistance(0);
    polylineRef.current?.setPath([]);
  };

  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === "Enter" && isDrawing) {
        stopDrawing();
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [isDrawing]);

  useEffect(() => {
    const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.error("Google Maps API key is missing!");
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry,places`;
    script.async = true;
    script.defer = true;
    script.onload = initializeMap;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
      if (mouseMoveListenerRef.current) {
        window.google.maps.event.removeListener(mouseMoveListenerRef.current);
      }
    };
  }, []);

  const initializeMap = () => {
    const map = new window.google.maps.Map(document.getElementById("map"), {
      center: { lat: 40.7128, lng: -74.006 },
      zoom: 12,
      disableDefaultUI: false,
      draggableCursor: "default",
    });
    mapRef.current = map;

    directionsServiceRef.current = new window.google.maps.DirectionsService();
    geocoderRef.current = new window.google.maps.Geocoder();

    polylineRef.current = new window.google.maps.Polyline({
      map: map,
      path: [],
      strokeColor: "#FF0000",
      strokeOpacity: 1.0,
      strokeWeight: 3,
    });

    map.addListener("mousedown", (e) => {
      if (e.domEvent.button === 0) {
        handleMapClick(e);
      }
    });
  };

  return (
    <div
      className="map-container"
      style={{ display: "flex", flexDirection: "row" }}
    >
      <div
        className="side-menu"
        style={{
          width: "300px",
          padding: "1rem",
          backgroundColor: "white",
          borderRight: "1px solid #ddd",
        }}
      >
        <div className="search-box" style={{ marginBottom: "1rem" }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search location..."
            style={{
              width: "100%",
              padding: "0.5rem",
              marginBottom: "0.5rem",
              borderRadius: "0.25rem",
              border: "1px solid #ddd",
            }}
            onKeyPress={(e) => {
              if (e.key === "Enter") {
                handleSearch();
              }
            }}
          />
          <button
            onClick={handleSearch}
            style={{
              width: "100%",
              padding: "0.5rem",
              backgroundColor: "#2196F3",
              color: "white",
              border: "none",
              borderRadius: "0.25rem",
              cursor: "pointer",
            }}
          >
            Search
          </button>
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <p>Instructions:</p>
          <ul>
            <li>Search for a starting location</li>
            <li>Click to start drawing</li>
            <li>Press Enter to stop drawing</li>
          </ul>
        </div>

        <button
          onClick={exportRoutes}
          style={{
            padding: "0.5rem 1rem",
            marginBottom: "1rem",
            backgroundColor: "#4CAF50",
            color: "white",
            border: "none",
            borderRadius: "0.25rem",
            cursor: "pointer",
          }}
        >
          Export GTFS Routes
        </button>
        <button
          onClick={clearMap}
          style={{
            padding: "0.5rem 1rem",
            backgroundColor: "#f44336",
            color: "white",
            border: "none",
            borderRadius: "0.25rem",
            cursor: "pointer",
          }}
        >
          Clear Map
        </button>

        <div className="route-info" style={{ marginTop: "1rem" }}>
          {selectedRoute && (
            <div
              className="card"
              style={{
                padding: "1rem",
                borderRadius: "0.5rem",
                backgroundColor: "#f9f9f9",
                boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
                marginBottom: "1rem",
              }}
            >
              <h3>Route Details</h3>
              <p>
                <strong>Start Point:</strong>{" "}
                {`${selectedRoute.startPoint.lat}, ${selectedRoute.startPoint.lng}`}
              </p>
              <p>
                <strong>End Point:</strong>{" "}
                {selectedRoute.endPoint
                  ? `${selectedRoute.endPoint.lat}, ${selectedRoute.endPoint.lng}`
                  : "Drawing in progress..."}
              </p>
              <p>
                <strong>Distance:</strong> {distance}
              </p>
            </div>
          )}
        </div>
      </div>
      <div
        id="map"
        style={{
          width: "calc(100% - 300px)",
          height: "100vh",
          borderRadius: "0.375rem",
          cursor: isDrawing ? "crosshair" : "default",
        }}
        role="application"
        aria-label="Google Maps"
      />
    </div>
  );
};

export default MapComponent;
