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

//console.log(JSON.stringify(await fetchEarthquakeData()));

async function displayEarthquakesOnMap() {
  const earthquakes = await fetchEarthquakeData();
  for (const quake of earthquakes) {
    if (quake.latitude && quake.longitude) {
      const lat = parseFloat(quake.latitude);
      const lon = parseFloat(quake.longitude);

      if (isInViewport(lat, lon)) {
        const popup = new maplibregl.Popup({ offset: 16 }).setHTML(`
  <h3>Earthquake Details</h3>
  <strong>Location:</strong> ${quake.place || "Unknown"} <br>
  <strong>Lat/Lon:</strong> ${lat}, ${lon}<br>
  <strong>Occurred:</strong> ${new Date(quake.time).toLocaleString("en-GB", {
    hour12: false,
    timeZoneName: "short",
  })} <br>
  <strong>Magnitude:</strong> ${quake.mag} (${quake.magType} scale) <br>
  <strong>Depth:</strong> ${quake.depth} km <br>
  <strong>Horizontal Error:</strong> ${quake.horizontalError || "Not Available"} km <br>
  <strong>Depth Error:</strong> ${quake.depthError || "Not Available"} km <br>
  <strong>Magnitude Error:</strong> ${quake.magError || "Not Available"} <br>
  <strong>Magnitude Source:</strong> ${quake.magSource || "Not Available"} <br>
  <strong>Location Source:</strong> ${quake.locationSource || "Not Available"} <br>
  <strong>Updated:</strong> ${new Date(quake.updated).toLocaleString("en-GB", {
    hour12: false,
    timeZoneName: "short",
  })} <br>
  <strong>Event Type:</strong> ${quake.type || "Unknown"} <br>
  <strong>Network:</strong> ${quake.net || "Not Available"} <br>
  <strong>ID:</strong> ${quake.id || "Unknown"} <br>
  <strong>Number of Stations Reporting:</strong> ${quake.nst || "Unknown"} <br>
  <strong>RMS Value (Quality of Data):</strong> ${quake.rms || "Not Available"} <br>
  <strong><a href="https://earthquake.usgs.gov/earthquakes/eventpage/${quake.id}" target="_blank">USGS event page</a></strong>
`);

        const marker = new maplibregl.Marker()
          .setLngLat([lon, lat])
          .setPopup(popup)
          .addTo(map);
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
