import type { Metadata } from 'next';
import { LegalPageShell } from '@/components/legal/legal-page-shell';

const TOC = [
  { id: 'editeur', label: '1. Responsable du traitement' },
  { id: 'donnees-collectees', label: '2. Données collectées' },
  { id: 'finalites', label: '3. Finalités et bases légales' },
  { id: 'avis-google', label: '4. Avis Google et accès API' },
  { id: 'ia', label: '5. Traitement par intelligence artificielle' },
  { id: 'paiements-stripe', label: '6. Paiements et données de facturation' },
  { id: 'sous-traitants', label: '7. Sous-traitants' },
  { id: 'cookies', label: '8. Cookies' },
  { id: 'duree-conservation', label: '9. Durée de conservation' },
  { id: 'droits', label: '10. Vos droits' },
  { id: 'securite', label: '11. Sécurité' },
  { id: 'modifications', label: '12. Modifications' },
  { id: 'contact', label: '13. Nous contacter' },
];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = 'https://reputexa.fr';
  const path = locale === 'fr' ? '/fr/privacy' : `/${locale}/privacy`;
  return {
    title: 'Politique de confidentialité | REPUTEXA',
    description:
      "Politique de confidentialité et protection des données personnelles de REPUTEXA. Conformité RGPD, gestion des avis Google, paiements Stripe.",
    alternates: { canonical: `${baseUrl}${path}` },
    openGraph: {
      title: 'Politique de confidentialité | REPUTEXA',
      description:
        "Politique de confidentialité et protection des données personnelles. Conformité RGPD, Stripe, Google Business.",
      url: `${baseUrl}${path}`,
      siteName: 'REPUTEXA',
    },
  };
}

export default function PrivacyPage() {
  return (
    <LegalPageShell title="Politique de confidentialité" toc={TOC}>
      <p className="text-slate-600 dark:text-slate-400 mb-8">
        Dernière mise à jour : mars 2026. Cette politique définit comment REPUTEXA collecte, utilise et protège
        vos données personnelles conformément au Règlement général sur la protection des données (RGPD).
      </p>

      <section id="editeur" className="mb-10">
        <h3 className="text-lg font-display font-semibold text-slate-900 dark:text-slate-100 mb-3">
          1. Responsable du traitement
        </h3>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-2">
          Le responsable du traitement des données personnelles est REPUTEXA, éditeur du site
          <strong> reputexa.fr</strong>, dont le siège est établi en France.
        </p>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
          Nous traitons vos données de manière licite, loyale et transparente, conformément au RGPD.
        </p>
      </section>

      <section id="donnees-collectees" className="mb-10">
        <h3 className="text-lg font-display font-semibold text-slate-900 dark:text-slate-100 mb-3">
          2. Données collectées
        </h3>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
          Nous collectons notamment :
        </p>
        <ul className="list-disc list-inside space-y-1.5 text-slate-600 dark:text-slate-400 ml-2">
          <li>
            <strong>Email :</strong> adresse email professionnelle pour la création du compte, les communications
            et l&apos;authentification
          </li>
          <li>
            <strong>Données de facturation :</strong> identité, coordonnées et informations de paiement transmises
            à Stripe pour le traitement des abonnements et la délivrance des factures
          </li>
          <li>
            <strong>Accès aux avis via l&apos;API Google :</strong> contenu des avis, notes, dates, données de votre
            fiche Google Business Profile (cf. section 4)
          </li>
          <li>
            <strong>Données d&apos;identification et professionnelles :</strong> nom, prénom, téléphone, nom de
            l&apos;établissement, adresse, Google Location ID
          </li>
          <li>
            <strong>Données techniques :</strong> adresse IP, logs de connexion, cookies (cf. section 8)
          </li>
        </ul>
      </section>

      <section id="finalites" className="mb-10">
        <h3 className="text-lg font-display font-semibold text-slate-900 dark:text-slate-100 mb-3">
          3. Finalités et bases légales
        </h3>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-2">
          Les données sont traitées pour les finalités suivantes, sur les bases juridiques indiquées :
        </p>
        <ul className="list-disc list-inside space-y-1.5 text-slate-600 dark:text-slate-400 ml-2">
          <li>
            <strong>Exécution du contrat :</strong> création du compte, accès au service, gestion de l&apos;abonnement
          </li>
          <li>
            <strong>Intérêt légitime :</strong> amélioration du service, analytics internes, prévention des fraudes
          </li>
          <li>
            <strong>Consentement :</strong> newsletter, communications marketing (révocable à tout moment)
          </li>
          <li>
            <strong>Obligation légale :</strong> conservation des factures, conformité fiscale
          </li>
        </ul>
      </section>

      <section id="avis-google" className="mb-10">
        <h3 className="text-lg font-display font-semibold text-slate-900 dark:text-slate-100 mb-3">
          4. Avis Google et accès API
        </h3>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
          Les données relatives aux avis Google sont collectées via l&apos;API Google Business Profile après
          votre autorisation. Il s&apos;agit notamment du contenu des avis (texte, note, date), du nom ou pseudo
          du contributeur et de l&apos;identifiant de votre établissement. Ces données servent à
          l&apos;affichage dans le dashboard, à la génération de suggestions de réponses par IA (voir section 5),
          aux alertes et au reporting.
        </p>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
          <strong>Propriété des données :</strong> Les données d&apos;avis affichées sur Google Business Profile
          restent la propriété du client ou de Google, selon le cas. REPUTEXA ne revendique aucune propriété sur
          ces contenus. REPUTEXA est toutefois habilitée à les traiter, les stocker et les utiliser dans le cadre
          strict de la fourniture du service et des finalités décrites aux présentes.
        </p>
      </section>

      <section id="ia" className="mb-10">
        <h3 className="text-lg font-display font-semibold text-slate-900 dark:text-slate-100 mb-3">
          5. Traitement par intelligence artificielle
        </h3>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-2">
          Les avis collectés sont traités par des modèles d&apos;intelligence artificielle (fournisseurs tels que
          OpenAI, Google ou équivalents) afin de générer des suggestions de réponses personnalisées, pour le compte
          exclusif de l&apos;utilisateur et dans le cadre strict de la prestation REPUTEXA.
        </p>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
          <strong>REPUTEXA ne revend, ne partage ni ne monétise les données d&apos;avis ou les contenus traités par l&apos;IA</strong> à des fins autres que la fourniture du service. L&apos;IA traite les avis uniquement pour permettre au client de répondre à ses avis et d&apos;améliorer sa e-réputation ; aucun usage secondaire (publicité ciblée, revente de données, profilage tiers) n&apos;est effectué.
        </p>
      </section>

      <section id="paiements-stripe" className="mb-10">
        <h3 className="text-lg font-display font-semibold text-slate-900 dark:text-slate-100 mb-3">
          6. Paiements et données de facturation
        </h3>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-2">
          Les données de facturation et de paiement sont transmises à <strong>Stripe</strong> (Stripe, Inc.),
          prestataire certifié PCI-DSS, pour le traitement des abonnements (plans Vision, Pulse, Zenith), la
          tokenisation des cartes bancaires et la délivrance des factures. Les données bancaires sensibles ne
          transitent jamais par nos serveurs. Politique Stripe :{' '}
          <a
            href="https://stripe.com/fr/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#2563eb] hover:underline"
          >
            stripe.com/fr/privacy
          </a>
          .
        </p>
      </section>

      <section id="sous-traitants" className="mb-10">
        <h3 className="text-lg font-display font-semibold text-slate-900 dark:text-slate-100 mb-3">
          7. Sous-traitants et transfert de données
        </h3>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
          Vos données peuvent être transférées et traitées par les sous-traitants ci-après, dans le strict cadre
          de leur mission. Ces transferts sont effectués conformément au RGPD et aux politiques de confidentialité
          propres à chaque prestataire :
        </p>
        <ul className="list-disc list-inside space-y-1.5 text-slate-600 dark:text-slate-400 ml-2 mb-3">
          <li><strong>Stripe</strong> – Paiements, facturation et gestion des abonnements (cartes, prorata, crédits)</li>
          <li><strong>Resend</strong> – Envoi d&apos;emails transactionnels (confirmation, alertes, notifications de compte)</li>
          <li><strong>WhatsApp API (Meta)</strong> – Envoi de notifications et alertes (avis négatifs, rappels) lorsque vous avez activé cette option sur votre plan</li>
          <li><strong>Supabase</strong> – Hébergement des données (base de données, authentification) ; les données peuvent être hébergées dans l&apos;Union européenne selon la configuration</li>
          <li><strong>OpenAI / fournisseurs d&apos;IA</strong> – Traitement des avis pour la génération de suggestions de réponses (cf. section 5)</li>
          <li><strong>Google</strong> – Connexion OAuth et API Google Business Profile (avis, fiches établissement)</li>
          <li><strong>Vercel</strong> – Hébergement du site et de l&apos;application</li>
        </ul>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
          Ces prestataires sont soumis à des obligations contractuelles conformes au RGPD. Vous pouvez consulter
          leurs politiques de confidentialité respectives (Stripe, Resend, Meta/WhatsApp, Supabase, etc.) sur leurs sites officiels.
        </p>
      </section>

      <section id="cookies" className="mb-10">
        <h3 className="text-lg font-display font-semibold text-slate-900 dark:text-slate-100 mb-3">
          8. Cookies
        </h3>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-2">
          Le site utilise des <strong>cookies techniques strictement indispensables</strong> au fonctionnement
          du service :
        </p>
        <ul className="list-disc list-inside space-y-1.5 text-slate-600 dark:text-slate-400 ml-2 mb-3">
          <li><strong>Session et authentification</strong> : maintien de la session utilisateur et sécurité de l&apos;accès</li>
          <li><strong>Sécurité Stripe</strong> : cookies nécessaires au traitement des paiements et à la prévention des fraudes</li>
        </ul>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
          Ces cookies ne requièrent pas de consentement préalable au sens de l&apos;article 82 de la loi
          « Informatique et Libertés » et du RGPD, dès lors qu&apos;ils sont strictement nécessaires à la
          fourniture du service. Aucun bandeau de consentement spécifique n&apos;est affiché pour ces cookies
          techniques.
        </p>
      </section>

      <section id="duree-conservation" className="mb-10">
        <h3 className="text-lg font-display font-semibold text-slate-900 dark:text-slate-100 mb-3">
          9. Durée de conservation
        </h3>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-2">
          Vos données sont conservées pendant la durée de votre compte, puis pendant les délais légaux
          applicables (facturation : 10 ans). Les données de connexion et logs sont conservés au maximum
          12 mois. En cas de suppression de compte, vos données sont supprimées ou anonymisées dans un délai
          de 30 jours, sauf obligation de conservation légale.
        </p>
      </section>

      <section id="droits" className="mb-10">
        <h3 className="text-lg font-display font-semibold text-slate-900 dark:text-slate-100 mb-3">
          10. Vos droits
        </h3>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-2">
          Conformément au RGPD, vous disposez des droits suivants :
        </p>
        <ul className="list-disc list-inside space-y-1.5 text-slate-600 dark:text-slate-400 ml-2 mb-3">
          <li><strong>Droit d&apos;accès</strong> et de rectification de vos données</li>
          <li><strong>Droit à l&apos;effacement</strong> (« droit à l&apos;oubli ») dans les limites prévues par la loi</li>
          <li><strong>Droit à la limitation</strong> du traitement</li>
          <li><strong>Droit à la portabilité</strong> des données</li>
          <li><strong>Droit d&apos;opposition</strong> au traitement, notamment pour la prospection</li>
        </ul>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
          Pour exercer ces droits, contactez-nous à{' '}
          <a href="mailto:contact@reputexa.fr" className="text-[#2563eb] hover:underline">
            contact@reputexa.fr
          </a>
          . Vous pouvez également introduire une réclamation auprès de la CNIL ({' '}
          <a
            href="https://www.cnil.fr"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#2563eb] hover:underline"
          >
            cnil.fr
          </a>
          ).
        </p>
      </section>

      <section id="securite" className="mb-10">
        <h3 className="text-lg font-display font-semibold text-slate-900 dark:text-slate-100 mb-3">
          11. Sécurité
        </h3>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
          Nous mettons en œuvre des mesures techniques et organisationnelles appropriées (chiffrement SSL,
          authentification sécurisée, contrôle d&apos;accès) pour protéger vos données contre tout accès non
          autorisé, perte ou altération.
        </p>
      </section>

      <section id="modifications" className="mb-10">
        <h3 className="text-lg font-display font-semibold text-slate-900 dark:text-slate-100 mb-3">
          12. Modifications
        </h3>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
          Nous nous réservons le droit de modifier cette politique. Toute modification significative sera
          communiquée par email ou via une notification dans votre espace client. La date de dernière mise à
          jour est indiquée en tête du document.
        </p>
      </section>

      <section id="contact" className="mb-10">
        <h3 className="text-lg font-display font-semibold text-slate-900 dark:text-slate-100 mb-3">
          13. Nous contacter
        </h3>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
          Pour toute question relative à la protection de vos données :{' '}
          <a href="mailto:contact@reputexa.fr" className="text-[#2563eb] hover:underline">
            contact@reputexa.fr
          </a>
          .
        </p>
      </section>
    </LegalPageShell>
  );
}
