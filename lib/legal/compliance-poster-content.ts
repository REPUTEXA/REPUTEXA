/**
 * PDF « affiche comptoir » — textes par marché (FR, GB, ES, DE, IT).
 * Références légales adaptées : CNIL, ICO, AEPD, Landesbehörden / DSGVO, Garante.
 * Aligné avec le bloc Legal des fichiers messages.
 */

export type PosterMarket = 'fr' | 'en' | 'es' | 'de' | 'it';

const POSTER_LOCALES = new Set<string>(['fr', 'en', 'es', 'de', 'it']);

export function posterMarketFromLocale(raw: string): PosterMarket {
  const n = raw.toLowerCase().trim();
  return (POSTER_LOCALES.has(n) ? n : 'fr') as PosterMarket;
}

export type CompliancePosterCopy = {
  documentTitle: string;
  documentSubject: string;
  kicker: string;
  establishmentFallback: string;
  leadBold: string;
  leadMuted: string;
  yourDataTitle: string;
  yourDataLines: [string, string];
  oneMessageTitle: string;
  oneMessageLines: [string, string, string];
  retentionTitle: string;
  retentionLines: [string, string, string];
  controlBanner: string;
  furtherTitle: string;
  privacyLead: string;
  erasureLead: string;
  legalFramework: string;
  techTagline: string;
  printHints: { A4: string; A5: string; A3: string };
};

const COPY: Record<PosterMarket, CompliancePosterCopy> = {
  fr: {
    documentTitle: 'Affiche information clients',
    documentSubject:
      'Information préalable — contact post-visite (amélioration du service) — WhatsApp — RGPD',
    kicker: 'Affiche au comptoir — information clients',
    establishmentFallback: 'VOTRE ÉTABLISSEMENT',
    leadBold:
      "Après votre visite, nous pouvons vous envoyer un court message WhatsApp pour savoir comment tout s'est passé et nous aider à améliorer le service.",
    leadMuted:
      "Objectif : recueillir votre retour d'expérience et faire évoluer l'accueil. Ce message peut proposer un lien pour partager votre avis en ligne, si vous le souhaitez. Traitement sous la responsabilité de l'établissement ; REPUTEXA fournit uniquement l'outil technique d'envoi et de file d'attente.",
    yourDataTitle: 'Vos données',
    yourDataLines: [
      'Votre numéro est utilisé uniquement pour ce contact de retour, dans le cadre défini en caisse ou lors de votre inscription (fidélité, commande, etc.).',
      "Transmission sécurisée ; pas d'usage publicitaire hors ce contexte.",
    ],
    oneMessageTitle: 'Un seul message',
    oneMessageLines: [
      'Un seul message WhatsApp au maximum pour cette prise de nouvelles (avis), hors messages liés à votre fidélité déjà acceptés en magasin.',
      'Pas de newsletters ni de relances commerciales hors cadre par ce canal.',
      'Répondez STOP à tout moment : fin des messages ; un retrait total peut clôturer le compte fidélité et les points non utilisés, selon le règlement du commerçant.',
    ],
    retentionTitle: 'Durée côté outil technique',
    retentionLines: [
      "Les données liées à la file d'attente sont conservées au plus {retentionDays} jours, puis anonymisées ou effacées selon nos procédures (identifiants non conservés au-delà de ce délai, sous réserve d'opposition ou obligations légales).",
      "Sans opposition : aucune nouvelle sollicitation d'avis pour ce numéro avant {cooldownDays} jours après le début de la précédente campagne ; à l'issue de ce délai, un nouvel envoi peut être déclenché (sauf liste d'opposition).",
      "La liste d'opposition (STOP) est conservée pour ne plus vous recontacter.",
    ],
    controlBanner:
      'STOP : arrêt des sollicitations ; effet éventuel sur le compte fidélité selon le règlement affiché — sans frais (hors coût opérateur).',
    furtherTitle: 'Pour aller plus loin (à saisir dans un navigateur)',
    privacyLead: 'Politique unique « Fidélité et avis » — confidentialité et détail des traitements :',
    erasureLead: "Demande d'effacement sans WhatsApp (clients finaux) :",
    legalFramework:
      'Base juridique applicable : Règlement (UE) 2016/679 (RGPD) et loi « Informatique et Libertés ». Autorité de contrôle : CNIL — www.cnil.fr.',
    techTagline: "Outil technique — retour d'expérience et e-réputation",
    printHints: {
      A4: 'A4, échelle 100 % (sans « Ajuster à la page »), papier blanc ou ivoire',
      A5: 'A5, échelle 100 %, papier blanc ou ivoire — affichage compact',
      A3: 'A3, échelle 100 % — affichage mural ou consultation à distance',
    },
  },
  en: {
    documentTitle: 'Customer information notice',
    documentSubject:
      'Fair processing information — post-visit feedback — WhatsApp — UK GDPR',
    kicker: 'Counter notice — customer information',
    establishmentFallback: 'YOUR BUSINESS',
    leadBold:
      'After your visit, we may send you a short WhatsApp message to see how things went and help us improve our service.',
    leadMuted:
      'Purpose: service improvement and feedback. The message may include a link to leave a public review if you wish. Processing is the responsibility of the business; REPUTEXA only provides the technical messaging and queue tool.',
    yourDataTitle: 'Your data',
    yourDataLines: [
      'Your phone number is used only for this follow-up, as explained at checkout or when you joined our loyalty scheme or order flow.',
      'Secure transmission; no unrelated marketing use of this channel.',
    ],
    oneMessageTitle: 'One message',
    oneMessageLines: [
      'At most one WhatsApp message for this follow-up.',
      'No newsletters or sales pushes via this channel.',
      'Reply STOP at any time: you will be removed and will not receive further messages of this type.',
    ],
    retentionTitle: 'Retention (technical platform)',
    retentionLines: [
      'Queue-related data is kept for up to {retentionDays} days, then anonymised or erased in line with our procedures, subject to legal obligations.',
      'Unless you object, no further review invitation for this number before {cooldownDays} days from the start of the previous campaign; after that a new send may occur unless you are on a suppression list.',
      'STOP/suppression records are kept so we do not contact you again on this basis.',
    ],
    controlBanner:
      'You stay in control: reply STOP at any time to stop further messages, at no cost.',
    furtherTitle: 'More information (type in a browser)',
    privacyLead: 'Privacy policy and processing details:',
    erasureLead: 'Erasure request without WhatsApp (end customers):',
    legalFramework:
      'Applicable law: UK GDPR and the Data Protection Act 2018. Supervisory authority: Information Commissioner’s Office (ICO) — ico.org.uk.',
    techTagline: 'Technical platform — feedback and e-reputation',
    printHints: {
      A4: 'A4 at 100 % scale (do not use “Fit to page”), white or ivory paper',
      A5: 'A5 at 100 % — compact display',
      A3: 'A3 at 100 % — wall display or viewing from a distance',
    },
  },
  es: {
    documentTitle: 'Cartel informativo para clientes',
    documentSubject:
      'Información previa — contacto tras la visita — WhatsApp — RGPD',
    kicker: 'Cartel en mostrador — información al cliente',
    establishmentFallback: 'SU ESTABLECIMIENTO',
    leadBold:
      'Tras su visita, podemos enviarle un breve mensaje de WhatsApp para saber cómo ha ido todo y ayudarnos a mejorar el servicio.',
    leadMuted:
      'Finalidad: conocer su experiencia y mejorar la atención. El mensaje puede incluir un enlace para publicar su valoración si lo desea. El responsable del tratamiento es el establecimiento; REPUTEXA solo presta la herramienta técnica de envío y la cola.',
    yourDataTitle: 'Sus datos',
    yourDataLines: [
      'Su teléfono se usa solo para este contacto, en el marco indicado en caja o al registrarse (fidelización, pedido, etc.).',
      'Transmisión segura; no hay uso publicitario ajeno a este contexto.',
    ],
    oneMessageTitle: 'Un solo mensaje',
    oneMessageLines: [
      'Como máximo un mensaje de WhatsApp para este seguimiento.',
      'No newsletters ni promociones por este canal.',
      'Responda STOP en cualquier momento: dejaremos de enviarle este tipo de mensajes.',
    ],
    retentionTitle: 'Plazo en la herramienta técnica',
    retentionLines: [
      'Los datos de la cola se conservan como máximo {retentionDays} días y luego se anonimizan o borran según nuestros procedimientos, salvo obligación legal.',
      'Sin oposición: no se enviará una nueva invitación de valoración a este número antes de {cooldownDays} días desde el inicio de la campaña anterior; después podría enviarse otra, salvo lista de bloqueo.',
      'La lista STOP se conserva para no volver a contactarle en este marco.',
    ],
    controlBanner:
      'Usted decide: responda STOP en cualquier momento para dejar de recibir mensajes, sin coste.',
    furtherTitle: 'Más información (escribir en el navegador)',
    privacyLead: 'Política de privacidad y detalle de tratamientos:',
    erasureLead: 'Solicitud de supresión sin WhatsApp (clientes finales):',
    legalFramework:
      'Normativa aplicable: RGPD (UE 2016/679) y LO 3/2018 de Protección de Datos. Autoridad de control: Agencia Española de Protección de Datos (AEPD) — www.aepd.es.',
    techTagline: 'Herramienta técnica — experiencia del cliente y reputación online',
    printHints: {
      A4: 'A4, escala 100 % (sin «Ajustar a la página»), papel blanco o marfil',
      A5: 'A5, escala 100 % — formato compacto',
      A3: 'A3, escala 100 % — uso en pared o lectura a distancia',
    },
  },
  de: {
    documentTitle: 'Kundeninformation am Point of Sale',
    documentSubject:
      'Information nach Art. 13 / 14 DSGVO — Kontakt nach dem Besuch — WhatsApp',
    kicker: 'Thekenaufsteller — Kundeninformation',
    establishmentFallback: 'IHR BETRIEB',
    leadBold:
      'Nach Ihrem Besuch können wir Ihnen eine kurze WhatsApp-Nachricht senden, um zu erfahren, wie alles war und unseren Service zu verbessern.',
    leadMuted:
      'Zweck: Rückmeldung zur Serviceverbesserung. Die Nachricht kann optional einen Link zur öffentlichen Bewertung enthalten. Verantwortlich ist das jeweilige Unternehmen; REPUTEXA stellt ausschließlich das technische Versand- und Warteschlangen-Tool bereit.',
    yourDataTitle: 'Ihre Daten',
    yourDataLines: [
      'Ihre Telefonnummer wird nur für diese Rückmeldung genutzt, wie an der Kasse oder bei Treueprogramm/Bestellung erläutert.',
      'Übertragung geschützt; keine werbliche Nutzung außerhalb dieses Kontexts.',
    ],
    oneMessageTitle: 'Eine Nachricht',
    oneMessageLines: [
      'Höchstens eine WhatsApp-Nachricht für dieses Follow-up.',
      'Keine Newsletter oder Verkaufswerbung über diesen Kanal.',
      'Antworten Sie STOP jederzeit: Sie werden von der Liste genommen und erhalten keine weiteren Nachrichten dieser Art.',
    ],
    retentionTitle: 'Aufbewahrung (technische Plattform)',
    retentionLines: [
      'Warteschlangendaten werden höchstens {retentionDays} Tage gespeichert, danach anonymisiert oder gelöscht nach unseren Verfahren, sofern keine gesetzliche Pflicht entgegensteht.',
      'Ohne Widerspruch: keine neue Bewertungsaufforderung für diese Nummer vor Ablauf von {cooldownDays} Tagen nach Start der vorherigen Kampagne; danach kann ein neuer Versand erfolgen (außer Sperr-/STOP-Liste).',
      'STOP-/Sperrdaten werden gespeichert, damit wir Sie in diesem Rahmen nicht erneut kontaktieren.',
    ],
    controlBanner:
      'Sie behalten die Kontrolle: Antworten Sie STOP, um jederzeit ohne Kosten keine weiteren Nachrichten zu erhalten.',
    furtherTitle: 'Weitere Informationen (im Browser eingeben)',
    privacyLead: 'Datenschutzerklärung und Einzelheiten der Verarbeitung:',
    erasureLead: 'Löschgesuch ohne WhatsApp (Endkunden):',
    legalFramework:
      'Rechtsgrundlage: DSGVO und BDSG. Zuständige Aufsichtsbehörde: die für den Verantwortlichen zuständige Landesdatenschutzbehörde (Liste: www.bfdi.bund.de). Hinweise auch im Impresseum auf der Website.',
    techTagline: 'Technische Plattform — Feedback und digitale Reputation',
    printHints: {
      A4: 'A4, 100 % Maßstab (nicht „An Seite anpassen“), weißes oder creme Papier',
      A5: 'A5, 100 % — kompakte Darstellung',
      A3: 'A3, 100 % — Wandmontage oder Lesen aus der Distanz',
    },
  },
  it: {
    documentTitle: 'Avviso informativo per i clienti',
    documentSubject:
      "Informazione preventiva — contatto post-visita — WhatsApp — GDPR",
    kicker: 'Avviso al banco — informazione ai clienti',
    establishmentFallback: 'LA VOSTRA ATTIVITÀ',
    leadBold:
      'Dopo la visita, potremmo inviarvi un breve messaggio WhatsApp per capire come è andata e migliorare il servizio.',
    leadMuted:
      "Finalità: raccogliere feedback e migliorare l'accoglienza. Il messaggio può proporre un link per lasciare una recensione online, se lo desiderate. Titolare del trattamento è l'esercizio; REPUTEXA fornisce solo lo strumento tecnico di invio e la coda.",
    yourDataTitle: 'I vostri dati',
    yourDataLines: [
      'Il numero è usato solo per questo contatto, nel quadro indicato in cassa o all’iscrizione (fedeltà, ordine, ecc.).',
      'Trasmissione protetta; nessun uso pubblicitario estraneo a questo contesto.',
    ],
    oneMessageTitle: 'Un solo messaggio',
    oneMessageLines: [
      'Al massimo un messaggio WhatsApp per questo follow-up.',
      'Niente newsletter o promozioni commerciali tramite questo canale.',
      'Rispondete STOP in qualsiasi momento: verrete rimossi e non riceverete altri messaggi di questo tipo.',
    ],
    retentionTitle: 'Conservazione (strumento tecnico)',
    retentionLines: [
      'I dati della coda sono conservati al massimo {retentionDays} giorni, poi anonimizzati o cancellati secondo le nostre procedure, salvo obblighi di legge.',
      'Senza opposizione: nessun nuovo invito a recensire per questo numero prima di {cooldownDays} giorni dall’inizio della campagna precedente; trascorso tale termine può essere inviato un nuovo messaggio (salvo lista di opposizione).',
      'La lista STOP è conservata per non ricontattarvi in questo ambito.',
    ],
    controlBanner:
      'Siete padroni del trattamento: rispondete STOP in qualsiasi momento per interrompere, senza costi.',
    furtherTitle: 'Per approfondire (digitare nel browser)',
    privacyLead: 'Informativa privacy e dettaglio dei trattamenti:',
    erasureLead: 'Richiesta di cancellazione senza WhatsApp (clienti finali):',
    legalFramework:
      'Normativa applicabile: GDPR (UE 2016/679) e Codice privacy (D.lgs. 196/2003 e s.m.i.). Autorità di controllo: Garante per la protezione dei dati personali — www.garanteprivacy.it.',
    techTagline: 'Strumento tecnico — feedback e reputazione online',
    printHints: {
      A4: 'A4, scala 100 % (senza «Adatta alla pagina»), carta bianca o avorio',
      A5: 'A5, scala 100 % — formato compatto',
      A3: 'A3, scala 100 % — esposizione a muro o lettura a distanza',
    },
  },
};

export function getCompliancePosterCopy(locale: string): CompliancePosterCopy {
  const key = posterMarketFromLocale(locale);
  return COPY[key];
}

export function fillRetentionPlaceholders(
  lines: [string, string, string],
  retentionDays: number,
  cooldownDays: number
): [string, string, string] {
  return lines.map((l) =>
    l.replace(/\{retentionDays\}/g, String(retentionDays)).replace(/\{cooldownDays\}/g, String(cooldownDays))
  ) as [string, string, string];
}
