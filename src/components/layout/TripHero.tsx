import { Text, View } from 'react-native';

type HeroCopy = {
  eyebrow: string;
  title: string;
  body: string;
};

type TripHeroProps = {
  copy: HeroCopy;
  drivingLabel: string;
  isMobile: boolean;
  routeLabel: string;
  startTitle: string;
  stopCount: number;
  styles: any;
  targetTitle: string;
};

export function TripHero({
  copy,
  drivingLabel,
  isMobile,
  routeLabel,
  startTitle,
  stopCount,
  styles,
  targetTitle,
}: TripHeroProps) {
  return (
    <View style={[styles.tripHero, isMobile && styles.tripHeroMobile]}>
      <View style={styles.heroPlaneOne} />
      <View style={styles.heroPlaneTwo} />
      <View style={styles.heroPlaneThree} />
      <View style={[styles.tripHeroCopy, isMobile && styles.tripHeroCopyMobile]}>
        <Text style={styles.heroEyebrow}>{copy.eyebrow}</Text>
        <Text style={styles.heroTitle}>{copy.title}</Text>
        <Text style={styles.heroBody}>{copy.body}</Text>
        <View style={styles.tripRouteLine}>
          <Text style={styles.tripRouteText}>{startTitle}</Text>
          <Text style={styles.tripRouteArrow}>→</Text>
          <Text style={styles.tripRouteText}>{targetTitle}</Text>
        </View>
      </View>
      <View style={[styles.heroStats, isMobile && styles.heroStatsMobile]}>
        <View style={styles.heroStat}>
          <Text style={styles.heroStatValue}>{stopCount}</Text>
          <Text style={styles.heroStatLabel}>Stopp</Text>
        </View>
        <View style={styles.heroStat}>
          <Text style={styles.heroStatValue}>{routeLabel}</Text>
          <Text style={styles.heroStatLabel}>Rutt</Text>
        </View>
        <View style={styles.heroStat}>
          <Text style={styles.heroStatValue}>{drivingLabel}</Text>
          <Text style={styles.heroStatLabel}>Körning</Text>
        </View>
      </View>
    </View>
  );
}
