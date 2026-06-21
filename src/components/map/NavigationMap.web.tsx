import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Coordinates, ItineraryNode, RouteSummary } from '@/models';
import { calculateMapViewport, extractValidMapMarkers, mapInitialCenter, type MapMarkerData } from './mapData';

type NavigationMapProps = {
  nodes: ItineraryNode[];
  activeRoute?: RouteSummary | null;
  followUser?: boolean;
  compact?: boolean;
  onUserLocationChange?: (coordinates: Coordinates) => void;
};

type GoogleMapsNamespace = {
  Map: new (element: HTMLElement, options: Record<string, unknown>) => GoogleMapInstance;
  Marker: new (options: Record<string, unknown>) => GoogleMarkerInstance;
  LatLngBounds: new () => GoogleLatLngBounds;
};

type GoogleMapInstance = {
  setCenter: (coordinates: { lat: number; lng: number }) => void;
  setZoom: (zoom: number) => void;
  fitBounds: (bounds: GoogleLatLngBounds, padding?: number) => void;
};

type GoogleMarkerInstance = {
  setMap: (map: GoogleMapInstance | null) => void;
};

type GoogleLatLngBounds = {
  extend: (coordinates: { lat: number; lng: number }) => void;
};

declare global {
  interface Window {
    google?: { maps?: GoogleMapsNamespace };
    __roadtripGoogleMapsPromise?: Promise<GoogleMapsNamespace>;
  }
}

const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;

export function NavigationMap({ nodes, compact = false }: NavigationMapProps) {
  const mapElementRef = useRef<HTMLElement | null>(null);
  const mapRef = useRef<GoogleMapInstance | null>(null);
  const markerRefs = useRef<GoogleMarkerInstance[]>([]);
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'ready' | 'missing-key' | 'error'>(
    googleMapsApiKey ? 'idle' : 'missing-key',
  );
  const markers = useMemo(() => extractValidMapMarkers(nodes), [nodes]);
  const viewport = useMemo(() => calculateMapViewport(markers), [markers]);

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
          });
        }

        applyViewport(mapRef.current, maps, markers);
        markerRefs.current.forEach((marker) => marker.setMap(null));
        markerRefs.current = markers.map((marker) => new maps.Marker({
          position: toLatLng(marker.coordinates),
          map: mapRef.current,
          label: marker.label,
          title: marker.title,
        }));
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
  }, [markers, viewport]);

  useEffect(() => () => {
    markerRefs.current.forEach((marker) => marker.setMap(null));
    markerRefs.current = [];
  }, []);

  if (loadState === 'missing-key') {
    return <MapFallback compact={compact} title="Google Maps är inte konfigurerat" detail="Lägg till EXPO_PUBLIC_GOOGLE_MAPS_API_KEY eller återanvänd EXPO_PUBLIC_GOOGLE_PLACES_API_KEY." />;
  }

  if (loadState === 'error') {
    return <MapFallback compact={compact} title="Kartan kunde inte laddas" detail="Kontrollera att Maps JavaScript API är aktiverat och att nyckelns referrer-regler tillåter appens domän." />;
  }

  return (
    <View style={[styles.container, compact && styles.compactContainer]}>
      <View ref={mapElementRef as never} style={[styles.map, compact && styles.compactMap]} />
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

function applyViewport(map: GoogleMapInstance, maps: GoogleMapsNamespace, markers: MapMarkerData[]) {
  const viewport = calculateMapViewport(markers);

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
    markers.forEach((marker) => bounds.extend(toLatLng(marker.coordinates)));
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
