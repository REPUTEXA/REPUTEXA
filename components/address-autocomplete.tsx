'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import { geocodeByPlaceId, getLatLng } from 'react-google-places-autocomplete';
import { MapPin, Loader2 } from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────

export interface AddressResult {
  fullAddress: string;
  street: string;
  city: string;
  postalCode: string;
  streetNumber: string;
  route: string;
  lat: number;
  lng: number;
}

interface Suggestion {
  placeId: string;
  description: string;
}

type Props = {
  value: string;
  onChange: (value: string, details?: AddressResult) => void;
  id?: string;
  placeholder?: string;
  className?: string;
};

// ─── Constants ─────────────────────────────────────────────────────────

const DEBOUNCE_MS = 150;
const MIN_QUERY_LENGTH = 2;
const CACHE_MAX_ENTRIES = 50;

/** France bounding box (SW, NE) for geographic bias */
const FRANCE_BOUNDS = {
  sw: { lat: 41.3, lng: -5.5 },
  ne: { lat: 51.1, lng: 9.6 },
};

// ─── Cache ─────────────────────────────────────────────────────────────

const suggestionsCache = new Map<string, Suggestion[]>();

function getCachedSuggestions(query: string): Suggestion[] | null {
  const key = query.trim().toLowerCase();
  return suggestionsCache.get(key) ?? null;
}

function setCachedSuggestions(query: string, suggestions: Suggestion[]) {
  const key = query.trim().toLowerCase();
  if (suggestionsCache.size >= CACHE_MAX_ENTRIES) {
    const firstKey = suggestionsCache.keys().next().value;
    if (firstKey) suggestionsCache.delete(firstKey);
  }
  suggestionsCache.set(key, suggestions);
}

// ─── Address parsing (getDetails / Geocoder) ────────────────────────────

function extractAddressComponents(
  components: google.maps.GeocoderAddressComponent[] | undefined
): {
  streetNumber: string;
  route: string;
  street: string;
  city: string;
  postalCode: string;
} {
  let streetNumber = '';
  let route = '';
  let city = '';
  let postalCode = '';
  if (!components) return { streetNumber, route, street: '', city, postalCode };

  for (const c of components) {
    if (c.types.includes('street_number')) streetNumber = c.long_name;
    if (c.types.includes('route')) route = c.long_name;
    if (c.types.includes('locality')) city = c.long_name;
    if (c.types.includes('postal_code')) postalCode = c.long_name;
    if (!city && c.types.includes('administrative_area_level_2'))
      city = c.long_name;
  }
  const street = [streetNumber, route].filter(Boolean).join(' ').trim();
  return { streetNumber, route, street, city, postalCode };
}

// ─── Highlight matching text ────────────────────────────────────────────

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(re);
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i}>{part}</strong> : part
  );
}

// ─── Component ──────────────────────────────────────────────────────────

export function AddressAutocomplete({
  value,
  onChange,
  id = 'address',
  placeholder = 'Saisissez votre adresse...',
  className = '',
}: Props) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
  const [inputValue, setInputValue] = useState(value);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSelectingRef = useRef(false);

  // Sync parent value → local input (selection persistence)
  useEffect(() => {
    if (value !== inputValue && !isSelectingRef.current) {
      setInputValue(value);
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load Google Places API
  useEffect(() => {
    if (!apiKey) return;
    const loader = new Loader({
      apiKey,
      version: 'weekly',
      libraries: ['places'],
    });
    loader.load().then(() => {
      if (typeof window !== 'undefined' && window.google?.maps?.places) {
        autocompleteServiceRef.current = new window.google.maps.places.AutocompleteService();
      }
    });
  }, [apiKey]);

  // Fetch suggestions (with cache + debounce)
  const fetchSuggestions = useCallback(
    (query: string) => {
      const trimmed = query.trim();
      if (trimmed.length < MIN_QUERY_LENGTH) {
        setSuggestions([]);
        return;
      }
      const cached = getCachedSuggestions(trimmed);
      if (cached) {
        setSuggestions(cached);
        setIsLoading(false);
        return;
      }
      const service = autocompleteServiceRef.current;
      if (!service) return;
      setIsLoading(true);
      service.getPlacePredictions(
        {
          input: trimmed,
          componentRestrictions: { country: 'fr' },
          bounds: new google.maps.LatLngBounds(
            new google.maps.LatLng(FRANCE_BOUNDS.sw.lat, FRANCE_BOUNDS.sw.lng),
            new google.maps.LatLng(FRANCE_BOUNDS.ne.lat, FRANCE_BOUNDS.ne.lng)
          ),
        },
        (results) => {
          const list = (results || []).map((r) => ({
            placeId: r.place_id ?? '',
            description: r.description ?? '',
          }));
          setCachedSuggestions(trimmed, list);
          setSuggestions(list);
          setSelectedIndex(-1);
          setIsLoading(false);
        }
      );
    },
    []
  );

  // Debounced input handler
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      setInputValue(v);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (!v.trim()) {
        setSuggestions([]);
        setIsOpen(false);
        onChange('');
        return;
      }
      setIsOpen(true);
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        fetchSuggestions(v);
      }, DEBOUNCE_MS);
    },
    [fetchSuggestions, onChange]
  );

  // Select suggestion + getDetails (geocode)
  const selectSuggestion = useCallback(
    async (suggestion: Suggestion) => {
      isSelectingRef.current = true;
      setInputValue(suggestion.description);
      setSuggestions([]);
      setIsOpen(false);
      setSelectedIndex(-1);
      try {
        const [result] = await geocodeByPlaceId(suggestion.placeId);
        const fullAddress = result?.formatted_address ?? suggestion.description;
        const { streetNumber, route, street, city, postalCode } =
          extractAddressComponents(result?.address_components);
        let lat = 0;
        let lng = 0;
        if (result?.geometry?.location) {
          const coords = await getLatLng(result);
          lat = coords.lat;
          lng = coords.lng;
        }
        onChange(fullAddress, {
          fullAddress,
          street,
          city,
          postalCode,
          streetNumber,
          route,
          lat,
          lng,
        });
      } catch (e) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[AddressAutocomplete] geocode error:', e);
        }
        onChange(suggestion.description);
      } finally {
        isSelectingRef.current = false;
      }
    },
    [onChange]
  );

  // Blur: never clear. Only close menu.
  const handleBlur = useCallback(() => {
    setTimeout(() => {
      if (!isSelectingRef.current) {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    }, 150);
  }, []);

  const handleFocus = useCallback(() => {
    if (suggestions.length > 0) setIsOpen(true);
  }, [suggestions.length]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) =>
          i < suggestions.length - 1 ? i + 1 : i
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => (i > 0 ? i - 1 : -1));
      } else if (e.key === 'Enter' && selectedIndex >= 0 && suggestions[selectedIndex]) {
        e.preventDefault();
        selectSuggestion(suggestions[selectedIndex]);
      } else if (e.key === 'Escape') {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    },
    [isOpen, suggestions, selectedIndex, selectSuggestion]
  );

  // Clear button
  const handleClear = useCallback(() => {
    setInputValue('');
    setSuggestions([]);
    setIsOpen(false);
    onChange('');
    inputRef.current?.focus();
  }, [onChange]);

  const inputClasses =
    'flex items-center gap-2 w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200';

  // ─── Fallback: no API key ────────────────────────────────────────────

  if (!apiKey) {
    return (
      <div className={`${inputClasses} ${className}`}>
        <MapPin className="shrink-0 w-4 h-4 text-slate-400" aria-hidden />
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            onChange(e.target.value);
          }}
          onBlur={handleBlur}
          placeholder={placeholder}
          autoComplete="street-address"
          className="flex-1 min-w-0 bg-transparent focus:outline-none placeholder:text-slate-400"
        />
      </div>
    );
  }

  // ─── Main: custom autocomplete ────────────────────────────────────────

  const dropdown = isOpen && (
    <div
      className="absolute left-0 right-0 top-full mt-1 z-[10000] bg-white rounded-lg border border-slate-200 shadow-md overflow-hidden"
      style={{
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -2px rgba(0,0,0,0.05)',
      }}
    >
      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-2 text-slate-400">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span className="text-xs">Recherche...</span>
        </div>
      )}
      {!isLoading && suggestions.length === 0 && inputValue.trim().length >= MIN_QUERY_LENGTH && (
        <div className="py-3 px-3 text-sm text-slate-500 text-center">
          Aucune adresse trouvée
        </div>
      )}
      {!isLoading && suggestions.length > 0 && (
        <ul id="address-suggestions" className="max-h-60 overflow-auto py-1" role="listbox">
          {suggestions.map((s, i) => (
            <li
              key={s.placeId}
              role="option"
              aria-selected={i === selectedIndex}
              className={`flex items-center gap-2 px-3 py-2.5 cursor-pointer text-sm transition-colors ${
                i === selectedIndex ? 'bg-slate-100' : 'hover:bg-slate-50'
              }`}
              onMouseDown={(e) => {
                e.preventDefault();
                selectSuggestion(s);
              }}
            >
              <MapPin className="shrink-0 w-4 h-4 text-slate-400" />
              <span className="text-slate-700">
                {highlightMatch(s.description, inputValue.trim())}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div ref={containerRef} className={`${inputClasses} ${className} relative overflow-visible`}>
      <MapPin className="shrink-0 w-4 h-4 text-slate-400" aria-hidden />
      <input
        ref={inputRef}
        id={id}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onBlur={handleBlur}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        className="flex-1 min-w-0 bg-transparent focus:outline-none placeholder:text-slate-400"
        aria-autocomplete="list"
        aria-controls="address-suggestions"
        role="combobox"
        aria-expanded={isOpen}
      />
      {value && (
        <button
          type="button"
          onClick={handleClear}
          className="shrink-0 p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          aria-label="Effacer l'adresse"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
      {dropdown}
    </div>
  );
}
