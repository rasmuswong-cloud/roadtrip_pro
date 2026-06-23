import { Pressable, Text, TextInput, View } from 'react-native';

import type { ItineraryNode } from '@/models';
import type { BudgetCategorySummary, BudgetDaySummary, MissingCostItem, TravelBudgetCenter } from '@/services/planning/budgetAnalysis';
import { BudgetMetricCard, SectionTitle, type WorkspaceStyles } from './WorkspaceBits';

type BudgetWorkspaceProps = {
  budgetCenter: TravelBudgetCenter;
  displayedNodes: ItineraryNode[];
  formatPercentage: (value: number) => string;
  formatSek: (value: number) => string;
  isDark: boolean;
  isMobile: boolean;
  styles: WorkspaceStyles;
  travelerCountText: string;
  onOpenBudgetCostEditor: (nodeId: string) => void;
  onSetTravelerCountText: (value: string) => void;
};

export function BudgetWorkspace({
  budgetCenter,
  displayedNodes,
  formatPercentage,
  formatSek,
  isDark,
  isMobile,
  styles,
  travelerCountText,
  onOpenBudgetCostEditor,
  onSetTravelerCountText,
}: BudgetWorkspaceProps) {
  return (
    <View style={[styles.panelSection, isDark && styles.panelDark]}>
      <View style={styles.sectionHeaderRow}>
        <View>
          <SectionTitle title="Budget" dark={isDark} styles={styles} />
          <Text style={[styles.itemMeta, isDark && styles.textMutedDark]}>Fyll i kostnader direkt på stopp för att se total, per person, kategori och dag.</Text>
        </View>
        <View style={styles.budgetHeaderTools}>
          <Text style={styles.budgetTotal}>{formatSek(budgetCenter.total)}</Text>
          <View style={styles.travelerControl}>
            <Text style={styles.travelerLabel}>Personer</Text>
            <TextInput
              value={travelerCountText}
              onChangeText={onSetTravelerCountText}
              placeholder="2"
              placeholderTextColor={isDark ? '#737373' : '#78716c'}
              style={[styles.travelerInput, isDark && styles.inputDark]}
              inputMode="numeric"
            />
          </View>
        </View>
      </View>
      <View style={[styles.budgetGrid, isMobile && styles.singleColumnGrid]}>
        <BudgetMetricCard label="Total kostnad" value={formatSek(budgetCenter.total)} detail={budgetCenter.hasRegisteredCosts ? `${budgetCenter.costItemCount} kostnadsposter` : 'Resan har inga registrerade kostnader än'} accent="#0a2540" styles={styles} />
        <BudgetMetricCard label="Per person" value={formatSek(budgetCenter.perPerson)} detail={`${budgetCenter.travelerCount} personer`} accent="#7c3aed" styles={styles} />
        <BudgetMetricCard label="Kostnadsposter" value={`${budgetCenter.costItemCount}`} detail={`${displayedNodes.length} planerade stopp`} accent="#2563eb" styles={styles} />
        <BudgetMetricCard label="Saknade kostnader" value={`${budgetCenter.missingCostCount}`} detail={budgetCenter.missingCostCount > 0 ? 'Behöver fyllas i' : 'Inga saknade kostnader'} accent={budgetCenter.missingCostCount > 0 ? '#d97706' : '#0f766e'} styles={styles} />
        <BudgetMetricCard label="Dyraste dag" value={budgetCenter.mostExpensiveDay ? formatSek(budgetCenter.mostExpensiveDay.total) : 'Saknas'} detail={budgetCenter.mostExpensiveDay ? `${budgetCenter.mostExpensiveDay.label} / ${budgetCenter.mostExpensiveDay.dateLabel}` : 'Ingen dagskostnad än'} accent="#0ea5a3" styles={styles} />
        <BudgetMetricCard label="Dyraste kategori" value={budgetCenter.mostExpensiveCategory ? budgetCenter.mostExpensiveCategory.label : 'Saknas'} detail={budgetCenter.mostExpensiveCategory ? formatSek(budgetCenter.mostExpensiveCategory.total) : 'Ingen kategori än'} accent="#f6b35f" styles={styles} />
      </View>

      {!budgetCenter.hasItineraryItems ? (
        <View style={styles.budgetEmptyState}>
          <Text style={styles.emptySearchTitle}>Inga stopp i resplanen</Text>
          <Text style={styles.emptySearchText}>Gå till Dagar och lägg till boende, aktiviteter eller transport. Budgeten räknas automatiskt när stoppen får kostnader.</Text>
        </View>
      ) : !budgetCenter.hasRegisteredCosts ? (
        <View style={styles.budgetEmptyState}>
          <Text style={styles.emptySearchTitle}>Resan har inga registrerade kostnader än</Text>
          <Text style={styles.emptySearchText}>Använd listan “Saknar kostnad” nedan och välj “Fyll i kostnad” på ett stopp. Boende, aktiviteter, mat, bränsle och transport räknas in i totalen.</Text>
        </View>
      ) : null}

      <View style={styles.budgetSection}>
        <View style={styles.budgetSectionHeader}>
          <Text style={styles.budgetSectionTitle}>Kostnad per kategori</Text>
          <Text style={styles.budgetSectionMeta}>{formatSek(budgetCenter.total)} totalt</Text>
        </View>
        <View style={styles.budgetCategoryList}>
          {budgetCenter.categories.map((category: BudgetCategorySummary) => (
            <View key={category.key} style={styles.budgetCategoryRow}>
              <View style={styles.budgetCategoryText}>
                <Text style={styles.budgetCategoryLabel}>{category.label}</Text>
                <Text style={styles.budgetCategoryMeta}>{category.itemCount} poster / {formatPercentage(category.percentage)}</Text>
              </View>
              <View style={styles.budgetCategoryAmountWrap}>
                <Text style={styles.budgetCategoryAmount}>{formatSek(category.total)}</Text>
                <View style={styles.budgetProgressTrack}>
                  <View style={[styles.budgetProgressFill, { width: `${Math.round(category.percentage * 100)}%` }]} />
                </View>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.budgetSection}>
        <View style={styles.budgetSectionHeader}>
          <Text style={styles.budgetSectionTitle}>Kostnad per dag</Text>
          <Text style={styles.budgetSectionMeta}>{budgetCenter.days.length} dagar</Text>
        </View>
        {budgetCenter.days.length > 0 ? (
          <View style={styles.budgetDayList}>
            {budgetCenter.days.map((day: BudgetDaySummary) => (
              <View key={day.key} style={styles.budgetDayRow}>
                <View style={styles.budgetDayCopy}>
                  <Text style={styles.budgetDayTitle}>{day.label}</Text>
                  <Text style={styles.budgetDayMeta}>{day.dateLabel} / {day.routeLabel}</Text>
                </View>
                <View style={styles.budgetDayStats}>
                  <Text style={styles.budgetDayTotal}>{formatSek(day.total)}</Text>
                  <Text style={styles.budgetDayMeta}>{day.itemCount} poster{day.missingCostCount > 0 ? ` / ${day.missingCostCount} saknas` : ''}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptySearchText}>Inga dagar att visa.</Text>
        )}
      </View>

      <View style={styles.budgetSection}>
        <View style={styles.budgetSectionHeader}>
          <Text style={styles.budgetSectionTitle}>Saknar kostnad</Text>
          <Text style={styles.budgetSectionMeta}>{budgetCenter.missingCostCount} stopp</Text>
        </View>
        {budgetCenter.missingItems.length > 0 ? (
          <View style={styles.missingCostList}>
            {budgetCenter.missingItems.map((item: MissingCostItem) => (
              <View key={item.nodeId} style={styles.missingCostItem}>
                <View style={styles.missingCostCopy}>
                  <Text style={styles.missingCostTitle}>{item.title}</Text>
                  <Text style={styles.missingCostMeta}>{item.dayLabel} / {item.typeLabel} / {item.place}</Text>
                </View>
                <Pressable style={styles.secondarySmallButton} onPress={() => onOpenBudgetCostEditor(item.nodeId)}>
                  <Text style={styles.secondarySmallButtonText}>Fyll i kostnad</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.budgetReadyText}>Inga saknade kostnader.</Text>
        )}
      </View>
    </View>
  );
}
