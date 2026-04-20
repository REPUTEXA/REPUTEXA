import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const testimonials = {
  en: {
    headline: 'What restaurant & hotel operators say about their new 24/7 director.',
    subtitle: 'Join hundreds of owners who finally sleep through the night.',
    items: {
      '1': {
        quote:
          'The smart filter alone paid for itself. We used to get two or three unfair hits a month that kneecapped our average. Now? Nothing slips through that should not. Worth every pound for the calm.',
        name: 'Emma L.',
        role: 'Owner, The Copper Fork — Manchester',
      },
      '2': {
        quote:
          "It's like having a reputation lead on shift round the clock. WhatsApp pings me on real emergencies; the product handles the steady work. We went from 3.9 to 4.8 on Google in four months.",
        name: 'James K.',
        role: 'Chef-patron, Harbour Kitchen — Bristol',
      },
      '3': {
        quote:
          'We pay for peace of mind. Zenith is the best money we have spent: review requests and AI replies run on rails and our local pack visibility has jumped.',
        name: 'Sarah T.',
        role: 'General Manager, Pine Court Hotel — York',
      },
    },
  },
  fr: {
    headline: 'Ce que disent les restaurateurs et hôteliers de leur nouveau directeur 24/7.',
    subtitle: 'Rejoignez des centaines de professionnels qui dorment enfin tranquilles.',
    items: {
      '1': {
        quote:
          'Le filtre intelligent nous a sauvés. Avant, 2 ou 3 avis injustes par nous tiraient vers le bas. Aujourd’hui ? Plus de “crash” public. Chaque euro pour la tranquillité d’esprit.',
        name: 'Sophie M.',
        role: 'Gérante, Le Bistro Parisien — Lyon',
      },
      '2': {
        quote:
          'C’est comme avoir un directeur e-réputation H24. J’ai les alertes WhatsApp pour les urgences, l’IA gère le quotidien. Notre note est passée de 3,9 à 4,8 en 4 mois.',
        name: 'Thomas R.',
        role: 'Chef-restaurateur, La Table du Port — Marseille',
      },
      '3': {
        quote:
          'Je paie pour être sereine. Zenith est le meilleur investissement : collecte d’avis et réponses IA en pilote automatique, et notre visibilité Google a explosé.',
        name: 'Isabelle R.',
        role: 'Directrice, Hôtel Les Pins — Annecy',
      },
    },
  },
  es: {
    headline: 'Lo que dicen hosteleros y hoteleros sobre su nuevo director 24/7.',
    subtitle: 'Únete a cientos de negocios que por fin duermen tranquilos.',
    items: {
      '1': {
        quote:
          'El filtro inteligente solo ya nos compensó. Antes teníamos 2-3 reseñas injustas al mes que nos hundían. Ahora cero crisis públicas. Vale cada euro de tranquilidad.',
        name: 'Carmen V.',
        role: 'Propietaria, Taberna del Mercado — Sevilla',
      },
      '2': {
        quote:
          'Es como tener un director de reputación permanentemente. WhatsApp para urgencias; la IA hace el resto. Pasamos de 3,9 a 4,8 en cuatro meses.',
        name: 'Diego P.',
        role: 'Chef-propietario, Marisquería Atlántico — A Coruña',
      },
      '3': {
        quote:
          'Pago por tranquilidad. Zenith es la mejor inversión: recogida de reseñas y respuestas IA en automático y nuestra visibilidad en Google se ha disparado.',
        name: 'Laura M.',
        role: 'Directora, Hotel Mirador — Granada',
      },
    },
  },
  de: {
    headline: 'Was Gastronomen und Hotelchefs über ihren neuen 24/7-Reputations-Director sagen.',
    subtitle: 'Schließen Sie sich Hunderten an, die endlich wieder durchschlafen.',
    items: {
      '1': {
        quote:
          'Allein der Smart-Filter hat sich amortisiert. Früher 2–3 ungerechte Bewertungen pro Monat, die den Schnitt zerrissen. Heute? Keine öffentlichen Desaster mehr. Jedes Euro für Ruhe wert.',
        name: 'Anna W.',
        role: 'Inhaberin, Gasthaus am Kanal — Hamburg',
      },
      '2': {
        quote:
          'Wie ein Reputations-Lead in Dauerschicht. WhatsApp nur bei echten Notfällen, der Rest läuft automatisiert. Von 3,9 auf 4,8 bei Google in vier Monaten.',
        name: 'Felix B.',
        role: 'Chef de cuisine, Brauhaus Südufer — München',
      },
      '3': {
        quote:
          'Wir kaufen uns Ruhe. Zenith ist die beste Investition: Review-Anfragen und KI-Antworten laufen auf Autopilot, die lokale Sichtbarkeit ist deutlich gestiegen.',
        name: 'Kathrin S.',
        role: 'Hoteldirektorin, Stadtvilla Elm — Köln',
      },
    },
  },
  it: {
    headline: 'Cosa dicono ristoratori e albergatori sul nuovo director della reputazione, 24/7.',
    subtitle: 'Unisciti a centinaia di imprenditori che finalmente dormono sonni tranquilli.',
    items: {
      '1': {
        quote:
          'Solo il filtro intelligente ci ha salvato. Prima 2–3 recensioni ingiuste al mese che ci facevano perdere terreno. Ora? Zero brutte sorprese in pubblico. Ogni euro per la serenità.',
        name: 'Giulia F.',
        role: 'Titolare, Osteria del Campo — Bologna',
      },
      '2': {
        quote:
          'È come avere un referente reputazione sempre in turno. WhatsApp per le emergenze, l’IA gestisce il resto. Siamo passati da 3,9 a 4,8 in quattro mesi.',
        name: 'Marco D.',
        role: 'Chef patron, Trattoria Milano — Milano',
      },
      '3': {
        quote:
          'Pago per dormire tranquilla. Zenith è l’investimento migliore: raccolta recensioni e risposte IA in automatico e la visibilità Google è schizzata.',
        name: 'Elena R.',
        role: 'Direttrice, Hotel Pini — Cortina d’Ampezzo',
      },
    },
  },
};

for (const loc of ['en', 'fr', 'es', 'de', 'it']) {
  const f = path.join(root, 'messages', `${loc}.json`);
  const m = JSON.parse(fs.readFileSync(f, 'utf8'));
  m.HomePage = m.HomePage ?? {};
  m.HomePage.testimonials = testimonials[loc];
  fs.writeFileSync(f, JSON.stringify(m));
}
console.log('HomePage.testimonials patched for 5 locales');
