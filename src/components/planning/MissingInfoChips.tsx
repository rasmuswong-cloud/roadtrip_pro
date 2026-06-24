import { Text, View } from 'react-native';

import { dayCardStyles } from './DayCard.styles';

type MissingInfoChipsProps = {
  chips: string[];
};

export function MissingInfoChips({ chips }: MissingInfoChipsProps) {
  if (chips.length === 0) {
    return null;
  }

  const calmChips = chips
    .map(formatMissingChip)
    .filter((chip): chip is string => Boolean(chip))
    .slice(0, 3);

  if (calmChips.length === 0) {
    return null;
  }

  return (
    <View style={dayCardStyles.missingChipRow}>
      {calmChips.map((chip) => (
        <Text key={chip} style={dayCardStyles.missingChip}>{chip}</Text>
      ))}
    </View>
  );
}

function formatMissingChip(chip: string): string | null {
  if (chip.includes('Tid')) {
    return 'Saknar tid';
  }

  if (chip.includes('Kostnad')) {
    return 'Saknar kostnad';
  }

  if (chip.includes('Bokningsreferens')) {
    return 'Saknar bokning';
  }

  if (chip.includes('Kartposition')) {
    return 'Saknar plats';
  }

  return null;
}
