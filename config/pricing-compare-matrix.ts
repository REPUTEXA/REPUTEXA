/**
 * Matrice fonctionnalités Vision / Pulse / Zenith pour le modal Tarifs.
 * Valeurs alignées sur messages PricingPage + politique Zenith (120 j).
 */

export type PricingMatrixRow = {
  /** Titre court (1 ligne) */
  labelKey: string;
  /** Explication pédagogique optionnelle (sous le titre) */
  detailKey?: string;
  vision: boolean;
  pulse: boolean;
  zenith: boolean;
};

export type PricingMatrixSection = {
  titleKey: string;
  rows: PricingMatrixRow[];
};

export const PRICING_COMPARE_MATRIX: PricingMatrixSection[] = [
  {
    titleKey: 'matrixSection_core',
    rows: [
      {
        labelKey: 'matrixRow_aiPersonalized',
        detailKey: 'matrixRow_aiPersonalized_detail',
        vision: true,
        pulse: true,
        zenith: true,
      },
      {
        labelKey: 'matrixRow_humanQueue',
        detailKey: 'matrixRow_humanQueue_detail',
        vision: true,
        pulse: true,
        zenith: true,
      },
      {
        labelKey: 'matrixRow_singleLanguage',
        detailKey: 'matrixRow_singleLanguage_detail',
        vision: true,
        pulse: false,
        zenith: false,
      },
      {
        labelKey: 'matrixRow_multilingual',
        detailKey: 'matrixRow_multilingual_detail',
        vision: false,
        pulse: true,
        zenith: true,
      },
      {
        labelKey: 'matrixRow_tripleDraft',
        detailKey: 'matrixRow_tripleDraft_detail',
        vision: false,
        pulse: true,
        zenith: true,
      },
      {
        labelKey: 'matrixRow_tripleJudge',
        detailKey: 'matrixRow_tripleJudge_detail',
        vision: false,
        pulse: false,
        zenith: true,
      },
    ],
  },
  {
    titleKey: 'matrixSection_reporting',
    rows: [
      {
        labelKey: 'matrixRow_pdfBasic',
        detailKey: 'matrixRow_pdfBasic_detail',
        vision: true,
        pulse: true,
        zenith: true,
      },
      {
        labelKey: 'matrixRow_pdfConsultant',
        detailKey: 'matrixRow_pdfConsultant_detail',
        vision: false,
        pulse: true,
        zenith: true,
      },
      {
        labelKey: 'matrixRow_whatsappBad',
        detailKey: 'matrixRow_whatsappBad_detail',
        vision: false,
        pulse: true,
        zenith: true,
      },
      {
        labelKey: 'matrixRow_whatsappWeekly',
        detailKey: 'matrixRow_whatsappWeekly_detail',
        vision: false,
        pulse: true,
        zenith: true,
      },
      {
        labelKey: 'matrixRow_toxicShield',
        detailKey: 'matrixRow_toxicShield_detail',
        vision: false,
        pulse: true,
        zenith: true,
      },
    ],
  },
  {
    titleKey: 'matrixSection_zenith',
    rows: [
      {
        labelKey: 'matrixRow_mapsSeo',
        detailKey: 'matrixRow_mapsSeo_detail',
        vision: false,
        pulse: false,
        zenith: true,
      },
      {
        labelKey: 'matrixRow_whatsappCapture',
        detailKey: 'matrixRow_whatsappCapture_detail',
        vision: false,
        pulse: false,
        zenith: true,
      },
      {
        labelKey: 'matrixRow_whatsappSampling',
        detailKey: 'matrixRow_whatsappSampling_detail',
        vision: false,
        pulse: false,
        zenith: true,
      },
      {
        labelKey: 'matrixRow_cooldown120',
        detailKey: 'matrixRow_cooldown120_detail',
        vision: false,
        pulse: false,
        zenith: true,
      },
    ],
  },
];
