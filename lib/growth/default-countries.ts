/** Marchés par défaut dans la War Room (interrupteurs OFF jusqu’à activation manuelle). */
export const GROWTH_DEFAULT_COUNTRIES: {
  countryCode: string;
  localeDefault: string;
  dailyOutreachCap: number;
}[] = [
  { countryCode: 'FR', localeDefault: 'fr', dailyOutreachCap: 150 },
  { countryCode: 'IT', localeDefault: 'it', dailyOutreachCap: 150 },
  { countryCode: 'ES', localeDefault: 'es', dailyOutreachCap: 150 },
  { countryCode: 'DE', localeDefault: 'de', dailyOutreachCap: 150 },
  { countryCode: 'GB', localeDefault: 'en', dailyOutreachCap: 150 },
  { countryCode: 'US', localeDefault: 'en', dailyOutreachCap: 200 },
  { countryCode: 'PT', localeDefault: 'pt', dailyOutreachCap: 150 },
  { countryCode: 'JP', localeDefault: 'ja', dailyOutreachCap: 120 },
  { countryCode: 'CN', localeDefault: 'zh', dailyOutreachCap: 120 },
];
