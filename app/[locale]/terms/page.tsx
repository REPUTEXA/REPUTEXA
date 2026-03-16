import type { Metadata } from 'next';
import { LegalPageShell } from '@/components/legal/legal-page-shell';

const TOC = [
  { id: 'objet', label: '1. Objet et acceptation' },
  { id: 'services', label: '2. Description des services' },
  { id: 'inscription', label: '3. Inscription et compte' },
  { id: 'abonnement', label: '4. Abonnement et facturation' },
  { id: 'multi-etablissements', label: '5. Multi-établissements et prorata' },
  { id: 'retractation', label: '6. Droit de rétractation' },
  { id: 'resiliation', label: '7. Résiliation et remboursement' },
  { id: 'responsabilite', label: '8. Responsabilité limitée et exonérations' },
  { id: 'force-majeure', label: '9. Force majeure et divisibilité' },
  { id: 'ip', label: '10. Propriété intellectuelle' },
  { id: 'modifications', label: '11. Modifications des CGV' },
  { id: 'droit', label: '12. Droit applicable et juridiction' },
  { id: 'contact', label: '13. Contact' },
];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = 'https://reputexa.fr';
  const path = locale === 'fr' ? '/fr/terms' : `/${locale}/terms`;
  return {
    title: 'Conditions Générales de Vente | REPUTEXA',
    description:
      'Conditions générales de vente de REPUTEXA. Abonnement SaaS, droit de rétractation, responsabilité, juridiction française.',
    alternates: { canonical: `${baseUrl}${path}` },
    openGraph: {
      title: 'Conditions Générales de Vente | REPUTEXA',
      description:
        'CGV REPUTEXA : abonnement, facturation, rétractation, responsabilité limitée, droit français.',
      url: `${baseUrl}${path}`,
      siteName: 'REPUTEXA',
    },
  };
}

export default function TermsPage() {
  return (
    <LegalPageShell title="Conditions Générales de Vente" toc={TOC}>
      <p className="text-slate-600 dark:text-slate-400 mb-8">
        Dernière mise à jour : mars 2026. Les présentes Conditions Générales de Vente (CGV) régissent
        l&apos;utilisation du service REPUTEXA et s&apos;appliquent à tout abonnement souscrit sur le site
        reputexa.fr.
      </p>

      <section id="objet" className="mb-10">
        <h3 className="text-lg font-display font-semibold text-slate-900 dark:text-slate-100 mb-3">
          1. Objet et acceptation
        </h3>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
          Les présentes CGV définissent les modalités d&apos;accès et d&apos;utilisation du service REPUTEXA,
          plateforme SaaS d&apos;e-réputation. En créant un compte ou en souscrivant à un abonnement, vous
          acceptez sans réserve les présentes conditions. Si vous n&apos;acceptez pas ces CGV, vous ne devez
          pas utiliser le service.
        </p>
      </section>

      <section id="services" className="mb-10">
        <h3 className="text-lg font-display font-semibold text-slate-900 dark:text-slate-100 mb-3">
          2. Description des services
        </h3>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
          REPUTEXA propose un service d&apos;agrégation des avis Google, de suggestions de réponses par
          intelligence artificielle, d&apos;alertes en cas d&apos;avis négatifs et de reporting. Les fonctionnalités
          varient selon le plan choisi : <strong>Vision</strong>, <strong>Pulse</strong> et <strong>Zenith</strong>. La description détaillée des offres est disponible sur la page Tarifs.
        </p>
        <h4 className="text-base font-semibold text-slate-800 dark:text-slate-200 mt-4 mb-2">
          2.1 Réponses automatisées
        </h4>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-2">
          L&apos;utilisateur reconnaît et accepte que le service REPUTEXA puisse être configuré pour publier des
          réponses de manière automatisée.
        </p>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-2">
          <strong>Responsabilité :</strong> L&apos;utilisateur demeure seul responsable des contenus publiés sur
          ses fiches d&apos;établissement. Il lui appartient de configurer les filtres et les tons de l&apos;IA de
          manière appropriée.
        </p>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-2">
          <strong>Droit de modification :</strong> L&apos;utilisateur peut à tout moment modifier ou supprimer une
          réponse publiée via son tableau de bord ou directement sur la plateforme concernée (Google).
        </p>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
          <strong>Cas des avis négatifs :</strong> Pour les avis jugés « négatifs » (selon les critères du plan
          choisi), le système peut être configuré pour suspendre l&apos;automatisation et requérir une validation
          manuelle.
        </p>
        <h4 className="text-base font-semibold text-slate-800 dark:text-slate-200 mt-4 mb-2">
          Réponses IA (suggestions)
        </h4>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
          Les réponses proposées par l&apos;IA sont des <strong>suggestions</strong>. L&apos;utilisateur est tenu de
          <strong> valider, adapter ou modifier</strong> tout contenu avant publication sur les plateformes d&apos;avis.
          Aucune réponse ne peut être publiée automatiquement sans action explicite de validation du client.
        </p>
        <h4 className="text-base font-semibold text-slate-800 dark:text-slate-200 mt-4 mb-2">
          Alertes WhatsApp
        </h4>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
          Les alertes par WhatsApp (notifications en cas d&apos;avis négatif ou de signalement) sont fournies via
          l&apos;API <strong>WhatsApp (Meta)</strong>. Leur disponibilité et leur bon fonctionnement dépendent des
          conditions d&apos;utilisation et des politiques de Meta. REPUTEXA n&apos;est pas le fournisseur du service
          WhatsApp.
        </p>
        <h4 className="text-base font-semibold text-slate-800 dark:text-slate-200 mt-4 mb-2">
          Suppression d&apos;avis
        </h4>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
          La demande de suppression ou de modération d&apos;un avis auprès des plateformes (notamment Google) relève
          des politiques et des processus de ces <strong>tiers</strong>. REPUTEXA peut fournir des outils ou des
          suggestions (arguments juridiques, formulaires) pour vous accompagner, mais ne garantit aucun résultat :
          la décision finale appartient à Google ou à l&apos;opérateur concerné.
        </p>
      </section>

      <section id="inscription" className="mb-10">
        <h3 className="text-lg font-display font-semibold text-slate-900 dark:text-slate-100 mb-3">
          3. Inscription et compte
        </h3>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
          L&apos;inscription nécessite une adresse email valide et la création d&apos;un mot de passe sécurisé.
          Vous êtes responsable de la confidentialité de vos identifiants et de toutes les actions réalisées
          depuis votre compte. REPUTEXA se réserve le droit de suspendre ou fermer tout compte en cas de
          violation des CGV ou d&apos;utilisation frauduleuse.
        </p>
      </section>

      <section id="abonnement" className="mb-10">
        <h3 className="text-lg font-display font-semibold text-slate-900 dark:text-slate-100 mb-3">
          4. Abonnement et facturation
        </h3>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
          L&apos;abonnement est <strong>récurrent</strong> (mensuel ou annuel selon le plan choisi) et fait l&apos;objet
          d&apos;un prélèvement automatique via <strong>Stripe</strong>. Le paiement est collecté par Stripe, Inc.
          (cartes bancaires, SEPA, moyens de paiement locaux). Les tarifs sont indiqués en euros TTC sur la page
          Tarifs.
        </p>
        <ul className="list-disc list-inside space-y-1.5 text-slate-600 dark:text-slate-400 ml-2 mb-3">
          <li>La facturation intervient à la souscription, puis à chaque date anniversaire de renouvellement</li>
          <li><strong>Tout mois ou période entamé est intégralement dû</strong> ; aucun remboursement prorata temporis ne sera accordé en cas de résiliation en cours de période</li>
          <li>Les factures sont disponibles dans votre espace client et via le portail client Stripe</li>
          <li>En cas de paiement refusé, vous serez informé ; vous disposerez d&apos;un délai pour mettre à jour vos informations de paiement avant suspension du service</li>
        </ul>
      </section>

      <section id="multi-etablissements" className="mb-10">
        <h3 className="text-lg font-display font-semibold text-slate-900 dark:text-slate-100 mb-3">
          5. Multi-établissements, prix dégressifs et gestion des crédits
        </h3>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
          Les plans permettant plusieurs établissements (Pulse, Zenith) appliquent une <strong>politique de prix dégressifs</strong> :
          plus le nombre d&apos;emplacements souscrits est élevé, plus le prix unitaire par établissement diminue
          (remises progressives selon les paliers, détaillées sur la page Tarifs).
        </p>
        <h4 className="text-base font-semibold text-slate-800 dark:text-slate-200 mt-4 mb-2">
          Ajout d&apos;établissements (prorata)
        </h4>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
          Lorsqu&apos;un client ajoute un ou plusieurs établissements en cours de période de facturation :
        </p>
        <ul className="list-disc list-inside space-y-1.5 text-slate-600 dark:text-slate-400 ml-2 mb-3">
          <li><strong>Un prorata immédiat est appliqué</strong> au prorata temporis pour les jours restants jusqu&apos;à la prochaine échéance, en tenant compte du barème dégressif</li>
          <li>Le complément est facturé et prélevé immédiatement lors de l&apos;ajout</li>
          <li>Le client accepte cette facturation en validant l&apos;ajout d&apos;établissement(s)</li>
        </ul>
        <h4 className="text-base font-semibold text-slate-800 dark:text-slate-200 mt-4 mb-2">
          Passage à un plan inférieur ou réduction du nombre d&apos;emplacements (downgrade)
        </h4>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-2">
          En cas de passage à un plan moins cher ou de réduction du nombre d&apos;établissements souscrits, la gestion
          financière est assurée par <strong>Stripe</strong> : une <strong>note de crédit</strong> est générée sur le
          compte client pour la partie non utilisée de la période en cours, crédit qui sera déduit des prochaines factures.
          Les données et établissements déjà créés sont <strong>conservés</strong> ; seuls les accès sont limités au
          nouveau quota (les emplacements au-delà du quota sont désactivés jusqu&apos;à un nouvel upgrade). Aucune
          suppression de données n&apos;est effectuée du fait d&apos;un downgrade.
        </p>
      </section>

      <section id="retractation" className="mb-10">
        <h3 className="text-lg font-display font-semibold text-slate-900 dark:text-slate-100 mb-3">
          6. Droit de rétractation
        </h3>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
          Conformément à l&apos;article L. 221-18 du Code de la consommation, le consommateur dispose d&apos;un
          délai de 14 jours calendaires pour exercer son droit de rétractation.
        </p>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
          <strong>Renonciation express au droit de rétractation – exécution immédiate :</strong> En créant un
          compte, en activant une période d&apos;essai ou en accédant au service, le client demande
          expressément l&apos;exécution immédiate du service numérique. Conformément à l&apos;article L. 221-25
          du Code de la consommation, le client renonce irrévocablement à son droit de rétractation pour
          ce service, dès lors que l&apos;exécution a commencé avec son accord préalable exprès.
        </p>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
          Pour toute question :{' '}
          <a href="mailto:contact@reputexa.fr" className="text-[#2563eb] hover:underline">
            contact@reputexa.fr
          </a>
          .
        </p>
      </section>

      <section id="resiliation" className="mb-10">
        <h3 className="text-lg font-display font-semibold text-slate-900 dark:text-slate-100 mb-3">
          7. Résiliation et remboursement
        </h3>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-2">
          Vous pouvez résilier votre abonnement à tout moment depuis votre espace client ou via le portail
          client Stripe. La résiliation prend effet à la fin de la période en cours ; aucun prorata ne sera
          appliqué pour les jours restants.
        </p>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
          REPUTEXA se réserve le droit de suspendre ou résilier l&apos;accès en cas de non-paiement, de
          violation des CGV ou d&apos;usage contraire à l&apos;éthique. Les remboursements sont traités au
          cas par cas, conformément à la réglementation en vigueur.
        </p>
      </section>

      <section id="responsabilite" className="mb-10">
        <h3 className="text-lg font-display font-semibold text-slate-900 dark:text-slate-100 mb-3">
          8. Responsabilité limitée et exonérations
        </h3>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
          REPUTEXA s&apos;engage à fournir un service de qualité conforme à sa description. Les clauses ci-dessous
          s&apos;appliquent sans restriction, quel que soit le chiffre d&apos;affaires du client.
        </p>

        <h4 className="text-base font-semibold text-slate-800 dark:text-slate-200 mt-4 mb-2">
          8.1 Limitation de responsabilité maximale
        </h4>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-2">
          La responsabilité totale de REPUTEXA, tous faits et dommages confondus, est strictement plafonnée au
          montant des sommes effectivement versées par le client au titre de l&apos;abonnement au cours des douze
          (12) derniers mois précédant le fait générateur de responsabilité. En aucun cas REPUTEXA ne pourra être
          tenue responsable des dommages indirects, incluant notamment sans s&apos;y limiter : la perte de profits,
          la perte de chiffre d&apos;affaires, la perte de clients, la perte de données, les préjudices commerciaux,
          la perte de données liées aux avis ou à la fiche Google Business Profile, ou tout autre préjudice
          économique de même nature.
        </p>

        <h4 className="text-base font-semibold text-slate-800 dark:text-slate-200 mt-4 mb-2">
          8.2 Exonération – Intelligence artificielle
        </h4>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-2">
          REPUTEXA fournit un outil d&apos;assistance proposant des <strong>suggestions</strong> de réponses générées
          par des modèles d&apos;intelligence artificielle. Ces suggestions sont fournies à titre strictement indicatif.
          Le client est l&apos;<strong>unique responsable éditorial</strong> des réponses qu&apos;il choisit de publier
          sur les plateformes d&apos;avis. REPUTEXA décline toute responsabilité quant aux erreurs, inexactitudes,
          hallucinations, propos inappropriés, non conformes ou illicites que pourraient contenir les contenus
          générés par l&apos;IA. Le client s&apos;engage à vérifier, adapter et valider tout contenu avant publication.
        </p>

        <h4 className="text-base font-semibold text-slate-800 dark:text-slate-200 mt-4 mb-2">
          8.3 Indépendance de Google et suppression d&apos;avis
        </h4>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-2">
          REPUTEXA est une entreprise indépendante de Google LLC, Google Ireland Limited et de toute entité du
          groupe Google. REPUTEXA n&apos;exerce aucun contrôle sur les services, API, politiques ou conditions
          d&apos;utilisation de Google. La <strong>suppression ou la modération d&apos;avis</strong> dépend exclusivement
          des tiers (Google et autres plateformes) ; REPUTEXA fournit un accompagnement (arguments, formulaires) mais
          ne peut garantir aucun résultat. Tout changement apporté par Google à ses API, à ses règles de modération,
          à la suspension ou la suppression d&apos;une fiche Google Business Profile, ou à toute autre modification
          de ses services, ne peut donner lieu à un remboursement, une indemnisation ou une réduction tarifaire de
          la part de REPUTEXA. Le client assume l&apos;ensemble des risques liés à l&apos;utilisation des services Google.
        </p>

        <h4 className="text-base font-semibold text-slate-800 dark:text-slate-200 mt-4 mb-2">
          8.4 Tiers et hébergeurs
        </h4>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
          Les perturbations, indisponibilités ou défaillances imputables à des tiers (Google, Stripe, hébergeurs,
          prestataires techniques) ne sauraient engager la responsabilité de REPUTEXA au-delà de ses obligations
          contractuelles expressément prévues aux présentes.
        </p>
      </section>

      <section id="force-majeure" className="mb-10">
        <h3 className="text-lg font-display font-semibold text-slate-900 dark:text-slate-100 mb-3">
          9. Force majeure et divisibilité
        </h3>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
          <strong>Force majeure :</strong> REPUTEXA ne pourra être tenue pour responsable du non-respect de ses
          obligations en cas de force majeure au sens de l&apos;article 1218 du Code civil (événement échappant au
          contrôle raisonnable du débiteur, imprévisible, irrésistible et extérieur).
        </p>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
          <strong>Divisibilité :</strong> Si une ou plusieurs stipulations des présentes CGV sont jugées nulles ou
          inapplicables par une décision de justice devenue définitive, les autres stipulations conserveront toute
          leur force et leur portée.
        </p>
      </section>

      <section id="ip" className="mb-10">
        <h3 className="text-lg font-display font-semibold text-slate-900 dark:text-slate-100 mb-3">
          10. Propriété intellectuelle
        </h3>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
          REPUTEXA conserve la propriété exclusive de la plateforme, des algorithmes, des interfaces et de
          toute marque associée. L&apos;abonnement vous accorde un droit d&apos;usage non exclusif et non
          transférable, strictement limité à votre usage professionnel. Toute reproduction ou exploitation
          non autorisée est prohibée.
        </p>
      </section>

      <section id="modifications" className="mb-10">
        <h3 className="text-lg font-display font-semibold text-slate-900 dark:text-slate-100 mb-3">
          11. Modifications des CGV
        </h3>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
          REPUTEXA peut modifier les présentes CGV. Les modifications substantielles seront communiquées par
          email au minimum 30 jours avant leur entrée en vigueur. En cas de désaccord, vous pourrez résilier
          votre abonnement avant la date d&apos;application. La poursuite de l&apos;utilisation du service
          vaut acceptation des nouvelles conditions.
        </p>
      </section>

      <section id="droit" className="mb-10">
        <h3 className="text-lg font-display font-semibold text-slate-900 dark:text-slate-100 mb-3">
          12. Droit applicable et juridiction
        </h3>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-2">
          Les présentes CGV sont soumises au <strong>droit français</strong>. À défaut d&apos;accord amiable,
          il est attribué <strong>compétence exclusive au Tribunal de Commerce de Paris</strong> pour tout litige
          relatif à leur interprétation ou à leur exécution.
        </p>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
          Le client consommateur résidant dans l&apos;Union européenne conserve la faculté de saisir les tribunaux
          de son lieu de résidence, conformément au Règlement (UE) n° 1215/2012 (Bruxelles I bis).
        </p>
      </section>

      <section id="contact" className="mb-10">
        <h3 className="text-lg font-display font-semibold text-slate-900 dark:text-slate-100 mb-3">
          13. Contact
        </h3>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
          Pour toute question relative aux présentes CGV :{' '}
          <a href="mailto:contact@reputexa.fr" className="text-[#2563eb] hover:underline">
            contact@reputexa.fr
          </a>
          .
        </p>
      </section>
    </LegalPageShell>
  );
}
