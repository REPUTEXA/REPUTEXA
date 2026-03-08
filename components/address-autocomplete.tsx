'use client';

import { useMemo } from 'react';
import GooglePlacesAutocomplete, {
  geocodeByPlaceId,
  getLatLng,
} from 'react-google-places-autocomplete';
import { MapPin } from 'lucide-react';

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(re);
  return parts.map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : part));
}

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
  placeholder = 'Saisissez votre adresse...',
  className = '',
}: Props) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

  const selectProps = useMemo(
    () => ({
      placeholder,
      value: value ? { label: value, value: { place_id: value } } : null,
      onChange: async (opt: { label: string; value?: { place_id?: string } } | null) => {
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
          const { street, city, postalCode } = extractComponents(result?.address_components);
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
      menuPortalTarget: typeof document !== 'undefined' ? document.body : undefined,
      menuPosition: 'fixed' as const,
      formatOptionLabel: (option: { label: string }, meta: { inputValue?: string }) =>
        highlightMatch(option.label, meta.inputValue ?? ''),
      components: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Option: (props: any) => (
          <div
            ref={props.innerRef}
            {...props.innerProps}
            className="flex items-center gap-2 px-3 py-2.5 cursor-pointer text-slate-700 hover:bg-slate-50 text-sm"
            onMouseDown={(e: React.MouseEvent) => {
              e.preventDefault();
              props.selectOption(props.data);
            }}
          >
            <MapPin className="shrink-0 w-4 h-4 text-slate-400" />
            <span>{props.children}</span>
          </div>
        ),
      },
      styles: {
        control: (base: object) => ({
          ...base,
          border: 'none',
          boxShadow: 'none',
          minHeight: 40,
          '&:hover': { border: 'none', boxShadow: 'none' },
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
        clearIndicator: (base: object) => ({ ...base, padding: '4px 2px', color: '#94a3b8' }),
        singleValue: (base: object) => ({ ...base, margin: 0 }),
        menu: (base: object) => ({
          ...base,
          position: 'absolute' as const,
          zIndex: 9999,
          backgroundColor: '#fff',
          borderRadius: 8,
          overflow: 'hidden',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -2px rgba(0,0,0,0.05)',
          marginTop: 4,
          width: '100%',
        }),
        menuList: (base: object) => ({
          ...base,
          padding: 4,
          maxHeight: 240,
        }),
        option: () => ({}),
      },
    }),
    [id, value, placeholder, onChange]
  );

  const inputClasses =
    'flex items-center gap-2 w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus-within:outline-none focus-within:ring-2 focus-within:ring-blue-500/30 focus-within:border-blue-500 transition-all duration-200';

  if (!apiKey) {
    return (
      <div className={`${inputClasses} ${className}`}>
        <MapPin className="shrink-0 w-4 h-4 text-slate-400" aria-hidden />
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
    <div className={`${inputClasses} ${className} relative`}>
      <MapPin className="shrink-0 w-4 h-4 text-slate-400" aria-hidden />
      <div className="flex-1 min-w-0 [&_.react-select__control]:!min-h-0 [&_.react-select__control]:!border-0 [&_.react-select__control]:!shadow-none [&_.react-select__value-container]:!p-0">
        <GooglePlacesAutocomplete
          apiKey={apiKey}
          selectProps={selectProps}
          debounce={300}
          autocompletionRequest={{
            componentRestrictions: { country: 'fr' },
          }}
          minLengthAutocomplete={2}
        />
      </div>
    </div>
  );
}
