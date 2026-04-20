export type TunnelDemoMessage = { from: 'business' | 'client'; text: string };

/** Réponse « publique » différée (démo landing) — après publication d’un avis. */
export type TunnelGoogleScene = {
  /** Extrait de l’avis tel qu’affiché sur la fiche. */
  reviewSnippet: string;
  /** Réponse du commerce (humaine, reprend un détail du fil privé). */
  businessReply: string;
  /** Libellé du délai (ex. « ~18 h plus tard »). */
  replyDelayHint: string;
};

/** Parcours démo — imposé ou tiré au sort côté API. */
export type TunnelScenarioPath =
  | 'decline_first'
  | 'happy_full'
  | 'happy_with_edit'
  | 'stop_after_yes';

export type TunnelDemoPayload = {
  establishmentName: string;
  messages: TunnelDemoMessage[];
  enginesUsed: ('openai' | 'anthropic')[];
  /** Présent si généré avec un chemin explicite ou renvoyé par l’IA. */
  scenario?: TunnelScenarioPath;
  /** Scène « Google » (avis + réponse propriétaire différée) — surtout happy_*. */
  googleScene?: TunnelGoogleScene | null;
};
