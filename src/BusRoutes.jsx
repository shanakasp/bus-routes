import React, { useRef, useState } from "react";

const MapComponent = () => {
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState([]);
  const [allPaths, setAllPaths] = useState([]);
  const mapRef = useRef(null);
  const polylineRef = useRef(null);
  const mouseMoveListenerRef = useRef(null);
  const drawingManagerRef = useRef(null);

  React.useEffect(() => {
    // Verify the API key
    const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.error("Google Maps API key is missing!");
      return;
    }

    // Create the script element
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
    script.async = true;
    script.defer = true;

    // Callback when script loads
    script.onload = initializeMap;

    // Add script to document
    document.body.appendChild(script);

    // Cleanup
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

    // Initialize polyline for active drawing
    polylineRef.current = new window.google.maps.Polyline({
      map: map,
      path: [],
      strokeColor: "#FF0000",
      strokeOpacity: 1.0,
      strokeWeight: 3,
    });

    // Setup map click listener
    map.addListener("mousedown", (e) => {
      if (e.domEvent.button === 0) {
        // Left click
        handleMapClick(e);
      }
    });
  };

  const handleMapClick = (event) => {
    if (!isDrawing) {
      // Start drawing
      startDrawing(event);
    } else {
      // End drawing
      stopDrawing();
    }
  };

  const startDrawing = (event) => {
    const startPoint = {
      lat: event.latLng.lat(),
      lng: event.latLng.lng(),
    };

    setIsDrawing(true);
    setCurrentPath([startPoint]);
    polylineRef.current.setPath([startPoint]);

    // Add mousemove listener
    mouseMoveListenerRef.current = mapRef.current.addListener(
      "mousemove",
      (e) => {
        const newPoint = {
          lat: e.latLng.lat(),
          lng: e.latLng.lng(),
        };

        setCurrentPath((prevPath) => {
          const newPath = [...prevPath, newPoint];
          polylineRef.current.setPath(newPath);
          return newPath;
        });
      }
    );
  };

  const stopDrawing = () => {
    // Remove mousemove listener
    if (mouseMoveListenerRef.current) {
      window.google.maps.event.removeListener(mouseMoveListenerRef.current);
      mouseMoveListenerRef.current = null;
    }

    if (currentPath.length > 0) {
      // Save the completed path
      setAllPaths((prev) => [...prev, currentPath]);

      // Create a new permanent polyline for the completed path
      new window.google.maps.Polyline({
        map: mapRef.current,
        path: currentPath,
        strokeColor: "#FF0000",
        strokeOpacity: 1.0,
        strokeWeight: 3,
      });

      // Reset the drawing polyline
      polylineRef.current.setPath([]);
      setCurrentPath([]);
    }

    setIsDrawing(false);
  };

  const exportRoutes = () => {
    const routeData = {
      paths: allPaths.map((path) => ({
        points: path,
        distance: calculateDistance(path),
      })),
    };

    const blob = new Blob([JSON.stringify(routeData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "drawn-routes.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const calculateDistance = (path) => {
    let distance = 0;
    for (let i = 0; i < path.length - 1; i++) {
      distance += window.google.maps.geometry.spherical.computeDistanceBetween(
        new window.google.maps.LatLng(path[i].lat, path[i].lng),
        new window.google.maps.LatLng(path[i + 1].lat, path[i + 1].lng)
      );
    }
    return (distance / 1000).toFixed(2) + " km";
  };

  const clearMap = () => {
    if (mouseMoveListenerRef.current) {
      window.google.maps.event.removeListener(mouseMoveListenerRef.current);
      mouseMoveListenerRef.current = null;
    }

    setAllPaths([]);
    setCurrentPath([]);
    setIsDrawing(false);
    polylineRef.current?.setPath([]);
    initializeMap();
  };

  return (
    <div
      className="map-container"
      style={{
        padding: "1rem",
        borderRadius: "0.5rem",
        backgroundColor: "white",
        boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
      }}
    >
      <div className="map-controls" style={{ marginBottom: "1rem" }}>
        <button
          onClick={exportRoutes}
          style={{
            padding: "0.5rem 1rem",
            marginRight: "1rem",
            backgroundColor: "#4CAF50",
            color: "white",
            border: "none",
            borderRadius: "0.25rem",
            cursor: "pointer",
          }}
        >
          Export Routes
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
        <span style={{ marginLeft: "1rem", fontWeight: "bold" }}>
          {isDrawing
            ? "Click left mouse button to finish drawing"
            : "Click left mouse button to start drawing"}
        </span>
      </div>
      <div
        id="map"
        style={{
          width: "100%",
          height: "800px",
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
