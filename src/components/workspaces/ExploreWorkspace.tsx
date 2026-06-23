import { Pressable, Text, TextInput, View } from 'react-native';

import { ExploreEmptyState } from '@/components/explore/ExploreEmptyState';
import { ExploreNotes } from '@/components/explore/ExploreNotes';
import { ExplorePlaceCard } from '@/components/explore/ExplorePlaceCard';
import { RecommendedPlaceCard } from '@/components/explore/RecommendedPlaceCard';
import type { GooglePlace } from '@/services/google/googlePlaces';
import {
  explorePlaceFromGooglePlace,
  type ExploreCategory,
  type ExplorePlace,
} from '@/services/planning/exploreBoard';
import { SectionTitle, type WorkspaceStyles } from './WorkspaceBits';

type ExploreEmptyStateSummary = {
  isEmpty: boolean;
  message: string;
};

type ExploreWorkspaceProps = {
  activeTripId: string | null;
  exploreEmptyState: ExploreEmptyStateSummary;
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

      <ExploreNotes
        activeTripId={activeTripId}
        exploreNotes={exploreNotes}
        isDark={isDark}
        isLoading={isLoading}
        styles={styles}
        onSaveExploreNotes={onSaveExploreNotes}
        onSetExploreNotes={onSetExploreNotes}
      />

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
          <ExploreEmptyState styles={styles} />
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
