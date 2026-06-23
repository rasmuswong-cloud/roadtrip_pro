import { Text, View } from 'react-native';

import { SectionTitle, type WorkspaceStyles } from './WorkspaceBits';

type ToolsWorkspaceProps = {
  activeTripId: string | null;
  isDark: boolean;
  isDemoMode: boolean;
  isMobile: boolean;
  missingCoordinateCount: number;
  onlineSaveLabel: string;
  styles: WorkspaceStyles;
};

export function ToolsWorkspace({
  activeTripId,
  isDark,
  isDemoMode,
  isMobile,
  missingCoordinateCount,
  onlineSaveLabel,
  styles,
}: ToolsWorkspaceProps) {
  return (
    <View style={[styles.panelSection, isDark && styles.panelDark]}>
      <View style={styles.sectionHeaderRow}>
        <SectionTitle title="Tekniska verktyg" dark={isDark} styles={styles} />
        <Text style={styles.overviewMeta}>{activeTripId ? 'Synk är tillgänglig' : 'Anslut resan för onlineverktyg'}</Text>
      </View>
      <View style={[styles.toolSummaryGrid, isMobile && styles.singleColumnGrid]}>
        <View style={styles.toolSummaryItem}>
          <Text style={styles.toolSummaryLabel}>Import</Text>
          <Text style={styles.toolSummaryTitle}>Importera/uppdatera resplan</Text>
          <Text style={styles.toolSummaryText}>Ladda den korrigerade rutten och rensa gamla importerade stopp.</Text>
        </View>
        <View style={styles.toolSummaryItem}>
          <Text style={styles.toolSummaryLabel}>Karta</Text>
          <Text style={styles.toolSummaryTitle}>{missingCoordinateCount > 0 ? `${missingCoordinateCount} saknar kartposition` : 'Kartpositioner klara'}</Text>
          <Text style={styles.toolSummaryText}>Fyll saknade koordinater med Google Places när det behövs.</Text>
        </View>
        <View style={styles.toolSummaryItem}>
          <Text style={styles.toolSummaryLabel}>Synk</Text>
          <Text style={styles.toolSummaryTitle}>{onlineSaveLabel}</Text>
          <Text style={styles.toolSummaryText}>Konto, delning, ångra och AI-assistent ligger i verktygspanelen.</Text>
        </View>
      </View>
      {isDemoMode ? (
        <Text style={styles.emptySearchText}>Slå på redigering och anslut resan för att visa import, delning och synkverktyg.</Text>
      ) : null}
    </View>
  );
}
