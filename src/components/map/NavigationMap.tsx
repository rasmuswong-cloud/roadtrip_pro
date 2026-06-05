import Mapbox from '@rnmapbox/maps';
import * as Location from 'expo-location';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Feature, FeatureCollection, LineString, Point } from 'geojson';
import type { Coordinates, ItineraryNode, RouteSummary } from '@/models';

const mapboxToken = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;

if (mapboxToken) {
  Mapbox.setAccessToken(mapboxToken);
}

type NavigationMapProps = {
  nodes: ItineraryNode[];
  activeRoute?: RouteSummary | null;
  followUser?: boolean;
  onUserLocationChange?: (coordinates: Coordinates) => void;
};

export function NavigationMap({
  nodes,
  activeRoute,
  followUser = true,
  onUserLocationChange,
}: NavigationMapProps) {
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);

  useEffect(() => {
    let subscription: Location.LocationSubscription | undefined;

    async function watchLocation() {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== Location.PermissionStatus.GRANTED) {
        return;
      }

      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          distanceInterval: 5,
          timeInterval: 1500,
        },
        (position) => {
          const coordinates = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          setUserLocation(coordinates);
          onUserLocationChange?.(coordinates);
        },
      );
    }

    void watchLocation();

    return () => {
      subscription?.remove();
    };
  }, [onUserLocationChange]);

  const routeFeature = useMemo<Feature<LineString> | null>(() => {
    if (!activeRoute?.geometry) {
      return null;
    }

    return {
      type: 'Feature',
      properties: {},
      geometry: activeRoute.geometry,
    };
  }, [activeRoute]);

  const nodeFeatures = useMemo<FeatureCollection<Point>>(
    () => ({
      type: 'FeatureCollection',
      features: nodes
        .filter((node) => node.location)
        .map((node) => ({
          type: 'Feature',
          id: node.id,
          properties: {
            title: node.title,
            type: node.type,
            startsAt: node.startsAt,
          },
          geometry: {
            type: 'Point',
            coordinates: [node.location!.longitude, node.location!.latitude],
          },
        })),
    }),
    [nodes],
  );

  const cameraCenter = userLocation
    ? [userLocation.longitude, userLocation.latitude]
    : nodeFeatures.features[0]?.geometry.coordinates;

  return (
    <View style={styles.container}>
      <Mapbox.MapView style={styles.map} styleURL={Mapbox.StyleURL.Outdoors}>
        {cameraCenter ? (
          <Mapbox.Camera
            followUserLocation={followUser}
            zoomLevel={13}
            centerCoordinate={cameraCenter}
            animationMode="flyTo"
            animationDuration={800}
          />
        ) : null}

        <Mapbox.UserLocation visible showsUserHeadingIndicator />

        {routeFeature ? (
          <Mapbox.ShapeSource id="active-route-source" shape={routeFeature}>
            <Mapbox.LineLayer
              id="active-route-line"
              style={{
                lineColor: '#0f766e',
                lineWidth: 5,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          </Mapbox.ShapeSource>
        ) : null}

        <Mapbox.ShapeSource id="itinerary-node-source" shape={nodeFeatures}>
          <Mapbox.CircleLayer
            id="itinerary-node-circles"
            style={{
              circleRadius: 7,
              circleColor: [
                'match',
                ['get', 'type'],
                'camping',
                '#059669',
                'activity',
                '#d97706',
                'lodging',
                '#2563eb',
                '#0f766e',
              ],
              circleStrokeColor: '#ffffff',
              circleStrokeWidth: 2,
            }}
          />
        </Mapbox.ShapeSource>
      </Mapbox.MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  map: {
    flex: 1,
  },
});
