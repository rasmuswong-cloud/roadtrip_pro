import { Pressable, Text, TextInput, View } from 'react-native';

import type { WorkspaceStyles } from '@/components/workspaces/WorkspaceBits';

type ExploreNotesProps = {
  activeTripId: string | null;
  exploreNotes: string;
  isDark: boolean;
  isLoading: boolean;
  styles: WorkspaceStyles;
  onSaveExploreNotes: () => void;
  onSetExploreNotes: (text: string) => void;
};

export function ExploreNotes({
  activeTripId,
  exploreNotes,
  isDark,
  isLoading,
  styles,
  onSaveExploreNotes,
  onSetExploreNotes,
}: ExploreNotesProps) {
  return (
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
  );
}
