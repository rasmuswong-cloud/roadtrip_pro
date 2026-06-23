import { Pressable, Text, TextInput, View } from 'react-native';

import type { GooglePlace } from '@/services/google/googlePlaces';
import {
  explorePlaceFromGooglePlace,
  imageSourceForPlace,
  placeholderTypeForPlace,
  type ExploreCategory,
  type ExplorePlace,
  type TravelPlaceholderType,
} from '@/services/planning/exploreBoard';
import { SectionTitle, type WorkspaceStyles } from './WorkspaceBits';

type ExploreEmptyState = {
  isEmpty: boolean;
  message: string;
};

type ExploreWorkspaceProps = {
  activeTripId: string | null;
  exploreEmptyState: ExploreEmptyState;
  exploreGroups: Record<ExploreCategory, ExplorePlace[]>;
  exploreNotes: string;
  exploreResults: GooglePlace[];
  exploreSearchQuery: string;
  isDark: boolean;
  isLoading: boolean;
  recommendedPlaces: ExplorePlace[];
  styles: WorkspaceStyles;
  onAddExplorePlaceToSelectedDay: (place: ExplorePlace) => void;
  onRemoveExplorePlace: (placeId: string) => void;
  onSaveExploreGooglePlace: (place: GooglePlace) => void;
  onSaveExploreNotes: () => void;
  onSaveRecommendedExplorePlace: (place: ExplorePlace) => void;
  onSearchExplorePlaces: () => void;
  onSetExploreNotes: (text: string) => void;
  onSetExploreSearchQuery: (text: string) => void;
  onShowExplorePlaceOnMap: (place: ExplorePlace) => void;
};

export function ExploreWorkspace({
  activeTripId,
  exploreEmptyState,
  exploreGroups,
  exploreNotes,
  exploreResults,
  exploreSearchQuery,
  isDark,
  isLoading,
  recommendedPlaces,
  styles,
  onAddExplorePlaceToSelectedDay,
  onRemoveExplorePlace,
  onSaveExploreGooglePlace,
  onSaveExploreNotes,
  onSaveRecommendedExplorePlace,
  onSearchExplorePlaces,
  onSetExploreNotes,
  onSetExploreSearchQuery,
  onShowExplorePlaceOnMap,
}: ExploreWorkspaceProps) {
  return (
    <View style={[styles.panelSection, isDark && styles.panelDark]}>
      <View style={styles.sectionHeaderRow}>
        <View>
          <SectionTitle title="Utforska" dark={isDark} styles={styles} />
          <Text style={[styles.itemMeta, isDark && styles.textMutedDark]}>Samla tips, platser och lösa idéer innan de blir stopp i Dagar.</Text>
        </View>
        <View style={styles.exploreSaveHint}>
          <Text style={styles.exploreSaveHintText}>Lokalt idébord</Text>
        </View>
      </View>

      <View style={styles.exploreNotesCard}>
        <View style={styles.exploreSectionHeader}>
          <Text style={styles.exploreSectionTitle}>Anteckningar</Text>
          <Text style={styles.exploreSectionMeta}>Tips, länkar och kom ihåg</Text>
        </View>
        <TextInput
          value={exploreNotes}
          onChangeText={onSetExploreNotes}
          placeholder="Skriv eller klistra in tips, länkar och saker att komma ihåg"
          placeholderTextColor={isDark ? '#737373' : '#78716c'}
          style={[styles.exploreNotesInput, isDark && styles.inputDark]}
          multiline
        />
        <View style={styles.exploreNoteActions}>
          <Text style={styles.exploreLocalHint}>{activeTripId ? 'Sparas i den anslutna resan.' : 'Sparas lokalt tills resan är ansluten.'}</Text>
          <Pressable style={[styles.smallButton, isLoading && styles.disabledButton]} onPress={onSaveExploreNotes} disabled={isLoading}>
            <Text style={styles.smallButtonText}>Spara anteckningar</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.exploreSearchCard}>
        <View style={styles.exploreSectionHeader}>
          <Text style={styles.exploreSectionTitle}>Lägg till plats</Text>
          <Text style={styles.exploreSectionMeta}>Sök plats</Text>
        </View>
        <View style={styles.exploreSearchRow}>
          <TextInput
            value={exploreSearchQuery}
            onChangeText={onSetExploreSearchQuery}
            placeholder="Sök restaurang, hotell, utsikt, parkering..."
            placeholderTextColor={isDark ? '#737373' : '#78716c'}
            style={[styles.exploreSearchInput, isDark && styles.inputDark]}
            onSubmitEditing={onSearchExplorePlaces}
          />
          <Pressable style={[styles.commandButton, isLoading && styles.disabledButton]} onPress={onSearchExplorePlaces} disabled={isLoading}>
            <Text style={styles.commandButtonText}>Sök</Text>
          </Pressable>
        </View>
        {exploreResults.length > 0 ? (
          <View style={styles.exploreResultGrid}>
            {exploreResults.map((place) => {
              const explorePlace = explorePlaceFromGooglePlace(place);
              return (
                <ExplorePlaceCard
                  key={place.id}
                  place={explorePlace}
                  styles={styles}
                  primaryLabel="Spara"
                  onPrimary={() => onSaveExploreGooglePlace(place)}
                  onMap={() => onShowExplorePlaceOnMap(explorePlace)}
                  onRemove={null}
                />
              );
            })}
          </View>
        ) : null}
      </View>

      <View style={styles.exploreBoardSection}>
        <View style={styles.exploreSectionHeader}>
          <Text style={styles.exploreSectionTitle}>Platser att besöka</Text>
          <Text style={styles.exploreSectionMeta}>{exploreEmptyState.message}</Text>
        </View>
        {exploreEmptyState.isEmpty ? (
          <View style={styles.exploreEmptyState}>
            <TravelPlaceholder type="notes-explore" styles={styles} />
            <View style={styles.exploreEmptyCopy}>
              <Text style={styles.emptySearchTitle}>Inga idéplatser sparade än</Text>
              <Text style={styles.emptySearchText}>Sök efter en plats eller spara en rekommendation för att bygga din lista.</Text>
            </View>
          </View>
        ) : (
          (Object.keys(exploreGroups) as ExploreCategory[]).map((category) => (
            exploreGroups[category].length > 0 ? (
              <View key={category} style={styles.exploreCategoryBlock}>
                <Text style={styles.exploreCategoryTitle}>{category}</Text>
                <View style={styles.explorePlaceGrid}>
                  {exploreGroups[category].map((place) => (
                    <ExplorePlaceCard
                      key={place.id}
                      place={place}
                      styles={styles}
                      primaryLabel="Lägg till i dag"
                      onPrimary={() => onAddExplorePlaceToSelectedDay(place)}
                      onMap={() => onShowExplorePlaceOnMap(place)}
                      onRemove={() => onRemoveExplorePlace(place.id)}
                    />
                  ))}
                </View>
              </View>
            ) : null
          ))
        )}
      </View>

      <View style={styles.exploreBoardSection}>
        <View style={styles.exploreSectionHeader}>
          <Text style={styles.exploreSectionTitle}>Rekommenderade platser</Text>
          <Text style={styles.exploreSectionMeta}>Från din nuvarande resplan</Text>
        </View>
        <View style={styles.recommendedPlaceRow}>
          {recommendedPlaces.map((place) => (
            <RecommendedPlaceCard
              key={place.id}
              place={place}
              styles={styles}
              onAdd={() => onSaveRecommendedExplorePlace(place)}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

function ExplorePlaceCard({
  place,
  primaryLabel,
  styles,
  onPrimary,
  onMap,
  onRemove,
}: {
  place: ExplorePlace;
  primaryLabel: string;
  styles: WorkspaceStyles;
  onPrimary: () => void;
  onMap: () => void;
  onRemove: (() => void) | null;
}) {
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

type RecommendedPlaceCardProps = {
  place: ExplorePlace;
  styles: WorkspaceStyles;
  onAdd: () => void;
};

function RecommendedPlaceCard({ place, styles, onAdd }: RecommendedPlaceCardProps) {
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

type TravelPlaceholderProps = {
  type: TravelPlaceholderType;
  styles: WorkspaceStyles;
  compact?: boolean;
  label?: string;
};

function TravelPlaceholder({ type, styles, compact = false, label }: TravelPlaceholderProps) {
  const visual = placeholderVisual(type);
  return (
    <View style={[styles.travelPlaceholder, compact && styles.travelPlaceholderCompact, { backgroundColor: visual.backgroundColor }]}>
      <View style={[styles.travelPlaceholderShape, { backgroundColor: visual.accentColor }]} />
      <Text style={[styles.travelPlaceholderIcon, { color: visual.accentColor }]}>{visual.icon}</Text>
      <Text style={styles.travelPlaceholderLabel}>{label ?? visual.label}</Text>
    </View>
  );
}

function placeholderVisual(type: TravelPlaceholderType): { icon: string; label: string; backgroundColor: string; accentColor: string } {
  switch (type) {
    case 'lodging':
      return { icon: 'H', label: 'Boende', backgroundColor: '#eef7f2', accentColor: '#0f766e' };
    case 'activity':
      return { icon: 'A', label: 'Aktivitet', backgroundColor: '#fff7df', accentColor: '#d97706' };
    case 'food':
      return { icon: 'F', label: 'Mat', backgroundColor: '#fff1f2', accentColor: '#be123c' };
    case 'fuel':
      return { icon: 'B', label: 'Bränsle', backgroundColor: '#eef2ff', accentColor: '#4f46e5' };
    case 'transport':
      return { icon: 'T', label: 'Transport', backgroundColor: '#eff6ff', accentColor: '#2563eb' };
    case 'budget':
      return { icon: 'SEK', label: 'Budget', backgroundColor: '#f8faf7', accentColor: '#475569' };
    case 'notes-explore':
      return { icon: 'i', label: 'Tips', backgroundColor: '#fffefa', accentColor: '#d97706' };
    case 'route-day':
      return { icon: 'R', label: 'Rutt', backgroundColor: '#eef7f2', accentColor: '#0f766e' };
    default:
      return { icon: 'P', label: 'Plats', backgroundColor: '#f8faf7', accentColor: '#52616f' };
  }
}
