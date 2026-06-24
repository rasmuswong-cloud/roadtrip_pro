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
import type { NearbyCategory, NearbyCategoryId, NearbySearchContext } from '@/services/planning/nearbySearch';
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
  nearbyCategories: NearbyCategory[];
  nearbyCategoryId: NearbyCategoryId;
  nearbyContexts: NearbySearchContext[];
  nearbyContextId: string;
  nearbyMessage: string | null;
  nearbyResults: ExplorePlace[];
  recommendedPlaces: ExplorePlace[];
  styles: WorkspaceStyles;
  onAddExplorePlaceToSelectedDay: (place: ExplorePlace) => void;
  onRemoveExplorePlace: (placeId: string) => void;
  onSaveNearbyPlace: (place: ExplorePlace) => void;
  onSaveExploreGooglePlace: (place: GooglePlace) => void;
  onSaveExploreNotes: () => void;
  onSaveRecommendedExplorePlace: (place: ExplorePlace) => void;
  onSearchExplorePlaces: () => void;
  onSearchNearbyPlaces: () => void;
  onSetNearbyCategoryId: (categoryId: NearbyCategoryId) => void;
  onSetNearbyContextId: (contextId: string) => void;
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
  nearbyCategories,
  nearbyCategoryId,
  nearbyContexts,
  nearbyContextId,
  nearbyMessage,
  nearbyResults,
  recommendedPlaces,
  styles,
  onAddExplorePlaceToSelectedDay,
  onRemoveExplorePlace,
  onSaveNearbyPlace,
  onSaveExploreGooglePlace,
  onSaveExploreNotes,
  onSaveRecommendedExplorePlace,
  onSearchExplorePlaces,
  onSearchNearbyPlaces,
  onSetNearbyCategoryId,
  onSetNearbyContextId,
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
          <Text style={styles.exploreSectionTitle}>Hitta nära</Text>
          <Text style={styles.exploreSectionMeta}>{nearbyContexts.length > 0 ? 'Sök runt stopp och dagar' : 'Inget stopp har kartposition'}</Text>
        </View>
        {nearbyContexts.length > 0 ? (
          <>
            <Text style={[styles.itemMeta, isDark && styles.textMutedDark]}>Välj plats att söka runt</Text>
            <View style={styles.exploreChipRow}>
              {nearbyContexts.slice(0, 8).map((context) => {
                const isSelected = context.id === nearbyContextId;
                return (
                  <Pressable
                    key={context.id}
                    style={isSelected ? styles.smallButton : styles.secondarySmallButton}
                    onPress={() => onSetNearbyContextId(context.id)}
                  >
                    <Text style={isSelected ? styles.smallButtonText : styles.secondarySmallButtonText} numberOfLines={1}>{context.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={[styles.itemMeta, isDark && styles.textMutedDark]}>Välj kategori</Text>
            <View style={styles.exploreChipRow}>
              {nearbyCategories.map((category) => {
                const isSelected = category.id === nearbyCategoryId;
                return (
                  <Pressable
                    key={category.id}
                    style={isSelected ? styles.smallButton : styles.secondarySmallButton}
                    onPress={() => onSetNearbyCategoryId(category.id)}
                  >
                    <Text style={isSelected ? styles.smallButtonText : styles.secondarySmallButtonText}>{category.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.exploreNoteActions}>
              <Text style={styles.exploreLocalHint}>{nearbyContexts.find((context) => context.id === nearbyContextId)?.detail ?? 'Söker från första stoppet med position.'}</Text>
              <Pressable style={[styles.commandButton, isLoading && styles.disabledButton]} onPress={onSearchNearbyPlaces} disabled={isLoading}>
                <Text style={styles.commandButtonText}>Sök nära</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <Text style={[styles.itemMeta, isDark && styles.textMutedDark]}>Fixa position på ett stopp i Dagar först, så kan Utforska söka restauranger, parkering och annat i närheten.</Text>
        )}
        {nearbyMessage ? <Text style={[styles.itemMeta, isDark && styles.textMutedDark]}>{nearbyMessage}</Text> : null}
        {nearbyResults.length > 0 ? (
          <View style={styles.exploreResultGrid}>
            {nearbyResults.map((place) => (
              <ExplorePlaceCard
                key={place.id}
                place={place}
                styles={styles}
                primaryLabel="Spara i Utforska"
                extraLabel="Lägg till i Dagar"
                onPrimary={() => onSaveNearbyPlace(place)}
                onExtra={() => onAddExplorePlaceToSelectedDay(place)}
                onMap={() => onShowExplorePlaceOnMap(place)}
                onRemove={null}
              />
            ))}
          </View>
        ) : null}
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
        {exploreResults.length === 0 ? (
          <Text style={[styles.itemMeta, isDark && styles.textMutedDark]}>Tips: börja brett, till exempel “camping”, “badplats” eller “restaurang nära nästa stopp”.</Text>
        ) : null}
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
