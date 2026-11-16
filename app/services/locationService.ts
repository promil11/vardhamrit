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
  landmark?: string;
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
 * 2. Get high-precision GPS coordinates with graceful accuracy fallback and timeout.
 */
export async function getAccurateCoordinates(): Promise<LocationCoordinates> {
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
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
          );
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
      );
    });
  }

  const hasPermission = await requestLocationPermission();
  if (!hasPermission) {
    throw new Error('Location permission was denied. Please allow location access in settings.');
  }

  // Fallback timeout promise (10 seconds)
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('GPS location request timed out')), 10000)
  );

  // Attempt 1: Highest Accuracy (Hardware GPS)
  try {
    const position = await Promise.race([
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
      }),
      timeoutPromise,
    ]);

    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
    };
  } catch (err) {
    console.warn('Highest accuracy GPS fix timed out or failed, falling back to High/Balanced:', err);

    // Attempt 2: High or Balanced Accuracy
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
      // Attempt 3: Try last known position as final native resort
      const lastKnown = await Location.getLastKnownPositionAsync({});
      if (lastKnown) {
        return {
          latitude: lastKnown.coords.latitude,
          longitude: lastKnown.coords.longitude,
          accuracy: lastKnown.coords.accuracy,
        };
      }

      // Web specific fallback to HTML5 navigator.geolocation
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
            (error) => reject(new Error(error.message || 'Could not fetch web geolocation')),
            { enableHighAccuracy: true, timeout: 8000 }
          );
        });
      }

      throw new Error('Could not acquire GPS position. Please ensure GPS/Location is enabled.');
    }
  }
}

/**
 * 3. Free Reverse Geocoding with Multi-tier Fallback:
 *    Tier 1: Native Expo Reverse Geocoder (Free system service on iOS & Android)
 *    Tier 2: OpenStreetMap Nominatim API (100% Free, rich Indian street & area data)
 *    Tier 3: BigDataCloud Free Reverse Geocode Client (100% Free, reliable locality & city)
 */
/**
 * 3. Free Reverse Geocoding with Multi-tier High Accuracy:
 *    Tier 1: Native Expo Reverse Geocoder (Free system service on iOS & Android)
 *    Tier 2: OpenStreetMap Nominatim API (Zoom=18, Exact Indian Street & Landmark)
 *    Tier 3: Photon Komoot Geocoder (High-density road, chowk & building names)
 *    Tier 4: BigDataCloud Free Reverse Geocode Client (Fallback)
 */
export async function reverseGeocodeCoordinates(
  latitude: number,
  longitude: number
): Promise<GeocodedAddressResult> {
  // Tier 1: Try Native Expo Reverse Geocode (Native iOS / Android System Geocoder)
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

      if (street || areaParts.length > 0 || city) {
        return {
          houseNumber: houseNumber || undefined,
          building: building || undefined,
          street: street || undefined,
          area: uniqueArea.join(', ') || undefined,
          line1: flatHouse, // specific house/building only (or "" if not present)
          line2: streetArea, // full street, area, landmark
          city,
          state,
          pincode,
          country,
          formattedAddress: formatted,
          latitude,
          longitude,
          landmark: building || item.name || undefined,
        };
      }
    }
  } catch (nativeErr) {
    console.warn('Native reverse geocode unavailable or skipped, trying OSM Nominatim:', nativeErr);
  }

  // Tier 2: OpenStreetMap Nominatim API (100% Free with zoom=18 high-resolution)
  try {
    const osmUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1&email=vardhamrit.care@gmail.com`;
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

        const houseNumber = addr.house_number || addr.housenumber || '';
        const building =
          addr.building ||
          addr.house_name ||
          addr.flats ||
          addr.amenity ||
          addr.shop ||
          addr.office ||
          addr.commercial ||
          (data.name && data.name !== addr.road ? data.name : '') ||
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

        // Extract detailed street/colony from display_name if road was missing
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

        const uniqueArea = [...new Set(areaParts)].filter((a) => a !== street && a !== city);
        const flatHouse = [houseNumber ? `House No. ${houseNumber}` : '', building]
          .filter(Boolean)
          .join(', ');

        const streetAreaParts = [street, ...uniqueArea].filter(Boolean);
        const streetArea = streetAreaParts.length > 0 ? streetAreaParts.join(', ') : (uniqueArea[0] || street || city);
        const formatted = data.display_name || [flatHouse, streetArea, city, state, pincode, country].filter(Boolean).join(', ');

        return {
          houseNumber: houseNumber || undefined,
          building: building || undefined,
          street: street || undefined,
          area: uniqueArea.join(', ') || undefined,
          line1: flatHouse, // specific house/building only (or "" for user input)
          line2: streetArea, // exact street, colony, chowk, landmark
          city,
          state,
          pincode,
          country,
          formattedAddress: formatted,
          latitude,
          longitude,
          landmark: building || addr.amenity || uniqueArea[0] || undefined,
        };
      }
    }
  } catch (osmErr) {
    console.warn('OpenStreetMap reverse geocode failed, trying Photon fallback:', osmErr);
  }

  // Tier 3: Photon Komoot API (Free OpenStreetMap-powered geocoder)
  try {
    const photonUrl = `https://photon.komoot.io/reverse?lat=${latitude}&lon=${longitude}`;
    const pResponse = await fetch(photonUrl);
    if (pResponse.ok) {
      const pData = await pResponse.json();
      const prop = pData?.features?.[0]?.properties || {};
      const houseNumber = prop.housenumber || '';
      const building = prop.type === 'house' && prop.name ? prop.name : '';
      const street = prop.street || (prop.type === 'street' || prop.type === 'secondary' || prop.type === 'residential' ? prop.name : '') || '';
      const area = prop.locality || prop.district || '';
      const city = prop.city || 'Indore';
      const state = prop.state || 'Madhya Pradesh';
      const pincode = String(prop.postcode || '').replace(/[^0-9]/g, '');
      const country = prop.country || 'India';

      const flatHouse = [houseNumber ? `House No. ${houseNumber}` : '', building].filter(Boolean).join(', ');
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
        formattedAddress: [flatHouse, streetArea, city, state, pincode, country].filter(Boolean).join(', '),
        latitude,
        longitude,
        landmark: building || area || undefined,
      };
    }
  } catch (photonErr) {
    console.warn('Photon reverse geocode failed, trying BigDataCloud fallback:', photonErr);
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
  const geocoded = await reverseGeocodeCoordinates(coords.latitude, coords.longitude);

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
    city: geocoded.city,
    state: geocoded.state,
    pincode: geocoded.pincode || '452001',
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
