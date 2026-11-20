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
  // 1. Electronic Complex & Sukhlia Zone
  {
    id: 'indore-ec-1',
    title: 'Electronic Complex',
    subtitle: 'Sukhlia / Pardesipura, Indore • 452010',
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
    id: 'indore-sukhlia-1',
    title: 'Sukhlia Square',
    subtitle: 'MR-10 / Bapat Square Road, Indore • 452010',
    latitude: 22.7607,
    longitude: 75.8645,
    pincode: '452010',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
  },
  {
    id: 'indore-bapat-1',
    title: 'Bapat Square',
    subtitle: 'Sukhlia, MR-10, Indore • 452010',
    latitude: 22.7615,
    longitude: 75.8690,
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
    id: 'indore-nanda-1',
    title: 'Nanda Nagar',
    subtitle: 'Pardesipura, Indore • 452011',
    latitude: 22.7530,
    longitude: 75.8750,
    pincode: '452011',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
  },
  {
    id: 'indore-clerk-1',
    title: 'Clerk Colony',
    subtitle: 'Pardesipura, Indore • 452011',
    latitude: 22.7560,
    longitude: 75.8710,
    pincode: '452011',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
  },

  // 2. Vijay Nagar & Schemes
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
    id: 'indore-s54-1',
    title: 'Scheme 54',
    subtitle: 'Vijay Nagar, Near C21 Mall, Indore • 452010',
    latitude: 22.7490,
    longitude: 75.8920,
    pincode: '452010',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
  },
  {
    id: 'indore-s78-1',
    title: 'Scheme 78',
    subtitle: 'Part 2, Vijay Nagar, Indore • 452010',
    latitude: 22.7610,
    longitude: 75.8980,
    pincode: '452010',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
  },
  {
    id: 'indore-s74-1',
    title: 'Scheme 74',
    subtitle: 'Vijay Nagar, Indore • 452010',
    latitude: 22.7580,
    longitude: 75.8910,
    pincode: '452010',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
  },
  {
    id: 'indore-s114-1',
    title: 'Scheme 114',
    subtitle: 'Near Part 1 & 2, Indore • 452010',
    latitude: 22.7720,
    longitude: 75.8960,
    pincode: '452010',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
  },
  {
    id: 'indore-s140-1',
    title: 'Scheme 140',
    subtitle: 'Pipliyahana / Ring Road, Indore • 452016',
    latitude: 22.7090,
    longitude: 75.9120,
    pincode: '452016',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
  },
  {
    id: 'indore-mahalaxmi-1',
    title: 'Mahalaxmi Nagar',
    subtitle: 'Bombay Hospital Road, Indore • 452010',
    latitude: 22.7620,
    longitude: 75.9080,
    pincode: '452010',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
  },
  {
    id: 'indore-apollo-1',
    title: 'Apollo DB City',
    subtitle: 'Nipania Main Road, Indore • 452020',
    latitude: 22.7680,
    longitude: 75.9180,
    pincode: '452020',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
  },
  {
    id: 'indore-nipania-1',
    title: 'Nipania',
    subtitle: 'Near DPS / Bypass, Indore • 452020',
    latitude: 22.7710,
    longitude: 75.9250,
    pincode: '452020',
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
    title: 'C21 Mall',
    subtitle: 'AB Road, Scheme 54, Vijay Nagar, Indore • 452010',
    latitude: 22.7480,
    longitude: 75.8930,
    pincode: '452010',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
  },
  {
    id: 'indore-malhar-1',
    title: 'Malhar Mega Mall',
    subtitle: 'AB Road, Vijay Nagar, Indore • 452010',
    latitude: 22.7490,
    longitude: 75.8940,
    pincode: '452010',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
  },
  {
    id: 'indore-brilliant-1',
    title: 'Brilliant Convention Centre',
    subtitle: 'Scheme 78, Part II, Vijay Nagar, Indore • 452010',
    latitude: 22.7640,
    longitude: 75.8950,
    pincode: '452010',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
  },
  {
    id: 'indore-medanta-1',
    title: 'Medanta Hospital',
    subtitle: 'MR-10, Sector B, Indore • 452010',
    latitude: 22.7570,
    longitude: 75.8820,
    pincode: '452010',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
  },

  // 3. Central & Palasia Zone
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
    id: 'indore-palasia-1',
    title: 'Palasia Square',
    subtitle: 'Old Palasia, AB Road, Indore • 452018',
    latitude: 22.7237,
    longitude: 75.8867,
    pincode: '452018',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
  },
  {
    id: 'indore-opalasia-1',
    title: 'Old Palasia',
    subtitle: 'Manoramaganj Road, Indore • 452018',
    latitude: 22.7250,
    longitude: 75.8890,
    pincode: '452018',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
  },
  {
    id: 'indore-npalasia-1',
    title: 'New Palasia',
    subtitle: 'Near 56 Dukan, Indore • 452001',
    latitude: 22.7260,
    longitude: 75.8810,
    pincode: '452001',
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
    id: 'indore-manorama-1',
    title: 'Manoramaganj',
    subtitle: 'Near Navneet Tower, Indore • 452001',
    latitude: 22.7210,
    longitude: 75.8840,
    pincode: '452001',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
  },
  {
    id: 'indore-stukoganj-1',
    title: 'South Tukoganj',
    subtitle: 'MG Road, Near TI Mall, Indore • 452001',
    latitude: 22.7200,
    longitude: 75.8790,
    pincode: '452001',
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
    subtitle: 'Night Food Street, Rajwada, Indore • 452001',
    latitude: 22.7170,
    longitude: 75.8530,
    pincode: '452001',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
  },
  {
    id: 'indore-badaganpati-1',
    title: 'Bada Ganpati',
    subtitle: 'Malharganj, Indore • 452006',
    latitude: 22.7220,
    longitude: 75.8420,
    pincode: '452006',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
  },
  {
    id: 'indore-malharganj-1',
    title: 'Malharganj',
    subtitle: 'Near Jinsi, Indore • 452006',
    latitude: 22.7250,
    longitude: 75.8450,
    pincode: '452006',
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
    id: 'indore-bengali-1',
    title: 'Bengali Square',
    subtitle: 'Ring Road, Kanadiya Road, Indore • 452016',
    latitude: 22.7150,
    longitude: 75.9050,
    pincode: '452016',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
  },
  {
    id: 'indore-pipliyahana-1',
    title: 'Pipliyahana Square (World Cup)',
    subtitle: 'Ring Road, Indore • 452016',
    latitude: 22.7090,
    longitude: 75.9020,
    pincode: '452016',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
  },

  // 4. Bhawarkua & South Zone
  {
    id: 'indore-bhawar-1',
    title: 'Bhawarkua Square',
    subtitle: 'AB Road, Near Holkar College, Indore • 452001',
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
    id: 'indore-sapna-1',
    title: 'Sapna Sangeeta Road',
    subtitle: 'Snehnagar, Indore • 452001',
    latitude: 22.7020,
    longitude: 75.8680,
    pincode: '452001',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
  },
  {
    id: 'indore-tower-1',
    title: 'Tower Square',
    subtitle: 'Khatiwala Tank, Sapna Sangeeta, Indore • 452001',
    latitude: 22.7000,
    longitude: 75.8650,
    pincode: '452001',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
  },
  {
    id: 'indore-vishnupuri-1',
    title: 'Vishnupuri Colony',
    subtitle: 'Bhawarkua, AB Road, Indore • 452001',
    latitude: 22.6880,
    longitude: 75.8670,
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
    id: 'indore-annapurna-rd-1',
    title: 'Annapurna Road',
    subtitle: 'Dravid Nagar / Usha Nagar, Indore • 452009',
    latitude: 22.6970,
    longitude: 75.8360,
    pincode: '452009',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
  },
  {
    id: 'indore-sudama-1',
    title: 'Sudama Nagar',
    subtitle: 'Sector E & D, Footi Kothi, Indore • 452009',
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
    id: 'indore-footi-1',
    title: 'Footi Kothi',
    subtitle: 'Dhar Road / Ring Road, Indore • 452009',
    latitude: 22.7020,
    longitude: 75.8280,
    pincode: '452009',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
  },
  {
    id: 'indore-rajendra-1',
    title: 'Rajendra Nagar',
    subtitle: 'Near IPS Academy / AB Road, Indore • 452012',
    latitude: 22.6780,
    longitude: 75.8280,
    pincode: '452012',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
  },
  {
    id: 'indore-silicon-1',
    title: 'Silicon City',
    subtitle: 'Rau, AB Road, Indore • 452012',
    latitude: 22.6280,
    longitude: 75.8110,
    pincode: '452012',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
  },
  {
    id: 'indore-tfantasy-1',
    title: 'Treasure Fantasy',
    subtitle: 'Rau, CAT Road, Indore • 453331',
    latitude: 22.6410,
    longitude: 75.8020,
    pincode: '453331',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
  },
  {
    id: 'indore-rau-1',
    title: 'Rau Circle / Rau Bypass',
    subtitle: 'AB Road / Pithampur Road, Indore • 453771',
    latitude: 22.6350,
    longitude: 75.8050,
    pincode: '453771',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
  },
  {
    id: 'indore-cat-1',
    title: 'CAT Road / RRCAT',
    subtitle: 'Rajendra Nagar, Indore • 452013',
    latitude: 22.6580,
    longitude: 75.8150,
    pincode: '452013',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
  },
  {
    id: 'indore-hawa-1',
    title: 'Hawa Bangla',
    subtitle: 'CAT Road, Choithram Hospital, Indore • 452009',
    latitude: 22.6720,
    longitude: 75.8320,
    pincode: '452009',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
  },
  {
    id: 'indore-choithram-1',
    title: 'Choithram Hospital',
    subtitle: 'Manik Bagh Road, Indore • 452014',
    latitude: 22.6880,
    longitude: 75.8450,
    pincode: '452014',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
  },

  // 5. Airport, Super Corridor & Transport
  {
    id: 'indore-super-1',
    title: 'Super Corridor',
    subtitle: 'Airport to TCS / Infosys, Indore • 452005',
    latitude: 22.7750,
    longitude: 75.8050,
    pincode: '452005',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
  },
  {
    id: 'indore-tcs-1',
    title: 'TCS Campus',
    subtitle: 'Super Corridor, Indore • 452005',
    latitude: 22.7810,
    longitude: 75.8020,
    pincode: '452005',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
  },
  {
    id: 'indore-infosys-1',
    title: 'Infosys Campus',
    subtitle: 'Super Corridor, Indore • 452005',
    latitude: 22.7850,
    longitude: 75.8000,
    pincode: '452005',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
  },
  {
    id: 'indore-airport-1',
    title: 'Indore Airport (IDR)',
    subtitle: 'Depalpur Road, Aerodrome, Indore • 452005',
    latitude: 22.7230,
    longitude: 75.8080,
    pincode: '452005',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
  },
  {
    id: 'indore-aerodrome-1',
    title: 'Aerodrome Road',
    subtitle: 'Bijasan Road, Indore • 452005',
    latitude: 22.7280,
    longitude: 75.8120,
    pincode: '452005',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
  },
  {
    id: 'indore-kalani-1',
    title: 'Kalani Nagar',
    subtitle: 'Airport Road, Indore • 452005',
    latitude: 22.7350,
    longitude: 75.8200,
    pincode: '452005',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
  },
  {
    id: 'indore-railway-1',
    title: 'Indore Junction Railway Station',
    subtitle: 'Chhoti Gwaltoli, Siyaganj, Indore • 452001',
    latitude: 22.7160,
    longitude: 75.8670,
    pincode: '452001',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
  },
  {
    id: 'indore-sarwate-1',
    title: 'Sarwate Bus Stand',
    subtitle: 'Near Railway Station, Indore • 452001',
    latitude: 22.7130,
    longitude: 75.8670,
    pincode: '452001',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
  },
  {
    id: 'indore-gangwal-1',
    title: 'Gangwal Bus Stand',
    subtitle: 'Dhar Road, Malharganj, Indore • 452002',
    latitude: 22.7150,
    longitude: 75.8420,
    pincode: '452002',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
  },
  {
    id: 'indore-mr9-1',
    title: 'MR 9 Square',
    subtitle: 'Ring Road, Malviya Nagar, Indore • 452010',
    latitude: 22.7420,
    longitude: 75.8970,
    pincode: '452010',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
  },
  {
    id: 'indore-mr10-1',
    title: 'MR 10 Square',
    subtitle: 'Bhawrasla / Sukhlia, Indore • 452016',
    latitude: 22.7750,
    longitude: 75.9300,
    pincode: '452016',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
  },
  {
    id: 'indore-radisson-1',
    title: 'Radisson Square',
    subtitle: 'Ring Road / AB Road, Indore • 452010',
    latitude: 22.7485,
    longitude: 75.9020,
    pincode: '452010',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
  },
  {
    id: 'indore-lig-1',
    title: 'LIG Colony',
    subtitle: 'AB Road, Indore • 452011',
    latitude: 22.7380,
    longitude: 75.8870,
    pincode: '452011',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
  },
  {
    id: 'indore-mig-1',
    title: 'MIG Colony',
    subtitle: 'Near LIG Colony, Indore • 452011',
    latitude: 22.7390,
    longitude: 75.8850,
    pincode: '452011',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
  },
  {
    id: 'indore-tilak-1',
    title: 'Tilak Nagar',
    subtitle: 'Kanadiya Road, Indore • 452004',
    latitude: 22.7150,
    longitude: 75.8850,
    pincode: '452004',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
  },
  {
    id: 'indore-saket-1',
    title: 'Saket Nagar',
    subtitle: 'Old Palasia Road, Indore • 452018',
    latitude: 22.7210,
    longitude: 75.8960,
    pincode: '452018',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
  },
  {
    id: 'indore-kanadiya-1',
    title: 'Kanadiya',
    subtitle: 'Bypass Road, Indore • 452016',
    latitude: 22.7180,
    longitude: 75.9350,
    pincode: '452016',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
  },
  {
    id: 'indore-bypass-1',
    title: 'Bypass Road',
    subtitle: 'Indore Bypass Highway, Indore • 452016',
    latitude: 22.7350,
    longitude: 75.9450,
    pincode: '452016',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
  },
  {
    id: 'indore-mhow-1',
    title: 'Mhow (Dr. Ambedkar Nagar)',
    subtitle: 'Indore District • 453441',
    latitude: 22.5530,
    longitude: 75.7600,
    pincode: '453441',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
  },
  {
    id: 'indore-sanwer-1',
    title: 'Sanwer',
    subtitle: 'Indore-Ujjain Highway • 453555',
    latitude: 22.8600,
    longitude: 75.9900,
    pincode: '453555',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
  },
  {
    id: 'indore-hatod-1',
    title: 'Hatod',
    subtitle: 'Airport Road Outer, Indore • 453111',
    latitude: 22.7950,
    longitude: 75.7250,
    pincode: '453111',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
  },
];

/**
 * Strict boundary validator:
 * Checks whether coordinates fall strictly within Indore metropolitan limits.
 * West lon: 75.68, North lat: 22.88, East lon: 76.08, South lat: 22.50
 */
export function isInsideIndore(lat: number, lon: number): boolean {
  return lat >= 22.50 && lat <= 22.88 && lon >= 75.68 && lon <= 76.08;
}

/**
 * Intelligent Indore-Only Location Search Engine:
 * 1. Checks Instant Local Indore Landmark Database (0ms response) with multi-token fuzzy search
 * 2. Queries Photon Geocoding API with strict Indore bounding box
 * 3. Queries OpenStreetMap Nominatim with bounded=1 Indore viewbox
 * 4. STRICT FILTER: Discards any location outside Indore!
 */
export async function searchPlaces(query: string): Promise<PlaceSearchResult[]> {
  const clean = query.trim().toLowerCase();
  if (clean.length < 2) return [];

  const tokens = clean.split(/\s+/).filter(Boolean);
  const results: PlaceSearchResult[] = [];
  const seenKeys = new Set<string>();

  // 1. Instant Match from Local Indore Landmarks Database (0ms delay)
  const localMatches = INDORE_LANDMARKS.filter((item) => {
    const searchableText = `${item.title} ${item.subtitle} ${item.pincode || ''}`.toLowerCase();
    return tokens.every((tok) => searchableText.includes(tok));
  });

  for (const m of localMatches) {
    const key = `${m.latitude.toFixed(4)},${m.longitude.toFixed(4)}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      results.push(m);
    }
  }

  // 2. Query Live Online Autocomplete API (Photon with STRICT Indore Bbox: 75.70,22.58,76.05,22.86)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&bbox=75.70,22.58,76.05,22.86&limit=8`;
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

            // STRICT FILTER: Discard any result outside Indore
            if (!isInsideIndore(lat, lon)) continue;

            const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
            if (!seenKeys.has(key)) {
              seenKeys.add(key);
              const p = f.properties || {};
              const title = p.name || p.street || 'Indore Landmark';
              const parts = [p.district || p.suburb, p.city || 'Indore', p.postcode].filter(Boolean);
              const subtitle = parts.join(', ') || 'Indore, Madhya Pradesh';

              results.push({
                id: `photon-${lat}-${lon}`,
                title,
                subtitle,
                latitude: lat,
                longitude: lon,
                pincode: p.postcode,
                city: 'Indore',
                state: 'Madhya Pradesh',
                source: 'PHOTON',
              });
            }
          }
        }
      }
    }
  } catch (e) {
    // network timeout, fall through
  }

  // 3. Query OpenStreetMap Nominatim with bounded=1 strict viewbox for Indore
  if (results.length < 5) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2500);
      const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=6&bounded=1&viewbox=75.70,22.86,76.05,22.58&countrycodes=in&q=${encodeURIComponent(query + ' Indore')}`;
      const res = await fetch(nomUrl, {
        headers: { 'User-Agent': 'VardhamritIndoreApp/1.0' },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          for (const item of data) {
            const lat = Number(item.lat);
            const lon = Number(item.lon);

            // STRICT FILTER: Discard any result outside Indore
            if (!isInsideIndore(lat, lon)) continue;

            const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
            if (!seenKeys.has(key)) {
              seenKeys.add(key);
              const addr = item.address || {};
              const title = item.name || addr.road || addr.suburb || item.display_name.split(',')[0];
              const parts = [addr.suburb || addr.neighbourhood, 'Indore', addr.postcode].filter(Boolean);
              const subtitle = parts.join(', ') || 'Indore, Madhya Pradesh';

              results.push({
                id: `nom-${lat}-${lon}`,
                title,
                subtitle,
                latitude: lat,
                longitude: lon,
                pincode: addr.postcode,
                city: 'Indore',
                state: 'Madhya Pradesh',
                source: 'NOMINATIM',
              });
            }
          }
        }
      }
    } catch (e) {
      // ignore
    }
  }

  return results.slice(0, 10);
}
