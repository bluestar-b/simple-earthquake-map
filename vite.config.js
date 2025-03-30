export default {
  base: "/simple-earthquake-map/",
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/maplibre-gl')) {
            return 'maplibregl';
          }
        }
      }
    }
  }
};
