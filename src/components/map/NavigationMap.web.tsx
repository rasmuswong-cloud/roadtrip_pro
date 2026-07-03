import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Coordinates, ItineraryNode, RouteSummary } from '@/models';
import {
  buildRouteDrivingLabels,
  calculateRouteAwareMapViewport,
  extractRoutePathCoordinates,
  extractValidMapMarkers,
  hasRoadRouteGeometry,
  mapInitialCenter,
  type MapMarkerData,
} from './mapData';

type NavigationMapProps = {
  nodes: ItineraryNode[];
  activeRoute?: RouteSummary | null;
  followUser?: boolean;
  compact?: boolean;
  pendingAddLocation?: Coordinates | null;
  onUserLocationChange?: (coordinates: Coordinates) => void;
  onMapPress?: (coordinates: Coordinates) => void;
  onCancelPendingAddLocation?: () => void;
  onConfirmPendingAddLocation?: () => void;
};

type GoogleMapsNamespace = {
  Map: new (element: HTMLElement, options: Record<string, unknown>) => GoogleMapInstance;
  Marker: new (options: Record<string, unknown>) => GoogleMarkerInstance;
  Polyline: new (options: Record<string, unknown>) => GooglePolylineInstance;
  LatLngBounds: new () => GoogleLatLngBounds;
};

type GoogleMapInstance = {
  addListener: (eventName: string, handler: (event: GoogleMapMouseEvent) => void) => GoogleMapsListener;
  setCenter: (coordinates: { lat: number; lng: number }) => void;
  setZoom: (zoom: number) => void;
  fitBounds: (bounds: GoogleLatLngBounds, padding?: number) => void;
};

type GoogleMarkerInstance = {
  setMap: (map: GoogleMapInstance | null) => void;
};

type GooglePolylineInstance = {
  setMap: (map: GoogleMapInstance | null) => void;
};

type GoogleLatLngBounds = {
  extend: (coordinates: { lat: number; lng: number }) => void;
};

type GoogleMapsListener = {
  remove: () => void;
};

type GoogleMapMouseEvent = {
  latLng?: {
    lat: () => number;
    lng: () => number;
  };
};

declare global {
  interface Window {
    google?: { maps?: GoogleMapsNamespace };
    __roadtripGoogleMapsPromise?: Promise<GoogleMapsNamespace>;
  }
}

const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;

export function NavigationMap({
  nodes,
  activeRoute,
  compact = false,
  pendingAddLocation,
  onMapPress,
  onCancelPendingAddLocation,
  onConfirmPendingAddLocation,
}: NavigationMapProps) {
  const mapElementRef = useRef<HTMLElement | null>(null);
  const mapRef = useRef<GoogleMapInstance | null>(null);
  const markerRefs = useRef<GoogleMarkerInstance[]>([]);
  const routePolylineRefs = useRef<GooglePolylineInstance[]>([]);
  const routeLabelRefs = useRef<GoogleMarkerInstance[]>([]);
  const pendingMarkerRef = useRef<GoogleMarkerInstance | null>(null);
  const mapClickListenerRef = useRef<GoogleMapsListener | null>(null);
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'ready' | 'missing-key' | 'error'>(
    googleMapsApiKey ? 'idle' : 'missing-key',
  );
  const markers = useMemo(() => extractValidMapMarkers(nodes), [nodes]);
  const routePath = useMemo(() => extractRoutePathCoordinates(activeRoute), [activeRoute]);
  const hasRoutePath = useMemo(() => hasRoadRouteGeometry(activeRoute), [activeRoute]);
  const routeLabels = useMemo(() => buildRouteDrivingLabels(activeRoute, nodes), [activeRoute, nodes]);
  const visibleRouteLabels = useMemo(() => routeLabels.slice(0, compact ? 3 : 5), [compact, routeLabels]);
  const viewport = useMemo(() => calculateRouteAwareMapViewport(markers, routePath), [markers, routePath]);

  useEffect(() => {
    if (!googleMapsApiKey) {
      return;
    }

    let cancelled = false;
    setLoadState('loading');

    loadGoogleMaps(googleMapsApiKey)
      .then((maps) => {
        if (cancelled || !mapElementRef.current) {
          return;
        }

        if (!mapRef.current) {
          mapRef.current = new maps.Map(mapElementRef.current, {
            center: toLatLng(mapInitialCenter(viewport)),
            zoom: viewport.state === 'single' ? 11 : 8,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            clickableIcons: false,
            draggableCursor: onMapPress ? 'crosshair' : undefined,
          });
        }

        ensureMapLabelStyles();
        applyViewport(mapRef.current, maps, markers, routePath, viewport);
        mapClickListenerRef.current?.remove();
        mapClickListenerRef.current = onMapPress
          ? mapRef.current.addListener('click', (event) => {
              const coordinates = coordinatesFromMapEvent(event);
              if (coordinates) {
                onMapPress(coordinates);
              }
            })
          : null;
        routePolylineRefs.current.forEach((polyline) => polyline.setMap(null));
        routePolylineRefs.current = hasRoutePath
          ? buildRoutePolylines(maps, mapRef.current, routePath, compact)
          : [];
        markerRefs.current.forEach((marker) => marker.setMap(null));
        markerRefs.current = markers.map((marker) => new maps.Marker({
          position: toLatLng(marker.coordinates),
          map: mapRef.current,
          label: marker.label,
          title: marker.title,
          zIndex: 30,
        }));
        routeLabelRefs.current.forEach((marker) => marker.setMap(null));
        routeLabelRefs.current = visibleRouteLabels.map((label) => new maps.Marker({
          position: toLatLng(label.coordinates),
          map: mapRef.current,
          title: label.label,
          label: {
            text: label.label,
            color: '#0a2540',
            fontSize: '11px',
            fontWeight: '800',
            className: 'roadtrip-route-label',
          },
          icon: transparentMarkerIcon,
          zIndex: 40,
        }));
        pendingMarkerRef.current?.setMap(null);
        pendingMarkerRef.current = pendingAddLocation
          ? new maps.Marker({
              position: toLatLng(pendingAddLocation),
              map: mapRef.current,
              title: 'Vald plats',
              label: '+',
              zIndex: 30,
            })
          : null;
        setLoadState('ready');
      })
      .catch(() => {
        if (!cancelled) {
          setLoadState('error');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [compact, hasRoutePath, markers, onMapPress, pendingAddLocation, routePath, viewport, visibleRouteLabels]);

  useEffect(() => () => {
    markerRefs.current.forEach((marker) => marker.setMap(null));
    markerRefs.current = [];
    routeLabelRefs.current.forEach((marker) => marker.setMap(null));
    routeLabelRefs.current = [];
    pendingMarkerRef.current?.setMap(null);
    pendingMarkerRef.current = null;
    mapClickListenerRef.current?.remove();
    mapClickListenerRef.current = null;
    routePolylineRefs.current.forEach((polyline) => polyline.setMap(null));
    routePolylineRefs.current = [];
  }, []);

  if (loadState === 'missing-key') {
    return <MapFallback compact={compact} title="Google Maps är inte konfigurerat" detail="Lägg till EXPO_PUBLIC_GOOGLE_MAPS_API_KEY eller återanvänd EXPO_PUBLIC_GOOGLE_PLACES_API_KEY." />;
  }

  if (loadState === 'error') {
    return <MapFallback compact={compact} title="Kartan kunde inte laddas" detail="Kontrollera att Maps JavaScript API är aktiverat och att nyckelns referrer-regler tillåter appens domän." />;
  }

  return (
    <View style={[styles.container, compact && styles.compactContainer]}>
      <View testID="navigation-map-canvas" ref={mapElementRef as never} style={[styles.map, compact && styles.compactMap]} />
      {loadState !== 'ready' ? (
        <View style={styles.loadingOverlay}>
          <Text style={styles.loadingText}>Laddar karta...</Text>
        </View>
      ) : null}
      {loadState === 'ready' && viewport.state === 'empty' ? (
        <View style={styles.emptyOverlay}>
          <Text style={styles.emptyTitle}>Saknar koordinater för kartvisning</Text>
          <Text style={styles.emptyText}>Lägg till eller uppdatera kartpositioner för stoppen.</Text>
        </View>
      ) : null}
      {loadState === 'ready' && pendingAddLocation ? (
        <View testID="map-click-add-prompt" style={styles.pendingAddOverlay}>
          <Text style={styles.pendingAddTitle}>Lägg till plats här?</Text>
          <Text style={styles.pendingAddText}>
            Vald plats på kartan · {formatCoordinate(pendingAddLocation.latitude)}, {formatCoordinate(pendingAddLocation.longitude)}
          </Text>
          <View style={styles.pendingAddActions}>
            <Text
              testID="map-click-cancel"
              accessibilityRole="button"
              onPress={onCancelPendingAddLocation}
              style={styles.pendingAddSecondary}
            >
              Avbryt
            </Text>
            <Text
              testID="map-click-confirm"
              accessibilityRole="button"
              onPress={onConfirmPendingAddLocation}
              style={styles.pendingAddPrimary}
            >
              Lägg till stopp
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function MapFallback({ compact, title, detail }: { compact: boolean; title: string; detail: string }) {
  return (
    <View style={[styles.fallback, compact && styles.compactFallback]}>
      <Text style={styles.fallbackTitle}>{title}</Text>
      <Text style={styles.fallbackText}>{detail}</Text>
    </View>
  );
}

function loadGoogleMaps(apiKey: string): Promise<GoogleMapsNamespace> {
  if (window.google?.maps) {
    return Promise.resolve(window.google.maps);
  }

  if (window.__roadtripGoogleMapsPromise) {
    return window.__roadtripGoogleMapsPromise;
  }

  window.__roadtripGoogleMapsPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>('script[data-roadtrip-google-maps="true"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => {
        if (window.google?.maps) {
          resolve(window.google.maps);
        } else {
          reject(new Error('Google Maps did not initialize.'));
        }
      });
      existingScript.addEventListener('error', () => reject(new Error('Google Maps failed to load.')));
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly`;
    script.async = true;
    script.defer = true;
    script.dataset.roadtripGoogleMaps = 'true';
    script.addEventListener('load', () => {
      if (window.google?.maps) {
        resolve(window.google.maps);
      } else {
        reject(new Error('Google Maps did not initialize.'));
      }
    });
    script.addEventListener('error', () => reject(new Error('Google Maps failed to load.')));
    document.head.appendChild(script);
  });

  return window.__roadtripGoogleMapsPromise;
}

function ensureMapLabelStyles() {
  const styleId = 'roadtrip-route-label-styles';
  if (document.getElementById(styleId)) {
    return;
  }

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    .roadtrip-route-label {
      background: rgba(255,255,255,0.94);
      border: 1px solid rgba(15,118,110,0.22);
      border-radius: 999px;
      box-shadow: 0 6px 16px rgba(10,37,64,0.16);
      padding: 5px 9px;
      white-space: nowrap;
      transform: translateY(-8px);
    }
  `;
  document.head.appendChild(style);
}

function buildRoutePolylines(
  maps: GoogleMapsNamespace,
  map: GoogleMapInstance | null,
  routePath: Coordinates[],
  compact: boolean,
): GooglePolylineInstance[] {
  const path = routePath.map(toLatLng);
  const baseWeight = compact ? 6 : 7;

  return [
    new maps.Polyline({
      path,
      map,
      strokeColor: '#0a2540',
      strokeOpacity: 0.24,
      strokeWeight: baseWeight + 8,
      zIndex: 8,
    }),
    new maps.Polyline({
      path,
      map,
      strokeColor: '#ffffff',
      strokeOpacity: 0.96,
      strokeWeight: baseWeight + 4,
      zIndex: 9,
    }),
    new maps.Polyline({
      path,
      map,
      strokeColor: '#1d4ed8',
      strokeOpacity: 0.98,
      strokeWeight: baseWeight,
      zIndex: 10,
    }),
  ];
}

const transparentMarkerIcon = {
  url: 'data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%221%22%20height%3D%221%22%3E%3C/svg%3E',
  scaledSize: { width: 1, height: 1 },
};

function coordinatesFromMapEvent(event: GoogleMapMouseEvent): Coordinates | null {
  const latitude = event.latLng?.lat();
  const longitude = event.latLng?.lng();
  const coordinates = { latitude, longitude };
  return isValidCoordinate(coordinates) ? coordinates : null;
}

function isValidCoordinate(coordinates: { latitude?: number | undefined; longitude?: number | undefined }): coordinates is Coordinates {
  return Boolean(
    Number.isFinite(coordinates.latitude)
      && Number.isFinite(coordinates.longitude)
      && coordinates.latitude !== undefined
      && coordinates.latitude >= -90
      && coordinates.latitude <= 90
      && coordinates.longitude !== undefined
      && coordinates.longitude >= -180
      && coordinates.longitude <= 180,
  );
}

function formatCoordinate(value: number): string {
  return value.toFixed(5);
}

function applyViewport(map: GoogleMapInstance, maps: GoogleMapsNamespace, markers: MapMarkerData[], routePath: Coordinates[], viewport: ReturnType<typeof calculateRouteAwareMapViewport>) {
  if (viewport.state === 'empty') {
    map.setCenter(toLatLng(mapInitialCenter(viewport)));
    map.setZoom(5);
    return;
  }

  if (viewport.state === 'single') {
    map.setCenter(toLatLng(viewport.center));
    map.setZoom(11);
    return;
  }

  if (viewport.state === 'bounds') {
    const bounds = new maps.LatLngBounds();
    const fitCoordinates = routePath.length > 1 ? routePath : markers.map((marker) => marker.coordinates);
    fitCoordinates.forEach((coordinates) => bounds.extend(toLatLng(coordinates)));
    map.fitBounds(bounds, 48);
  }
}

function toLatLng(coordinates: Coordinates): { lat: number; lng: number } {
  return { lat: coordinates.latitude, lng: coordinates.longitude };
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 320,
    width: '100%',
    backgroundColor: '#e5eef7',
  },
  map: {
    flex: 1,
    minHeight: 320,
    width: '100%',
  },
  compactContainer: {
    minHeight: 220,
  },
  compactMap: {
    minHeight: 220,
  },
  loadingOverlay: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(10,37,64,0.82)',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  loadingText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  emptyOverlay: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.94)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(37,99,235,0.16)',
  },
  emptyTitle: {
    color: '#0a2540',
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center',
  },
  emptyText: {
    color: '#425466',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
    marginTop: 3,
    textAlign: 'center',
  },
  pendingAddOverlay: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(15,118,110,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 11,
    shadowColor: '#0a2540',
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  pendingAddTitle: {
    color: '#0a2540',
    fontSize: 14,
    fontWeight: '900',
  },
  pendingAddText: {
    color: '#425466',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    marginTop: 3,
  },
  pendingAddActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 10,
  },
  pendingAddPrimary: {
    overflow: 'hidden',
    borderRadius: 999,
    backgroundColor: '#0f766e',
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pendingAddSecondary: {
    overflow: 'hidden',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d7e1ea',
    backgroundColor: '#ffffff',
    color: '#0a2540',
    fontSize: 12,
    fontWeight: '900',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  fallback: {
    flex: 1,
    minHeight: 320,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f6f9fc',
    padding: 18,
  },
  compactFallback: {
    minHeight: 220,
  },
  fallbackTitle: {
    color: '#0a2540',
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
  },
  fallbackText: {
    color: '#425466',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    textAlign: 'center',
  },
});
