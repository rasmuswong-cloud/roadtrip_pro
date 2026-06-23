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
      {chips.map((chip) => (
        <Text key={chip} style={dayCardStyles.missingChip}>{chip}</Text>
      ))}
    </View>
  );
}
