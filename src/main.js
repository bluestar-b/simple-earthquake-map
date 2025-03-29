import "./style.css";
import "maplibre-gl/dist/maplibre-gl.css";
import maplibregl from "maplibre-gl";
import Papa from "papaparse";

const styles = {
  osm: {
    version: 8,
    sources: {
      osm: {
        type: "raster",
        tiles: ["https://a.tile.openstreetmap.org/{z}/{x}/{y}.png"],
        tilesize: 256,
        attribution: "&copy; openstreetmap contributors",
        maxzoom: 19,
      },
    },
    layers: [{ id: "osm", type: "raster", source: "osm" }],
  },
  googlesatellite: {
    version: 8,
    sources: {
      googlesatellite: {
        type: "raster",
        tiles: ["https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"],
        tilesize: 256,
        attribution: "&copy; google",
        maxzoom: 19,
      },
    },
    layers: [
      { id: "googlesatellite", type: "raster", source: "googlesatellite" },
    ],
  },
  googlehybrid: {
    version: 8,
    sources: {
      googlehybrid: {
        type: "raster",
        tiles: ["https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"],
        tilesize: 256,
        attribution: "&copy; google",
        maxzoom: 19,
      },
    },
    layers: [{ id: "googlehybrid", type: "raster", source: "googlehybrid" }],
  },
  osmSat: {
    version: 8,
    sources: {
      osm: {
        type: "raster",
        tiles: ["https://a.tile.openstreetmap.org/{z}/{x}/{y}.png"],
        tileSize: 256,
        attribution: "&copy; OpenStreetMap Contributors",
        maxzoom: 19,
      },
      googleSatellite: {
        type: "raster",
        tiles: ["https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"],
        tileSize: 256,
        attribution: "&copy; Google",
        maxzoom: 19,
      },
    },
    layers: [
      {
        id: "osmSat",
        type: "raster",
        source: "osm",
        paint: { "raster-opacity": 0.7 },
      },
      {
        id: "osmSatSatellite",
        type: "raster",
        source: "googleSatellite",
        paint: { "raster-opacity": 0.7 },
      },
    ],
  },
};

const map = new maplibregl.Map({
  container: "map",
  style: styles.osm,
  center: [0, 0],
  zoom: 3,
});

map.addControl(new maplibregl.NavigationControl());

let activeMarkers = [];

let earthquakeDataCache = null;
let lastFetchTime = null;
const CACHE_TIMEOUT = 60000;

async function fetchEarthquakeData() {
  const currentTime = Date.now();

  if (earthquakeDataCache && currentTime - lastFetchTime < CACHE_TIMEOUT) {
    return earthquakeDataCache;
  }
  try {
    const response = await fetch(
      "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.csv",
    );
    const data = await response.text();

    const parsedData = Papa.parse(data, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
    });

    earthquakeDataCache = parsedData.data;
    lastFetchTime = currentTime;

    return earthquakeDataCache;
  } catch (error) {
    console.error("Error fetching earthquake data:", error);
    return [];
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isInViewport(lat, lon) {
  return map.getBounds().contains([lon, lat]);
}

function removeInvisibleMarkers() {
  activeMarkers = activeMarkers.filter(({ marker, latitude, longitude }) => {
    if (isInViewport(latitude, longitude)) return true;
    marker.remove();
    return false;
  });
}

const newEarthQuakeIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" fill="#7b7d00" viewBox="0 0 256 256"><path d="M116,106.32V176a12,12,0,0,0,24,0V106.32a44,44,0,1,0-24,0ZM128,44a20,20,0,1,1-20,20A20,20,0,0,1,128,44ZM244,176c0,21.59-23.9,34-38.15,39.48C184.86,223.56,157.22,228,128,228c-57.64,0-116-17.86-116-52,0-22.23,26.12-40.2,69.88-48.06a12,12,0,1,1,4.24,23.62C51.93,157.71,36,169.78,36,176c0,4,7.12,11.07,22.77,17.08,18.3,7,42.89,10.92,69.23,10.92s50.93-3.88,69.23-10.92C212.87,187.07,220,180,220,176c0-6.22-15.93-18.29-50.12-24.44a12,12,0,1,1,4.24-23.62C217.88,135.8,244,153.77,244,176Z"></path></svg>`;

const createMagnitudeMarker = (magnitude) => {
  let color;

  if (magnitude >= 8) {
    color = "#4B2C2B";
  } else if (magnitude >= 7) {
    color = "#7A3B3B";
  } else if (magnitude >= 6) {
    color = "#9B7D57";
  } else if (magnitude >= 5) {
    color = "#A69E6A";
  } else if (magnitude >= 4) {
    color = "#C5C79E";
  } else if (magnitude >= 3) {
    color = "#B0B5A2";
  } else {
    color = "#D1D1D1";
  }

  //Icon from: https://phosphoricons.com/?color=%220000ff%22&q=%22map%22&weight=%22bold%22&size=32

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="${color}" viewBox="0 0 256 256">
      <path d="M188,72a60,60,0,1,0-72,58.79V232a12,12,0,0,0,24,0V130.79A60.09,60.09,0,0,0,188,72Zm-60,36a36,36,0,1,1,36-36A36,36,0,0,1,128,108Z"></path>
    </svg>
  `;
};

async function displayEarthquakesOnMap() {
  const earthquakes = await fetchEarthquakeData();
  for (const quake of earthquakes) {
    if (quake.latitude && quake.longitude) {
      const lat = parseFloat(quake.latitude);
      const lon = parseFloat(quake.longitude);

      if (isInViewport(lat, lon)) {
        const magnitude = quake.mag;
        const svgIcon = createMagnitudeMarker(magnitude);

        const el = document.createElement("div");
        el.className = "marker";
        el.style.backgroundImage = `url('data:image/svg+xml;base64,${btoa(svgIcon)}')`;
        el.style.width = "32px";
        el.style.height = "32px";
        el.style.pointerEvents = "auto";

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([lon, lat])
          .addTo(map);

        const popup = new maplibregl.Popup({ offset: 16 }).setHTML(`    
          <h3>Earthquake Details</h3>    
          <strong>Location:</strong> ${quake.place || "Unknown"} <br>    
          <strong>Lat/Lon:</strong> ${lat}, ${lon}<br>    
          <strong>Occurred:</strong> ${new Date(quake.time).toLocaleString(
            "en-GB",
            {
              hour12: false,
              timeZoneName: "short",
            },
          )} <br>    
          <strong>Magnitude:</strong> ${quake.mag} (${quake.magType} scale) <br>    
          <strong>Depth:</strong> ${quake.depth} km <br>    
          <strong>Horizontal Error:</strong> ${quake.horizontalError || "Not Available"} km <br>    
          <strong>Depth Error:</strong> ${quake.depthError || "Not Available"} km <br>    
          <strong>Magnitude Error:</strong> ${quake.magError || "Not Available"} <br>    
          <strong>Magnitude Source:</strong> ${quake.magSource || "Not Available"} <br>    
          <strong>Location Source:</strong> ${quake.locationSource || "Not Available"} <br>    
          <strong>Updated:</strong> ${new Date(quake.updated).toLocaleString(
            "en-GB",
            {
              hour12: false,
              timeZoneName: "short",
            },
          )} <br>    
          <strong>Event Type:</strong> ${quake.type || "Unknown"} <br>    
          <strong>Network:</strong> ${quake.net || "Not Available"} <br>    
          <strong>ID:</strong> ${quake.id || "Unknown"} <br>    
          <strong>Number of Stations Reporting:</strong> ${quake.nst || "Unknown"} <br>    
          <strong>RMS Value (Quality of Data):</strong> ${quake.rms || "Not Available"} <br>    
          <strong><a href="https://earthquake.usgs.gov/earthquakes/eventpage/${quake.id}" target="_blank">USGS event page</a></strong>    
        `);

        marker.setPopup(popup);
        activeMarkers.push({ marker, latitude: lat, longitude: lon });

        await sleep(10);
      }
    }
  }
}

map.on("moveend", () => {
  removeInvisibleMarkers();
  displayEarthquakesOnMap();
});

displayEarthquakesOnMap();

class LayerSwitcherControl {
  onAdd(map) {
    this._map = map;
    this._container = document.createElement("div");
    this._container.className = "maplibregl-ctrl maplibregl-ctrl-group";

    Object.assign(this._container.style, {
      display: "flex",
      gap: "5px",
      padding: "5px",
      background: "rgba(255, 255, 255, 0.8)",
      borderRadius: "5px",
      flexDirection: "column",
    });

    const buttons = [
      { label: "OpenStreetMap", styleKey: "osm" },
      { label: "Google Satellite", styleKey: "googlesatellite" },
      { label: "OSM + Satellite", styleKey: "osmSat" },
      { label: "Google Hybrid", styleKey: "googlehybrid" },
    ];

    buttons.forEach(({ label, styleKey }) => {
      const button = document.createElement("button");
      button.textContent = label;

      Object.assign(button.style, {
        padding: "8px",
        cursor: "pointer",
        border: "none",
        background: "#ddd",
        borderRadius: "3px",
        fontSize: "14px",
        whiteSpace: "nowrap",
        width: "auto",
      });

      button.onclick = () => {
        map.setStyle(styles[styleKey]);
        this._container.childNodes.forEach(
          (btn) => (btn.style.background = "#ddd"),
        );
        button.style.background = "#aaa";
      };

      this._container.appendChild(button);
    });

    return this._container;
  }

  onRemove() {
    this._container.parentNode.removeChild(this._container);
    this._map = undefined;
  }
}

map.addControl(new LayerSwitcherControl(), "top-right");
