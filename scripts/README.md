# Scripts - AAA Empire Reputation AI

Dossier dédié aux scripts utilitaires, notamment le **Sniper de prospection**.

## Sniper

Script de prospection ultra-performant utilisant :
- **Google Places API** (Text Search + Place Details) pour trouver des établissements
- **GPT-4o** pour générer des pitchs personnalisés

### Configuration

Ajoute dans `.env` :
```
MAPS_API_KEY="AIza..."
OPENAI_API_KEY="sk-..."
```

### Utilisation

```bash
# Ville et catégorie par défaut (Lyon, Restaurants)
npm run sniper

# Ou avec arguments
npx tsx scripts/sniper.ts "Paris" "Boulangeries"

# Avec ts-node
npx ts-node scripts/sniper.ts "Marseille" "Hôtels"
```

### Logique de filtrage

Prospects retenus si note entre **3.2 et 4.1**.
