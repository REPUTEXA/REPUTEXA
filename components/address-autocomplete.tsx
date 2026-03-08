'use client';

import { useMemo } from 'react';
import GooglePlacesAutocomplete, {
  geocodeByPlaceId,
  getLatLng,
} from 'react-google-places-autocomplete';
import type { OptionTypeBase } from 'react-select';
import { MapPin } from 'lucide-react';

export interface AddressResult {
  fullAddress: string;
  street: string;
  city: string;
  postalCode: string;
  lat: number;
  lng: number;
}

type Props = {
  value: string;
  onChange: (value: string, details?: AddressResult) => void;
  id?: string;
  placeholder?: string;
  className?: string;
};

function extractComponents(
  components: google.maps.GeocoderAddressComponent[] | undefined
): { street: string; city: string; postalCode: string } {
  let street = '';
  let city = '';
  let postalCode = '';
  if (!components) return { street, city, postalCode };

  let route = '';
  let streetNumber = '';
  for (const c of components) {
    if (c.types.includes('route')) route = c.long_name;
    if (c.types.includes('street_number')) streetNumber = c.long_name;
    if (c.types.includes('locality')) city = c.long_name;
    if (c.types.includes('postal_code')) postalCode = c.long_name;
    if (!city && c.types.includes('administrative_area_level_2')) city = c.long_name;
  }
  street = [streetNumber, route].filter(Boolean).join(' ').trim() || '';
  return { street, city, postalCode };
}

export function AddressAutocomplete({
  value,
  onChange,
  id = 'address',
  placeholder = 'Tapez votre adresse (ex: 599 chemin de Guiran)',
  className = '',
}: Props) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

  const selectProps = useMemo(
    () => ({
      placeholder,
      value: value ? { label: value, value: { place_id: value } } : null,
      onChange: async (opt: OptionTypeBase | null) => {
        if (!opt) {
          onChange('');
          return;
        }
        const placeId = opt.value?.place_id ?? (typeof opt.value === 'string' ? opt.value : null);
        if (!placeId) {
          onChange(opt.label ?? '');
          return;
        }
        try {
          const [result] = await geocodeByPlaceId(placeId);
          const fullAddress = result?.formatted_address ?? opt.label ?? '';
          const { city, postalCode } = extractComponents(result?.address_components);
          let lat = 0;
          let lng = 0;
          if (result?.geometry?.location) {
            const coords = await getLatLng(result);
            lat = coords.lat;
            lng = coords.lng;
          }
          onChange(fullAddress, {
            fullAddress,
            city,
            postalCode,
            lat,
            lng,
          });
        } catch (e) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[AddressAutocomplete] geocode error:', e);
          }
          onChange(opt.label ?? '');
        }
      },
      onInputChange: (inputValue: string) => {
        if (inputValue === '') onChange('');
      },
      inputId: id,
      isClearable: true,
      noOptionsMessage: () => 'Aucune adresse trouvée',
      loadingMessage: () => 'Recherche...',
      styles: {
        control: (base: object) => ({
          ...base,
          border: 'none',
          boxShadow: 'none',
          minHeight: 42,
          '&:hover': { border: 'none' },
        }),
        valueContainer: (base: object) => ({
          ...base,
          padding: 0,
          paddingLeft: 0,
        }),
        input: (base: object) => ({
          ...base,
          margin: 0,
          padding: 0,
        }),
        indicatorSeparator: () => ({ display: 'none' }),
        dropdownIndicator: () => ({ display: 'none' }),
        clearIndicator: (base: object) => ({ ...base, padding: '4px 2px' }),
        singleValue: (base: object) => ({ ...base, margin: 0 }),
        menu: (base: object) => ({
          ...base,
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: '0 10px 40px -10px rgba(0,0,0,0.15), 0 0 1px rgba(0,0,0,0.05)',
          marginTop: 6,
        }),
        option: (base: object, state: { isFocused?: boolean }) => ({
          ...base,
          backgroundColor: state.isFocused ? '#eff6ff' : 'white',
          cursor: 'pointer',
          padding: '12px 18px',
          fontSize: 15,
        }),
      },
    }),
    [id, value, placeholder, onChange]
  );

  const inputClasses =
    'flex items-center gap-3 w-full pl-4 pr-4 py-3 rounded-2xl border border-slate-200/80 bg-white text-slate-900 placeholder:text-slate-400 focus-within:outline-none focus-within:ring-2 focus-within:ring-blue-500/25 focus-within:border-blue-400 transition-all duration-200 shadow-sm focus-within:shadow-[0_0_0_4px_rgba(59,130,246,0.12)]';

  if (!apiKey) {
    return (
      <div className={`${inputClasses} ${className}`}>
        <MapPin className="shrink-0 w-5 h-5 text-blue-500/70" aria-hidden />
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="street-address"
          className="flex-1 min-w-0 bg-transparent focus:outline-none placeholder:text-slate-400"
        />
      </div>
    );
  }

  return (
    <div className={`${inputClasses} ${className}`}>
      <MapPin className="shrink-0 w-5 h-5 text-blue-500/70" aria-hidden />
      <div className="flex-1 min-w-0 [&_.react-select__control]:!min-h-0 [&_.react-select__control]:!border-0 [&_.react-select__value-container]:!p-0">
        <GooglePlacesAutocomplete
          apiKey={apiKey}
          selectProps={selectProps}
          autocompletionRequest={{
            componentRestrictions: { country: ['fr'] },
          }}
          minLengthAutocomplete={2}
        />
      </div>
    </div>
  );
}
