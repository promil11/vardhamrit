export interface PricingCalculationResult {
  subtotal: number;
  discountAmount: number;
  taxableAmount: number;
  taxAmount: number;
  deliveryFee: number;
  handlingFee: number;
  distanceKm: number;
  isServiceable: boolean;
  total: number;
}

export interface DistanceDeliveryFeeResult {
  distanceKm: number;
  deliveryFee: number;
  handlingFee: number;
  isServiceable: boolean;
  maxDistanceKm: number;
  message?: string;
}

export const DISTANCE_CONFIG = {
  get STORE_LAT(): number {
    return Number(process.env.STORE_LATITUDE) || 22.70723;
  },
  get STORE_LON(): number {
    return Number(process.env.STORE_LONGITUDE) || 75.82384;
  },
  get MAX_DISTANCE_KM(): number {
    return Number(process.env.MAX_DELIVERY_DISTANCE_KM) || 10;
  },
  get BASE_DISTANCE_KM(): number {
    return Number(process.env.BASE_DELIVERY_DISTANCE_KM) || 0.5; // 500 meters
  },
  get BASE_DELIVERY_FEE(): number {
    return Number(process.env.BASE_DELIVERY_FEE) || 30; // ₹30 below 500m
  },
  get BASE_HANDLING_FEE(): number {
    return Number(process.env.BASE_HANDLING_FEE) || 5; // ₹5 below 500m
  },
  get DELIVERY_FEE_PER_KM(): number {
    return Number(process.env.DELIVERY_FEE_PER_KM) || 7; // +₹7 per additional km
  },
  get HANDLING_FEE_PER_KM(): number {
    return Number(process.env.HANDLING_FEE_PER_KM) || 1; // +₹1 per additional km
  },
};

export const PRICING_CONFIG = {
  GST_PERCENTAGE: process.env.GST_PERCENTAGE !== undefined ? Number(process.env.GST_PERCENTAGE) : 5,
  FREE_DELIVERY_THRESHOLD: process.env.FREE_DELIVERY_THRESHOLD !== undefined ? Number(process.env.FREE_DELIVERY_THRESHOLD) : 0,
};

// Known pincode centroids for instant high-precision distance fallback
export const PINCODE_COORDINATES: Record<string, { lat: number; lon: number }> = {
  '452001': { lat: 22.7196, lon: 75.8577 }, // Indore Central / Rajwada (~0.2 km)
  '452002': { lat: 22.7100, lon: 75.8600 }, // Chhatribagh (~1.1 km)
  '452003': { lat: 22.7300, lon: 75.8700 }, // Vallabh Nagar (~1.7 km)
  '452004': { lat: 22.7150, lon: 75.8850 }, // Tilak Nagar (~2.9 km)
  '452005': { lat: 22.7230, lon: 75.8080 }, // Aerodrome / Airport (~5.2 km)
  '452006': { lat: 22.7220, lon: 75.8420 }, // Bada Ganpati (~1.7 km)
  '452007': { lat: 22.6950, lon: 75.8450 }, // Sudama Nagar (~3.1 km)
  '452008': { lat: 22.6980, lon: 75.8340 }, // Usha Nagar / Annapurna (~3.4 km)
  '452009': { lat: 22.7080, lon: 75.8300 }, // Gumasta Nagar (~3.1 km)
  '452010': { lat: 22.7533, lon: 75.8937 }, // Vijay Nagar (~5.3 km)
  '452011': { lat: 22.7450, lon: 75.8750 }, // Nanda Nagar / Pardesipura (~3.3 km)
  '452012': { lat: 22.7350, lon: 75.9200 }, // Khajrana (~6.7 km)
  '452013': { lat: 22.7200, lon: 75.8880 }, // Palasia (~3.1 km)
  '452014': { lat: 22.7380, lon: 75.8870 }, // LIG Colony / MIG (~3.7 km)
  '452015': { lat: 22.6850, lon: 75.8270 }, // Rajendra Nagar (~5.1 km)
  '452016': { lat: 22.7750, lon: 75.9300 }, // MR-10 / Bhawrasla (~9.6 km)
  '452018': { lat: 22.7610, lon: 75.8980 }, // Scheme 78 / Vijay Nagar Ext (~6.1 km)
  '452020': { lat: 22.7680, lon: 75.9180 }, // Nipania / Mahalaxmi Nagar (~8.2 km)
  '453111': { lat: 22.7950, lon: 75.7250 }, // Hatod (> 15 km - Exceeds 10 km!)
  '453112': { lat: 22.6850, lon: 75.5800 }, // Betma (> 28 km - Exceeds 10 km!)
  '453441': { lat: 22.5530, lon: 75.7600 }, // Mhow (> 20 km - Exceeds 10 km!)
  '453555': { lat: 22.8600, lon: 75.9900 }, // Sanwer (> 18 km - Exceeds 10 km!)
  '453771': { lat: 22.6350, lon: 75.8050 }, // Rau (> 11 km - Exceeds 10 km!)
};

/**
 * Standard Haversine spherical distance calculation
 */
export function calculateHaversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
}

/**
 * Resolve coordinates from an address object (GPS lat/lon, or pincode lookup, or default fallback)
 */
export function resolveAddressCoordinates(address: any): { lat: number; lon: number; isEstimated: boolean } {
  const lat = address?.latitude !== undefined && address?.latitude !== null && address?.latitude !== '' ? Number(address.latitude) : NaN;
  const lon = address?.longitude !== undefined && address?.longitude !== null && address?.longitude !== '' ? Number(address.longitude) : NaN;

  // 1. Exact GPS coordinates from satellite lock or pinned location
  if (!isNaN(lat) && !isNaN(lon) && Math.abs(lat) > 0.001 && Math.abs(lon) > 0.001) {
    return {
      lat,
      lon,
      isEstimated: false,
    };
  }

  // 2. Exact pincode centroid lookup
  const rawPincode = String(address?.pincode || '').replace(/[^0-9]/g, '');
  if (rawPincode && PINCODE_COORDINATES[rawPincode]) {
    return {
      lat: PINCODE_COORDINATES[rawPincode].lat,
      lon: PINCODE_COORDINATES[rawPincode].lon,
      isEstimated: true,
    };
  }

  // 3. Fallback for unlisted Indore addresses (city is Indore or pincode starts with 452)
  const city = String(address?.city || '').toLowerCase();
  const isIndore = city.includes('indore') || rawPincode.startsWith('452');
  if (isIndore) {
    return {
      lat: DISTANCE_CONFIG.STORE_LAT + 0.02,
      lon: DISTANCE_CONFIG.STORE_LON + 0.02, // ~3.1 km from central hub
      isEstimated: true,
    };
  }

  // 4. Outside Indore service zone (e.g. non-Indore pincode without GPS)
  // Positioned far outside 10 km limit so it is flagged unserviceable rather than falsely returning 0.4 km
  return {
    lat: DISTANCE_CONFIG.STORE_LAT + 0.5,
    lon: DISTANCE_CONFIG.STORE_LON + 0.5,
    isEstimated: true,
  };
}

/**
 * Calculate dynamic delivery partner fee and handling & packaging fee based on distance:
 * - Below 500m (0.5 km): Delivery = ₹30, Handling = ₹5
 * - Above 500m: Scales with distance up to max 10 km (+₹7/km delivery, +₹1/km handling)
 * - Above 10 km: Not serviceable (exceeds 10 km maximum delivery radius)
 */
export function calculateDynamicDistanceFees(address: any, subtotal: number = 0): DistanceDeliveryFeeResult {
  const coords = resolveAddressCoordinates(address);
  const distanceKm = calculateHaversineDistanceKm(
    DISTANCE_CONFIG.STORE_LAT,
    DISTANCE_CONFIG.STORE_LON,
    coords.lat,
    coords.lon
  );

  // Check 10 km maximum delivery limit
  if (distanceKm > DISTANCE_CONFIG.MAX_DISTANCE_KM) {
    return {
      distanceKm,
      deliveryFee: 0,
      handlingFee: 0,
      isServiceable: false,
      maxDistanceKm: DISTANCE_CONFIG.MAX_DISTANCE_KM,
      message: `Delivery address is ${distanceKm} km away. We only deliver within ${DISTANCE_CONFIG.MAX_DISTANCE_KM} km.`,
    };
  }

  // Below or equal to 500 meters (0.5 km)
  if (distanceKm <= DISTANCE_CONFIG.BASE_DISTANCE_KM) {
    return {
      distanceKm,
      deliveryFee: DISTANCE_CONFIG.BASE_DELIVERY_FEE,
      handlingFee: DISTANCE_CONFIG.BASE_HANDLING_FEE,
      isServiceable: true,
      maxDistanceKm: DISTANCE_CONFIG.MAX_DISTANCE_KM,
    };
  }

  // Between 500 meters and 10 km: Scales dynamically with distance
  const extraKm = distanceKm - DISTANCE_CONFIG.BASE_DISTANCE_KM;
  const extraDelivery = Math.round(extraKm * DISTANCE_CONFIG.DELIVERY_FEE_PER_KM);
  const extraHandling = Math.round(extraKm * DISTANCE_CONFIG.HANDLING_FEE_PER_KM);

  const deliveryFee = DISTANCE_CONFIG.BASE_DELIVERY_FEE + extraDelivery;
  const handlingFee = DISTANCE_CONFIG.BASE_HANDLING_FEE + extraHandling;

  return {
    distanceKm,
    deliveryFee,
    handlingFee,
    isServiceable: true,
    maxDistanceKm: DISTANCE_CONFIG.MAX_DISTANCE_KM,
  };
}

export function calculateDeliveryFee(subtotal: number, address?: any): number {
  if (subtotal === 0) return 0.00;
  if (address) {
    const fees = calculateDynamicDistanceFees(address, subtotal);
    return fees.isServiceable ? fees.deliveryFee : 0;
  }
  return DISTANCE_CONFIG.BASE_DELIVERY_FEE;
}

export function calculateHandlingFee(subtotal: number, address?: any): number {
  if (subtotal === 0) return 0.00;
  if (address) {
    const fees = calculateDynamicDistanceFees(address, subtotal);
    return fees.isServiceable ? fees.handlingFee : 0;
  }
  return DISTANCE_CONFIG.BASE_HANDLING_FEE;
}

export function calculateTax(taxableAmount: number): number {
  const tax = (taxableAmount * PRICING_CONFIG.GST_PERCENTAGE) / 100;
  return Number(tax.toFixed(2));
}

export function calculateOrderTotals(subtotal: number, discountAmount: number, address?: any): PricingCalculationResult {
  const validDiscount = Math.min(discountAmount, subtotal);
  const taxableAmount = Math.max(0, subtotal - validDiscount);
  const taxAmount = calculateTax(taxableAmount);

  const distanceFees = address
    ? calculateDynamicDistanceFees(address, subtotal)
    : {
        distanceKm: 0.4,
        deliveryFee: DISTANCE_CONFIG.BASE_DELIVERY_FEE,
        handlingFee: DISTANCE_CONFIG.BASE_HANDLING_FEE,
        isServiceable: true,
        maxDistanceKm: DISTANCE_CONFIG.MAX_DISTANCE_KM,
      };

  const deliveryFee = distanceFees.isServiceable ? distanceFees.deliveryFee : 0;
  const handlingFee = distanceFees.isServiceable ? distanceFees.handlingFee : 0;
  const total = Number((taxableAmount + deliveryFee + handlingFee).toFixed(2));

  return {
    subtotal: Number(subtotal.toFixed(2)),
    discountAmount: Number(validDiscount.toFixed(2)),
    taxableAmount: Number(taxableAmount.toFixed(2)),
    taxAmount,
    deliveryFee,
    handlingFee,
    distanceKm: distanceFees.distanceKm,
    isServiceable: distanceFees.isServiceable,
    total,
  };
}
