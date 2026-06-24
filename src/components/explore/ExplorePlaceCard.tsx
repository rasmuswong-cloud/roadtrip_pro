import { Pressable, Text, View } from 'react-native';

import type { WorkspaceStyles } from '@/components/workspaces/WorkspaceBits';
import { imageSourceForPlace, placeholderTypeForPlace, type ExplorePlace } from '@/services/planning/exploreBoard';
import { TravelPlaceholder } from './TravelPlaceholder';

type ExplorePlaceCardProps = {
  place: ExplorePlace;
  primaryLabel: string;
  styles: WorkspaceStyles;
  extraLabel?: string;
  onPrimary: () => void;
  onExtra?: () => void;
  onMap: () => void;
  onRemove: (() => void) | null;
};

export function ExplorePlaceCard({
  place,
  primaryLabel,
  styles,
  extraLabel,
  onPrimary,
  onExtra,
  onMap,
  onRemove,
}: ExplorePlaceCardProps) {
  const placeholderType = placeholderTypeForPlace(place);
  const imageSource = imageSourceForPlace(place);

  return (
    <View style={styles.explorePlaceCard}>
      <TravelPlaceholder
        type={placeholderType}
        styles={styles}
        {...(imageSource === 'google_place_photo' ? { label: 'Google bild redo' } : {})}
      />
      <View style={styles.explorePlaceBody}>
        <Text style={styles.explorePlaceTitle} numberOfLines={2}>{place.title}</Text>
        <Text style={styles.explorePlaceSubtitle} numberOfLines={2}>{place.place || place.description || place.category}</Text>
        {place.description ? <Text style={styles.explorePlaceDescription} numberOfLines={2}>{place.description}</Text> : null}
        <View style={styles.exploreChipRow}>
          <Text style={styles.exploreTypeChip}>{place.category}</Text>
          {place.statusChips.slice(0, 2).map((chip) => (
            <Text key={chip} style={styles.exploreStatusChip}>{chip}</Text>
          ))}
        </View>
      </View>
      <View style={styles.exploreActionRow}>
        <Pressable style={styles.smallButton} onPress={onPrimary}>
          <Text style={styles.smallButtonText}>{primaryLabel}</Text>
        </Pressable>
        {extraLabel && onExtra ? (
          <Pressable style={styles.secondarySmallButton} onPress={onExtra}>
            <Text style={styles.secondarySmallButtonText}>{extraLabel}</Text>
          </Pressable>
        ) : null}
        <Pressable style={styles.secondarySmallButton} onPress={onMap}>
          <Text style={styles.secondarySmallButtonText}>Visa på karta</Text>
        </Pressable>
        {onRemove ? (
          <Pressable style={styles.ghostSmallButton} onPress={onRemove}>
            <Text style={styles.ghostSmallButtonText}>Ta bort</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
