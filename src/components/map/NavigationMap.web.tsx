import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Coordinates, ItineraryNode, RouteSummary } from '@/models';

type NavigationMapProps = {
  nodes: ItineraryNode[];
  activeRoute?: RouteSummary | null;
  followUser?: boolean;
  onUserLocationChange?: (coordinates: Coordinates) => void;
};

export function NavigationMap({ nodes, activeRoute }: NavigationMapProps) {
  const points = useMemo(() => nodes.filter((node) => node.location), [nodes]);

  return (
    <View style={styles.canvas}>
      <View style={styles.routeLine} />
      {points.map((node, index) => (
        <View
          key={node.id}
          style={[
            styles.pin,
            {
              left: `${12 + (index % 4) * 24}%`,
              top: `${22 + (index % 3) * 20}%`,
              backgroundColor: nodeColor(node.type),
            },
          ]}
        >
          <Text style={styles.pinText}>{index + 1}</Text>
        </View>
      ))}
      <View style={styles.info}>
        <Text style={styles.infoTitle}>Desktop Preview</Text>
        <Text style={styles.infoText}>
          {activeRoute ? `${Math.round(activeRoute.distanceMeters / 1000)} km route` : 'No route loaded'} / {points.length} stops
        </Text>
      </View>
    </View>
  );
}

function nodeColor(type: ItineraryNode['type']) {
  switch (type) {
    case 'camping':
      return '#059669';
    case 'activity':
      return '#d97706';
    case 'lodging':
      return '#2563eb';
    default:
      return '#0f766e';
  }
}

const styles = StyleSheet.create({
  canvas: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#101820',
  },
  routeLine: {
    position: 'absolute',
    left: '10%',
    right: '10%',
    top: '54%',
    height: 4,
    backgroundColor: '#14b8a6',
    transform: [{ rotate: '-12deg' }],
    borderRadius: 2,
  },
  pin: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  pinText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  info: {
    position: 'absolute',
    left: 14,
    bottom: 14,
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  infoTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  infoText: {
    color: '#d6d3d1',
    fontSize: 12,
    marginTop: 3,
  },
});
