import { Pressable, Text, View } from 'react-native';

import type { WorkspaceStyles } from '@/components/workspaces/WorkspaceBits';
import { placeholderTypeForPlace, type ExplorePlace } from '@/services/planning/exploreBoard';
import { TravelPlaceholder } from './TravelPlaceholder';

type RecommendedPlaceCardProps = {
  place: ExplorePlace;
  styles: WorkspaceStyles;
  onAdd: () => void;
};

export function RecommendedPlaceCard({ place, styles, onAdd }: RecommendedPlaceCardProps) {
  return (
    <View style={styles.recommendedPlaceCard}>
      <TravelPlaceholder type={placeholderTypeForPlace(place)} styles={styles} compact />
      <View style={styles.recommendedPlaceCopy}>
        <Text style={styles.recommendedPlaceTitle} numberOfLines={2}>{place.title}</Text>
        <Text style={styles.recommendedPlaceMeta} numberOfLines={1}>{place.category}{place.place ? ` / ${place.place}` : ''}</Text>
      </View>
      <Pressable style={styles.plusButton} onPress={onAdd}>
        <Text style={styles.plusButtonText}>+</Text>
      </Pressable>
    </View>
  );
}
