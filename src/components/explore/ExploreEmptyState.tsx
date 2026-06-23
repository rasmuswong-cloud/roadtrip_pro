import { Text, View } from 'react-native';

import type { WorkspaceStyles } from '@/components/workspaces/WorkspaceBits';
import { TravelPlaceholder } from './TravelPlaceholder';

type ExploreEmptyStateProps = {
  styles: WorkspaceStyles;
};

export function ExploreEmptyState({ styles }: ExploreEmptyStateProps) {
  return (
    <View style={styles.exploreEmptyState}>
      <TravelPlaceholder type="notes-explore" styles={styles} />
      <View style={styles.exploreEmptyCopy}>
        <Text style={styles.emptySearchTitle}>Inga idéplatser sparade än</Text>
        <Text style={styles.emptySearchText}>Sök efter restauranger, boenden, utsikter eller parkeringar. Spara bra idéer här först och lägg till dem i Dagar när du vet var de passar.</Text>
      </View>
    </View>
  );
}
