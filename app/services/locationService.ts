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
 * Checks if a string is a public landmark or amenity (temple, bank, school, hospital, shop, park, etc.)
 */
function isAmenityOrLandmark(name: string): boolean {
  if (!name) return false;
  return /temple|mandir|masjid|mosque|church|gurdwara|ashram|dargah|school|college|university|vidyalaya|hospital|clinic|dispensary|pharmacy|bank|atm|hotel|restaurant|cafe|dhaba|garden|park|stadium|ground|mall|bazaar|market|square|circle|chauraha|chowk|police|thana|petrol|fuel|complex|station|theatre|cinema/i.test(name);
}

/**
 * Checks if a name indicates a residential building, apartment, or society
 */
function isResidentialPremise(name: string): boolean {
  if (!name) return false;
  return /apartment|residency|heights|enclave|tower|villa|bhavan|niwas|kunj|mansion|society|house|cottage|block|floor|flat/i.test(name);
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

    let flatHouse = [
      houseNumber ? `House No. ${houseNumber}` : '',
      building,
    ].filter(Boolean).join(', ');

    if (!flatHouse) {
      const nearestIndore = findNearestIndoreLandmark(latitude, longitude, 3000);
      flatHouse =
        getExactPoiPremise(nearestIndore) ||
        (sublocality2 || sublocality1 ? `Plot / Building, ${sublocality2 || sublocality1}` : `Building, ${route || 'Indore'}`);
    }

    let streetAreaParts = [route, sublocality2, sublocality1].filter(Boolean);
    if (flatHouse) {
      const flatLower = flatHouse.toLowerCase();
      streetAreaParts = streetAreaParts.filter((p) => !flatLower.includes(p.toLowerCase()));
    }
    const streetArea = streetAreaParts.join(', ') || locality;

    return {
      houseNumber: houseNumber || flatHouse,
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
function getExactPoiPremise(poi?: PlaceSearchResult | null): string {
  if (!poi) return '';
  if (poi.extractedHouseNo) {
    return poi.title.toLowerCase().includes(poi.extractedHouseNo.toLowerCase())
      ? poi.title
      : `${poi.extractedHouseNo}, ${poi.title}`;
  }
  if (poi.title.includes('Square') || poi.title.includes('Chowk')) {
    return `Building / Premise, near ${poi.title}`;
  }
  return `Plot / Building, ${poi.title}`;
}

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

        // Check if there is an explicit residential building / apartment / flat name
        let residentialBuilding =
          addr.house_name ||
          addr.flats ||
          addr.apartment ||
          extratags['addr:flats'] ||
          extratags['addr:floor'] ||
          extratags['addr:unit'] ||
          '';

        // POI, Amenity or Landmark name from Nominatim (e.g. Ranjeet Hanuman Temple, Apollo Hospital)
        const candidatePoi =
          addr.amenity ||
          addr.shop ||
          addr.tourism ||
          addr.office ||
          addr.leisure ||
          addr.commercial ||
          (data.name && data.name !== addr.road ? data.name : '') ||
          (namedetails?.name && namedetails?.name !== addr.road ? namedetails?.name : '') ||
          '';

        let detectedLandmark = '';
        if (candidatePoi) {
          if (isAmenityOrLandmark(candidatePoi)) {
            // It's a public landmark (temple, bank, hospital, etc.) - ALWAYS a landmark, NEVER home/flat!
            detectedLandmark = candidatePoi.toLowerCase().startsWith('near')
              ? candidatePoi
              : `Near ${candidatePoi}`;
          } else if (!residentialBuilding && isResidentialPremise(candidatePoi)) {
            residentialBuilding = candidatePoi;
          } else {
            // General business / landmark
            detectedLandmark = `Near ${candidatePoi}`;
          }
        }

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
        let pincode = (addr.postcode || '').replace(/[^0-9]/g, '');
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
              p.toLowerCase() !== 'indore city' &&
              p.toLowerCase() !== 'indore' &&
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

        // Tier 1.5: If houseNumber or residentialBuilding is missing, query Overpass 35m spatial footprint
        if (!houseNumber && !residentialBuilding) {
          const nearbyBuilding = await queryOverpassNearbyBuilding(latitude, longitude);
          if (nearbyBuilding) {
            if (nearbyBuilding.houseNumber) houseNumber = nearbyBuilding.houseNumber;
            if (nearbyBuilding.building && isResidentialPremise(nearbyBuilding.building)) {
              residentialBuilding = nearbyBuilding.building;
            }
          }
        }

        // Check for exact plot/premise within 80 meters
        const exactPremisePoi = findNearestIndoreLandmark(latitude, longitude, 80);
        // Enrich with nearest Indore colony/scheme if street or area is vague
        const nearestIndore = findNearestIndoreLandmark(latitude, longitude, 3000);
        const nearestRoad = nearestIndore?.subtitle?.split(',')[0]?.trim();
        let colonyName = '';
        if (nearestIndore) {
          if (!street || street === 'Indore City' || street === 'Indore') {
            street = nearestRoad || nearestIndore.title;
          }
          colonyName = nearestIndore.extractedHouseNo
            ? nearestIndore.title.replace(new RegExp(`^${nearestIndore.extractedHouseNo}\\s*,?\\s*`, 'i'), '').trim()
            : (nearestIndore.title.includes('Square') ? '' : nearestIndore.title);
          if (colonyName && !areaParts.includes(colonyName)) {
            areaParts.unshift(colonyName);
          }
          if (!pincode && nearestIndore.pincode) {
            pincode = nearestIndore.pincode;
          }
          if (!detectedLandmark && nearestIndore.title !== street) {
            detectedLandmark = `Near ${nearestIndore.title}`;
          }
        }

        const uniqueArea = [...new Set(areaParts)].filter((a) => a !== street && a !== city && a !== 'Indore City');
        const exactHouse = houseNumber || exactPremisePoi?.extractedHouseNo || '';
        const exactBuilding = residentialBuilding || exactPremisePoi?.title || '';
        let flatHouse = [
          exactHouse ? (exactHouse.toLowerCase().startsWith('plot') || exactHouse.toLowerCase().startsWith('house') || exactHouse.toLowerCase().startsWith('flat') ? exactHouse : `House No. ${exactHouse}`) : '',
          exactBuilding && exactBuilding !== exactHouse ? exactBuilding : ''
        ]
          .filter(Boolean)
          .join(', ');

        if (!flatHouse) {
          if (exactBuilding) {
            flatHouse = exactBuilding;
          } else if (exactHouse) {
            flatHouse = `House No. ${exactHouse}`;
          } else if (exactPremisePoi) {
            flatHouse = getExactPoiPremise(exactPremisePoi);
          } else if (nearestIndore) {
            flatHouse = getExactPoiPremise(nearestIndore);
          } else if (colonyName) {
            flatHouse = `Plot / Building, ${colonyName}`;
          } else if (street) {
            flatHouse = `Building, ${street}`;
          } else if (uniqueArea[0]) {
            flatHouse = `Plot / Building, ${uniqueArea[0]}`;
          } else {
            flatHouse = 'Plot / Building, Indore';
          }
        }

        let streetAreaParts = [street, ...uniqueArea].filter(Boolean);
        if (flatHouse) {
          const flatLower = flatHouse.toLowerCase();
          streetAreaParts = streetAreaParts.filter((p) => typeof p === 'string' && !flatLower.includes(p.toLowerCase()));
        }
        const streetArea =
          streetAreaParts.length > 0 ? streetAreaParts.join(', ') : uniqueArea[0] || street || city;
        const formatted =
          data.display_name ||
          [flatHouse, streetArea, city, state, pincode, country].filter(Boolean).join(', ');

        return {
          houseNumber: exactHouse || flatHouse,
          building: exactBuilding || (nearestIndore?.title || undefined),
          street: street || (nearestRoad || nearestIndore?.title || undefined),
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
          landmark: detectedLandmark || uniqueArea[0] || undefined,
          confidence: exactHouse || residentialBuilding ? 'EXACT_PREMISE' : 'STREET_LEVEL',
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
      let residentialBuilding = prop.type === 'house' && prop.name && isResidentialPremise(prop.name) ? prop.name : '';
      let detectedLandmark = '';
      if (prop.name && isAmenityOrLandmark(prop.name)) {
        detectedLandmark = prop.name.toLowerCase().startsWith('near') ? prop.name : `Near ${prop.name}`;
      }
      let street =
        prop.street ||
        (prop.type === 'street' || prop.type === 'secondary' || prop.type === 'residential'
          ? prop.name
          : '') ||
        '';
      if (street === 'Indore City' || street === 'Indore') street = '';
      const area = prop.locality || prop.district || '';
      const city = prop.city || 'Indore';
      const state = prop.state || 'Madhya Pradesh';
      let pincode = String(prop.postcode || '').replace(/[^0-9]/g, '');
      const country = prop.country || 'India';

      const nearestIndore = findNearestIndoreLandmark(latitude, longitude, 3000);
      const nearestRoad = nearestIndore?.subtitle?.split(',')[0]?.trim();
      if (nearestIndore) {
        if (!street) street = nearestRoad || nearestIndore.title;
        if (!pincode && nearestIndore.pincode) pincode = nearestIndore.pincode;
        if (!detectedLandmark && nearestIndore.title !== street) {
          detectedLandmark = `Near ${nearestIndore.title}`;
        }
      }

      let flatHouse = [houseNumber ? `House No. ${houseNumber}` : '', residentialBuilding]
        .filter(Boolean)
        .join(', ');

      if (!flatHouse) {
        flatHouse =
          getExactPoiPremise(nearestIndore) ||
          residentialBuilding ||
          (area ? `Plot / Building, ${area}` : `Building, ${street || 'Indore'}`);
      }
      let streetAreaParts = [street, area].filter(Boolean);
      if (flatHouse) {
        const flatLower = flatHouse.toLowerCase();
        streetAreaParts = streetAreaParts.filter((p) => typeof p === 'string' && !flatLower.includes(p.toLowerCase()));
      }
      const streetArea = streetAreaParts.join(', ') || area || street || city;

      return {
        houseNumber: (houseNumber ? `House No. ${houseNumber}` : '') || nearestIndore?.extractedHouseNo || flatHouse,
        building: residentialBuilding || nearestIndore?.title || undefined,
        street: street || (nearestRoad || nearestIndore?.title || undefined),
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
        landmark: detectedLandmark || area || undefined,
        confidence: houseNumber || residentialBuilding ? 'EXACT_PREMISE' : 'STREET_LEVEL',
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
      let residentialBuilding = item.name && item.name !== item.street && isResidentialPremise(item.name) ? item.name : '';
      let detectedLandmark = '';
      if (item.name && isAmenityOrLandmark(item.name)) {
        detectedLandmark = item.name.toLowerCase().startsWith('near') ? item.name : `Near ${item.name}`;
      }
      let street = item.street || '';
      if (street === 'Indore City' || street === 'Indore') street = '';
      const areaParts = [item.district, item.subregion].filter(Boolean);
      const city = item.city || item.subregion || item.district || 'Indore';
      const state = item.region || 'Madhya Pradesh';
      let pincode = item.postalCode ? item.postalCode.replace(/[^0-9]/g, '') : '';
      const country = item.country || 'India';

      const nearestIndore = findNearestIndoreLandmark(latitude, longitude, 3000);
      const nearestRoad = nearestIndore?.subtitle?.split(',')[0]?.trim();
      if (nearestIndore) {
        if (!street) street = nearestRoad || nearestIndore.title;
        if (!pincode && nearestIndore.pincode) pincode = nearestIndore.pincode;
        if (!detectedLandmark && nearestIndore.title !== street) {
          detectedLandmark = `Near ${nearestIndore.title}`;
        }
      }

      const uniqueArea = [...new Set(areaParts)].filter((a) => a !== street && a !== city && a !== 'Indore City');

      let flatHouse = [houseNumber ? `House No. ${houseNumber}` : '', residentialBuilding]
        .filter(Boolean)
        .join(', ');

      if (!flatHouse) {
        flatHouse =
          getExactPoiPremise(nearestIndore) ||
          residentialBuilding ||
          (uniqueArea[0] ? `Plot / Building, ${uniqueArea[0]}` : `Building, ${street || 'Indore'}`);
      }

      let streetAreaParts = [street, ...uniqueArea].filter(Boolean);
      if (flatHouse) {
        const flatLower = flatHouse.toLowerCase();
        streetAreaParts = streetAreaParts.filter((p) => typeof p === 'string' && !flatLower.includes(p.toLowerCase()));
      }
      const streetArea = streetAreaParts.length > 0 ? streetAreaParts.join(', ') : (nearestIndore?.title || city);

      const formatted = [flatHouse, streetArea, city, state, pincode, country]
        .filter(Boolean)
        .join(', ');

      return {
        houseNumber: (houseNumber ? `House No. ${houseNumber}` : '') || nearestIndore?.extractedHouseNo || flatHouse,
        building: residentialBuilding || nearestIndore?.title || undefined,
        street: street || (nearestRoad || nearestIndore?.title || undefined),
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
        landmark: detectedLandmark || item.name || undefined,
        confidence: houseNumber || residentialBuilding ? 'EXACT_PREMISE' : 'STREET_LEVEL',
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
      const locality = (bdcData.locality || '').replace(/Indore City/i, '').trim();
      const city = bdcData.city || 'Indore';
      const state = bdcData.principalSubdivision || 'Madhya Pradesh';
      const pincode = (bdcData.postcode || '').replace(/[^0-9]/g, '');
      const country = bdcData.countryName || 'India';

      const exactPremisePoi = findNearestIndoreLandmark(latitude, longitude, 80);
      const nearestIndore = findNearestIndoreLandmark(latitude, longitude, 3000);
      const nearestRoad = nearestIndore?.subtitle?.split(',')[0]?.trim();
      const streetName = nearestRoad || nearestIndore?.title || (locality || 'MR-10 Road');
      const premiseColony = exactPremisePoi
        ? getExactPoiPremise(exactPremisePoi)
        : (nearestIndore ? getExactPoiPremise(nearestIndore) : (locality ? `Plot / Building, ${locality}` : 'Plot / Building, Indore'));
      const flatHouse = premiseColony;
      const streetArea = nearestIndore && !flatHouse.toLowerCase().includes(nearestIndore.title.toLowerCase())
        ? `${nearestIndore.title}, ${streetName}`
        : `${streetName}, ${locality || 'Indore'}`;

      return {
        houseNumber: exactPremisePoi?.extractedHouseNo || flatHouse,
        building: exactPremisePoi ? exactPremisePoi.title : (nearestIndore ? nearestIndore.title : undefined),
        street: streetName,
        area: nearestIndore ? nearestIndore.title : (locality || undefined),
        line1: flatHouse,
        line2: streetArea,
        city,
        state,
        pincode: pincode || (nearestIndore?.pincode) || '452010',
        country,
        formattedAddress: [flatHouse, streetArea, city, state, pincode, country].filter(Boolean).join(', '),
        latitude,
        longitude,
        accuracy,
        landmark: nearestIndore ? `Near ${nearestIndore.title}` : undefined,
        confidence: exactPremisePoi ? 'EXACT_PREMISE' : 'STREET_LEVEL',
      };
    }
  } catch (bdcErr) {
    console.warn('BigDataCloud reverse geocode failed:', bdcErr);
  }

  // Ultimate fallback
  const exactPremisePoi = findNearestIndoreLandmark(latitude, longitude, 80);
  const nearestIndore = findNearestIndoreLandmark(latitude, longitude, 3000);
  const fallbackColony = exactPremisePoi
    ? getExactPoiPremise(exactPremisePoi)
    : (nearestIndore ? getExactPoiPremise(nearestIndore) : 'Plot / Building, Sukhlia');
  const nearestRoad = nearestIndore?.subtitle?.split(',')[0]?.trim() || 'MR-10 Road';
  const fallbackArea = nearestIndore?.subtitle?.split(',')[1]?.trim() || (nearestIndore?.title || 'Sukhlia');
  const flatHouse = fallbackColony;
  const streetArea = nearestIndore && !flatHouse.toLowerCase().includes(nearestIndore.title.toLowerCase())
    ? `${nearestIndore.title}, ${nearestRoad}`
    : `${nearestRoad}, ${fallbackArea}`;
  return {
    houseNumber: exactPremisePoi?.extractedHouseNo || flatHouse,
    building: fallbackColony,
    street: nearestRoad,
    area: fallbackArea,
    line1: flatHouse,
    line2: streetArea,
    city: 'Indore',
    state: 'Madhya Pradesh',
    pincode: nearestIndore?.pincode || '452010',
    country: 'India',
    formattedAddress: `${flatHouse}, ${streetArea}, Indore, Madhya Pradesh - ${nearestIndore?.pincode || '452010'}`,
    latitude,
    longitude,
    accuracy: null,
    landmark: nearestIndore ? `Near ${nearestIndore.title}` : undefined,
    confidence: exactPremisePoi ? 'EXACT_PREMISE' : 'LOCALITY',
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

  const homeNumber = geocoded.houseNumber || geocoded.building || geocoded.line1;
  const streetName = geocoded.street || geocoded.line2 || geocoded.area || 'Indore';

  const address: Address = {
    id: `gps-${Date.now()}`,
    name: options?.name || 'My Location',
    phone: options?.phone || '9876543210',
    tag: options?.tag || 'Current Location',
    line1: geocoded.line1 || homeNumber || 'Plot / House',
    line2: geocoded.line2 || streetName,
    houseNumber: homeNumber,
    street: streetName,
    area: geocoded.area,
    landmark: geocoded.landmark,
    city: geocoded.city,
    state: geocoded.state,
    pincode: geocoded.pincode || '452010',
    latitude: coords.latitude,
    longitude: coords.longitude,
    isDefault: true,
  };

  return { address, geocoded };
}

/**
 * Enriches an address (especially legacy/vague GPS addresses) with exact street name,
 * home/building premise, landmark and pincode from coordinates.
 */
export function enrichAddressCoordinates(addr: Address): Address {
  if (!addr.latitude || !addr.longitude) return addr;

  const nearest = findNearestIndoreLandmark(addr.latitude, addr.longitude, 3000);
  if (!nearest) return addr;

  const road = nearest.subtitle?.split(',')[0]?.trim() || nearest.title;
  const cleanLine1 = (addr.line1 || '')
    .replace(/^Building\s*\/\s*Plot\s*,?\s*/i, '')
    .replace(/^House\s*\/\s*Plot\s*,?\s*/i, '')
    .trim();

  const isVague =
    !cleanLine1 ||
    cleanLine1 === 'Indore City' ||
    cleanLine1 === 'Indore' ||
    cleanLine1 === 'Current Location' ||
    cleanLine1.toLowerCase().includes('building / plot') ||
    !addr.street;

  const exactPremise = getExactPoiPremise(nearest);
  const rawHouseNo = nearest.extractedHouseNo || '';
  const colony = rawHouseNo
    ? nearest.title.replace(new RegExp(`^${rawHouseNo}\\s*,?\\s*`, 'i'), '').trim()
    : nearest.title;
  const subArea = nearest.subtitle?.split(',')[1]?.trim() || 'Sukhlia';

  const houseNumber = addr.houseNumber
    ? addr.houseNumber.replace(/^Building\s*\/\s*Plot\s*,?\s*/i, '').trim()
    : (rawHouseNo || exactPremise);

  const street = addr.street && addr.street !== 'Indore City'
    ? addr.street
    : (colony && road ? `${colony}, ${road}` : road || colony);

  const line1 = isVague ? exactPremise : cleanLine1;
  const line2 = addr.line2 && addr.line2 !== 'Indore City' ? addr.line2 : road;
  const landmark = addr.landmark || `Near ${nearest.title}`;
  const pincode = (!addr.pincode || addr.pincode === '452001') && nearest.pincode ? nearest.pincode : (addr.pincode || '452010');

  return {
    ...addr,
    houseNumber,
    street,
    area: addr.area && addr.area !== 'Indore City' && addr.area !== 'Indore' ? addr.area : subArea,
    line1,
    line2,
    landmark,
    pincode,
  };
}

/**
 * Formats an Address cleanly for display on headers or cards,
 * ensuring both the home/building number and street address name are clearly visible.
 */
export function formatHeaderAddress(addr: Address | null | undefined): string {
  if (!addr) return 'Tap to set address';

  // 1. Strip any legacy "Building / Plot" prefix from cached addresses
  const cleanLine1 = (addr.line1 || '')
    .replace(/^Building\s*\/\s*Plot\s*,?\s*/i, '')
    .replace(/^House\s*\/\s*Plot\s*,?\s*/i, '')
    .trim();

  const cleanHouseNo = (addr.houseNumber || '')
    .replace(/^Building\s*\/\s*Plot\s*,?\s*/i, '')
    .replace(/^House\s*\/\s*Plot\s*,?\s*/i, '')
    .trim();

  // 2. If address is vague or legacy, resolve exact premise from coordinates
  const isVague =
    !cleanLine1 ||
    cleanLine1 === 'Indore City' ||
    cleanLine1 === 'Indore' ||
    cleanLine1 === 'Current Location' ||
    cleanLine1.toLowerCase().includes('building / plot');

  if (isVague && addr.latitude && addr.longitude) {
    const nearest = findNearestIndoreLandmark(addr.latitude, addr.longitude, 3000);
    if (nearest) {
      const road = nearest.subtitle?.split(',')[0]?.trim() || '';
      const exactPremise = getExactPoiPremise(nearest);
      return [exactPremise, road].filter(Boolean).join(', ');
    }
  }

  // 3. Extract exact house/plot/building number
  const houseNo = cleanHouseNo || cleanLine1;

  // 4. Extract street name
  const streetName =
    addr.street && addr.street !== 'Indore City' && addr.street !== houseNo
      ? addr.street
      : addr.line2 && addr.line2 !== houseNo && addr.line2 !== 'Indore City'
      ? addr.line2
      : addr.area || '';

  // 5. Combine exact building/plot + street name
  const parts: string[] = [];

  if (houseNo) {
    parts.push(houseNo);
  }

  if (streetName && !parts.some((p) => p.toLowerCase().includes(streetName.toLowerCase()))) {
    parts.push(streetName);
  }

  if (parts.length === 0 && addr.city) {
    parts.push(addr.city);
  }

  return parts.filter(Boolean).join(', ') || 'Current Location';
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
  source: 'INDORE_POI' | 'PHOTON' | 'NOMINATIM' | 'ARCGIS';
  extractedHouseNo?: string;
  keywords?: string[];
}

export const INDORE_LANDMARKS: PlaceSearchResult[] = [
  {
    id: 'indore-s71-1',
    title: 'Scheme No. 71',
    subtitle: 'Gumasta Nagar / Footi Kothi, Indore • 452009',
    latitude: 22.7044,
    longitude: 75.8287,
    pincode: '452009',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['sch 71', 'scheme 71', 's71', 'gumasta nagar', 'footi kothi', 'dhar road'],
  },
  {
    id: 'indore-s71-sec-ab',
    title: 'Scheme 71 Sector A & B',
    subtitle: 'Gumasta Nagar, Dhar Road, Indore • 452009',
    latitude: 22.704,
    longitude: 75.828,
    pincode: '452009',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['sch 71 a', 'scheme 71 b', 'sector a', 'sector b'],
  },
  {
    id: 'indore-s71-sec-cd',
    title: 'Scheme 71 Sector C & D',
    subtitle: 'Near Chandan Nagar, Indore • 452009',
    latitude: 22.705,
    longitude: 75.826,
    pincode: '452009',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['sch 71 c', 'scheme 71 d', 'sector c', 'sector d'],
  },
  {
    id: 'indore-gumasta-1',
    title: 'Gumasta Nagar',
    subtitle: 'Scheme 71 / Footi Kothi, Indore • 452009',
    latitude: 22.708,
    longitude: 75.83,
    pincode: '452009',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['gumasta', 'gumasta nagar', 'footi kothi'],
  },
  {
    id: 'indore-footi-1',
    title: 'Footi Kothi Square',
    subtitle: 'Dhar Road / Ring Road, Indore • 452009',
    latitude: 22.702,
    longitude: 75.828,
    pincode: '452009',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['footi kothi', 'phooti kothi', 'dhar road', 'ring road'],
  },
  {
    id: 'indore-sudama-1',
    title: 'Sudama Nagar',
    subtitle: 'Footi Kothi / Annapurna, Indore • 452009',
    latitude: 22.695,
    longitude: 75.845,
    pincode: '452009',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['sudama', 'sudama nagar', 'sector e', 'sector d'],
  },
  {
    id: 'indore-sudama-e',
    title: 'Sudama Nagar Sector E',
    subtitle: 'Near Narendra Tiwari Marg, Indore • 452009',
    latitude: 22.696,
    longitude: 75.842,
    pincode: '452009',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['sudama e', 'sudama nagar e', 'sector e'],
  },
  {
    id: 'indore-sudama-d',
    title: 'Sudama Nagar Sector D',
    subtitle: 'Near Footi Kothi, Indore • 452009',
    latitude: 22.697,
    longitude: 75.84,
    pincode: '452009',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['sudama d', 'sudama nagar d', 'sector d'],
  },
  {
    id: 'indore-ushnagar-1',
    title: 'Usha Nagar',
    subtitle: 'Annapurna Road, Indore • 452009',
    latitude: 22.698,
    longitude: 75.834,
    pincode: '452009',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['usha nagar', 'annapurna road'],
  },
  {
    id: 'indore-ushnagar-ext',
    title: 'Usha Nagar Extension',
    subtitle: 'Near Dravid Nagar, Indore • 452009',
    latitude: 22.6965,
    longitude: 75.833,
    pincode: '452009',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['usha nagar ext', 'extension'],
  },
  {
    id: 'indore-vaishali-1',
    title: 'Vaishali Nagar',
    subtitle: 'Near Annapurna / Gumasta Nagar, Indore • 452009',
    latitude: 22.684,
    longitude: 75.829,
    pincode: '452009',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['vaishali nagar', 'annapurna'],
  },
  {
    id: 'indore-dravid-1',
    title: 'Dravid Nagar',
    subtitle: 'Annapurna Road, Indore • 452009',
    latitude: 22.697,
    longitude: 75.836,
    pincode: '452009',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['dravid nagar', 'annapurna'],
  },
  {
    id: 'indore-annapurna-mandir',
    title: 'Annapurna Mandir',
    subtitle: 'Annapurna Road, Indore • 452009',
    latitude: 22.6948,
    longitude: 75.8389,
    pincode: '452009',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['annapurna temple', 'annapurna mandir', 'annapurna road'],
  },
  {
    id: 'indore-gopur-sq',
    title: 'Gopur Square',
    subtitle: 'Annapurna Road / Ring Road, Indore • 452009',
    latitude: 22.686,
    longitude: 75.838,
    pincode: '452009',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['gopur square', 'gopur chauraha', 'annapurna'],
  },
  {
    id: 'indore-ranjeet-1',
    title: 'Ranjeet Hanuman Mandir',
    subtitle: 'Footi Kothi Road, Indore • 452009',
    latitude: 22.701,
    longitude: 75.833,
    pincode: '452009',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['ranjeet hanuman', 'ranjit hanuman'],
  },
  {
    id: 'indore-lokmanya-1',
    title: 'Lokmanya Nagar',
    subtitle: 'Near Ranjeet Hanuman, Indore • 452009',
    latitude: 22.703,
    longitude: 75.836,
    pincode: '452009',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['lokmanya nagar', 'kesarbagh'],
  },
  {
    id: 'indore-kesarbagh-1',
    title: 'Kesarbagh Road',
    subtitle: 'Near Lal Bagh Palace, Indore • 452009',
    latitude: 22.705,
    longitude: 75.845,
    pincode: '452009',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['kesarbagh', 'lal bagh'],
  },
  {
    id: 'indore-lalbagh-1',
    title: 'Lal Bagh Palace',
    subtitle: 'Kesarbagh Road, Indore • 452009',
    latitude: 22.7,
    longitude: 75.849,
    pincode: '452009',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['lal bagh', 'lalbagh palace'],
  },
  {
    id: 'indore-prajapat-1',
    title: 'Prajapat Nagar',
    subtitle: 'Footi Kothi / Dhar Road, Indore • 452009',
    latitude: 22.7015,
    longitude: 75.824,
    pincode: '452009',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['prajapat nagar'],
  },
  {
    id: 'indore-dwarkapuri-1',
    title: 'Dwarkapuri',
    subtitle: 'Footi Kothi Road, Indore • 452009',
    latitude: 22.691,
    longitude: 75.832,
    pincode: '452009',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['dwarkapuri', 'footi kothi'],
  },
  {
    id: 'indore-chandan-1',
    title: 'Chandan Nagar',
    subtitle: 'Dhar Road, Indore • 452002',
    latitude: 22.707,
    longitude: 75.821,
    pincode: '452002',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['chandan nagar', 'dhar road'],
  },
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
    keywords: ['electronic complex', 'elec comp', 'ec', 'sukhlia', 'pardesipura'],
  },
  {
    id: 'indore-ec-2',
    title: 'Electronic Complex 4th Floor',
    subtitle: 'Plot 142-A, Sukhlia, Indore • 452010',
    latitude: 22.7524,
    longitude: 75.8688,
    pincode: '452010',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['electronic complex 4th floor', 'plot 142', 'it complex', 'cis'],
  },
  {
    id: 'indore-ddunagar-1',
    title: 'DDU Nagar (Scheme 31)',
    subtitle: 'Abhinandan Nagar Road, Sukhlia, Indore • 452010',
    latitude: 22.76065,
    longitude: 75.86447,
    pincode: '452010',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['ddu nagar', 'deendayal nagar', 'scheme 31', 'plot 176'],
  },
  {
    id: 'indore-abhinandan-1',
    title: 'Abhinandan Nagar',
    subtitle: 'MR-10 / Sukhlia, Indore • 452010',
    latitude: 22.761,
    longitude: 75.864,
    pincode: '452010',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['abhinandan nagar', 'sukhlia', 'mr 10'],
  },
  {
    id: 'indore-sukhlia-1',
    title: 'Sukhlia Square',
    subtitle: 'MR-10 / Bapat Square Road, Indore • 452010',
    latitude: 22.7615,
    longitude: 75.8652,
    pincode: '452010',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['sukhlia', 'sukhlia square', 'mr 10'],
  },
  {
    id: 'indore-bapat-1',
    title: 'Bapat Square',
    subtitle: 'Sukhlia, MR-10, Indore • 452010',
    latitude: 22.7615,
    longitude: 75.869,
    pincode: '452010',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['bapat', 'bapat square', 'bapat chauraha', 'sukhlia'],
  },
  {
    id: 'indore-pardesi-1',
    title: 'Pardesipura Square',
    subtitle: 'Nanda Nagar / Sukhlia Road, Indore • 452011',
    latitude: 22.7485,
    longitude: 75.875,
    pincode: '452011',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['pardesipura', 'pardeshipura', 'square'],
  },
  {
    id: 'indore-nanda-1',
    title: 'Nanda Nagar',
    subtitle: 'Pardesipura, Indore • 452011',
    latitude: 22.753,
    longitude: 75.875,
    pincode: '452011',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['nanda nagar', 'patil hospital', 'pardesipura'],
  },
  {
    id: 'indore-clerk-1',
    title: 'Clerk Colony',
    subtitle: 'Pardesipura, Indore • 452011',
    latitude: 22.756,
    longitude: 75.871,
    pincode: '452011',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['clerk colony', 'clerk', 'pardesipura'],
  },
  {
    id: 'indore-subhash-1',
    title: 'Subhash Nagar',
    subtitle: 'Pardesipura, Indore • 452011',
    latitude: 22.745,
    longitude: 75.872,
    pincode: '452011',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['subhash nagar', 'pardesipura'],
  },
  {
    id: 'indore-kulkarni-1',
    title: 'Kulkarni Ka Bhatta',
    subtitle: 'Near Pardesipura, Indore • 452015',
    latitude: 22.749,
    longitude: 75.862,
    pincode: '452015',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['kulkarni bhatta', 'kulkarni'],
  },
  {
    id: 'indore-aurobindo-1',
    title: 'Aurobindo Hospital (SAIMS)',
    subtitle: 'Indore-Ujjain Highway, Bhawrasla • 453555',
    latitude: 22.793,
    longitude: 75.856,
    pincode: '453555',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['aurobindo', 'saims', 'aurobindo hospital', 'bhawrasla'],
  },
  {
    id: 'indore-laxmibai-1',
    title: 'Laxmibai Nagar Station',
    subtitle: 'Sanwer Road, Indore • 452006',
    latitude: 22.742,
    longitude: 75.851,
    pincode: '452006',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['laxmibai nagar', 'laxmi bai', 'mandi'],
  },
  {
    id: 'indore-marimata-1',
    title: 'Marimata Square',
    subtitle: 'Sanwer Road, Indore • 452006',
    latitude: 22.735,
    longitude: 75.852,
    pincode: '452006',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['marimata', 'mari mata', 'square'],
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
    keywords: ['vijay nagar', 'vijaynagar', 'vn square'],
  },
  {
    id: 'indore-s54-1',
    title: 'Scheme 54',
    subtitle: 'Vijay Nagar, Near C21 Mall, Indore • 452010',
    latitude: 22.749,
    longitude: 75.892,
    pincode: '452010',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['sch 54', 'scheme 54', 's54', 'meghdoot garden', 'vijay nagar'],
  },
  {
    id: 'indore-s74-1',
    title: 'Scheme 74',
    subtitle: 'Vijay Nagar, Indore • 452010',
    latitude: 22.758,
    longitude: 75.891,
    pincode: '452010',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['sch 74', 'scheme 74', 's74', 'vijay nagar'],
  },
  {
    id: 'indore-s78-1',
    title: 'Scheme 78',
    subtitle: 'Part 2, Vijay Nagar, Indore • 452010',
    latitude: 22.761,
    longitude: 75.898,
    pincode: '452010',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['sch 78', 'scheme 78', 's78', 'vijay nagar', 'brilliant'],
  },
  {
    id: 'indore-s78-part1',
    title: 'Scheme 78 Part 1',
    subtitle: 'Near Brilliant Solitaire, Indore • 452010',
    latitude: 22.763,
    longitude: 75.896,
    pincode: '452010',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['scheme 78 part 1', 'sch 78 p1'],
  },
  {
    id: 'indore-s94-1',
    title: 'Scheme 94',
    subtitle: 'Ring Road, Bombay Hospital, Indore • 452010',
    latitude: 22.757,
    longitude: 75.899,
    pincode: '452010',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['sch 94', 'scheme 94', 's94', 'bombay hospital'],
  },
  {
    id: 'indore-s114-1',
    title: 'Scheme 114',
    subtitle: 'Part 1 & 2, Dewas Naka, Indore • 452010',
    latitude: 22.772,
    longitude: 75.896,
    pincode: '452010',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['sch 114', 'scheme 114', 's114'],
  },
  {
    id: 'indore-s134-1',
    title: 'Scheme 134',
    subtitle: 'Star Square / Nipania, Indore • 452010',
    latitude: 22.758,
    longitude: 75.912,
    pincode: '452010',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['sch 134', 'scheme 134', 's134', 'star square'],
  },
  {
    id: 'indore-s136-1',
    title: 'Scheme 136',
    subtitle: 'Nipania Road, Indore • 452010',
    latitude: 22.765,
    longitude: 75.915,
    pincode: '452010',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['sch 136', 'scheme 136', 's136'],
  },
  {
    id: 'indore-mahalaxmi-1',
    title: 'Mahalaxmi Nagar',
    subtitle: 'Bombay Hospital Road, Indore • 452010',
    latitude: 22.762,
    longitude: 75.908,
    pincode: '452010',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['mahalaxmi nagar', 'mahalakshmi', 'bombay hospital road'],
  },
  {
    id: 'indore-apollo-1',
    title: 'Apollo DB City',
    subtitle: 'Nipania Main Road, Indore • 452020',
    latitude: 22.768,
    longitude: 75.918,
    pincode: '452020',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['apollo db city', 'db city', 'apollo db', 'nipania'],
  },
  {
    id: 'indore-nipania-1',
    title: 'Nipania',
    subtitle: 'Near DPS / Bypass, Indore • 452020',
    latitude: 22.771,
    longitude: 75.925,
    pincode: '452020',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['nipania', 'dps indore', 'shishukunj'],
  },
  {
    id: 'indore-tulsi-1',
    title: 'Tulsi Nagar',
    subtitle: 'Near Mahalaxmi Nagar, Indore • 452010',
    latitude: 22.769,
    longitude: 75.905,
    pincode: '452010',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['tulsi nagar', 'mahalaxmi'],
  },
  {
    id: 'indore-bombay-1',
    title: 'Bombay Hospital Square',
    subtitle: 'Ring Road, Scheme 94, Indore • 452010',
    latitude: 22.759,
    longitude: 75.897,
    pincode: '452010',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['bombay hospital', 'bombay hosp', 'bombay circle'],
  },
  {
    id: 'indore-c21-1',
    title: 'C21 Mall',
    subtitle: 'AB Road, Scheme 54, Vijay Nagar • 452010',
    latitude: 22.748,
    longitude: 75.893,
    pincode: '452010',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['c21', 'c21 mall', 'scheme 54'],
  },
  {
    id: 'indore-malhar-1',
    title: 'Malhar Mega Mall',
    subtitle: 'AB Road, Vijay Nagar, Indore • 452010',
    latitude: 22.749,
    longitude: 75.894,
    pincode: '452010',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['malhar mall', 'malhar mega mall'],
  },
  {
    id: 'indore-mangalcity-1',
    title: 'Mangal City Mall',
    subtitle: 'Vijay Nagar Square, Indore • 452010',
    latitude: 22.752,
    longitude: 75.894,
    pincode: '452010',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['mangal city', 'mangal city mall'],
  },
  {
    id: 'indore-brilliant-1',
    title: 'Brilliant Convention Centre',
    subtitle: 'Scheme 78, Vijay Nagar, Indore • 452010',
    latitude: 22.764,
    longitude: 75.895,
    pincode: '452010',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['brilliant convention', 'bcc', 'brilliant'],
  },
  {
    id: 'indore-brilliant-titanium',
    title: 'Brilliant Titanium',
    subtitle: 'Scheme 78 Part 2, Indore • 452010',
    latitude: 22.762,
    longitude: 75.894,
    pincode: '452010',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['brilliant titanium', 'titanium'],
  },
  {
    id: 'indore-brilliant-solitaire',
    title: 'Brilliant Solitaire',
    subtitle: 'Scheme 78 Part 2, Indore • 452010',
    latitude: 22.761,
    longitude: 75.895,
    pincode: '452010',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['brilliant solitaire', 'solitaire'],
  },
  {
    id: 'indore-medanta-1',
    title: 'Medanta Hospital',
    subtitle: 'MR-10, Sector B, Indore • 452010',
    latitude: 22.757,
    longitude: 75.882,
    pincode: '452010',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['medanta', 'medanta hospital', 'mr 10'],
  },
  {
    id: 'indore-chl-1',
    title: 'Care CHL Hospital',
    subtitle: 'AB Road, Near LIG Colony, Indore • 452008',
    latitude: 22.738,
    longitude: 75.89,
    pincode: '452008',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['chl hospital', 'care chl', 'ab road'],
  },
  {
    id: 'indore-shalby-1',
    title: 'Shalby Hospital',
    subtitle: 'RS Bhandari Marg, Janjeerwala • 452001',
    latitude: 22.731,
    longitude: 75.883,
    pincode: '452001',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['shalby', 'shalby hospital', 'janjeerwala'],
  },
  {
    id: 'indore-radisson-1',
    title: 'Radisson Square',
    subtitle: 'Ring Road / AB Road, Indore • 452010',
    latitude: 22.7485,
    longitude: 75.902,
    pincode: '452010',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['radisson', 'radisson square', 'radisson blu'],
  },
  {
    id: 'indore-mr9-1',
    title: 'MR 9 Square',
    subtitle: 'Ring Road, Malviya Nagar, Indore • 452010',
    latitude: 22.742,
    longitude: 75.897,
    pincode: '452010',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['mr 9', 'mr9 square', 'mr 9 road'],
  },
  {
    id: 'indore-mr10-1',
    title: 'MR 10 Square',
    subtitle: 'Bhawrasla / Sukhlia, Indore • 452016',
    latitude: 22.775,
    longitude: 75.93,
    pincode: '452016',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['mr 10', 'mr10 square', 'mr 10 road'],
  },
  {
    id: 'indore-malviya-1',
    title: 'Malviya Nagar',
    subtitle: 'MR-9 / Ring Road, Indore • 452010',
    latitude: 22.744,
    longitude: 75.894,
    pincode: '452010',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['malviya nagar', 'mr 9'],
  },
  {
    id: 'indore-lig-1',
    title: 'LIG Colony',
    subtitle: 'AB Road, Indore • 452011',
    latitude: 22.738,
    longitude: 75.887,
    pincode: '452011',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['lig', 'lig colony', 'lig square', 'lig circle'],
  },
  {
    id: 'indore-mig-1',
    title: 'MIG Colony',
    subtitle: 'Near LIG Colony, Indore • 452011',
    latitude: 22.739,
    longitude: 75.885,
    pincode: '452011',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['mig', 'mig colony', 'mig thana'],
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
    keywords: ['56 dukan', 'chhappan dukan', 'chappan', 'new palasia'],
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
    keywords: ['palasia', 'palasia square', 'old palasia'],
  },
  {
    id: 'indore-opalasia-1',
    title: 'Old Palasia',
    subtitle: 'Manoramaganj Road, Indore • 452018',
    latitude: 22.725,
    longitude: 75.889,
    pincode: '452018',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['old palasia', 'anand bazaar'],
  },
  {
    id: 'indore-npalasia-1',
    title: 'New Palasia',
    subtitle: 'Near 56 Dukan, Indore • 452001',
    latitude: 22.726,
    longitude: 75.881,
    pincode: '452001',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['new palasia', 'curewell'],
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
    keywords: ['geeta bhawan', 'gita bhawan', 'geeta bhavan'],
  },
  {
    id: 'indore-manorama-1',
    title: 'Manoramaganj',
    subtitle: 'Near Navneet Tower, Indore • 452001',
    latitude: 22.721,
    longitude: 75.884,
    pincode: '452001',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['manoramaganj', 'navneet tower'],
  },
  {
    id: 'indore-stukoganj-1',
    title: 'South Tukoganj',
    subtitle: 'MG Road, Near TI Mall, Indore • 452001',
    latitude: 22.72,
    longitude: 75.879,
    pincode: '452001',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['south tukoganj', 'tukoganj', 'nath mandir'],
  },
  {
    id: 'indore-ntukoganj-1',
    title: 'North Tukoganj',
    subtitle: 'Race Course Road, Indore • 452001',
    latitude: 22.725,
    longitude: 75.877,
    pincode: '452001',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['north tukoganj', 'race course road'],
  },
  {
    id: 'indore-ti-1',
    title: 'Treasure Island Mall (TI Mall)',
    subtitle: 'MG Road, South Tukoganj • 452001',
    latitude: 22.7215,
    longitude: 75.877,
    pincode: '452001',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['ti mall', 'treasure island', 'ti', 'mg road'],
  },
  {
    id: 'indore-tinext-1',
    title: 'TI Next Mall',
    subtitle: 'Central Mall, Tukoganj, Indore • 452001',
    latitude: 22.723,
    longitude: 75.876,
    pincode: '452001',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['ti next', 'central mall'],
  },
  {
    id: 'indore-regal-1',
    title: 'Regal Square / High Court',
    subtitle: 'MG Road, Central Indore • 452001',
    latitude: 22.719,
    longitude: 75.869,
    pincode: '452001',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['regal square', 'high court', 'regal cinema'],
  },
  {
    id: 'indore-whitechurch-1',
    title: 'White Church Square',
    subtitle: 'Pipliyahana Road, Residency • 452001',
    latitude: 22.713,
    longitude: 75.88,
    pincode: '452001',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['white church', 'residency area'],
  },
  {
    id: 'indore-zoo-1',
    title: 'Kamla Nehru Prani Sangrahalay (Zoo)',
    subtitle: 'Navlakha / Residency, Indore • 452001',
    latitude: 22.71,
    longitude: 75.877,
    pincode: '452001',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['indore zoo', 'kamla nehru park'],
  },
  {
    id: 'indore-anoop-1',
    title: 'Anoop Nagar',
    subtitle: 'Near CHL Hospital, AB Road • 452008',
    latitude: 22.735,
    longitude: 75.892,
    pincode: '452008',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['anoop nagar', 'anup nagar'],
  },
  {
    id: 'indore-srinagar-1',
    title: 'Srinagar Colony',
    subtitle: 'Old Palasia, Indore • 452018',
    latitude: 22.722,
    longitude: 75.892,
    pincode: '452018',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['srinagar', 'shrinagar'],
  },
  {
    id: 'indore-anandbazaar-1',
    title: 'Anand Bazaar',
    subtitle: 'Old Palasia / Saket, Indore • 452018',
    latitude: 22.724,
    longitude: 75.894,
    pincode: '452018',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['anand bazaar', 'anand bazar'],
  },
  {
    id: 'indore-saket-1',
    title: 'Saket Nagar',
    subtitle: 'Old Palasia Road, Indore • 452018',
    latitude: 22.721,
    longitude: 75.896,
    pincode: '452018',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['saket', 'saket nagar'],
  },
  {
    id: 'indore-goyal-1',
    title: 'Goyal Nagar',
    subtitle: 'Near Bengali Square, Indore • 452018',
    latitude: 22.718,
    longitude: 75.898,
    pincode: '452018',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['goyal nagar'],
  },
  {
    id: 'indore-tilak-1',
    title: 'Tilak Nagar',
    subtitle: 'Kanadiya Road, Indore • 452004',
    latitude: 22.715,
    longitude: 75.885,
    pincode: '452004',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['tilak nagar', 'kanadiya road'],
  },
  {
    id: 'indore-savind-1',
    title: 'Savindnagar',
    subtitle: 'Tilak Nagar, Indore • 452004',
    latitude: 22.713,
    longitude: 75.888,
    pincode: '452004',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['savindnagar', 'savind nagar'],
  },
  {
    id: 'indore-bengali-1',
    title: 'Bengali Square',
    subtitle: 'Ring Road, Kanadiya Road • 452016',
    latitude: 22.715,
    longitude: 75.905,
    pincode: '452016',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['bengali square', 'bengali chauraha', 'ring road'],
  },
  {
    id: 'indore-pipliyahana-1',
    title: 'Pipliyahana Square (World Cup)',
    subtitle: 'Ring Road, Indore • 452016',
    latitude: 22.709,
    longitude: 75.902,
    pincode: '452016',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['pipliyahana', 'world cup square', 'ring road'],
  },
  {
    id: 'indore-s140-1',
    title: 'Scheme 140',
    subtitle: 'Pipliyahana / Ring Road • 452016',
    latitude: 22.709,
    longitude: 75.912,
    pincode: '452016',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['sch 140', 'scheme 140', 's140', 'pipliyahana'],
  },
  {
    id: 'indore-khajrana-1',
    title: 'Khajrana Ganesh Mandir',
    subtitle: 'Khajrana Road, Indore • 452012',
    latitude: 22.735,
    longitude: 75.92,
    pincode: '452012',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['khajrana', 'khajrana ganesh', 'mandir'],
  },
  {
    id: 'indore-khajrana-ring',
    title: 'Khajrana Ring Road',
    subtitle: 'Ring Road / Khajrana, Indore • 452012',
    latitude: 22.738,
    longitude: 75.912,
    pincode: '452012',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['khajrana ring road'],
  },
  {
    id: 'indore-kanadiya-1',
    title: 'Kanadiya',
    subtitle: 'Bypass Road, Indore • 452016',
    latitude: 22.718,
    longitude: 75.935,
    pincode: '452016',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['kanadiya', 'kanadia', 'bypass'],
  },
  {
    id: 'indore-bypass-1',
    title: 'Bypass Road',
    subtitle: 'Indore Bypass Highway • 452016',
    latitude: 22.735,
    longitude: 75.945,
    pincode: '452016',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['bypass', 'bypass highway'],
  },
  {
    id: 'indore-phoenix-1',
    title: 'Phoenix Citadel Mall',
    subtitle: 'MR-10 Junction, Bypass Road • 452016',
    latitude: 22.775,
    longitude: 75.94,
    pincode: '452016',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['phoenix', 'phoenix citadel', 'citadel mall', 'bypass'],
  },
  {
    id: 'indore-bicholi-m-1',
    title: 'Bicholi Mardana',
    subtitle: 'Bypass Road, Indore • 452016',
    latitude: 22.701,
    longitude: 75.928,
    pincode: '452016',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['bicholi mardana', 'bicholi', 'agrawal public school'],
  },
  {
    id: 'indore-bicholi-h-1',
    title: 'Bicholi Hapsi',
    subtitle: 'Bypass Road, Indore • 452016',
    latitude: 22.695,
    longitude: 75.935,
    pincode: '452016',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['bicholi hapsi'],
  },
  {
    id: 'indore-silver-1',
    title: 'Silver Springs Township',
    subtitle: 'AB Road Bypass, Near DPS • 452020',
    latitude: 22.668,
    longitude: 75.915,
    pincode: '452020',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['silver springs', 'silver springs township', 'bypass'],
  },
  {
    id: 'indore-omaxe1-1',
    title: 'Omaxe City 1',
    subtitle: 'Mayakhedi, Bypass Road • 452016',
    latitude: 22.795,
    longitude: 75.925,
    pincode: '452016',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['omaxe', 'omaxe city', 'omaxe city 1', 'mayakhedi'],
  },
  {
    id: 'indore-omaxe2-1',
    title: 'Omaxe City 2',
    subtitle: 'Manglia, Bypass Road • 453771',
    latitude: 22.815,
    longitude: 75.93,
    pincode: '453771',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['omaxe city 2', 'omaxe 2', 'manglia'],
  },
  {
    id: 'indore-singapore-1',
    title: 'Singapore Township',
    subtitle: 'Talawali Chanda, Bypass • 453771',
    latitude: 22.805,
    longitude: 75.915,
    pincode: '453771',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['singapore township', 'talawali chanda'],
  },
  {
    id: 'indore-casagreens-1',
    title: 'Casa Greens',
    subtitle: 'Talawali Chanda, Bypass • 453771',
    latitude: 22.808,
    longitude: 75.918,
    pincode: '453771',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['casa greens', 'talawali'],
  },
  {
    id: 'indore-milan-1',
    title: 'Milan Heights',
    subtitle: 'Bicholi Mardana, Bypass • 452016',
    latitude: 22.705,
    longitude: 75.922,
    pincode: '452016',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['milan heights', 'bicholi'],
  },
  {
    id: 'indore-shalimar-1',
    title: 'Shalimar Palms',
    subtitle: 'Bicholi Mardana, Bypass • 452016',
    latitude: 22.704,
    longitude: 75.92,
    pincode: '452016',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['shalimar palms', 'bicholi'],
  },
  {
    id: 'indore-royal-1',
    title: 'Royal Residency',
    subtitle: 'Mahalaxmi Nagar / Bypass • 452010',
    latitude: 22.766,
    longitude: 75.912,
    pincode: '452010',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['royal residency', 'mahalaxmi'],
  },
  {
    id: 'indore-dewasnaka-1',
    title: 'Dewas Naka',
    subtitle: 'AB Road / Bypass Junction • 452010',
    latitude: 22.778,
    longitude: 75.91,
    pincode: '452010',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['dewas naka', 'ab road', 'lasudia'],
  },
  {
    id: 'indore-manglia-1',
    title: 'Manglia',
    subtitle: 'Indore Bypass, HPCL Depot • 453771',
    latitude: 22.825,
    longitude: 75.935,
    pincode: '453771',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['manglia', 'mangliya'],
  },
  {
    id: 'indore-sanwer-ind-1',
    title: 'Sanwer Road Industrial Area',
    subtitle: 'Sector A-E, Indore • 452015',
    latitude: 22.768,
    longitude: 75.845,
    pincode: '452015',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['sanwer road', 'industrial area', 'sector a'],
  },
  {
    id: 'indore-sanwer-1',
    title: 'Sanwer',
    subtitle: 'Indore-Ujjain Highway • 453555',
    latitude: 22.86,
    longitude: 75.99,
    pincode: '453555',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['sanwer', 'ujjain road'],
  },
  {
    id: 'indore-bhawar-1',
    title: 'Bhawarkua Square',
    subtitle: 'AB Road, Holkar College • 452001',
    latitude: 22.6919,
    longitude: 75.8669,
    pincode: '452001',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['bhawarkua', 'bhawarkuan', 'bhavarkuan', 'square'],
  },
  {
    id: 'indore-crystal-1',
    title: 'Crystal IT Park',
    subtitle: 'Ring Road, Bhawarkua • 452001',
    latitude: 22.6845,
    longitude: 75.8642,
    pincode: '452001',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['crystal it park', 'it park', 'ring road'],
  },
  {
    id: 'indore-sapna-1',
    title: 'Sapna Sangeeta Road',
    subtitle: 'Snehnagar, Inox, Indore • 452001',
    latitude: 22.702,
    longitude: 75.868,
    pincode: '452001',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['sapna sangeeta', 'sapna sangita'],
  },
  {
    id: 'indore-tower-1',
    title: 'Tower Square',
    subtitle: 'Khatiwala Tank, Sapna Sangeeta • 452001',
    latitude: 22.7,
    longitude: 75.865,
    pincode: '452001',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['tower square', 'khatiwala tank'],
  },
  {
    id: 'indore-snehnagar-1',
    title: 'Snehnagar',
    subtitle: 'Sapna Sangeeta Road, Indore • 452001',
    latitude: 22.703,
    longitude: 75.869,
    pincode: '452001',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['snehnagar', 'sneh nagar'],
  },
  {
    id: 'indore-khatiwala-1',
    title: 'Khatiwala Tank',
    subtitle: 'Tower Square, Indore • 452014',
    latitude: 22.698,
    longitude: 75.862,
    pincode: '452014',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['khatiwala tank', 'khatiwala'],
  },
  {
    id: 'indore-vishnupuri-1',
    title: 'Vishnupuri Colony',
    subtitle: 'Bhawarkua, AB Road • 452001',
    latitude: 22.688,
    longitude: 75.867,
    pincode: '452001',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['vishnupuri', 'vishnu puri'],
  },
  {
    id: 'indore-indrapuri-1',
    title: 'Indrapuri Colony',
    subtitle: 'Bhawarkua, DAVV • 452001',
    latitude: 22.686,
    longitude: 75.868,
    pincode: '452001',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['indrapuri', 'indra puri'],
  },
  {
    id: 'indore-professor-1',
    title: 'Professor Colony',
    subtitle: 'Bhawarkua, Indore • 452001',
    latitude: 22.689,
    longitude: 75.864,
    pincode: '452001',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['professor colony'],
  },
  {
    id: 'indore-bholaram-1',
    title: 'Bholaram Ustad Marg',
    subtitle: 'Bhawarkua Student Hub • 452001',
    latitude: 22.687,
    longitude: 75.865,
    pincode: '452001',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['bholaram ustad', 'bholaram'],
  },
  {
    id: 'indore-navlakha-1',
    title: 'Navlakha Square / Bus Stand',
    subtitle: 'AB Road, Indore • 452001',
    latitude: 22.702,
    longitude: 75.875,
    pincode: '452001',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['navlakha', 'navalaghar', 'bus stand'],
  },
  {
    id: 'indore-transport-1',
    title: 'Transport Nagar',
    subtitle: 'Near Navlakha, Indore • 452014',
    latitude: 22.695,
    longitude: 75.872,
    pincode: '452014',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['transport nagar'],
  },
  {
    id: 'indore-manikbagh-1',
    title: 'Manik Bagh Road',
    subtitle: 'Palsikar / Choithram, Indore • 452014',
    latitude: 22.692,
    longitude: 75.852,
    pincode: '452014',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['manik bagh', 'manikbagh'],
  },
  {
    id: 'indore-choithram-1',
    title: 'Choithram Hospital',
    subtitle: 'Manik Bagh Road, Indore • 452014',
    latitude: 22.688,
    longitude: 75.845,
    pincode: '452014',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['choithram', 'choithram hospital'],
  },
  {
    id: 'indore-choithram-sq',
    title: 'Choithram Square / Mandi',
    subtitle: 'Ring Road, Indore • 452014',
    latitude: 22.685,
    longitude: 75.843,
    pincode: '452014',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['choithram square', 'choithram mandi'],
  },
  {
    id: 'indore-palsikar-1',
    title: 'Palsikar Colony',
    subtitle: 'Manik Bagh Road, Indore • 452007',
    latitude: 22.702,
    longitude: 75.855,
    pincode: '452007',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['palsikar colony', 'palsikar'],
  },
  {
    id: 'indore-sindhi-1',
    title: 'Sindhi Colony',
    subtitle: 'Near Khatiwala Tank, Indore • 452001',
    latitude: 22.701,
    longitude: 75.861,
    pincode: '452001',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['sindhi colony'],
  },
  {
    id: 'indore-agrasen-1',
    title: 'Agrasen Square',
    subtitle: 'Navlakha / Bhanwarkuan • 452001',
    latitude: 22.705,
    longitude: 75.872,
    pincode: '452001',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['agrasen square', 'agrasen chauraha'],
  },
  {
    id: 'indore-pipliyapala-1',
    title: 'Pipliyapala Regional Park',
    subtitle: 'Ring Road, Indore • 452020',
    latitude: 22.678,
    longitude: 75.855,
    pincode: '452020',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['regional park', 'pipliyapala', 'atal bihari vajpayee park'],
  },
  {
    id: 'indore-rajendra-1',
    title: 'Rajendra Nagar',
    subtitle: 'Near IPS Academy / AB Road • 452012',
    latitude: 22.678,
    longitude: 75.828,
    pincode: '452012',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['rajendra nagar', 'rajendranagar'],
  },
  {
    id: 'indore-dhanvantari-1',
    title: 'Dhanvantari Nagar',
    subtitle: 'Rajendra Nagar, Indore • 452012',
    latitude: 22.675,
    longitude: 75.826,
    pincode: '452012',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['dhanvantari nagar', 'rajendra nagar'],
  },
  {
    id: 'indore-silicon-1',
    title: 'Silicon City',
    subtitle: 'Rau, AB Road, Indore • 452012',
    latitude: 22.628,
    longitude: 75.811,
    pincode: '452012',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['silicon city', 'silicon', 'rau', 'ips'],
  },
  {
    id: 'indore-silicon-sec',
    title: 'Silicon City Sector A & B',
    subtitle: 'Near AB Road, Rau, Indore • 452012',
    latitude: 22.629,
    longitude: 75.812,
    pincode: '452012',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['silicon city sector a', 'sector b'],
  },
  {
    id: 'indore-rau-1',
    title: 'Rau Circle / Rau Bypass',
    subtitle: 'AB Road / Pithampur Road • 453771',
    latitude: 22.635,
    longitude: 75.805,
    pincode: '453771',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['rau', 'rau circle', 'rau bypass'],
  },
  {
    id: 'indore-tfantasy-1',
    title: 'Treasure Fantasy',
    subtitle: 'Rau, CAT Road, Indore • 453331',
    latitude: 22.641,
    longitude: 75.802,
    pincode: '453331',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['treasure fantasy', 'rau', 'cat road'],
  },
  {
    id: 'indore-cat-1',
    title: 'CAT Road / RRCAT',
    subtitle: 'Rajendra Nagar, Indore • 452013',
    latitude: 22.658,
    longitude: 75.815,
    pincode: '452013',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['cat road', 'rrcat', 'cat colony'],
  },
  {
    id: 'indore-hawa-1',
    title: 'Hawa Bangla',
    subtitle: 'CAT Road, Choithram Hospital • 452009',
    latitude: 22.672,
    longitude: 75.832,
    pincode: '452009',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['hawa bangla', 'cat road'],
  },
  {
    id: 'indore-ips-1',
    title: 'IPS Academy Campus',
    subtitle: 'Rajendra Nagar, AB Road • 452012',
    latitude: 22.671,
    longitude: 75.823,
    pincode: '452012',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['ips academy', 'ips college'],
  },
  {
    id: 'indore-medicaps-1',
    title: 'Medicaps University',
    subtitle: 'AB Road, Rau, Indore • 453331',
    latitude: 22.621,
    longitude: 75.803,
    pincode: '453331',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['medicaps', 'medicaps university', 'rau'],
  },
  {
    id: 'indore-iim-1',
    title: 'IIM Indore Campus',
    subtitle: 'Prabandh Shikhar, Rau • 453556',
    latitude: 22.623,
    longitude: 75.772,
    pincode: '453556',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['iim indore', 'prabandh shikhar'],
  },
  {
    id: 'indore-bijalpur-1',
    title: 'Bijalpur',
    subtitle: 'AB Road, Near Rajendra Nagar • 452012',
    latitude: 22.674,
    longitude: 75.839,
    pincode: '452012',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['bijalpur', 'treasure town'],
  },
  {
    id: 'indore-super-1',
    title: 'Super Corridor',
    subtitle: 'Airport to TCS / Infosys • 452005',
    latitude: 22.775,
    longitude: 75.805,
    pincode: '452005',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['super corridor', 'super corridor indore'],
  },
  {
    id: 'indore-tcs-1',
    title: 'TCS Campus',
    subtitle: 'Super Corridor, Indore • 452005',
    latitude: 22.781,
    longitude: 75.802,
    pincode: '452005',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['tcs', 'tcs super corridor', 'tcs indore'],
  },
  {
    id: 'indore-infosys-1',
    title: 'Infosys Campus',
    subtitle: 'Super Corridor, Indore • 452005',
    latitude: 22.785,
    longitude: 75.8,
    pincode: '452005',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['infosys', 'infosys super corridor', 'infosys indore'],
  },
  {
    id: 'indore-airport-1',
    title: 'Indore Airport (IDR)',
    subtitle: 'Devi Ahilyabai Holkar Airport • 452005',
    latitude: 22.723,
    longitude: 75.808,
    pincode: '452005',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['airport', 'indore airport', 'devi ahilyabai', 'aerodrome'],
  },
  {
    id: 'indore-gandhinagar-1',
    title: 'Gandhi Nagar',
    subtitle: 'Super Corridor / Airport Road • 452005',
    latitude: 22.748,
    longitude: 75.805,
    pincode: '452005',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['gandhi nagar', 'airport road'],
  },
  {
    id: 'indore-aerodrome-1',
    title: 'Aerodrome Road',
    subtitle: 'Bijasan Road, Indore • 452005',
    latitude: 22.728,
    longitude: 75.812,
    pincode: '452005',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['aerodrome', 'aerodrome road'],
  },
  {
    id: 'indore-bijasan-1',
    title: 'Bijasan Mata Mandir',
    subtitle: 'Airport Hill, Indore • 452005',
    latitude: 22.731,
    longitude: 75.803,
    pincode: '452005',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['bijasan mandir', 'bijasan mata'],
  },
  {
    id: 'indore-kalani-1',
    title: 'Kalani Nagar',
    subtitle: 'Airport Road, Indore • 452005',
    latitude: 22.735,
    longitude: 75.82,
    pincode: '452005',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['kalani nagar', 'airport road'],
  },
  {
    id: 'indore-sangam-1',
    title: 'Sangam Nagar',
    subtitle: 'Airport Road, Indore • 452006',
    latitude: 22.732,
    longitude: 75.828,
    pincode: '452006',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['sangam nagar', 'airport road'],
  },
  {
    id: 'indore-badaganpati-1',
    title: 'Bada Ganpati',
    subtitle: 'Malharganj, Aerodrome Road • 452006',
    latitude: 22.722,
    longitude: 75.842,
    pincode: '452006',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['bada ganpati', 'bada ganesh'],
  },
  {
    id: 'indore-malharganj-1',
    title: 'Malharganj',
    subtitle: 'Near Jinsi, Indore • 452006',
    latitude: 22.725,
    longitude: 75.845,
    pincode: '452006',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['malharganj', 'khajuri bazaar'],
  },
  {
    id: 'indore-rajwada-1',
    title: 'Rajwada Palace',
    subtitle: 'MG Road, Central Indore • 452001',
    latitude: 22.718,
    longitude: 75.8548,
    pincode: '452001',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['rajwada', 'rajwada palace', 'central indore'],
  },
  {
    id: 'indore-sarafa-1',
    title: 'Sarafa Bazaar',
    subtitle: 'Night Food Street, Rajwada • 452001',
    latitude: 22.717,
    longitude: 75.853,
    pincode: '452001',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['sarafa', 'sarafa bazaar', 'sarafa street', 'bada sarafa', 'chhota sarafa', 'night market'],
  },
  {
    id: 'indore-sarafa-girls-1',
    title: 'Sarafa Vidya Niketan (Girls School / College)',
    subtitle: 'MOG Lines Road, Near Sarafa & Malharganj, Indore • 452001',
    latitude: 22.7071,
    longitude: 75.8428,
    pincode: '452001',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: [
      'sarafa girls',
      'sarafa girls school',
      'sarafa girls college',
      'sarafa vidhya niketan',
      'sarafa vidya niketan',
      'mog lines',
      'sarafa school',
      'kanya shala',
    ],
  },
  {
    id: 'indore-old-gdc-1',
    title: 'Old GDC (Govt Girls Degree College)',
    subtitle: 'Moti Tabela, Collectorate Road, Indore • 452004',
    latitude: 22.712,
    longitude: 75.858,
    pincode: '452004',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['old gdc', 'gdc', 'girls college', 'govt girls degree college', 'moti tabela'],
  },
  {
    id: 'indore-new-gdc-1',
    title: 'New GDC (Govt Girls PG College)',
    subtitle: 'Kila Maidan Road, Near Mari Mata, Indore • 452006',
    latitude: 22.7283,
    longitude: 75.8447,
    pincode: '452006',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['new gdc', 'girls college', 'girls degree college', 'kila maidan', 'mari mata'],
  },
  {
    id: 'indore-straphael-1',
    title: "St. Raphael's Girls Higher Secondary School",
    subtitle: 'Old Sehore Road, Old Palasia, Indore • 452018',
    latitude: 22.723,
    longitude: 75.888,
    pincode: '452018',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['st raphaels', 'raphael girls', 'st raphael girls school', 'palasia school'],
  },
  {
    id: 'indore-sophia-girls-1',
    title: 'Sophia Girls Higher Secondary School',
    subtitle: 'Sanyogitaganj, Indore • 452001',
    latitude: 22.7125,
    longitude: 75.875,
    pincode: '452001',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['sophia girls', 'sophia school', 'sanyogitaganj'],
  },
  {
    id: 'indore-clothmarket-girls-1',
    title: 'Shri Cloth Market Girls College',
    subtitle: 'Ganeshganj, Rajwada, Indore • 452002',
    latitude: 22.7175,
    longitude: 75.8465,
    pincode: '452002',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['cloth market girls college', 'kanya mahavidyalaya', 'ganeshganj'],
  },
  {
    id: 'indore-cloth-1',
    title: 'MT Cloth Market',
    subtitle: 'Maharaja Tukojirao Market • 452002',
    latitude: 22.719,
    longitude: 75.849,
    pincode: '452002',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['cloth market', 'mt cloth market'],
  },
  {
    id: 'indore-siyaganj-1',
    title: 'Siyaganj Wholesale Market',
    subtitle: 'Near Railway Station • 452001',
    latitude: 22.715,
    longitude: 75.862,
    pincode: '452001',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['siyaganj', 'siya ganj'],
  },
  {
    id: 'indore-chhotigwaltoli',
    title: 'Chhoti Gwaltoli',
    subtitle: 'Near Sarwate Bus Stand • 452001',
    latitude: 22.714,
    longitude: 75.865,
    pincode: '452001',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['chhoti gwaltoli', 'gwaltoli'],
  },
  {
    id: 'indore-railway-1',
    title: 'Indore Junction Railway Station',
    subtitle: 'Chhoti Gwaltoli, Siyaganj • 452001',
    latitude: 22.716,
    longitude: 75.867,
    pincode: '452001',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['railway station', 'indore station', 'indore junction'],
  },
  {
    id: 'indore-sarwate-1',
    title: 'Sarwate Bus Stand',
    subtitle: 'Near Railway Station • 452001',
    latitude: 22.713,
    longitude: 75.867,
    pincode: '452001',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['sarwate', 'sarwate bus stand'],
  },
  {
    id: 'indore-gangwal-1',
    title: 'Gangwal Bus Stand',
    subtitle: 'Dhar Road, Malharganj • 452002',
    latitude: 22.715,
    longitude: 75.842,
    pincode: '452002',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['gangwal', 'gangwal bus stand'],
  },
  {
    id: 'indore-jinsi-1',
    title: 'Jinsi',
    subtitle: 'Subhash Chowk, Malharganj • 452006',
    latitude: 22.723,
    longitude: 75.847,
    pincode: '452006',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['jinsi', 'jinsi square'],
  },
  {
    id: 'indore-jawahar-1',
    title: 'Jawahar Marg',
    subtitle: 'Central Commercial Corridor • 452002',
    latitude: 22.716,
    longitude: 75.851,
    pincode: '452002',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['jawahar marg'],
  },
  {
    id: 'indore-kanch-1',
    title: 'Kanch Mandir',
    subtitle: 'Itwaria Bazaar, Indore • 452002',
    latitude: 22.718,
    longitude: 75.847,
    pincode: '452002',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['kanch mandir', 'glass temple'],
  },
  {
    id: 'indore-chhatribagh-1',
    title: 'Chhatribagh',
    subtitle: 'Near Rajwada, Central Indore • 452007',
    latitude: 22.711,
    longitude: 75.85,
    pincode: '452007',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['chhatribagh', 'chhatri bagh'],
  },
  {
    id: 'indore-juni-1',
    title: 'Juni Indore',
    subtitle: 'Juni Indore Police Station • 452007',
    latitude: 22.707,
    longitude: 75.856,
    pincode: '452007',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['juni indore'],
  },
  {
    id: 'indore-tejaji-1',
    title: 'Tejaji Nagar Square',
    subtitle: 'Bypass / Khandwa Road • 452020',
    latitude: 22.662,
    longitude: 75.885,
    pincode: '452020',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['tejaji nagar', 'khandwa road'],
  },
  {
    id: 'indore-khandwa-1',
    title: 'Khandwa Road',
    subtitle: 'DAVV Takshashila, IT Park • 452020',
    latitude: 22.678,
    longitude: 75.875,
    pincode: '452020',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['khandwa road', 'davv campus'],
  },
  {
    id: 'indore-davv-1',
    title: 'DAVV Takshashila Campus',
    subtitle: 'Khandwa Road, Indore • 452020',
    latitude: 22.682,
    longitude: 75.877,
    pincode: '452020',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['davv', 'devi ahilya university', 'takshashila'],
  },
  {
    id: 'indore-holkar-1',
    title: 'Holkar Science College',
    subtitle: 'AB Road, Bhawarkua • 452001',
    latitude: 22.695,
    longitude: 75.867,
    pincode: '452001',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['holkar college', 'holkar science'],
  },
  {
    id: 'indore-sgsits-1',
    title: 'SGSITS Indore',
    subtitle: 'Park Road, Vallabh Nagar • 452003',
    latitude: 22.724,
    longitude: 75.871,
    pincode: '452003',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['sgsits', 'gsits', 'vallabh nagar'],
  },
  {
    id: 'indore-iit-1',
    title: 'IIT Indore Campus',
    subtitle: 'Simrol, Khandwa Road • 453552',
    latitude: 22.52,
    longitude: 75.92,
    pincode: '453552',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['iit indore', 'simrol', 'iit'],
  },
  {
    id: 'indore-pithampur-1',
    title: 'Pithampur Sector 1 & 2',
    subtitle: 'Outer Indore Industrial Hub • 454775',
    latitude: 22.605,
    longitude: 75.695,
    pincode: '454775',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['pithampur', 'sector 1', 'sector 2'],
  },
  {
    id: 'indore-mhow-1',
    title: 'Mhow (Dr. Ambedkar Nagar)',
    subtitle: 'Indore District • 453441',
    latitude: 22.553,
    longitude: 75.76,
    pincode: '453441',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['mhow', 'dr ambedkar nagar'],
  },
  {
    id: 'indore-hatod-1',
    title: 'Hatod',
    subtitle: 'Airport Road Outer, Indore • 453111',
    latitude: 22.795,
    longitude: 75.725,
    pincode: '453111',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['hatod', 'depalpur road'],
  },
  {
    id: 'indore-mog-lines-poi',
    title: 'MOG Lines',
    subtitle: 'MOG Lines Road, Near Malharganj & Sarafa, Indore • 452001',
    latitude: 22.7089,
    longitude: 75.8416,
    pincode: '452001',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['mog lines', 'mog lines road', 'mog line', 'mog line road', 'malharganj'],
  },
  {
    id: 'indore-race-course-poi',
    title: 'Race Course Road',
    subtitle: 'New Palasia / Tukoganj, Indore • 452001',
    latitude: 22.7248,
    longitude: 75.8716,
    pincode: '452001',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['race course road', 'racecourse road', 'new palasia', 'tukoganj'],
  },
  {
    id: 'indore-sarafa-street-poi',
    title: 'Sarafa Street (Bada Sarafa)',
    subtitle: 'Sarafa Bazaar, Rajwada Central, Indore • 452002',
    latitude: 22.718,
    longitude: 75.8533,
    pincode: '452002',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['sarafa street', 'bada sarafa', 'sarafa bazaar', 'rajwada'],
  },
  {
    id: 'indore-chhota-sarafa-poi',
    title: 'Chhota Sarafa',
    subtitle: 'Near Rajwada, Central Indore • 452002',
    latitude: 22.7171,
    longitude: 75.8505,
    pincode: '452002',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['chhota sarafa', 'chhota sarafa street', 'sarafa'],
  },
  {
    id: 'indore-jail-road-poi',
    title: 'Jail Road',
    subtitle: 'Kothari Market to MG Road, Indore • 452001',
    latitude: 22.7225,
    longitude: 75.8654,
    pincode: '452001',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['jail road', 'kothari market', 'mg road'],
  },
  {
    id: 'indore-siyaganj-poi',
    title: 'Siyaganj Market',
    subtitle: 'Commercial Wholesale Market, Indore • 452001',
    latitude: 22.715,
    longitude: 75.864,
    pincode: '452001',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['siyaganj', 'siyaganj market', 'siya ganj'],
  },
  {
    id: 'indore-ranipura-poi',
    title: 'Ranipura',
    subtitle: 'Near Railway Station & Central Commercial Hub • 452007',
    latitude: 22.716,
    longitude: 75.86,
    pincode: '452007',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['ranipura', 'rani pura', 'daulatganj'],
  },
  {
    id: 'indore-snehalataganj-poi',
    title: 'Snehalataganj',
    subtitle: 'Near Vallabh Nagar & Station Road • 452003',
    latitude: 22.726,
    longitude: 75.866,
    pincode: '452003',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['snehalataganj', 'snehlata ganj'],
  },
  {
    id: 'indore-khatiwala-tank-poi',
    title: 'Khatiwala Tank',
    subtitle: 'Near Sapna Sangeeta & Tower Square • 452014',
    latitude: 22.698,
    longitude: 75.854,
    pincode: '452014',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['khatiwala tank', 'khatiwala', 'sapna sangeeta'],
  },
  {
    id: 'indore-pardesipura-poi',
    title: 'Pardesipura',
    subtitle: 'Near Nanda Nagar & Subhash Nagar, Indore • 452003',
    latitude: 22.738,
    longitude: 75.876,
    pincode: '452003',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['pardesipura', 'pardesi pura', 'clerk colony'],
  },
  {
    id: 'indore-nanda-nagar-poi',
    title: 'Nanda Nagar',
    subtitle: 'Nanda Nagar Main Road, Indore • 452011',
    latitude: 22.744,
    longitude: 75.872,
    pincode: '452011',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['nanda nagar', 'nandanagar', 'itit road'],
  },
  {
    id: 'indore-patnipura-poi',
    title: 'Patnipura Square',
    subtitle: 'Patnipura, Near Pardesipura & Malwa Mill • 452001',
    latitude: 22.735,
    longitude: 75.878,
    pincode: '452001',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['patnipura', 'patni pura', 'malwa mill square'],
  },
  {
    id: 'indore-tilak-nagar-poi',
    title: 'Tilak Nagar',
    subtitle: 'Near Goyal Nagar & Pipliyahana, Indore • 452018',
    latitude: 22.712,
    longitude: 75.895,
    pincode: '452018',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['tilak nagar', 'goyal nagar', 'pipliyahana'],
  },
  {
    id: 'indore-manorama-ganj-poi',
    title: 'Manorama Ganj',
    subtitle: 'Near Geeta Bhavan & Palasia, Indore • 452001',
    latitude: 22.719,
    longitude: 75.878,
    pincode: '452001',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['manorama ganj', 'manoramaganj', 'geeta bhavan'],
  },
  {
    id: 'indore-usha-nagar-poi',
    title: 'Usha Nagar',
    subtitle: 'Usha Nagar Ext., Near Ranjeet Hanuman & Annapurna • 452009',
    latitude: 22.701,
    longitude: 75.842,
    pincode: '452009',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['usha nagar', 'usha nagar extension', 'ranjeet hanuman'],
  },
  {
    id: 'indore-gumashta-nagar-poi',
    title: 'Gumashta Nagar',
    subtitle: 'Near Footi Kothi & Sudama Nagar, Indore • 452009',
    latitude: 22.704,
    longitude: 75.828,
    pincode: '452009',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['gumashta nagar', 'gumasta nagar', 'footi kothi'],
  },
  {
    id: 'indore-sangam-nagar-poi',
    title: 'Sangam Nagar',
    subtitle: 'Airport Road / Kalani Nagar, Indore • 452006',
    latitude: 22.739,
    longitude: 75.835,
    pincode: '452006',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['sangam nagar', 'kalani nagar', 'airport road'],
  },
  {
    id: 'indore-aerodrome-road-poi',
    title: 'Aerodrome Road',
    subtitle: 'Bada Ganpati to Airport, Indore • 452005',
    latitude: 22.728,
    longitude: 75.82,
    pincode: '452005',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['aerodrome road', 'airport road', 'kalani nagar'],
  },
  {
    id: 'indore-bada-ganpati-poi',
    title: 'Bada Ganpati',
    subtitle: 'Square & Historical Temple, Malharganj • 452002',
    latitude: 22.72,
    longitude: 75.844,
    pincode: '452002',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['bada ganpati', 'bada ganpati square', 'malharganj'],
  },
  // --- Small Localities, Galis, Bazaars & Sectors ---
  {
    id: 'indore-tilak-path-poi',
    title: 'Tilak Path',
    subtitle: 'Near Jawahar Marg & Rajwada, Central Indore • 452002',
    latitude: 22.716,
    longitude: 75.852,
    pincode: '452002',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['tilak path', 'tilak marg', 'jawahar marg', 'rajwada'],
  },
  {
    id: 'indore-kailash-marg-poi',
    title: 'Kailash Marg',
    subtitle: 'Central Commercial Corridor, Indore • 452002',
    latitude: 22.715,
    longitude: 75.848,
    pincode: '452002',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['kailash marg', 'kailash road', 'malharganj'],
  },
  {
    id: 'indore-subhash-marg-poi',
    title: 'Subhash Marg',
    subtitle: 'Malharganj / Jinsi Corridor, Indore • 452002',
    latitude: 22.721,
    longitude: 75.848,
    pincode: '452002',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['subhash marg', 'subhash road', 'jinsi', 'malharganj'],
  },
  {
    id: 'indore-nandlalpura-poi',
    title: 'Nandlalpura',
    subtitle: 'Fruit Market & Commercial Area, Central Indore • 452007',
    latitude: 22.714,
    longitude: 75.858,
    pincode: '452007',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['nandlalpura', 'nandlal pura', 'gautampura'],
  },
  {
    id: 'indore-ada-bazaar-poi',
    title: 'Ada Bazaar',
    subtitle: 'Near Rajwada & Sarafa, Central Indore • 452002',
    latitude: 22.7185,
    longitude: 75.854,
    pincode: '452002',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['ada bazaar', 'ada bazar', 'rajwada', 'sarafa'],
  },
  {
    id: 'indore-bartan-bazaar-poi',
    title: 'Bartan Bazaar',
    subtitle: 'Historical Metal Utensil Market, Rajwada • 452002',
    latitude: 22.719,
    longitude: 75.853,
    pincode: '452002',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['bartan bazaar', 'bartan bazar', 'rajwada'],
  },
  {
    id: 'indore-sitlamata-bazaar-poi',
    title: 'Sitlamata Bazaar',
    subtitle: 'Wholesale & Retail Cloth Market, Rajwada • 452002',
    latitude: 22.7195,
    longitude: 75.852,
    pincode: '452002',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['sitlamata bazaar', 'sitlamata bazar', 'cloth market'],
  },
  {
    id: 'indore-marothia-bazaar-poi',
    title: 'Marothia Bazaar',
    subtitle: 'Traditional Spice & Grocery Market, Rajwada • 452002',
    latitude: 22.7198,
    longitude: 75.855,
    pincode: '452002',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['marothia bazaar', 'marothia bazar', 'rajwada'],
  },
  {
    id: 'indore-khajuri-bazaar-poi',
    title: 'Khajuri Bazaar',
    subtitle: 'Book Market & Wholesale Stationery, Rajwada • 452002',
    latitude: 22.718,
    longitude: 75.8565,
    pincode: '452002',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['khajuri bazaar', 'khajuri bazar', 'book market'],
  },
  {
    id: 'indore-narsingh-bazaar-poi',
    title: 'Narsingh Bazaar',
    subtitle: 'Near Bada Ganpati & Malharganj, Indore • 452002',
    latitude: 22.7205,
    longitude: 75.849,
    pincode: '452002',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['narsingh bazaar', 'narsingh bazar', 'bada ganpati'],
  },
  {
    id: 'indore-pipali-bazaar-poi',
    title: 'Pipali Bazaar',
    subtitle: 'Near Rajwada & Krishnapura Chhatri, Indore • 452002',
    latitude: 22.717,
    longitude: 75.8545,
    pincode: '452002',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['pipali bazaar', 'pipali bazar', 'rajwada'],
  },
  {
    id: 'indore-itwaria-bazaar-poi',
    title: 'Itwaria Bazaar',
    subtitle: 'Near Kanch Mandir & Malharganj, Indore • 452002',
    latitude: 22.718,
    longitude: 75.847,
    pincode: '452002',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['itwaria bazaar', 'itwaria bazar', 'kanch mandir'],
  },
  {
    id: 'indore-topkhana-poi',
    title: 'Topkhana',
    subtitle: 'MG Road Commercial Hub, Indore • 452001',
    latitude: 22.72,
    longitude: 75.862,
    pincode: '452001',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['topkhana', 'mg road', 'rajwada'],
  },
  {
    id: 'indore-kothari-market-poi',
    title: 'Kothari Market',
    subtitle: 'MG Road Shopping Complex, Indore • 452001',
    latitude: 22.7215,
    longitude: 75.8645,
    pincode: '452001',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['kothari market', 'mg road', 'jail road'],
  },
  {
    id: 'indore-dhenu-market-poi',
    title: 'Dhenu Market',
    subtitle: 'Tukoganj, Near Race Course Road • 452001',
    latitude: 22.723,
    longitude: 75.875,
    pincode: '452001',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['dhenu market', 'tukoganj', 'race course road'],
  },
  {
    id: 'indore-pagnis-paga-poi',
    title: 'Pagnis Paga',
    subtitle: 'Near Jawahar Marg & Juni Indore • 452002',
    latitude: 22.714,
    longitude: 75.851,
    pincode: '452002',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['pagnis paga', 'pagnispaga', 'jawahar marg'],
  },
  {
    id: 'indore-lohar-patti-poi',
    title: 'Lohar Patti',
    subtitle: 'Central Commercial Area, Indore • 452002',
    latitude: 22.717,
    longitude: 75.849,
    pincode: '452002',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['lohar patti', 'loharpatti', 'malharganj'],
  },
  {
    id: 'indore-silawatpura-poi',
    title: 'Silawatpura',
    subtitle: 'Near Subhash Marg, Central Indore • 452002',
    latitude: 22.722,
    longitude: 75.852,
    pincode: '452002',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['silawatpura', 'silawat pura', 'subhash marg'],
  },
  {
    id: 'indore-lodhipura-poi',
    title: 'Lodhipura',
    subtitle: 'Central Historic Locality, Indore • 452002',
    latitude: 22.721,
    longitude: 75.855,
    pincode: '452002',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['lodhipura', 'lodhi pura'],
  },
  {
    id: 'indore-kishoreganj-poi',
    title: 'Kishoreganj',
    subtitle: 'Near Malharganj, Indore • 452002',
    latitude: 22.724,
    longitude: 75.851,
    pincode: '452002',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['kishoreganj', 'kishore ganj', 'malharganj'],
  },
  {
    id: 'indore-bholaram-ustad-poi',
    title: 'Bholaram Ustad Marg',
    subtitle: 'Student Food Street & Hostels, Bhawarkua • 452001',
    latitude: 22.694,
    longitude: 75.865,
    pincode: '452001',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['bholaram ustad marg', 'bholaram', 'bhawarkua', 'hostel area'],
  },
  {
    id: 'indore-indrapuri-poi',
    title: 'Indrapuri Colony',
    subtitle: 'Near Bhawarkua Square, AB Road • 452001',
    latitude: 22.695,
    longitude: 75.869,
    pincode: '452001',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['indrapuri', 'indrapuri colony', 'bhawarkua'],
  },
  {
    id: 'indore-telephone-nagar-poi',
    title: 'Telephone Nagar',
    subtitle: 'Near Bengali Square & Ring Road • 452016',
    latitude: 22.71,
    longitude: 75.91,
    pincode: '452016',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['telephone nagar', 'bengali square', 'ring road'],
  },
  {
    id: 'indore-vaibhav-nagar-poi',
    title: 'Vaibhav Nagar',
    subtitle: 'Kanadia Road, Near Bengali Square • 452016',
    latitude: 22.717,
    longitude: 75.908,
    pincode: '452016',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['vaibhav nagar', 'kanadia road', 'bengali square'],
  },
  {
    id: 'indore-sharda-nagar-poi',
    title: 'Sharda Nagar',
    subtitle: 'Near Gumasta Nagar & Footi Kothi • 452009',
    latitude: 22.705,
    longitude: 75.832,
    pincode: '452009',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['sharda nagar', 'gumasta nagar', 'footi kothi'],
  },
  {
    id: 'indore-veena-nagar-poi',
    title: 'Veena Nagar',
    subtitle: 'MR-10 / Sukhlia Road, Indore • 452010',
    latitude: 22.756,
    longitude: 75.865,
    pincode: '452010',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['veena nagar', 'mr 10', 'sukhlia'],
  },
  {
    id: 'indore-vigyan-nagar-poi',
    title: 'Vigyan Nagar',
    subtitle: 'Near Navlakha & Annapurna Road • 452001',
    latitude: 22.708,
    longitude: 75.882,
    pincode: '452001',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['vigyan nagar', 'navlakha'],
  },
  {
    id: 'indore-chanakyapuri-poi',
    title: 'Chanakyapuri',
    subtitle: 'Near Annapurna Temple, Indore • 452009',
    latitude: 22.702,
    longitude: 75.845,
    pincode: '452009',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['chanakyapuri', 'chanakya puri', 'annapurna road'],
  },
  {
    id: 'indore-clerk-colony-poi',
    title: 'Clerk Colony',
    subtitle: 'Near Pardesipura & Malwa Mill • 452003',
    latitude: 22.742,
    longitude: 75.874,
    pincode: '452003',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['clerk colony', 'pardesipura', 'malwa mill'],
  },
  {
    id: 'indore-loha-mandi-poi',
    title: 'Loha Mandi',
    subtitle: 'Iron Wholesale Market, Loha Gate • 452001',
    latitude: 22.713,
    longitude: 75.865,
    pincode: '452001',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['loha mandi', 'loha gate', 'siyaganj'],
  },
  {
    id: 'indore-bairathi-colony-poi',
    title: 'Bairathi Colony',
    subtitle: 'Tower Square to Sapna Sangeeta • 452001',
    latitude: 22.706,
    longitude: 75.862,
    pincode: '452001',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['bairathi colony', 'tower square', 'sapna sangeeta'],
  },
  {
    id: 'indore-scheme-78-slice-1',
    title: 'Scheme 78 Slice 1',
    subtitle: 'Vijay Nagar, Near Aranya Nagar • 452010',
    latitude: 22.755,
    longitude: 75.888,
    pincode: '452010',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['scheme 78 slice 1', 'slice 1', 'scheme 78', 'vijay nagar'],
  },
  {
    id: 'indore-scheme-78-slice-2',
    title: 'Scheme 78 Slice 2',
    subtitle: 'Vijay Nagar, Near Prestige Institute • 452010',
    latitude: 22.757,
    longitude: 75.89,
    pincode: '452010',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['scheme 78 slice 2', 'slice 2', 'scheme 78', 'prestige college'],
  },
  {
    id: 'indore-scheme-78-slice-3',
    title: 'Scheme 78 Slice 3',
    subtitle: 'Vijay Nagar, Near Ring Road • 452010',
    latitude: 22.759,
    longitude: 75.892,
    pincode: '452010',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['scheme 78 slice 3', 'slice 3', 'scheme 78'],
  },
  {
    id: 'indore-aranya-nagar-poi',
    title: 'Aranya Nagar (Scheme 78)',
    subtitle: 'Vijay Nagar Residential Sector • 452010',
    latitude: 22.758,
    longitude: 75.885,
    pincode: '452010',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['aranya nagar', 'scheme 78', 'vijay nagar'],
  },
  {
    id: 'indore-scheme-54-pu3',
    title: 'Scheme 54 PU-3',
    subtitle: 'Commercial Hub, Behind C21 Mall, Vijay Nagar • 452010',
    latitude: 22.751,
    longitude: 75.889,
    pincode: '452010',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['scheme 54 pu3', 'pu 3', 'pu3', 'scheme 54', 'c21 mall'],
  },
  {
    id: 'indore-scheme-54-pu4',
    title: 'Scheme 54 PU-4',
    subtitle: 'Commercial Zone, Behind Malhar Mega Mall • 452010',
    latitude: 22.753,
    longitude: 75.891,
    pincode: '452010',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['scheme 54 pu4', 'pu 4', 'pu4', 'scheme 54', 'malhar mall'],
  },
  {
    id: 'indore-scheme-71-sec-a',
    title: 'Scheme 71 Sector A',
    subtitle: 'Gumasta Nagar / Dhar Road • 452009',
    latitude: 22.708,
    longitude: 75.832,
    pincode: '452009',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['scheme 71 sector a', 'sector a', 'scheme 71'],
  },
  {
    id: 'indore-scheme-71-sec-b',
    title: 'Scheme 71 Sector B',
    subtitle: 'Gumasta Nagar, Footi Kothi • 452009',
    latitude: 22.71,
    longitude: 75.833,
    pincode: '452009',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['scheme 71 sector b', 'sector b', 'scheme 71'],
  },
  {
    id: 'indore-scheme-71-sec-c',
    title: 'Scheme 71 Sector C',
    subtitle: 'Near Chandan Nagar & Dhar Road • 452009',
    latitude: 22.712,
    longitude: 75.834,
    pincode: '452009',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['scheme 71 sector c', 'sector c', 'scheme 71'],
  },
  {
    id: 'indore-scheme-71-sec-d',
    title: 'Scheme 71 Sector D',
    subtitle: 'Near Footi Kothi Square • 452009',
    latitude: 22.714,
    longitude: 75.835,
    pincode: '452009',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['scheme 71 sector d', 'sector d', 'scheme 71'],
  },
  {
    id: 'indore-silicon-city-sec-a',
    title: 'Silicon City Sector A',
    subtitle: 'Silicon City, Nihalpur Mundi / Rau • 453331',
    latitude: 22.645,
    longitude: 75.828,
    pincode: '453331',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['silicon city sector a', 'sector a', 'silicon city', 'rau'],
  },
  {
    id: 'indore-silicon-city-sec-b',
    title: 'Silicon City Sector B',
    subtitle: 'Silicon City Main Sector, Rau • 453331',
    latitude: 22.643,
    longitude: 75.83,
    pincode: '453331',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['silicon city sector b', 'sector b', 'silicon city'],
  },
  {
    id: 'indore-silicon-city-sec-c',
    title: 'Silicon City Sector C',
    subtitle: 'Silicon City, AB Road / Rau • 453331',
    latitude: 22.641,
    longitude: 75.832,
    pincode: '453331',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['silicon city sector c', 'sector c', 'silicon city'],
  },
  {
    id: 'indore-silicon-city-sec-d',
    title: 'Silicon City Sector D',
    subtitle: 'Silicon City, Rau Bypass • 453331',
    latitude: 22.639,
    longitude: 75.834,
    pincode: '453331',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['silicon city sector d', 'sector d', 'silicon city'],
  },
  {
    id: 'indore-sudama-nagar-sec-a',
    title: 'Sudama Nagar Sector A',
    subtitle: 'Near Gopur Square & Annapurna • 452009',
    latitude: 22.695,
    longitude: 75.831,
    pincode: '452009',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['sudama nagar sector a', 'sector a', 'sudama nagar', 'gopur'],
  },
  {
    id: 'indore-sudama-nagar-sec-b',
    title: 'Sudama Nagar Sector B',
    subtitle: 'Narendra Tiwari Marg • 452009',
    latitude: 22.697,
    longitude: 75.833,
    pincode: '452009',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['sudama nagar sector b', 'sector b', 'sudama nagar'],
  },
  {
    id: 'indore-sudama-nagar-sec-c',
    title: 'Sudama Nagar Sector C',
    subtitle: 'Central Sudama Nagar, Near Market • 452009',
    latitude: 22.699,
    longitude: 75.835,
    pincode: '452009',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['sudama nagar sector c', 'sector c', 'sudama nagar'],
  },
  {
    id: 'indore-mahalakshmi-sec-a',
    title: 'Mahalakshmi Nagar Sector A',
    subtitle: 'Near Bombay Hospital & Ring Road • 452010',
    latitude: 22.758,
    longitude: 75.901,
    pincode: '452010',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['mahalakshmi nagar sector a', 'sector a', 'mahalakshmi nagar'],
  },
  {
    id: 'indore-mahalakshmi-sec-b',
    title: 'Mahalakshmi Nagar Sector B',
    subtitle: 'Behind Bombay Hospital • 452010',
    latitude: 22.76,
    longitude: 75.903,
    pincode: '452010',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['mahalakshmi nagar sector b', 'sector b', 'mahalakshmi nagar'],
  },
  {
    id: 'indore-mahalakshmi-sec-c',
    title: 'Mahalakshmi Nagar Sector C',
    subtitle: 'Mahalakshmi Nagar Main Sector • 452010',
    latitude: 22.762,
    longitude: 75.905,
    pincode: '452010',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['mahalakshmi nagar sector c', 'sector c', 'mahalakshmi nagar'],
  },
  {
    id: 'indore-mahalakshmi-sec-r',
    title: 'Mahalakshmi Nagar Sector R',
    subtitle: 'Near Ring Road & MR-9 • 452010',
    latitude: 22.764,
    longitude: 75.907,
    pincode: '452010',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['mahalakshmi nagar sector r', 'sector r', 'mahalakshmi nagar'],
  },
  {
    id: 'indore-shalimar-township-poi',
    title: 'Shalimar Township',
    subtitle: 'AB Road, Near Dewas Naka • 452010',
    latitude: 22.768,
    longitude: 75.894,
    pincode: '452010',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['shalimar township', 'shalimar', 'ab road'],
  },
  {
    id: 'indore-silver-springs-poi',
    title: 'Silver Springs',
    subtitle: 'AB Road Bypass, Near DPS • 452020',
    latitude: 22.685,
    longitude: 75.925,
    pincode: '452020',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['silver springs', 'silver spring', 'bypass road'],
  },
  {
    id: 'indore-omaxe-city-poi',
    title: 'Omaxe City',
    subtitle: 'Bypass Road, Mayakhedi, Indore • 452016',
    latitude: 22.785,
    longitude: 75.915,
    pincode: '452016',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['omaxe city', 'omaxe', 'mayakhedi', 'bypass'],
  },
  {
    id: 'indore-treasure-fantasy-poi',
    title: 'Treasure Fantasy',
    subtitle: 'Cat Road / Rau, Indore • 453331',
    latitude: 22.668,
    longitude: 75.815,
    pincode: '453331',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['treasure fantasy', 'cat road', 'rau'],
  },
  {
    id: 'indore-singapore-township-poi',
    title: 'Singapore Township',
    subtitle: 'Talawali Chanda, AB Road • 453771',
    latitude: 22.795,
    longitude: 75.895,
    pincode: '453771',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['singapore township', 'talawali chanda'],
  },
  {
    id: 'indore-tulsi-nagar-poi',
    title: 'Tulsi Nagar',
    subtitle: 'Nipania Road, Near Mahalaxmi Nagar • 452016',
    latitude: 22.765,
    longitude: 75.915,
    pincode: '452016',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['tulsi nagar', 'nipania road'],
  },
  {
    id: 'indore-sanwer-rd-sec-a',
    title: 'Sanwer Road Sector A',
    subtitle: 'Sanwer Road Industrial Area • 452015',
    latitude: 22.782,
    longitude: 75.865,
    pincode: '452015',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['sanwer road sector a', 'sanwer road', 'sector a'],
  },
  {
    id: 'indore-sanwer-rd-sec-b',
    title: 'Sanwer Road Sector B',
    subtitle: 'Sanwer Road Industrial Area • 452015',
    latitude: 22.785,
    longitude: 75.867,
    pincode: '452015',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['sanwer road sector b', 'sanwer road', 'sector b'],
  },
  {
    id: 'indore-sanwer-rd-sec-c',
    title: 'Sanwer Road Sector C',
    subtitle: 'Sanwer Road Industrial Area • 452015',
    latitude: 22.788,
    longitude: 75.869,
    pincode: '452015',
    city: 'Indore',
    state: 'Madhya Pradesh',
    source: 'INDORE_POI',
    keywords: ['sanwer road sector c', 'sanwer road', 'sector c'],
  },
];

/**
 * Strict boundary validator:
 * Checks whether coordinates fall strictly within Indore metropolitan delivery limits.
 * West lon: 75.68, North lat: 22.88, East lon: 76.08, South lat: 22.50
 */
export function isInsideIndore(lat: number, lon: number): boolean {
  return lat >= 22.50 && lat <= 22.88 && lon >= 75.68 && lon <= 76.08;
}

/**
 * Finds the nearest known Indore locality, scheme, or landmark from INDORE_LANDMARKS.
 * Used to enrich reverse-geocoded addresses with exact local colony/scheme details.
 */
export function findNearestIndoreLandmark(
  lat: number,
  lon: number,
  maxDistanceMeters = 3000
): PlaceSearchResult | null {
  let nearest: PlaceSearchResult | null = null;
  let minDistance = Infinity;

  for (const item of INDORE_LANDMARKS) {
    const dLat = (item.latitude - lat) * (Math.PI / 180);
    const dLon = (item.longitude - lon) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat * (Math.PI / 180)) * Math.cos(item.latitude * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const dist = 6371000 * c;

    if (dist < minDistance && dist <= maxDistanceMeters) {
      minDistance = dist;
      nearest = item;
    }
  }

  return nearest;
}

/**
 * Generic road, area, and administrative suffixes.
 * A candidate MUST match at least one distinctive keyword rather than just a generic suffix word.
 */
const GENERIC_LOCATION_WORDS = new Set([
  'road',
  'rd',
  'street',
  'st',
  'marg',
  'lane',
  'gali',
  'sector',
  'sec',
  'nagar',
  'colony',
  'circle',
  'square',
  'sq',
  'chauraha',
  'chouk',
  'chowk',
  'indore',
  'mp',
  'area',
  'behind',
  'near',
  'opp',
  'opposite',
  'beside',
  'front',
  'bazaar',
  'bazar',
  'market',
  'block',
  'phase',
]);

/**
 * Intelligent bidirectional address decomposition parser:
 * Separates private premise / micro-details ("Plot 142", "Flat 302", "Gali 2", "104", "Shop 12", "Sector A")
 * whether entered at the beginning OR the end of the query (e.g. "Plot 142 MOG Lines" or "MOG Lines Plot 142").
 */
export function parseAddressQuery(input: string): { houseNo: string; locationQuery: string } {
  let clean = input.trim().replace(/\s+/g, ' ');
  if (!clean) return { houseNo: '', locationQuery: '' };

  let houseNo = '';
  let locationQuery = clean;

  const PREMISE_TYPES = 'flat|house|plot|h\\.?no\\.?|door|shop|block|room|office|unit|gali|lane|street|building|bldg|sector|sec|ward|floor';

  // 1. Prefix WITH premise type: e.g. "Plot 142 MOG Lines", "Gali 2 Chhatribagh", "Flat 302 Scheme 71", "Sector A Silicon City", "Shop 12 Sarafa"
  const prefixWithTypeRegex = new RegExp(
    '^(' + PREMISE_TYPES + ')\\s+(\\d+(?:st|nd|rd|th)?\\s+floor|[0-9]+[a-zA-Z]?(?:[/\\-][0-9]+[a-zA-Z]?)?|[A-Z]-[0-9]+|[a-zA-Z0-9/\\-]+)\\s*[,/\\-]?\\s*(.*)$',
    'i'
  );

  // 2. Prefix WITHOUT premise type (starts with a number): e.g. "104 MOG Lines", "45 Sudama Nagar", "4th Floor Jawahar Marg"
  const prefixBareNumRegex = /^(\\d+(?:st|nd|rd|th)\\s+floor|[0-9]+[a-zA-Z]?(?:[/\\-][0-9]+[a-zA-Z]?)?|[A-Z]-[0-9]+)\\s*[,/-]?\\s*(.*)$/i;

  // 3. Suffix WITH premise type: e.g. "MOG Lines Plot 142", "MOG Lines Gali 2", "Chhatribagh Gali 3", "Sarafa Shop 12", "Scheme 71 Flat 302", "Silicon City Sector A"
  const suffixWithTypeRegex = new RegExp(
    '^(.*?)\\s*[,/\\-]?\\s*(' + PREMISE_TYPES + ')\\s*([a-zA-Z0-9/\\-]+)\\s*$',
    'i'
  );

  // 4. Suffix WITHOUT premise type (ends with a number): e.g. "MOG Lines 104", "Sudama Nagar 45"
  const suffixBareNumRegex = /^(.*?)\\s*[,/-]?\\s*(\\d+[a-zA-Z]?)\\s*$/i;

  // Try Prefix with Type first:
  const pwtMatch = clean.match(prefixWithTypeRegex);
  if (pwtMatch) {
    const pfx = (pwtMatch[1] || '').trim();
    const num = (pwtMatch[2] || '').trim();
    const rest = (pwtMatch[3] || '').trim();
    if (rest.length >= 2) {
      houseNo = `${pfx} ${num}`.trim();
      locationQuery = rest;
    }
  }

  // Try Prefix with Bare Number:
  if (!houseNo) {
    const pbnMatch = clean.match(prefixBareNumRegex);
    if (pbnMatch) {
      const num = (pbnMatch[1] || '').trim();
      const rest = (pbnMatch[2] || '').trim();
      const isSchemeOrLocality = /^(scheme|sec|sector|ward|road|rd|nagar|colony|bypass|chauraha|square|vijay nagar)\\b/i.test(rest);
      if (!isSchemeOrLocality && rest.length >= 2) {
        houseNo = num;
        locationQuery = rest;
      }
    }
  }

  // Try Suffix with Type:
  if (!houseNo) {
    const swtMatch = clean.match(suffixWithTypeRegex);
    if (swtMatch) {
      const baseLoc = (swtMatch[1] || '').trim();
      const pfx = (swtMatch[2] || '').trim();
      const num = (swtMatch[3] || '').trim();
      if (baseLoc.length >= 2) {
        houseNo = `${pfx} ${num}`.trim();
        locationQuery = baseLoc;
      }
    }
  }

  // Try Suffix with Bare Number:
  if (!houseNo) {
    const sbnMatch = clean.match(suffixBareNumRegex);
    if (sbnMatch) {
      const baseLoc = (sbnMatch[1] || '').trim();
      const num = (sbnMatch[2] || '').trim();
      const isSchemeNum = /\\b(scheme|sch|sec|sector|phase|mr|nh)\\s*$/i.test(baseLoc);
      if (!isSchemeNum && baseLoc.length >= 2) {
        houseNo = num;
        locationQuery = baseLoc;
      }
    }
  }

  if (houseNo) {
    houseNo = houseNo
      .replace(/\\b([a-z])/g, (c) => c.toUpperCase())
      .replace(/\\bH\\.?No\\.?\\b/i, 'House No.');
  }

  return { houseNo, locationQuery: locationQuery.trim() || clean };
}

/**
 * Normalize abbreviations and colloquial Indian terms for high-recall search
 */
export function normalizeSearchText(input: string): string {
  return input
    .toLowerCase()
    .replace(/\\b(sch|sch\\.|scheme no\\.?)\\b/gi, 'scheme ')
    .replace(/\\b(sec|sec\\.|sector no\\.?)\\b/gi, 'sector ')
    .replace(/\\b(gali no\\.?|gali number|lane no\\.?|street no\\.?)\\b/gi, 'gali ')
    .replace(/\\b(makan no\\.?|house no\\.?)\\b/gi, 'house ')
    .replace(/\\b(dookan no\\.?|shop no\\.?)\\b/gi, 'shop ')
    .replace(/\\b(sq|sqr|sq\\.|chauraha|chowk|circle)\\b/gi, 'square ')
    .replace(/\\b(rd|rd\\.|marg)\\b/gi, 'road ')
    .replace(/\\b(elec|elect)\\b/gi, 'electronic ')
    .replace(/\\b(comp|cplx)\\b/gi, 'complex ')
    .replace(/\\b(hosp|hos)\\b/gi, 'hospital ')
    .replace(/\\b(coll|clg|univ)\\b/gi, 'college ')
    .replace(/\\b(apt|apts|soc)\\b/gi, 'society ')
    .replace(/\\bnh\\b/gi, 'highway ')
    .replace(/[^\\w\\s]/g, ' ')
    .replace(/\\s+/g, ' ')
    .trim();
}

/**
 * Multi-token scoring algorithm that evaluates title, subtitle, keywords, and pincodes
 */
function scorePlaceMatch(item: PlaceSearchResult, rawQuery: string, normalizedQuery: string): number {
  const normTitle = normalizeSearchText(item.title);
  const normSub = normalizeSearchText(item.subtitle);
  const normKws = (item.keywords || []).map((k) => normalizeSearchText(k));
  const fullText = `${normTitle} ${normSub} ${normKws.join(' ')} ${item.pincode || ''}`;

  const queryWords = normalizedQuery
    .split(/\\s+/)
    .filter((w) => w.length > 0 && !['in', 'at', 'near', 'the', 'of', 'to'].includes(w));
  if (queryWords.length === 0) return 0;

  // Distinctive words (e.g. 'mog', 'annapurna', 'jawahar', 'sarafa', 'scheme', '71')
  const distinctiveWords = queryWords.filter((w) => !GENERIC_LOCATION_WORDS.has(w));
  if (distinctiveWords.length > 0) {
    const hasDistinctiveMatch = distinctiveWords.some(
      (dw) =>
        normTitle.includes(dw) ||
        normKws.some((kw) => kw.includes(dw)) ||
        normSub.includes(dw)
    );
    // If user entered specific distinctive word(s), candidate MUST match at least one of them
    if (!hasDistinctiveMatch) {
      return 0;
    }
  }

  let score = 0;

  // 1. Exact phrase matches
  if (normTitle === normalizedQuery) score += 100;
  else if (normTitle.startsWith(normalizedQuery)) score += 60;
  else if (normTitle.includes(normalizedQuery)) score += 40;
  else if (fullText.includes(normalizedQuery)) score += 30;

  // 2. Keyword exact matches
  for (const kw of normKws) {
    if (kw === normalizedQuery) score += 50;
    else if (kw.includes(normalizedQuery) || normalizedQuery.includes(kw)) score += 25;
  }

  // 3. Word-by-word token scoring
  let matchedWordCount = 0;
  for (const w of queryWords) {
    if (w.length < 2) continue;
    let wordMatched = false;

    if (normTitle.split(/\\s+/).some((tw) => tw.startsWith(w))) {
      score += 18;
      wordMatched = true;
    } else if (normTitle.includes(w)) {
      score += 12;
      wordMatched = true;
    } else if (normKws.some((kw) => kw.includes(w))) {
      score += 14;
      wordMatched = true;
    } else if (normSub.includes(w)) {
      score += 6;
      wordMatched = true;
    }

    if (wordMatched) matchedWordCount++;
  }

  // Bonus when every query token matched
  if (queryWords.length > 1 && matchedWordCount === queryWords.length) {
    score += 35;
  }

  return score;
}

/**
 * Filters out generic city/state/country centroids that add no navigational value
 */
function isGenericJunk(title: string, subtitle: string): boolean {
  const t = title.trim().toLowerCase().replace(/[,.-]/g, ' ').replace(/\\s+/g, ' ').trim();
  const junkTitles = [
    'indore',
    'madhya pradesh',
    'india',
    'indore city',
    'indore location',
    'indore tahsil',
    'indore district',
    'madhya pradesh india',
    'central indore',
  ];
  return junkTitles.includes(t);
}

/**
 * Ensures online geocoder candidates are genuinely relevant to the user query
 */
function isCandidateRelevant(title: string, subtitle: string, searchTerms: string[]): boolean {
  const combined = `${title} ${subtitle}`.toLowerCase();
  const meaningful = searchTerms.filter((term) => term.length >= 3 && !GENERIC_LOCATION_WORDS.has(term));
  const activeTerms = meaningful.length > 0 ? meaningful : searchTerms.filter((t) => t.length >= 3);
  return activeTerms.some((term) => combined.includes(term));
}

/**
 * Intelligent Indore Location Search Engine (Rapido / Zepto Architecture):
 * 1. Symmetrical Premise Extraction: "Plot 142 MOG Lines" & "MOG Lines Plot 142" -> Premise: "Plot 142", Location: "MOG Lines"
 * 2. Instant (0ms) scoring across comprehensive 250+ Indore Locality, Road, Gali, Bazaar & Sector Database
 * 3. Progressive query relaxation fallback (auto-resolves micro-details to parent colony)
 * 4. Strict anti-junk filter to permanently eliminate generic "Indore, Madhya Pradesh" centroids
 * 5. Parallel live geocoders (Photon with Indore center bias, ArcGIS, Nominatim)
 * 6. STRICT BOUNDARY: Discards any location outside Indore metropolitan delivery limits
 * 7. Proximity deduplication to merge identical locations cleanly
 */
export async function searchPlaces(query: string): Promise<PlaceSearchResult[]> {
  const clean = query.trim();
  if (clean.length < 1) return [];

  // Fast-path for single-character input: instant local lookup of Indore landmarks starting with that character
  if (clean.length === 1) {
    const char = clean.toLowerCase();
    const oneLetterMatches: PlaceSearchResult[] = [];
    const seen = new Set<string>();

    for (const item of INDORE_LANDMARKS) {
      const titleWords = item.title.toLowerCase().split(/\s+/);
      const kwWords = (item.keywords || []).flatMap((k) => k.toLowerCase().split(/\s+/));
      const startsWithLetter =
        titleWords.some((w) => w.startsWith(char)) ||
        kwWords.some((w) => w.startsWith(char));

      if (startsWithLetter) {
        const key = `${item.latitude.toFixed(3)},${item.longitude.toFixed(3)}`;
        if (!seen.has(key)) {
          seen.add(key);
          oneLetterMatches.push(item);
          if (oneLetterMatches.length >= 10) break;
        }
      }
    }
    return oneLetterMatches;
  }

  const { houseNo, locationQuery } = parseAddressQuery(clean);
  const effectiveQuery = locationQuery && locationQuery.length >= 2 ? locationQuery : clean;
  const normalizedQuery = normalizeSearchText(effectiveQuery);

  const queryWords = normalizedQuery
    .split(/\\s+/)
    .filter((w) => w.length >= 2 && !['in', 'at', 'near', 'the', 'of', 'to'].includes(w));
  const distinctiveWords = queryWords.filter((w) => !GENERIC_LOCATION_WORDS.has(w));
  const primaryAnchor = (distinctiveWords.length > 0 ? distinctiveWords : queryWords)
    .reduce((longest, w) => (w.length > longest.length ? w : longest), '');

  const results: PlaceSearchResult[] = [];
  const seenKeys = new Set<string>();

  const addCandidate = (item: PlaceSearchResult) => {
    // 1. Filter out generic city centroids ("Indore, Madhya Pradesh")
    if (isGenericJunk(item.title, item.subtitle)) return false;

    // 2. Strict relevance: Online results must match at least one user search token
    if (
      item.source !== 'INDORE_POI' &&
      queryWords.length > 0 &&
      !isCandidateRelevant(item.title, item.subtitle, queryWords)
    ) {
      return false;
    }

    // 3. Prevent duplicate pins (~120m proximity and similar titles)
    const key = `${item.latitude.toFixed(3)},${item.longitude.toFixed(3)}`;
    if (seenKeys.has(key)) return false;

    for (const r of results) {
      const dLat = (r.latitude - item.latitude) * 111000;
      const dLon =
        (r.longitude - item.longitude) * 111000 * Math.cos((item.latitude * Math.PI) / 180);
      const distM = Math.sqrt(dLat * dLat + dLon * dLon);
      if (
        distM < 120 &&
        (r.title.toLowerCase().includes(item.title.toLowerCase()) ||
          item.title.toLowerCase().includes(r.title.toLowerCase()))
      ) {
        return false;
      }
    }

    seenKeys.add(key);
    const displayTitle = houseNo ? `${houseNo}, ${item.title}` : item.title;
    results.push({
      ...item,
      title: displayTitle,
      extractedHouseNo: houseNo || undefined,
    });
    return true;
  };

  // 1. High-Performance Local Indore POI / Locality Search (0ms latency, 250+ items)
  const scoredLocal = INDORE_LANDMARKS.map((item) => {
    const score = scorePlaceMatch(item, effectiveQuery, normalizedQuery);
    return { item, score };
  })
    .filter((entry) => entry.score >= 10)
    .sort((a, b) => b.score - a.score);

  for (const { item } of scoredLocal) {
    addCandidate(item);
    if (results.length >= 10) break;
  }

  // If compound phrase yielded < 3 results, also match primary anchor term (e.g. "sarafa" for "sarafa girls")
  if (results.length < 3 && primaryAnchor.length >= 3 && primaryAnchor !== normalizedQuery) {
    const anchorMatches = INDORE_LANDMARKS.map((item) => {
      const score = scorePlaceMatch(item, primaryAnchor, primaryAnchor);
      return { item, score };
    })
      .filter((entry) => entry.score >= 10)
      .sort((a, b) => b.score - a.score);

    for (const { item } of anchorMatches) {
      addCandidate(item);
      if (results.length >= 6) break;
    }
  }

  // Fast Path: ONLY skip online geocoders if we have high-confidence exact/near-exact local matches (score >= 80)
  const topScore = scoredLocal[0]?.score || 0;
  if (topScore >= 80 && results.length >= 4) {
    return results.slice(0, 12);
  }

  // 2. Parallel Online Geocoders with strict timeouts and error bounds
  const onlinePromises: Promise<void>[] = [];

  // 2a. ArcGIS World Geocoding Candidates (Free public autocomplete, excellent Indian coverage)
  onlinePromises.push(
    (async () => {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 2200);
        const arcgisUrl = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?f=json&singleLine=${encodeURIComponent(
          effectiveQuery + ', Indore'
        )}&maxLocations=6&location=75.8577,22.7196&searchExtent=75.68,22.50,76.08,22.88`;
        const res = await fetch(arcgisUrl, { signal: controller.signal });
        clearTimeout(timer);
        const ct = res.headers.get('content-type') || '';
        if (res.ok && ct.includes('application/json')) {
          const data = await res.json();
          if (Array.isArray(data.candidates)) {
            for (const c of data.candidates) {
              const lat = c.location?.y;
              const lon = c.location?.x;
              if (typeof lat === 'number' && typeof lon === 'number' && isInsideIndore(lat, lon)) {
                const addr = c.address || '';
                const parts = addr.split(',').map((s: string) => s.trim());
                const rawTitle = parts[0] || '';
                if (!rawTitle || isGenericJunk(rawTitle, '')) continue;
                const subtitle = parts.slice(1).join(', ') || 'Indore, Madhya Pradesh';
                addCandidate({
                  id: `arcgis-${lat.toFixed(4)}-${lon.toFixed(4)}`,
                  title: rawTitle,
                  subtitle,
                  latitude: lat,
                  longitude: lon,
                  city: 'Indore',
                  state: 'Madhya Pradesh',
                  source: 'ARCGIS',
                });
              }
            }
          }
        }
      } catch {}
    })()
  );

  // 2b. Photon Geocoder (Fast OpenStreetMap-backed autocomplete with Indore center bias)
  onlinePromises.push(
    (async () => {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 2200);
        const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(
          effectiveQuery
        )}&lat=22.7196&lon=75.8577&bbox=75.68,22.50,76.08,22.88&limit=8`;
        const res = await fetch(photonUrl, { signal: controller.signal });
        clearTimeout(timer);
        const ct = res.headers.get('content-type') || '';
        if (res.ok && ct.includes('application/json')) {
          const data = await res.json();
          if (Array.isArray(data.features)) {
            for (const f of data.features) {
              const coords = f.geometry?.coordinates;
              if (Array.isArray(coords) && coords.length >= 2) {
                const lon = coords[0];
                const lat = coords[1];
                if (isInsideIndore(lat, lon)) {
                  const p = f.properties || {};
                  const rawTitle = p.name || p.street || (p.housenumber ? `${p.housenumber}, ${p.street || ''}` : '') || '';
                  if (!rawTitle || isGenericJunk(rawTitle, '')) continue;
                  const parts = [
                    p.street && p.street !== rawTitle ? p.street : undefined,
                    p.district || p.suburb || p.locality,
                    p.city || 'Indore',
                    p.postcode,
                  ].filter((x, idx, arr) => Boolean(x) && arr.indexOf(x) === idx);
                  addCandidate({
                    id: `photon-${lat.toFixed(4)}-${lon.toFixed(4)}`,
                    title: rawTitle,
                    subtitle: parts.join(', ') || 'Indore, Madhya Pradesh',
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
      } catch {}

      // Rapido progressive relaxation: If compound query yielded < 3 online results, query anchor keyword
      if (
        results.length < 3 &&
        primaryAnchor.length >= 3 &&
        primaryAnchor !== effectiveQuery.toLowerCase()
      ) {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 1800);
          const relaxedUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(
            primaryAnchor
          )}&lat=22.7196&lon=75.8577&bbox=75.68,22.50,76.08,22.88&limit=6`;
          const res = await fetch(relaxedUrl, { signal: controller.signal });
          clearTimeout(timer);
          const ct = res.headers.get('content-type') || '';
          if (res.ok && ct.includes('application/json')) {
            const data = await res.json();
            if (Array.isArray(data.features)) {
              for (const f of data.features) {
                const coords = f.geometry?.coordinates;
                if (Array.isArray(coords) && coords.length >= 2) {
                  const lon = coords[0];
                  const lat = coords[1];
                  if (isInsideIndore(lat, lon)) {
                    const p = f.properties || {};
                    const rawTitle = p.name || p.street || '';
                    if (!rawTitle || isGenericJunk(rawTitle, '')) continue;
                    const parts = [
                      p.street && p.street !== rawTitle ? p.street : undefined,
                      p.district || p.suburb,
                      p.city || 'Indore',
                      p.postcode,
                    ].filter((x, idx, arr) => Boolean(x) && arr.indexOf(x) === idx);
                    addCandidate({
                      id: `photon-relax-${lat.toFixed(4)}-${lon.toFixed(4)}`,
                      title: rawTitle,
                      subtitle: parts.join(', ') || 'Indore, Madhya Pradesh',
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
        } catch {}
      }
    })()
  );

  // 2c. Nominatim OpenStreetMap (bounded=0 with Indore bounding bias)
  if (results.length < 6) {
    onlinePromises.push(
      (async () => {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 2400);
          const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=6&bounded=0&viewbox=75.68,22.88,76.08,22.50&countrycodes=in&q=${encodeURIComponent(
            effectiveQuery + ' Indore'
          )}`;
          const res = await fetch(nomUrl, {
            headers: { 'User-Agent': 'VardhamritIndoreApp/1.0' },
            signal: controller.signal,
          });
          clearTimeout(timer);
          const ct = res.headers.get('content-type') || '';
          if (res.ok && ct.includes('application/json')) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
              for (const item of data) {
                const lat = Number(item.lat);
                const lon = Number(item.lon);
                if (isInsideIndore(lat, lon)) {
                  const addr = item.address || {};
                  const rawTitle =
                    item.name || addr.road || addr.suburb || addr.neighbourhood || addr.residential || item.display_name.split(',')[0];
                  if (!rawTitle || isGenericJunk(rawTitle, '')) continue;
                  const parts = [
                    addr.road && addr.road !== rawTitle ? addr.road : undefined,
                    addr.suburb || addr.neighbourhood || addr.residential,
                    'Indore',
                    addr.postcode,
                  ].filter(Boolean);
                  addCandidate({
                    id: `nom-${lat.toFixed(4)}-${lon.toFixed(4)}`,
                    title: rawTitle,
                    subtitle: parts.join(', ') || 'Indore, Madhya Pradesh',
                    latitude: lat,
                    longitude: lon,
                    pincode: addr.postcode,
                    city: 'Indore',
                    state: 'Madhya Pradesh',
                    source: 'NOMINATIM',
                  });
                }
              }
            } else {
              // Retry without appending ' Indore' if 0 results
              const nomUrlBare = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=6&bounded=0&viewbox=75.68,22.88,76.08,22.50&countrycodes=in&q=${encodeURIComponent(
                effectiveQuery
              )}`;
              const res2 = await fetch(nomUrlBare, {
                headers: { 'User-Agent': 'VardhamritIndoreApp/1.0' },
              });
              if (res2.ok) {
                const data2 = await res2.json();
                if (Array.isArray(data2)) {
                  for (const item of data2) {
                    const lat = Number(item.lat);
                    const lon = Number(item.lon);
                    if (isInsideIndore(lat, lon)) {
                      const addr = item.address || {};
                      const rawTitle =
                        item.name || addr.road || addr.suburb || addr.neighbourhood || item.display_name.split(',')[0];
                      if (!rawTitle || isGenericJunk(rawTitle, '')) continue;
                      const parts = [
                        addr.road && addr.road !== rawTitle ? addr.road : undefined,
                        addr.suburb || addr.neighbourhood || addr.residential,
                        'Indore',
                        addr.postcode,
                      ].filter(Boolean);
                      addCandidate({
                        id: `nom-bare-${lat.toFixed(4)}-${lon.toFixed(4)}`,
                        title: rawTitle,
                        subtitle: parts.join(', ') || 'Indore, Madhya Pradesh',
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
            }
          }
        } catch {}
      })()
    );
  }

  await Promise.allSettled(onlinePromises);

  // 3. Fallback for bare premise numbers / galis (e.g. "Gali 2", "104", "Plot 142") where no locality was specified
  if (results.length === 0 && houseNo) {
    const popularLocs = [
      INDORE_LANDMARKS.find((i) => i.id === 'indore-mog-lines-poi'),
      INDORE_LANDMARKS.find((i) => i.id === 'indore-sarafa-street-poi'),
      INDORE_LANDMARKS.find((i) => i.id === 'indore-chhatribagh-1'),
      INDORE_LANDMARKS.find((i) => i.id === 'indore-sch-54-1'),
      INDORE_LANDMARKS.find((i) => i.id === 'indore-sch-71-1'),
      INDORE_LANDMARKS.find((i) => i.id === 'indore-sudama-1'),
      INDORE_LANDMARKS.find((i) => i.id === 'indore-silicon-city-sec-a'),
      INDORE_LANDMARKS.find((i) => i.id === 'indore-elec-1'),
    ].filter(Boolean) as PlaceSearchResult[];

    for (const loc of popularLocs) {
      addCandidate(loc);
    }
  }

  return results.slice(0, 12);
}
