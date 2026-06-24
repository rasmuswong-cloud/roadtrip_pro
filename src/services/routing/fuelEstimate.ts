export type FuelEstimateInput = {
  distanceMeters: number;
  consumptionLitersPer100Km: number;
  fuelPricePerLiter: number;
  travelerCount?: number;
};

export type FuelEstimate = {
  distanceKm: number;
  liters: number;
  totalCost: number;
  perPersonCost: number | null;
};

export function calculateFuelEstimate(input: FuelEstimateInput): FuelEstimate {
  const distanceKm = Math.max(0, input.distanceMeters) / 1000;
  const consumption = Math.max(0, input.consumptionLitersPer100Km);
  const price = Math.max(0, input.fuelPricePerLiter);
  const liters = (distanceKm * consumption) / 100;
  const totalCost = liters * price;
  const travelerCount = input.travelerCount && input.travelerCount > 0 ? input.travelerCount : null;

  return {
    distanceKm,
    liters,
    totalCost,
    perPersonCost: travelerCount ? totalCost / travelerCount : null,
  };
}

export function parseFuelNumber(value: string, fallback: number): number {
  const parsed = Number(value.replace(',', '.').trim());
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}
