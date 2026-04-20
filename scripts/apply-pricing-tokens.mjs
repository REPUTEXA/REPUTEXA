/**
 * Remplace les montants catalogue codés en dur par des jetons [[PX:…]] lus au runtime
 * depuis targets/settings.json (via injectPricingIntoMessages).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const messagesDir = path.join(__dirname, '..', 'messages');

const files = fs
  .readdirSync(messagesDir)
  .filter((f) => f.endsWith('.json') && !f.startsWith('legal-') && f !== 'legal-fr.json');

function patch(content) {
  let s = content;

  s = s.replace(/"vision_price": "[^"]*"/g, '"vision_price": "[[PX:vision]]"');
  s = s.replace(/"pulse_price": "[^"]*"/g, '"pulse_price": "[[PX:pulse]]"');
  s = s.replace(/"zenith_price": "[^"]*"/g, '"zenith_price": "[[PX:zenith]]"');

  s = s.replace(/"price": "\$59"/g, '"price": "[[PX:vision:num]]"');
  s = s.replace(/"price": "\$97"/g, '"price": "[[PX:pulse:num]]"');
  s = s.replace(/"price": "\$179"/g, '"price": "[[PX:zenith:num]]"');
  s = s.replace(/"price": "€59"/g, '"price": "[[PX:vision:num]]"');
  s = s.replace(/"price": "€97"/g, '"price": "[[PX:pulse:num]]"');
  s = s.replace(/"price": "€179"/g, '"price": "[[PX:zenith:num]]"');
  s = s.replace(/"price": "59€"/g, '"price": "[[PX:vision:num]]"');
  s = s.replace(/"price": "97€"/g, '"price": "[[PX:pulse:num]]"');
  s = s.replace(/"price": "179€"/g, '"price": "[[PX:zenith:num]]"');
  s = s.replace(/"price": "£59"/g, '"price": "[[PX:vision:num]]"');
  s = s.replace(/"price": "£97"/g, '"price": "[[PX:pulse:num]]"');
  s = s.replace(/"price": "£179"/g, '"price": "[[PX:zenith:num]]"');
  s = s.replace(/"price": "59"/g, '"price": "[[PX:vision:num]]"');
  s = s.replace(/"price": "97"/g, '"price": "[[PX:pulse:num]]"');
  s = s.replace(/"price": "179"/g, '"price": "[[PX:zenith:num]]"');

  s = s.replace(
    /"cta": "Activate my ZENITH plan — €179\/month"/g,
    '"cta": "Activate my ZENITH plan — [[PX:zenith:mo]]"',
  );
  s = s.replace(
    /"cta": "Activate my ZENITH plan — \$199\/month"/g,
    '"cta": "Activate my ZENITH plan — [[PX:zenith:mo]]"',
  );
  s = s.replace(
    /"cta": "Activate my ZENITH plan — £179\/month"/g,
    '"cta": "Activate my ZENITH plan — [[PX:zenith:mo]]"',
  );
  s = s.replace(
    /"cta": "Activer mon plan ZENITH — 179€\/mois"/g,
    '"cta": "Activer mon plan ZENITH — [[PX:zenith:mo]]"',
  );
  s = s.replace(
    /"cta": "Activate my ZENITH plan — 179€\/mois"/g,
    '"cta": "Activate my ZENITH plan — [[PX:zenith:mo]]"',
  );
  s = s.replace(
    /"cta": "Activate my ZENITH plan — 179€\/mes"/g,
    '"cta": "Activate my ZENITH plan — [[PX:zenith:mo]]"',
  );
  s = s.replace(
    /"cta": "Activate my ZENITH plan — 179€\/mese"/g,
    '"cta": "Activate my ZENITH plan — [[PX:zenith:mo]]"',
  );
  s = s.replace(
    /"cta": "Attiva il mio piano ZENITH — 179€\/mese"/g,
    '"cta": "Attiva il mio piano ZENITH — [[PX:zenith:mo]]"',
  );
  s = s.replace(
    /"cta": "Activar mi plan ZENITH — 179€\/mes"/g,
    '"cta": "Activar mi plan ZENITH — [[PX:zenith:mo]]"',
  );
  s = s.replace(
    /"cta": "Aktivieren Sie meinen ZENITH-Plan – 179€\/Monat"/g,
    '"cta": "Aktivieren Sie meinen ZENITH-Plan – [[PX:zenith:mo]]"',
  );
  s = s.replace(
    /"cta": "私のZENITHプランを有効にする — 179€\/月"/g,
    '"cta": "私のZENITHプランを有効にする — [[PX:zenith:mo]]"',
  );

  s = s.replace(/"price": "¥8,000"/g, '"price": "[[PX:vision:num]]"');
  s = s.replace(/"price": "¥15,800"/g, '"price": "[[PX:pulse:num]]"');
  s = s.replace(/"price": "¥29,800"/g, '"price": "[[PX:zenith:num]]"');

  s = s.replace(
    /du plan PULSE \(97€\/mois\)/g,
    'du plan PULSE ([[PX:pulse:mo]])',
  );
  s = s.replace(
    /from the PULSE plan \(€97\/month\)/g,
    'from the PULSE plan ([[PX:pulse:mo]])',
  );
  s = s.replace(
    /from the PULSE plan \(€97\/mo\)/g,
    'from the PULSE plan ([[PX:pulse:mo]])',
  );
  s = s.replace(
    /from PULSE \(€97\/mo\)/g,
    'from PULSE ([[PX:pulse:mo]])',
  );
  s = s.replace(
    /ab dem PULSE-Plan \(97 €\/Monat\)/g,
    'ab dem PULSE-Plan ([[PX:pulse:mo]])',
  );
  s = s.replace(
    /desde el plan PULSE \(97€\/mes\)/g,
    'desde el plan PULSE ([[PX:pulse:mo]])',
  );
  s = s.replace(
    /a partire dal piano PULSE \(97€\/mese\)/g,
    'a partire dal piano PULSE ([[PX:pulse:mo]])',
  );
  s = s.replace(
    /desde o plano PULSE \(97€\/mês\)/g,
    'desde o plano PULSE ([[PX:pulse:mo]])',
  );
  s = s.replace(
    /PULSE \(97 €\/Monat\)/g,
    'PULSE ([[PX:pulse:mo]])',
  );
  s = s.replace(
    /PULSE-Plan \(97 €\/Monat\)/g,
    'PULSE-Plan ([[PX:pulse:mo]])',
  );
  s = s.replace(
    /plan PULSE \(97€\/mes\)/g,
    'plan PULSE ([[PX:pulse:mo]])',
  );
  s = s.replace(
    /on PULSE \(€97\/mo\)/g,
    'on PULSE ([[PX:pulse:mo]])',
  );

  return s;
}

for (const f of files) {
  const p = path.join(messagesDir, f);
  const before = fs.readFileSync(p, 'utf8');
  const after = patch(before);
  if (before !== after) {
    fs.writeFileSync(p, after, 'utf8');
    console.log('updated', f);
  }
}
