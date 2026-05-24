<!--
  @component
  Leaflet + OpenStreetMap map for the Contact page. Loaded with `client:visible`
  so the leaflet bundle only ships when the map scrolls into view. Sizing comes
  from the parent — never set a height here.

  Leaflet touches `window` at module top level, so the JS import is dynamic
  inside the effect (browser-only). The CSS import is fine — Vite extracts it
  and it never runs as JS.

  Pub address/geo come from `pubMapService` so there's a single source of truth.
-->
<script lang="ts">
  import 'leaflet/dist/leaflet.css';
  import type { Map as LMap } from 'leaflet';
  import markerIcon from 'leaflet/dist/images/marker-icon.png';
  import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
  import markerShadow from 'leaflet/dist/images/marker-shadow.png';
  import pubMapService from '$util/PubMap/PubMap.service';

  let el = $state<HTMLDivElement | null>(null);

  $effect(() => {
    if (!el) return;
    const { geo, address } = pubMapService;
    const directionsUrl = pubMapService.buildDirectionsUrl();
    let map: LMap | undefined;
    let cancelled = false;

    const init = async (): Promise<void> => {
      const L = (await import('leaflet')).default;
      if (cancelled || !el) return;

      L.Marker.prototype.options.icon = L.icon({
        iconRetinaUrl: markerIcon2x.src,
        iconUrl: markerIcon.src,
        shadowUrl: markerShadow.src,
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
      });

      const reduceMotion = pubMapService.prefersReducedMotion();
      map = L.map(el, {
        zoomAnimation: !reduceMotion,
        fadeAnimation: !reduceMotion,
        scrollWheelZoom: false
      }).setView([geo.lat, geo.lng], 15);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19
      }).addTo(map);

      L.marker([geo.lat, geo.lng])
        .addTo(map)
        .bindPopup(pubMapService.buildPopupHtml(address, directionsUrl))
        .openPopup();
    };

    void init();

    return () => {
      cancelled = true;
      map?.remove();
    };
  });
</script>

<div bind:this={el} class="h-full w-full" aria-label="Map showing the pub's location"></div>
