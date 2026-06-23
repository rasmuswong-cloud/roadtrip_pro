import { Text, View } from 'react-native';

import { dayCardStyles } from './DayCard.styles';

type MissingInfoChipsProps = {
  chips: string[];
};

export function MissingInfoChips({ chips }: MissingInfoChipsProps) {
  if (chips.length === 0) {
    return null;
  }

  return (
    <View style={dayCardStyles.missingChipRow}>
      <Text style={dayCardStyles.missingChip}>{chips.length > 1 ? `Att komplettera (${chips.length})` : 'Att komplettera'}</Text>
    </View>
  );
}
