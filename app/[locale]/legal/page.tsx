import type { Metadata } from 'next';
import { Link } from '@/i18n/navigation';
import { LegalPageShell } from '@/components/legal/legal-page-shell';

const TOC = [
  { id: 'editeur', label: '1. Éditeur du site' },
  { id: 'directeur-publication', label: '2. Directeur de la publication' },
  { id: 'services-technologies', label: '3. Services et technologies' },
  { id: 'hebergeur', label: '4. Hébergeur' },
  { id: 'prop-intel', label: '5. Propriété intellectuelle' },
  { id: 'liens', label: '6. Liens hypertextes' },
  { id: 'contact', label: '7. Contact' },
];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = 'https://reputexa.fr';
  const path = locale === 'fr' ? '/fr/legal' : `/${locale}/legal`;
  return {
    title: 'Mentions légales | REPUTEXA',
    description:
      "Mentions légales du site Reputexa.fr. Éditeur, hébergeur, plans Vision Pulse Zenith, conformité LCEN et RGPD.",
    alternates: { canonical: `${baseUrl}${path}` },
    openGraph: {
      title: 'Mentions légales | REPUTEXA',
      description: 'Mentions légales et informations légales du site Reputexa.',
      url: `${baseUrl}${path}`,
      siteName: 'REPUTEXA',
    },
  };
}

export default function LegalPage() {
  return (
    <LegalPageShell title="Mentions légales" toc={TOC}>
      <p className="text-slate-600 dark:text-slate-400 mb-8">
        Conformément à la loi n° 2004-575 du 21 juin 2004 pour la confiance dans l&apos;économie numérique (LCEN)
        et au Règlement général sur la protection des données (RGPD), les présentes mentions légales précisent
        l&apos;identité des différents intervenants dans le cadre de la création et du suivi du site
        reputexa.fr.
      </p>

      <section id="editeur" className="mb-10">
        <h3 className="text-lg font-display font-semibold text-slate-900 dark:text-slate-100 mb-3">
          1. Éditeur du site
        </h3>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-2">
          Le site <strong>reputexa.fr</strong> est édité par :
        </p>
        <ul className="list-none space-y-1 text-slate-600 dark:text-slate-400 ml-0">
          <li><strong>Nom ou raison sociale :</strong> [NOM / RAISON SOCIALE]</li>
          <li><strong>Adresse du siège social :</strong> [ADRESSE COMPLÈTE DU SIÈGE SOCIAL]</li>
          <li><strong>SIRET :</strong> [NUMÉRO SIRET À 14 CHIFFRES]</li>
          <li><strong>Numéro de TVA intracommunautaire :</strong> [N° TVA INTRACOMMUNAUTAIRE]</li>
        </ul>
      </section>

      <section id="directeur-publication" className="mb-10">
        <h3 className="text-lg font-display font-semibold text-slate-900 dark:text-slate-100 mb-3">
          2. Directeur de la publication
        </h3>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
          Le directeur de la publication est : <strong>Le fondateur de Reputexa</strong>.
        </p>
      </section>

      <section id="services-technologies" className="mb-10">
        <h3 className="text-lg font-display font-semibold text-slate-900 dark:text-slate-100 mb-3">
          3. Services et technologies
        </h3>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-2">
          Le site reputexa.fr propose un service d&apos;e-réputation organisé en trois offres d&apos;abonnement :
          <strong> Vision</strong>, <strong>Pulse</strong> et <strong>Zenith</strong>. Les fonctionnalités (agrégation
          d&apos;avis, réponses IA, alertes, reporting) et les technologies utilisées (paiements Stripe, hébergement
          des données Supabase, emails Resend, notifications WhatsApp via Meta) sont détaillées dans les{' '}
          <Link href="/legal/cgu" target="_blank" rel="noopener noreferrer" className="text-[#2563eb] hover:underline">Conditions Générales d&apos;Utilisation</Link>
          {' '}et la{' '}
          <Link href="/legal/confidentialite" target="_blank" rel="noopener noreferrer" className="text-[#2563eb] hover:underline">Politique de confidentialité</Link>.
        </p>
      </section>

      <section id="hebergeur" className="mb-10">
        <h3 className="text-lg font-display font-semibold text-slate-900 dark:text-slate-100 mb-3">
          4. Hébergeur
        </h3>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-2">
          Le site reputexa.fr est hébergé par :
        </p>
        <ul className="list-none space-y-1 text-slate-600 dark:text-slate-400 ml-0">
          <li><strong>Raison sociale :</strong> Vercel Inc.</li>
          <li><strong>Adresse :</strong> 650 California Street, San Francisco, CA 94108, États-Unis</li>
        </ul>
      </section>

      <section id="prop-intel" className="mb-10">
        <h3 className="text-lg font-display font-semibold text-slate-900 dark:text-slate-100 mb-3">
          5. Propriété intellectuelle
        </h3>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
          L&apos;ensemble du contenu du site (textes, graphismes, logos, icônes, bases de données) est protégé
          par le droit d&apos;auteur et le droit des marques. Toute reproduction, représentation ou exploitation
          non autorisée constitue une contrefaçon passible de poursuites pénales et civiles.
        </p>
      </section>

      <section id="liens" className="mb-10">
        <h3 className="text-lg font-display font-semibold text-slate-900 dark:text-slate-100 mb-3">
          5. Liens hypertextes
        </h3>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
          Le site peut contenir des liens vers des sites tiers. REPUTEXA n&apos;exerce aucun contrôle sur ces
          sites et décline toute responsabilité quant à leur contenu. La création de liens hypertextes vers
          le site reputexa.fr est soumise à l&apos;accord préalable de l&apos;éditeur.
        </p>
      </section>

      <section id="contact" className="mb-10">
        <h3 className="text-lg font-display font-semibold text-slate-900 dark:text-slate-100 mb-3">
          7. Contact
        </h3>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
          Pour toute question relative aux présentes mentions légales :{' '}
          <a href="mailto:contact@reputexa.fr" className="text-[#2563eb] hover:underline">
            contact@reputexa.fr
          </a>
          .
        </p>
      </section>
    </LegalPageShell>
  );
}
