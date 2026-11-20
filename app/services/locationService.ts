import { Platform } from 'react-native';
import * as Location from 'expo-location';
import { Address } from '../types';

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
  accuracy: number | null;
}

export interface GeocodedAddressResult {
  houseNumber?: string;
  building?: string;
  street?: string;
  area?: string;
  line1: string; // House/Building (or empty if GPS cannot know private flat number)
  line2: string; // Exact Street, Area, Landmark
  city: string;
  state: string;
  pincode: string;
  country: string;
  formattedAddress: string;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  landmark?: string;
  confidence?: 'EXACT_PREMISE' | 'STREET_LEVEL' | 'LOCALITY';
}

/**
 * 1. Request foreground location permission with clear error guidance.
 */
export async function requestLocationPermission(): Promise<boolean> {
  try {
    if (Platform.OS === 'web') {
      return typeof navigator !== 'undefined' && !!navigator.geolocation;
    }
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status === Location.PermissionStatus.GRANTED) {
      return true;
    }

    const res = await Location.requestForegroundPermissionsAsync();
    return res.status === Location.PermissionStatus.GRANTED;
  } catch (error) {
    console.warn('Error requesting location permission:', error);
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.geolocation) {
      return true;
    }
    return false;
  }
}

/**
 * 2. Adaptive GPS Satellite Lock:
 *    Waits for a high-precision fix (accuracy <= 15m) before returning,
 *    preventing coarse cell-tower approximations.
 */
export async function getAccurateCoordinates(): Promise<LocationCoordinates> {
  // Web browser geolocation: force fresh fix with maximumAge = 0
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.geolocation) {
    return new Promise<LocationCoordinates>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
        },
        (error) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              resolve({
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                accuracy: pos.coords.accuracy,
              });
            },
            (err2) => reject(new Error(err2.message || 'Could not fetch web geolocation')),
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 }
          );
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  }

  const hasPermission = await requestLocationPermission();
  if (!hasPermission) {
    throw new Error('Location permission was denied. Please allow location access in settings.');
  }

  // Attempt 1: Highest Accuracy (Hardware GPS)
  try {
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Highest,
    });

    let bestCoords: LocationCoordinates = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
    };

    // If initial reading is already tight (<= 15 meters), return immediately!
    if (bestCoords.accuracy !== null && bestCoords.accuracy <= 15) {
      return bestCoords;
    }

    // Otherwise, GPS is still locking onto satellites. Watch for up to 3.5 seconds for a tighter fix (accuracy <= 15m).
    try {
      const tightFix = await new Promise<LocationCoordinates>((resolve) => {
        let subscription: Location.LocationSubscription | null = null;
        const timer = setTimeout(() => {
          subscription?.remove();
          resolve(bestCoords);
        }, 3500);

        Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Highest,
            timeInterval: 400,
            distanceInterval: 1,
          },
          (loc) => {
            const acc = loc.coords.accuracy;
            if (acc !== null && (bestCoords.accuracy === null || acc < bestCoords.accuracy)) {
              bestCoords = {
                latitude: loc.coords.latitude,
                longitude: loc.coords.longitude,
                accuracy: acc,
              };
            }
            if (acc !== null && acc <= 15) {
              clearTimeout(timer);
              subscription?.remove();
              resolve(bestCoords);
            }
          }
        ).then((sub) => {
          subscription = sub;
        }).catch(() => {
          clearTimeout(timer);
          resolve(bestCoords);
        });
      });

      return tightFix;
    } catch {
      return bestCoords;
    }
  } catch (err) {
    console.warn('Highest accuracy GPS fix timed out, falling back to High/Balanced:', err);

    try {
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      };
    } catch (fallbackErr) {
      const lastKnown = await Location.getLastKnownPositionAsync({});
      if (lastKnown) {
        return {
          latitude: lastKnown.coords.latitude,
          longitude: lastKnown.coords.longitude,
          accuracy: lastKnown.coords.accuracy,
        };
      }
      throw new Error('Could not acquire GPS position. Please ensure GPS/Location is enabled.');
    }
  }
}

/**
 * Directional Pin Nudge Helper:
 * Shifts latitude and longitude by ~12-15 meters in any cardinal direction.
 * Essential when a user is indoors and wants to pinpoint their exact gate/entrance.
 */
export function nudgeCoordinates(
  coords: { latitude: number; longitude: number },
  direction: 'north' | 'south' | 'east' | 'west',
  meters: number = 13
): { latitude: number; longitude: number } {
  const deltaLat = meters / 111111;
  const deltaLon = meters / (111111 * Math.cos((coords.latitude * Math.PI) / 180));

  switch (direction) {
    case 'north':
      return { latitude: coords.latitude + deltaLat, longitude: coords.longitude };
    case 'south':
      return { latitude: coords.latitude - deltaLat, longitude: coords.longitude };
    case 'east':
      return { latitude: coords.latitude, longitude: coords.longitude + deltaLon };
    case 'west':
      return { latitude: coords.latitude, longitude: coords.longitude - deltaLon };
  }
}

/**
 * 100% Free Overpass API 35m spatial query for nearby building or house number.
 * Used when Nominatim centroid returns a road but user is inside a mapped building/apartment.
 */
async function queryOverpassNearbyBuilding(
  lat: number,
  lon: number
): Promise<{ houseNumber?: string; building?: string } | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const query = `[out:json][timeout:2];(node(around:35,${lat},${lon})["addr:housenumber"];way(around:35,${lat},${lon})["addr:housenumber"];way(around:35,${lat},${lon})["building"]["name"];);out tags 1;`;
    const res = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      const el = data.elements?.[0]?.tags;
      if (el) {
        return {
          houseNumber: el['addr:housenumber'] || el['contact:housenumber'] || undefined,
          building: el.name || el['addr:housename'] || el.building || undefined,
        };
      }
    }
  } catch {}
  return null;
}

/**
 * Optional Google Geocoding API (Tier 0):
 * If EXPO_PUBLIC_GOOGLE_MAPS_API_KEY is configured in the environment,
 * Google Maps reverse geocoding provides premier building-level precision for India.
 */
async function queryGoogleGeocoding(
  latitude: number,
  longitude: number
): Promise<GeocodedAddressResult | null> {
  const apiKey = (process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '').trim();
  if (!apiKey) return null;

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${apiKey}&result_type=street_address|premise|subpremise|route`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json();
    if (data.status !== 'OK' || !data.results || data.results.length === 0) return null;

    const topResult = data.results[0];
    const components: any[] = topResult.address_components || [];

    const getComponent = (types: string[]) =>
      components.find((c) => types.some((t) => c.types.includes(t)))?.long_name || '';

    const subpremise = getComponent(['subpremise']); // Flat / Floor No.
    const premise = getComponent(['premise']); // Building name
    const streetNumber = getComponent(['street_number']);
    const route = getComponent(['route']); // Street / Road
    const sublocality2 = getComponent(['sublocality_level_2']);
    const sublocality1 = getComponent(['sublocality_level_1']);
    const locality = getComponent(['locality']) || 'Indore';
    const state = getComponent(['administrative_area_level_1']) || 'Madhya Pradesh';
    const postalCode = getComponent(['postal_code']).replace(/[^0-9]/g, '');
    const country = getComponent(['country']) || 'India';

    const houseNumber = [streetNumber, subpremise].filter(Boolean).join('/');
    const building = premise;

    const flatHouse = [
      houseNumber ? `House No. ${houseNumber}` : '',
      building,
    ].filter(Boolean).join(', ');

    const streetArea = [route, sublocality2, sublocality1]
      .filter(Boolean)
      .join(', ') || locality;

    return {
      houseNumber: houseNumber || undefined,
      building: building || undefined,
      street: route || undefined,
      area: [sublocality2, sublocality1].filter(Boolean).join(', ') || undefined,
      line1: flatHouse,
      line2: streetArea,
      city: locality,
      state,
      pincode: postalCode,
      country,
      formattedAddress: topResult.formatted_address || [flatHouse, streetArea, locality, state, postalCode, country].filter(Boolean).join(', '),
      latitude,
      longitude,
      landmark: building || sublocality2 || undefined,
      confidence: 'EXACT_PREMISE',
    };
  } catch (err) {
    console.warn('Google Geocoding API lookup error:', err);
    return null;
  }
}

/**
 * 3. High-Precision Multi-Tier Reverse Geocoder:
 *    Tier 0: Google Geocoding API (if EXPO_PUBLIC_GOOGLE_MAPS_API_KEY is configured)
 *    Tier 1: OpenStreetMap Nominatim (zoom=18, extratags=1, namedetails=1 for building & house numbers)
 *    Tier 1.5: Free Overpass 35m Building footprint spatial lookup
 *    Tier 2: Photon Komoot API
 *    Tier 3: Native Expo Geocoder
 *    Tier 4: BigDataCloud Fallback
 */
export async function reverseGeocodeCoordinates(
  latitude: number,
  longitude: number,
  accuracy?: number | null
): Promise<GeocodedAddressResult> {
  // Tier 0: Check Google Geocoding API if key configured
  const googleResult = await queryGoogleGeocoding(latitude, longitude);
  if (googleResult) {
    googleResult.accuracy = accuracy;
    return googleResult;
  }

  // Tier 1: OpenStreetMap Nominatim with zoom=18, extratags=1, namedetails=1
  try {
    const osmUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1&namedetails=1&extratags=1&email=vardhamrit.care@gmail.com`;
    const response = await fetch(osmUrl, {
      headers: {
        'User-Agent': 'VardhamritTeaApp/1.0 (care@vardhamrit.com)',
        'Accept-Language': 'en',
      },
    });

    if (response.ok) {
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await response.json();
        const addr = data.address || {};
        const extratags = data.extratags || {};
        const namedetails = data.namedetails || {};

        let houseNumber =
          addr.house_number ||
          addr.housenumber ||
          extratags['addr:housenumber'] ||
          extratags['addr:door'] ||
          extratags['contact:housenumber'] ||
          '';

        let building =
          addr.building ||
          addr.house_name ||
          addr.flats ||
          addr.apartment ||
          extratags['addr:flats'] ||
          extratags['addr:floor'] ||
          addr.amenity ||
          addr.shop ||
          addr.office ||
          addr.commercial ||
          (data.name && data.name !== addr.road ? data.name : '') ||
          (namedetails?.name && namedetails?.name !== addr.road ? namedetails?.name : '') ||
          '';

        let street =
          addr.road ||
          addr.street ||
          addr.pedestrian ||
          addr.footway ||
          addr.residential ||
          addr.path ||
          '';

        const areaParts = [
          addr.neighbourhood,
          addr.suburb,
          addr.city_district,
          addr.subdistrict,
          addr.quarter,
          addr.hamlet,
          addr.village,
        ].filter(Boolean);

        const city =
          addr.city ||
          addr.town ||
          addr.village ||
          addr.city_district ||
          addr.county ||
          'Indore';
        const state = addr.state || 'Madhya Pradesh';
        const pincode = (addr.postcode || '').replace(/[^0-9]/g, '');
        const country = addr.country || 'India';

        // If road was missing, extract street from display_name
        if (!street && data.display_name) {
          const rawParts = data.display_name.split(', ').map((s: string) => s.trim());
          const candidateParts = rawParts.filter(
            (p: string) =>
              p !== city &&
              p !== state &&
              p !== country &&
              p !== pincode &&
              !p.toLowerCase().includes('tahsil') &&
              !p.toLowerCase().includes('subdistrict') &&
              !p.toLowerCase().includes('district')
          );
          if (candidateParts.length > 0) {
            street = candidateParts[0];
            if (candidateParts[1] && !areaParts.includes(candidateParts[1])) {
              areaParts.unshift(candidateParts[1]);
            }
          }
        }

        // Tier 1.5: If houseNumber or building is missing, query Overpass 35m spatial footprint
        if (!houseNumber && !building) {
          const nearbyBuilding = await queryOverpassNearbyBuilding(latitude, longitude);
          if (nearbyBuilding) {
            if (nearbyBuilding.houseNumber) houseNumber = nearbyBuilding.houseNumber;
            if (nearbyBuilding.building) building = nearbyBuilding.building;
          }
        }

        const uniqueArea = [...new Set(areaParts)].filter((a) => a !== street && a !== city);
        const flatHouse = [houseNumber ? `House No. ${houseNumber}` : '', building]
          .filter(Boolean)
          .join(', ');

        const streetAreaParts = [street, ...uniqueArea].filter(Boolean);
        const streetArea =
          streetAreaParts.length > 0 ? streetAreaParts.join(', ') : uniqueArea[0] || street || city;
        const formatted =
          data.display_name ||
          [flatHouse, streetArea, city, state, pincode, country].filter(Boolean).join(', ');

        return {
          houseNumber: houseNumber || undefined,
          building: building || undefined,
          street: street || undefined,
          area: uniqueArea.join(', ') || undefined,
          line1: flatHouse,
          line2: streetArea,
          city,
          state,
          pincode,
          country,
          formattedAddress: formatted,
          latitude,
          longitude,
          accuracy,
          landmark: building || addr.amenity || uniqueArea[0] || undefined,
          confidence: flatHouse ? 'EXACT_PREMISE' : 'STREET_LEVEL',
        };
      }
    }
  } catch (osmErr) {
    console.warn('OpenStreetMap reverse geocode failed, trying Photon fallback:', osmErr);
  }

  // Tier 2: Photon Komoot API (Free OSM-powered)
  try {
    const photonUrl = `https://photon.komoot.io/reverse?lat=${latitude}&lon=${longitude}`;
    const pResponse = await fetch(photonUrl);
    if (pResponse.ok) {
      const pData = await pResponse.json();
      const prop = pData?.features?.[0]?.properties || {};
      const houseNumber = prop.housenumber || '';
      const building = prop.type === 'house' && prop.name ? prop.name : '';
      const street =
        prop.street ||
        (prop.type === 'street' || prop.type === 'secondary' || prop.type === 'residential'
          ? prop.name
          : '') ||
        '';
      const area = prop.locality || prop.district || '';
      const city = prop.city || 'Indore';
      const state = prop.state || 'Madhya Pradesh';
      const pincode = String(prop.postcode || '').replace(/[^0-9]/g, '');
      const country = prop.country || 'India';

      const flatHouse = [houseNumber ? `House No. ${houseNumber}` : '', building]
        .filter(Boolean)
        .join(', ');
      const streetArea = [street, area].filter(Boolean).join(', ') || area || street || city;

      return {
        houseNumber: houseNumber || undefined,
        building: building || undefined,
        street: street || undefined,
        area: area || undefined,
        line1: flatHouse,
        line2: streetArea,
        city,
        state,
        pincode,
        country,
        formattedAddress: [flatHouse, streetArea, city, state, pincode, country]
          .filter(Boolean)
          .join(', '),
        latitude,
        longitude,
        accuracy,
        landmark: building || area || undefined,
        confidence: flatHouse ? 'EXACT_PREMISE' : 'STREET_LEVEL',
      };
    }
  } catch (photonErr) {
    console.warn('Photon reverse geocode failed, trying Native fallback:', photonErr);
  }

  // Tier 3: Native Expo Reverse Geocoder
  try {
    const results = await Location.reverseGeocodeAsync({ latitude, longitude });
    if (results && results.length > 0) {
      const item = results[0];
      const houseNumber = item.streetNumber || '';
      const building = item.name && item.name !== item.street ? item.name : '';
      const street = item.street || '';
      const areaParts = [item.district, item.subregion].filter(Boolean);
      const city = item.city || item.subregion || item.district || 'Indore';
      const state = item.region || 'Madhya Pradesh';
      const pincode = item.postalCode ? item.postalCode.replace(/[^0-9]/g, '') : '';
      const country = item.country || 'India';

      const flatHouse = [houseNumber ? `House No. ${houseNumber}` : '', building]
        .filter(Boolean)
        .join(', ');

      const uniqueArea = [...new Set(areaParts)].filter((a) => a !== street && a !== city);
      const streetAreaParts = [street, ...uniqueArea].filter(Boolean);
      const streetArea = streetAreaParts.length > 0 ? streetAreaParts.join(', ') : city;

      const formatted = [flatHouse, streetArea, city, state, pincode, country]
        .filter(Boolean)
        .join(', ');

      return {
        houseNumber: houseNumber || undefined,
        building: building || undefined,
        street: street || undefined,
        area: uniqueArea.join(', ') || undefined,
        line1: flatHouse,
        line2: streetArea,
        city,
        state,
        pincode,
        country,
        formattedAddress: formatted,
        latitude,
        longitude,
        accuracy,
        landmark: building || item.name || undefined,
        confidence: flatHouse ? 'EXACT_PREMISE' : 'STREET_LEVEL',
      };
    }
  } catch (nativeErr) {
    console.warn('Native reverse geocode failed, trying BigDataCloud fallback:', nativeErr);
  }

  // Tier 4: BigDataCloud Free Client-Side Reverse Geocoding
  try {
    const bdcUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`;
    const response = await fetch(bdcUrl);
    if (response.ok) {
      const bdcData = await response.json();
      const locality = bdcData.locality || '';
      const city = bdcData.city || locality || 'Indore';
      const state = bdcData.principalSubdivision || 'Madhya Pradesh';
      const pincode = (bdcData.postcode || '').replace(/[^0-9]/g, '');
      const country = bdcData.countryName || 'India';
      const streetArea = locality ? `${locality} Area` : 'Indore Area';

      return {
        line1: '',
        line2: streetArea,
        city,
        state,
        pincode,
        country,
        formattedAddress: [streetArea, city, state, pincode, country].filter(Boolean).join(', '),
        latitude,
        longitude,
        accuracy,
        confidence: 'LOCALITY',
      };
    }
  } catch (bdcErr) {
    console.warn('BigDataCloud reverse geocode failed:', bdcErr);
  }

  // Ultimate fallback
  return {
    line1: '',
    line2: 'Current Location',
    city: 'Indore',
    state: 'Madhya Pradesh',
    pincode: '452001',
    country: 'India',
    formattedAddress: 'Indore, Madhya Pradesh - 452001',
    latitude,
    longitude,
    accuracy,
    confidence: 'LOCALITY',
  };
}

/**
 * 4. Main convenient function: Detect current location and return ready-to-use Address
 */
export async function fetchCurrentLocationAddress(options?: {
  name?: string;
  phone?: string;
  tag?: 'HOME' | 'WORK' | 'OTHER';
}): Promise<{ address: Address; geocoded: GeocodedAddressResult }> {
  const coords = await getAccurateCoordinates();
  const geocoded = await reverseGeocodeCoordinates(coords.latitude, coords.longitude, coords.accuracy);

  // In saved address cards, line1 displays the primary street/area or house
  const cardLine1 = geocoded.line1 && geocoded.line1.trim().length > 0
    ? `${geocoded.line1}, ${geocoded.line2}`
    : (geocoded.line2 || 'Current Location');

  const address: Address = {
    id: `gps-${Date.now()}`,
    name: options?.name || 'My Location',
    phone: options?.phone || '9876543210',
    tag: options?.tag || 'HOME',
    line1: cardLine1,
    line2: geocoded.line1 ? geocoded.line2 : undefined,
    landmark: geocoded.landmark,
    city: geocoded.city,
    state: geocoded.state,
    pincode: geocoded.pincode || '452001',
    latitude: coords.latitude,
    longitude: coords.longitude,
    isDefault: true,
  };

  return { address, geocoded };
}

/**
 * Quick local fallback lookup for common Indian PIN code prefixes
 */
function getLocalPincodeFallback(pincode: string): { city: string; state: string } | null {
  const p = pincode.slice(0, 3);
  const p2 = pincode.slice(0, 2);

  // Madhya Pradesh
  if (p === '452' || p === '453') return { city: 'Indore', state: 'Madhya Pradesh' };
  if (p === '462' || p === '463') return { city: 'Bhopal', state: 'Madhya Pradesh' };
  if (p === '456') return { city: 'Ujjain', state: 'Madhya Pradesh' };
  if (p === '474') return { city: 'Gwalior', state: 'Madhya Pradesh' };
  if (p === '482') return { city: 'Jabalpur', state: 'Madhya Pradesh' };
  if (p === '455') return { city: 'Dewas', state: 'Madhya Pradesh' };
  if (p === '457') return { city: 'Ratlam', state: 'Madhya Pradesh' };
  if (p === '458') return { city: 'Mandsaur', state: 'Madhya Pradesh' };
  if (p === '454') return { city: 'Dhar', state: 'Madhya Pradesh' };
  if (p === '451') return { city: 'Khargone', state: 'Madhya Pradesh' };
  if (p === '450') return { city: 'Khandwa', state: 'Madhya Pradesh' };
  if (p === '461') return { city: 'Hoshangabad', state: 'Madhya Pradesh' };
  if (p === '464') return { city: 'Vidisha', state: 'Madhya Pradesh' };
  if (p === '466') return { city: 'Sehore', state: 'Madhya Pradesh' };
  if (p === '470') return { city: 'Sagar', state: 'Madhya Pradesh' };
  if (p === '473') return { city: 'Guna', state: 'Madhya Pradesh' };
  if (p === '485') return { city: 'Satna', state: 'Madhya Pradesh' };
  if (p === '486') return { city: 'Rewa', state: 'Madhya Pradesh' };

  // Maharashtra
  if (p === '411' || p === '412') return { city: 'Pune', state: 'Maharashtra' };
  if (p === '400') return { city: 'Mumbai', state: 'Maharashtra' };
  if (p === '401') return { city: 'Thane', state: 'Maharashtra' };
  if (p === '410') return { city: 'Navi Mumbai', state: 'Maharashtra' };
  if (p === '440') return { city: 'Nagpur', state: 'Maharashtra' };
  if (p === '422') return { city: 'Nashik', state: 'Maharashtra' };
  if (p === '431') return { city: 'Chhatrapati Sambhajinagar', state: 'Maharashtra' };
  if (p === '416') return { city: 'Kolhapur', state: 'Maharashtra' };
  if (p === '413') return { city: 'Solapur', state: 'Maharashtra' };

  // Delhi NCR
  if (p === '110') return { city: 'New Delhi', state: 'Delhi' };
  if (p === '122') return { city: 'Gurugram', state: 'Haryana' };
  if (p === '121') return { city: 'Faridabad', state: 'Haryana' };
  if (p === '201') return { city: 'Noida', state: 'Uttar Pradesh' };

  // Other Major Metros & States
  if (p === '560') return { city: 'Bengaluru', state: 'Karnataka' };
  if (p === '500') return { city: 'Hyderabad', state: 'Telangana' };
  if (p === '600') return { city: 'Chennai', state: 'Tamil Nadu' };
  if (p === '700') return { city: 'Kolkata', state: 'West Bengal' };
  if (p === '380') return { city: 'Ahmedabad', state: 'Gujarat' };
  if (p === '395') return { city: 'Surat', state: 'Gujarat' };
  if (p === '390') return { city: 'Vadodara', state: 'Gujarat' };
  if (p === '302') return { city: 'Jaipur', state: 'Rajasthan' };
  if (p === '226') return { city: 'Lucknow', state: 'Uttar Pradesh' };
  if (p === '208') return { city: 'Kanpur', state: 'Uttar Pradesh' };
  if (p === '781') return { city: 'Guwahati', state: 'Assam' };
  if (p === '786') return { city: 'Dibrugarh', state: 'Assam' };

  // Two-digit State Prefixes
  if (p2 === '45' || p2 === '46' || p2 === '47' || p2 === '48') return { city: 'Indore', state: 'Madhya Pradesh' };
  if (p2 === '40' || p2 === '41' || p2 === '42' || p2 === '43' || p2 === '44') return { city: 'Pune', state: 'Maharashtra' };
  if (p2 === '11') return { city: 'New Delhi', state: 'Delhi' };
  if (p2 === '56' || p2 === '57' || p2 === '58') return { city: 'Bengaluru', state: 'Karnataka' };
  if (p2 === '38' || p2 === '39') return { city: 'Ahmedabad', state: 'Gujarat' };
  if (p2 === '30' || p2 === '31' || p2 === '32' || p2 === '33' || p2 === '34') return { city: 'Jaipur', state: 'Rajasthan' };
  if (p2 === '20' || p2 === '21' || p2 === '22' || p2 === '24' || p2 === '25' || p2 === '26' || p2 === '27' || p2 === '28') return { city: 'Lucknow', state: 'Uttar Pradesh' };

  return null;
}

/**
 * Accurately fetch City, State and Area from 6-digit Indian PIN Code.
 * Queries official India Post API with instant fallback.
 */
export async function fetchAddressFromPincode(
  pincode: string
): Promise<{ city: string; state: string; area?: string } | null> {
  const clean = pincode.replace(/[^0-9]/g, '').slice(0, 6);
  if (clean.length !== 6) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(`https://api.postalpincode.in/pincode/${clean}`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data[0]?.Status === 'Success' && data[0]?.PostOffice?.length > 0) {
        const po = data[0].PostOffice[0];
        const district = po.District || po.Division?.replace(/ Division| City/i, '') || po.Region;
        const state = po.State;
        const area = po.Name;
        if (district && state) {
          return { city: district, state, area };
        }
      }
    }
  } catch (e) {
    // network timeout or abort, fall through to local fallback
  }

  const fallback = getLocalPincodeFallback(clean);
  if (fallback) {
    return fallback;
  }

  return null;
}

export interface PlaceSearchResult {
  id: string;
  title: string;
  subtitle: string;
  latitude: number;
  longitude: number;
  pincode?: string;
  city?: string;
  state?: string;
  source: 'INDORE_POI' | 'PHOTON' | 'NOMINATIM';
}

export const INDORE_LANDMARKS: PlaceSearchResult[] = [
  {
    id: 'indore-ec-1',
    title: 'Electronic Complex',
    subtitle: 'Pardesipura / Sukhlia, Indore • 452010',
    latitude: 22.7523,
    longitude: 75.8687,
    pincode: '452010',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
  },
  {
    id: 'indore-ec-2',
    title: 'Electronic Complex 4th Floor',
    subtitle: 'IT Park / Electronic Complex, Sukhlia, Indore • 452010',
    latitude: 22.7524,
    longitude: 75.8688,
    pincode: '452010',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
  },
  {
    id: 'indore-pardesi-1',
    title: 'Pardesipura Square',
    subtitle: 'Nanda Nagar / Sukhlia Road, Indore • 452011',
    latitude: 22.7485,
    longitude: 75.8750,
    pincode: '452011',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
  },
  {
    id: 'indore-vn-1',
    title: 'Vijay Nagar Square',
    subtitle: 'AB Road, Scheme 54, Indore • 452010',
    latitude: 22.7511,
    longitude: 75.8955,
    pincode: '452010',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
  },
  {
    id: 'indore-c56-1',
    title: 'Chhappan Dukan (56 Dukan)',
    subtitle: 'New Palasia, Indore • 452001',
    latitude: 22.7242,
    longitude: 75.8821,
    pincode: '452001',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
  },
  {
    id: 'indore-rajwada-1',
    title: 'Rajwada Palace',
    subtitle: 'MG Road, Central Indore • 452001',
    latitude: 22.7180,
    longitude: 75.8548,
    pincode: '452001',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
  },
  {
    id: 'indore-sarafa-1',
    title: 'Sarafa Bazaar',
    subtitle: 'Night Food Market, Rajwada, Indore • 452001',
    latitude: 22.7170,
    longitude: 75.8530,
    pincode: '452001',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
  },
  {
    id: 'indore-palasia-1',
    title: 'Old Palasia / Palasia Square',
    subtitle: 'AB Road / Greater Kailash Hospital, Indore • 452013',
    latitude: 22.7237,
    longitude: 75.8867,
    pincode: '452013',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
  },
  {
    id: 'indore-bhawar-1',
    title: 'Bhawarkua Square',
    subtitle: 'Holkar Science College / AB Road, Indore • 452001',
    latitude: 22.6919,
    longitude: 75.8669,
    pincode: '452001',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
  },
  {
    id: 'indore-crystal-1',
    title: 'Crystal IT Park',
    subtitle: 'Ring Road, Bhawarkua, Indore • 452001',
    latitude: 22.6845,
    longitude: 75.8642,
    pincode: '452001',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
  },
  {
    id: 'indore-annapurna-1',
    title: 'Annapurna Mandir',
    subtitle: 'Annapurna Road, Usha Nagar, Indore • 452009',
    latitude: 22.6948,
    longitude: 75.8389,
    pincode: '452009',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
  },
  {
    id: 'indore-sudama-1',
    title: 'Sudama Nagar',
    subtitle: 'Footi Kothi Road, Indore • 452009',
    latitude: 22.6950,
    longitude: 75.8450,
    pincode: '452009',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
  },
  {
    id: 'indore-gumasta-1',
    title: 'Gumasta Nagar',
    subtitle: 'Footi Kothi / Dhar Road, Indore • 452009',
    latitude: 22.7080,
    longitude: 75.8300,
    pincode: '452009',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
  },
  {
    id: 'indore-khajrana-1',
    title: 'Khajrana Ganesh Mandir',
    subtitle: 'Khajrana Road, Indore • 452012',
    latitude: 22.7350,
    longitude: 75.9200,
    pincode: '452012',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
  },
  {
    id: 'indore-bombay-1',
    title: 'Bombay Hospital Square',
    subtitle: 'Ring Road, Scheme 94, Indore • 452010',
    latitude: 22.7590,
    longitude: 75.8970,
    pincode: '452010',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
  },
  {
    id: 'indore-c21-1',
    title: 'C21 Mall / Malhar Mega Mall',
    subtitle: 'AB Road, Scheme 54, Vijay Nagar, Indore • 452010',
    latitude: 22.7480,
    longitude: 75.8930,
    pincode: '452010',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
  },
  {
    id: 'indore-ti-1',
    title: 'Treasure Island Mall (TI Mall)',
    subtitle: 'MG Road, South Tukoganj, Indore • 452001',
    latitude: 22.7215,
    longitude: 75.8770,
    pincode: '452001',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
  },
  {
    id: 'indore-nipania-1',
    title: 'Apollo DB City / Nipania',
    subtitle: 'Nipania Main Road, Indore • 452020',
    latitude: 22.7680,
    longitude: 75.9180,
    pincode: '452020',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
  },
  {
    id: 'indore-super-1',
    title: 'Super Corridor (TCS & Infosys)',
    subtitle: 'Airport Road, Indore • 452005',
    latitude: 22.7750,
    longitude: 75.8050,
    pincode: '452005',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
  },
  {
    id: 'indore-airport-1',
    title: 'Devi Ahilyabai Holkar Airport',
    subtitle: 'Depalpur Road, Indore • 452005',
    latitude: 22.7230,
    longitude: 75.8080,
    pincode: '452005',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
  },
  {
    id: 'indore-railway-1',
    title: 'Indore Junction Railway Station',
    subtitle: 'Chhoti Gwaltoli / Siyaganj, Indore • 452001',
    latitude: 22.7160,
    longitude: 75.8670,
    pincode: '452001',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
  },
  {
    id: 'indore-lig-1',
    title: 'LIG Colony / Square',
    subtitle: 'AB Road, MIG Colony, Indore • 452011',
    latitude: 22.7380,
    longitude: 75.8870,
    pincode: '452011',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
  },
  {
    id: 'indore-geeta-1',
    title: 'Geeta Bhawan Square',
    subtitle: 'AB Road, Manoramaganj, Indore • 452001',
    latitude: 22.7181,
    longitude: 75.8874,
    pincode: '452001',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
  },
  {
    id: 'indore-mr10-1',
    title: 'MR-10 Square / Bhawrasla',
    subtitle: 'Ujjain Road / Bypass, Indore • 452016',
    latitude: 22.7750,
    longitude: 75.9300,
    pincode: '452016',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
  },
  {
    id: 'indore-rau-1',
    title: 'Rau Circle',
    subtitle: 'AB Road / Pithampur Road, Indore • 453771',
    latitude: 22.6350,
    longitude: 75.8050,
    pincode: '453771',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
  },
  {
    id: 'indore-bengali-1',
    title: 'Bengali Square',
    subtitle: 'Ring Road / Kanadiya Road, Indore • 452016',
    latitude: 22.7150,
    longitude: 75.9050,
    pincode: '452016',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
  },
];

/**
 * Intelligent Multi-Source Location Search:
 * 1. Checks Instant Local Indore Landmark Database (0ms response)
 * 2. Queries Photon Geocoding API with proximity bias
 * 3. Fallback to OpenStreetMap Nominatim
 */
export async function searchPlaces(query: string): Promise<PlaceSearchResult[]> {
  const clean = query.trim().toLowerCase();
  if (clean.length < 2) return [];

  const results: PlaceSearchResult[] = [];
  const seenKeys = new Set<string>();

  // 1. Instant Match from Local Indore Landmarks Database
  const localMatches = INDORE_LANDMARKS.filter((item) => {
    const titleMatch = item.title.toLowerCase().includes(clean);
    const subMatch = item.subtitle.toLowerCase().includes(clean);
    const pinMatch = item.pincode ? item.pincode.includes(clean) : false;
    return titleMatch || subMatch || pinMatch;
  });

  for (const m of localMatches) {
    const key = `${m.latitude.toFixed(4)},${m.longitude.toFixed(4)}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      results.push(m);
    }
  }

  // 2. Query Live Online Autocomplete API (Photon with Indore Lat/Lon Proximity Bias)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2800);
    const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&lat=22.7196&lon=75.8577&limit=6`;
    const res = await fetch(photonUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.features)) {
        for (const f of data.features) {
          const coords = f.geometry?.coordinates;
          if (Array.isArray(coords) && coords.length >= 2) {
            const lon = coords[0];
            const lat = coords[1];
            const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
            if (!seenKeys.has(key)) {
              seenKeys.add(key);
              const p = f.properties || {};
              const title = p.name || p.street || 'Located Place';
              const parts = [p.district, p.city, p.state, p.postcode].filter(Boolean);
              const subtitle = parts.join(', ') || 'Madhya Pradesh, India';

              results.push({
                id: `photon-${lat}-${lon}`,
                title,
                subtitle,
                latitude: lat,
                longitude: lon,
                pincode: p.postcode,
                city: p.city || 'Indore',
                state: p.state || 'Madhya Pradesh',
                source: 'PHOTON',
              });
            }
          }
        }
      }
    }
  } catch (e) {
    // photon timeout or offline, keep local matches
  }

  return results.slice(0, 8);
}
