import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { theme } from '../../theme';
import { Icon } from '../common/Icon';
import { PlaceSearchResult, searchPlaces } from '../../services/locationService';

interface InteractiveUberMapPickerProps {
  latitude?: number;
  longitude?: number;
  accuracy?: number | null;
  onLocationChange: (
    coords: { latitude: number; longitude: number },
    placeHint?: string,
    extractedHouseNo?: string
  ) => void;
  onRequestLocateMe?: () => void;
  isLocating?: boolean;
}

const POPULAR_INDORE_CHIPS = [
  { label: 'Electronic Complex', query: 'Electronic Complex' },
  { label: 'Vijay Nagar', query: 'Vijay Nagar' },
  { label: 'Sukhlia', query: 'Sukhlia' },
  { label: 'Palasia', query: 'Palasia' },
  { label: '56 Dukan', query: 'Chhappan Dukan' },
  { label: 'Bhawarkua', query: 'Bhawarkua' },
  { label: 'Sudama Nagar', query: 'Sudama Nagar' },
  { label: 'Apollo DB City', query: 'Apollo DB City' },
];

export const InteractiveUberMapPicker: React.FC<InteractiveUberMapPickerProps> = ({
  latitude,
  longitude,
  accuracy,
  onLocationChange,
  onRequestLocateMe,
  isLocating = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PlaceSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isPinHovering, setIsPinHovering] = useState(false);
  const searchTimeoutRef = useRef<any>(null);
  const iframeRef = useRef<any>(null);

  const activeLat = latitude || 22.7196;
  const activeLon = longitude || 75.8577;

  // Search input handler with 200ms debounce
  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (text.trim().length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setShowDropdown(true);

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await searchPlaces(text);
        setSearchResults(results);
      } catch (err) {
        console.warn('Search places error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 180);
  };

  const handleSelectPlace = (place: PlaceSearchResult) => {
    setSearchQuery(place.title);
    setShowDropdown(false);
    setSearchResults([]);

    // Fly map to new coordinates
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        {
          type: 'FLY_TO',
          lat: place.latitude,
          lon: place.longitude,
          zoom: 17,
        },
        '*'
      );
    }

    onLocationChange(
      { latitude: place.latitude, longitude: place.longitude },
      `${place.title}, ${place.subtitle}`,
      place.extractedHouseNo
    );
  };

  const handleChipPress = async (query: string) => {
    setSearchQuery(query);
    setIsSearching(true);
    setShowDropdown(true);
    const results = await searchPlaces(query);
    setSearchResults(results);
    setIsSearching(false);
    if (results.length > 0) {
      handleSelectPlace(results[0]);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setShowDropdown(false);
  };

  // Sync external coordinate changes to the embedded Leaflet map
  useEffect(() => {
    if (latitude && longitude && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        {
          type: 'FLY_TO',
          lat: latitude,
          lon: longitude,
          zoom: 17,
        },
        '*'
      );
    }
  }, [latitude, longitude]);

  // Listen to postMessage events from Leaflet map
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const handleMessage = (e: MessageEvent) => {
      if (!e.data || typeof e.data !== 'object') return;

      if (e.data.type === 'PIN_MOVING') {
        setIsPinHovering(true);
      } else if (e.data.type === 'PIN_SETTLED') {
        setIsPinHovering(false);
        const { lat, lon } = e.data;
        if (typeof lat === 'number' && typeof lon === 'number') {
          onLocationChange({ latitude: lat, longitude: lon });
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onLocationChange]);

  // Self-contained, responsive Leaflet HTML template with CartoDB Voyager 2x Retina, Satellite toggle & Famous Landmark pins
  const leafletHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #e5e7eb; }
    
    /* Uber Pin Center Marker Container */
    .uber-pin-anchor {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -100%);
      z-index: 1000;
      pointer-events: none;
      transition: transform 0.16s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    .uber-pin-anchor.lifting {
      transform: translate(-50%, -125%) scale(1.12);
    }

    /* Uber Pin Graphic */
    .pin-graphic {
      width: 40px;
      height: 48px;
      filter: drop-shadow(0 6px 10px rgba(0,0,0,0.35));
    }

    /* Floating Shadow underneath pin */
    .uber-pin-shadow {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 18px;
      height: 7px;
      background: rgba(10, 54, 34, 0.38);
      border-radius: 50%;
      z-index: 999;
      pointer-events: none;
      transition: all 0.16s ease-out;
    }
    .uber-pin-anchor.lifting + .uber-pin-shadow {
      transform: translate(-50%, -50%) scale(0.55);
      background: rgba(10, 54, 34, 0.18);
    }

    /* Subtle pulse radar ring when settled */
    .pin-pulse-ring {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 32px;
      height: 14px;
      border: 1.5px solid rgba(10, 54, 34, 0.45);
      border-radius: 50%;
      z-index: 998;
      pointer-events: none;
      animation: pulseAnim 2.2s infinite ease-out;
    }
    @keyframes pulseAnim {
      0% { transform: translate(-50%, -50%) scale(0.4); opacity: 0.9; }
      100% { transform: translate(-50%, -50%) scale(1.6); opacity: 0; }
    }

    /* Layer Switch Button (Street vs Satellite) */
    .layer-toggle-btn {
      position: absolute;
      top: 10px;
      left: 10px;
      z-index: 800;
      background: #FFFFFF;
      border: 1.5px solid #D1D5DB;
      border-radius: 8px;
      padding: 5px 9px;
      font-size: 11px;
      font-weight: 700;
      color: #1F2937;
      box-shadow: 0 2px 6px rgba(0,0,0,0.18);
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 4px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      transition: all 0.15s ease;
    }
    .layer-toggle-btn:hover, .layer-toggle-btn:active {
      background: #F3F4F6;
      border-color: #0A3622;
      color: #0A3622;
      transform: scale(1.02);
    }

    /* Famous Landmark Map Badges */
    .famous-poi-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: #FFFFFF;
      padding: 3.5px 8px;
      border-radius: 14px;
      border: 1.5px solid #0A3622;
      box-shadow: 0 3px 8px rgba(0, 0, 0, 0.24);
      cursor: pointer;
      white-space: nowrap;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
      user-select: none;
    }
    .famous-poi-badge:hover, .famous-poi-badge:active {
      transform: scale(1.1);
      box-shadow: 0 6px 14px rgba(0, 0, 0, 0.38);
      border-color: #15803D;
      background: #F0FDF4;
    }
    .famous-poi-badge .poi-icon {
      font-size: 12px;
    }
    .famous-poi-badge .poi-name {
      font-size: 10.5px;
      font-weight: 700;
      color: #0A3622;
    }
  </style>
</head>
<body>
  <div id="map"></div>

  <!-- Layer Switcher: Street vs Satellite -->
  <button id="layer-btn" class="layer-toggle-btn" onclick="toggleMapLayer()">
    <span>🛰️</span>
    <span id="layer-btn-text">Satellite</span>
  </button>

  <!-- Centered Interactive Uber Pin -->
  <div id="center-pin" class="uber-pin-anchor">
    <svg class="pin-graphic" viewBox="0 0 38 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M19 0C8.50659 0 0 8.50659 0 19C0 31.5 19 48 19 48C19 48 38 31.5 38 19C38 8.50659 29.4934 0 19 0Z" fill="#0A3622"/>
      <path d="M19 2C9.61116 2 2 9.61116 2 19C2 30.2 19 45.2 19 45.2C19 45.2 36 30.2 36 19C36 9.61116 28.3888 2 19 2Z" fill="#14532D"/>
      <circle cx="19" cy="18" r="7.5" fill="#FFFFFF"/>
      <circle cx="19" cy="18" r="4.5" fill="#0A3622"/>
    </svg>
  </div>
  <div class="uber-pin-shadow"></div>
  <div class="pin-pulse-ring"></div>

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var startLat = ${activeLat};
    var startLon = ${activeLon};

    var map = L.map('map', {
      center: [startLat, startLon],
      zoom: 16,
      zoomControl: false,
      attributionControl: false,
      inertia: true,
      inertiaDeceleration: 3000
    });

    // 1. CartoDB Voyager 2x Retina Layer (Ultra-crisp streets, building outlines, contrast labels)
    var isRetina = window.devicePixelRatio > 1;
    var streetLayer = L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}' + (isRetina ? '@2x.png' : '.png'),
      {
        subdomains: 'abcd',
        maxZoom: 20,
        crossOrigin: true
      }
    ).addTo(map);

    // 2. High-Res Satellite Layer (Esri World Imagery)
    var satLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 19,
        crossOrigin: true
      }
    );

    var currentLayer = 'street';
    function toggleMapLayer() {
      var btnText = document.getElementById('layer-btn-text');
      var btn = document.getElementById('layer-btn');
      if (currentLayer === 'street') {
        map.removeLayer(streetLayer);
        satLayer.addTo(map);
        currentLayer = 'satellite';
        btn.innerHTML = '<span>🗺️</span><span id="layer-btn-text">Street</span>';
      } else {
        map.removeLayer(satLayer);
        streetLayer.addTo(map);
        currentLayer = 'street';
        btn.innerHTML = '<span>🛰️</span><span id="layer-btn-text">Satellite</span>';
      }
    }

    // 3. Famous Landmarks in Indore directly pinned on map
    var famousLandmarks = [
      { name: 'Scheme 71 Park', icon: '🌳', lat: 22.7044, lon: 75.8287 },
      { name: 'Gumasta Nagar', icon: '🏡', lat: 22.7080, lon: 75.8300 },
      { name: 'Electronic Complex', icon: '💻', lat: 22.7523, lon: 75.8687 },
      { name: 'Sukhlia / Bapat', icon: '🚏', lat: 22.7615, lon: 75.8690 },
      { name: 'Vijay Nagar Sq.', icon: '🌟', lat: 22.7511, lon: 75.8955 },
      { name: '56 Dukan', icon: '🍲', lat: 22.7242, lon: 75.8821 },
      { name: 'Rajwada Palace', icon: '🏛️', lat: 22.7180, lon: 75.8548 },
      { name: 'Apollo DB City', icon: '🏢', lat: 22.7680, lon: 75.9180 },
      { name: 'Khajrana Ganesh', icon: '🕉️', lat: 22.7350, lon: 75.9200 },
      { name: 'Crystal IT Park', icon: '🎓', lat: 22.6845, lon: 75.8642 },
      { name: 'C21 Mall', icon: '🛍️', lat: 22.7480, lon: 75.8930 },
      { name: 'Bhawarkua Sq.', icon: '📍', lat: 22.6919, lon: 75.8669 },
      { name: 'Annapurna Mandir', icon: '🌺', lat: 22.6948, lon: 75.8389 },
      { name: 'Bombay Hospital', icon: '🏥', lat: 22.7590, lon: 75.8970 },
      { name: 'Indore Airport', icon: '✈️', lat: 22.7230, lon: 75.8080 },
      { name: 'Sarafa Bazaar', icon: '🍛', lat: 22.7170, lon: 75.8530 },
      { name: 'Sudama Nagar', icon: '📍', lat: 22.6950, lon: 75.8450 },
      { name: 'Pardesipura', icon: '📍', lat: 22.7485, lon: 75.8750 }
    ];

    famousLandmarks.forEach(function(poi) {
      var badgeHtml = '<div class="famous-poi-badge" title="Tap to move pin here">' +
        '<span class="poi-icon">' + poi.icon + '</span>' +
        '<span class="poi-name">' + poi.name + '</span>' +
        '</div>';

      var poiIcon = L.divIcon({
        html: badgeHtml,
        className: 'custom-poi-marker',
        iconSize: [null, null],
        iconAnchor: [35, 14]
      });

      var marker = L.marker([poi.lat, poi.lon], { icon: poiIcon, zIndexOffset: 200 }).addTo(map);

      // Tapping any famous landmark pin smoothly flies camera right to it
      marker.on('click', function(e) {
        L.DomEvent.stopPropagation(e);
        map.flyTo([poi.lat, poi.lon], 17, { animate: true, duration: 0.9 });
      });
    });

    var pinEl = document.getElementById('center-pin');

    map.on('movestart dragstart', function() {
      if (pinEl) pinEl.classList.add('lifting');
      window.parent.postMessage({ type: 'PIN_MOVING' }, '*');
    });

    map.on('moveend dragend', function() {
      if (pinEl) pinEl.classList.remove('lifting');
      var center = map.getCenter();
      window.parent.postMessage({
        type: 'PIN_SETTLED',
        lat: Number(center.lat.toFixed(6)),
        lon: Number(center.lng.toFixed(6))
      }, '*');
    });

    // Tap/Click on map smoothly centers pin right there
    map.on('click', function(e) {
      map.panTo(e.latlng, { animate: true, duration: 0.6 });
    });

    window.addEventListener('message', function(e) {
      if (!e.data || typeof e.data !== 'object') return;
      if (e.data.type === 'FLY_TO') {
        var targetLat = Number(e.data.lat);
        var targetLon = Number(e.data.lon);
        var zoom = e.data.zoom || 16;
        if (!isNaN(targetLat) && !isNaN(targetLon)) {
          map.flyTo([targetLat, targetLon], zoom, {
            animate: true,
            duration: 1.1
          });
        }
      } else if (e.data.type === 'ZOOM_IN') {
        map.zoomIn();
      } else if (e.data.type === 'ZOOM_OUT') {
        map.zoomOut();
      }
    });
  </script>
</body>
</html>`;

  return (
    <View style={styles.container}>
      {/* Indore Service Zone Header */}
      <View style={styles.zoneHeaderRow}>
        <View style={styles.zoneHeaderBadge}>
          <Icon name="check" size={11} color="#15803D" />
          <Text style={styles.zoneHeaderBadgeText}>INDORE ONLY</Text>
        </View>
        <Text style={styles.zoneHeaderTitle}>Fast 48-hr Doorstep Delivery</Text>
      </View>

      {/* 1. Uber-Style Location Search Bar */}
      <View style={styles.searchBarWrapper}>
        <View style={styles.searchBar}>
          <Icon name="search" size={16} color={theme.colors.primary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search Indore area, colony, street (e.g. Sukhlia, Vijay Nagar)..."
            placeholderTextColor="#6B7280"
            value={searchQuery}
            onChangeText={handleSearchChange}
            onFocus={() => {
              if (searchResults.length > 0) setShowDropdown(true);
            }}
          />
          {isSearching ? (
            <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginRight: 8 }} />
          ) : searchQuery.length > 0 ? (
            <TouchableOpacity onPress={handleClearSearch} style={styles.clearBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Icon name="close" size={13} color="#6B7280" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Quick Tap Indore Chips */}
        <View style={styles.quickChipsRow}>
          {POPULAR_INDORE_CHIPS.map((c) => (
            <TouchableOpacity
              key={c.label}
              activeOpacity={0.75}
              onPress={() => handleChipPress(c.query)}
              style={styles.quickChip}
            >
              <Text style={styles.quickChipText}>{c.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Search Results Dropdown Card */}
        {showDropdown && searchResults.length > 0 ? (
          <View style={styles.dropdownCard}>
            <View style={styles.dropdownHeader}>
              <Text style={styles.dropdownHeaderText}>INDORE LOCATIONS ({searchResults.length})</Text>
              <TouchableOpacity onPress={() => setShowDropdown(false)}>
                <Text style={styles.dropdownCloseText}>Close</Text>
              </TouchableOpacity>
            </View>
            {searchResults.map((item) => (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.7}
                onPress={() => handleSelectPlace(item)}
                style={styles.dropdownItem}
              >
                <View style={styles.dropdownItemIconCircle}>
                  <Icon name="map-pin" size={13} color={theme.colors.primary} />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.dropdownItemTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.dropdownItemSubtitle} numberOfLines={1}>
                    {item.subtitle}
                  </Text>
                </View>
                <View style={item.source === 'INDORE_POI' ? styles.indoreBadge : styles.osmBadge}>
                  <Text style={item.source === 'INDORE_POI' ? styles.indoreBadgeText : styles.osmBadgeText}>
                    {item.source === 'INDORE_POI' ? 'Indore POI' : 'Verified'}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
      </View>

      {/* 2. Interactive Moving Map with Center Uber Pin */}
      <View style={styles.mapFrame}>
        {Platform.OS === 'web' ? (
          // @ts-ignore - React Native Web supports standard DOM elements like iframe
          <iframe
            ref={iframeRef}
            srcDoc={leafletHtml}
            style={styles.webIframe}
            title="Uber Style Map Picker"
            loading="eager"
          />
        ) : (
          <View style={styles.nativeFallback}>
            <Icon name="map-pin" size={24} color={theme.colors.primary} />
            <Text style={styles.nativeFallbackText}>Interactive Map Active</Text>
          </View>
        )}

        {/* Floating Uber Hint Pill on Map */}
        <View style={styles.uberFloatingHint}>
          <Text style={styles.uberFloatingHintText}>
            {isPinHovering ? '🎯 Release to drop pin' : '🖐️ Drag map to pinpoint house / entrance'}
          </Text>
        </View>

        {/* Floating "Locate Me" GPS Button */}
        {onRequestLocateMe ? (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={onRequestLocateMe}
            disabled={isLocating}
            style={styles.floatingGpsBtn}
          >
            {isLocating ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : (
              <Icon name="crosshair" size={18} color={theme.colors.primary} />
            )}
          </TouchableOpacity>
        ) : null}

        {/* Floating Zoom Controls */}
        <View style={styles.floatingZoomGroup}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => iframeRef.current?.contentWindow?.postMessage({ type: 'ZOOM_IN' }, '*')}
            style={styles.zoomBtn}
          >
            <Text style={styles.zoomBtnText}>+</Text>
          </TouchableOpacity>
          <View style={styles.zoomDivider} />
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => iframeRef.current?.contentWindow?.postMessage({ type: 'ZOOM_OUT' }, '*')}
            style={styles.zoomBtn}
          >
            <Text style={styles.zoomBtnText}>−</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 3. Live Precision & Coordinate Status Strip */}
      <View style={styles.statusBar}>
        <View style={styles.statusDotWrapper}>
          <View style={styles.statusLiveDot} />
          <Icon name="map-pin" size={12} color="#0A3622" />
        </View>
        <View style={{ flex: 1, marginLeft: 6 }}>
          <Text style={styles.statusCoordsText}>
            Pin: {activeLat.toFixed(5)}, {activeLon.toFixed(5)}
          </Text>
          <Text style={styles.statusSubText}>
            {accuracy ? `Satellite Accuracy: ±${accuracy}m` : 'Uber-style moving pin active'}
          </Text>
        </View>
        <View style={styles.pinLockedBadge}>
          <Text style={styles.pinLockedBadgeText}>📍 Move Pin</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
    position: 'relative',
    zIndex: 50,
  },
  zoneHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  zoneHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  zoneHeaderBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#15803D',
    letterSpacing: 0.4,
  },
  zoneHeaderTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#064E3B',
  },
  quickChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 6,
  },
  quickChip: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  quickChipText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#374151',
  },
  searchBarWrapper: {
    position: 'relative',
    zIndex: 60,
    marginBottom: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    paddingHorizontal: 10,
    height: 42,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#111827',
    fontWeight: '500',
    paddingVertical: 0,
  },
  clearBtn: {
    padding: 4,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
  },
  dropdownCard: {
    position: 'absolute',
    top: 46,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 99,
    maxHeight: 220,
    overflow: 'hidden',
  },
  dropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  dropdownHeaderText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6B7280',
    letterSpacing: 0.5,
  },
  dropdownCloseText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  dropdownItemIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownItemTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#111827',
  },
  dropdownItemSubtitle: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 1,
  },
  indoreBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  indoreBadgeText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#15803D',
  },
  osmBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  osmBadgeText: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#4B5563',
  },
  mapFrame: {
    height: 220,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#D1FAE5',
    backgroundColor: '#E5E7EB',
    position: 'relative',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  webIframe: {
    width: '100%',
    height: '100%',
    border: 'none',
    display: 'block',
  },
  nativeFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  nativeFallbackText: {
    fontSize: 12,
    color: '#4B5563',
    marginTop: 6,
  },
  uberFloatingHint: {
    position: 'absolute',
    top: 10,
    alignSelf: 'center',
    backgroundColor: 'rgba(10, 54, 34, 0.88)',
    paddingHorizontal: 12,
    paddingVertical: 4.5,
    borderRadius: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    zIndex: 30,
  },
  uberFloatingHintText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  floatingGpsBtn: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 5,
    zIndex: 40,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  floatingZoomGroup: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 40,
    overflow: 'hidden',
  },
  zoomBtn: {
    width: 32,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
    lineHeight: 18,
  },
  zoomDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  statusDotWrapper: {
    position: 'relative',
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusLiveDot: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#86EFAC',
    opacity: 0.5,
  },
  statusCoordsText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#064E3B',
  },
  statusSubText: {
    fontSize: 10,
    color: '#047857',
  },
  pinLockedBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  pinLockedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803D',
  },
});
