/**
 * Affiche de conformité RGPD — Rendu via @react-pdf/renderer
 *
 * Typographie réelle :
 *   - Playfair Display Bold  → nom de l'établissement (Serif haut de gamme)
 *   - Montserrat Light/Bold  → slogan, corps, phrase STOP, footer
 *
 * Lignes séparatrices à 0.3pt positionnées à ≈15 % et ≈85 % de la hauteur A4
 * paddingHorizontal: 60  •  icônes SVG réduites 20 %  •  zéro césure
 */

import React from 'react';
import {
  Document,
  Page,
  View,
  Text,
  Svg,
  Path,
  Rect,
  Circle,
  Line,
  Font,
  renderToBuffer,
} from '@react-pdf/renderer';

// ── Zéro césure automatique ───────────────────────────────────────────────────
Font.registerHyphenationCallback((word: string) => [word]);

// ── Polices réelles (jsDelivr CDN — fiable server-side) ───────────────────────
Font.register({
  family: 'Playfair Display',
  fonts: [
    {
      src: 'https://cdn.jsdelivr.net/npm/@fontsource/playfair-display/files/playfair-display-latin-400-normal.woff2',
      fontWeight: 400,
    },
    {
      src: 'https://cdn.jsdelivr.net/npm/@fontsource/playfair-display/files/playfair-display-latin-700-normal.woff2',
      fontWeight: 700,
    },
  ],
});

Font.register({
  family: 'Montserrat',
  fonts: [
    {
      src: 'https://cdn.jsdelivr.net/npm/@fontsource/montserrat/files/montserrat-latin-300-normal.woff2',
      fontWeight: 300,
    },
    {
      src: 'https://cdn.jsdelivr.net/npm/@fontsource/montserrat/files/montserrat-latin-400-normal.woff2',
      fontWeight: 400,
    },
    {
      src: 'https://cdn.jsdelivr.net/npm/@fontsource/montserrat/files/montserrat-latin-700-normal.woff2',
      fontWeight: 700,
    },
  ],
});

// ── Palette ───────────────────────────────────────────────────────────────────
const BG   = '#F5F2ED'; // fond beige crème
const INK  = '#1a1a1a'; // quasi-noir (nom, slogan, icônes)
const RULE = '#1a1a1a'; // lignes séparatrices (identique INK pour netteté max)
const BODY = '#333333'; // corps des 3 blocs (spec: '#333')
const STOP = '#1a1a1a'; // phrase STOP
const FOOT = '#9a9590'; // footer gris chaud

// ── A4 en points (@ 72dpi) ────────────────────────────────────────────────────
// Hauteur A4 = 841.89 pt
// Ligne haute à 15 % = 841.89 × 0.15 ≈ 126 pt depuis le haut
// Ligne basse à 85 % = 841.89 × 0.85 ≈ 716 pt → paddingBottom footer ≈ 126 pt
const A4_H = 841.89;
const LINE_TOP_Y    = Math.round(A4_H * 0.15); // 126
const LINE_BOTTOM_Y = Math.round(A4_H * 0.85); // 716 → footer occupe A4_H - 716 = 126 pt

// Hauteur approximative du nom (fontSize 48 × leading 1.2) + paddingBottom 14
const NAME_TEXT_H  = Math.round(48 * 1.2); // 58
const NAME_PAD_BOT = 14;
// paddingTop en-tête pour que la ligne tombe à LINE_TOP_Y
const HEADER_PAD_TOP = LINE_TOP_Y - NAME_TEXT_H - NAME_PAD_BOT; // ≈ 54

// Hauteur approximative du footer : SVG 22 + 3×gap 4 + textes ~20 + paddingTop 14
const FOOTER_CONTENT_H = 22 + 4 + 11 + 4 + 9; // ≈ 50
const FOOTER_PAD_TOP   = 14;
// paddingBottom pour que le filet bas soit à LINE_BOTTOM_Y
const FOOTER_PAD_BOT = (A4_H - LINE_BOTTOM_Y) - FOOTER_CONTENT_H - FOOTER_PAD_TOP; // ≈ 62

// ── SVG : Cadenas fermé (taille -20% : 34×34) ────────────────────────────────
function IconLock() {
  return (
    <Svg width={34} height={34} viewBox="0 0 24 24">
      <Rect x="3" y="11" width="18" height="11" rx="2"
        stroke={INK} strokeWidth={0.75} fill="none" />
      <Path d="M7 11V7a5 5 0 0110 0v4"
        stroke={INK} strokeWidth={0.75} fill="none" />
      <Circle cx="12" cy="16.4" r="1.25"
        stroke={INK} strokeWidth={0.75} fill="none" />
      <Line x1="12" y1="17.65" x2="12" y2="19.3"
        stroke={INK} strokeWidth={0.75} />
    </Svg>
  );
}

// ── SVG : Bulle de dialogue (34×35) ──────────────────────────────────────────
function IconBubble() {
  return (
    <Svg width={34} height={35} viewBox="0 0 26 28">
      <Circle cx="13" cy="10.5" r="9"
        stroke={INK} strokeWidth={0.75} fill="none" />
      <Path d="M8 18.5 L4.5 24 L13.5 18.5"
        stroke={INK} strokeWidth={0.75} fill="none" />
    </Svg>
  );
}

// ── SVG : Sablier (34×37) ─────────────────────────────────────────────────────
function IconHourglass() {
  return (
    <Svg width={34} height={37} viewBox="0 0 24 28">
      <Line x1="2"  y1="2"  x2="22" y2="2"  stroke={INK} strokeWidth={0.75} />
      <Line x1="2"  y1="26" x2="22" y2="26" stroke={INK} strokeWidth={0.75} />
      <Line x1="2"  y1="2"  x2="12" y2="14" stroke={INK} strokeWidth={0.75} />
      <Line x1="22" y1="2"  x2="12" y2="14" stroke={INK} strokeWidth={0.75} />
      <Line x1="12" y1="14" x2="2"  y2="26" stroke={INK} strokeWidth={0.75} />
      <Line x1="12" y1="14" x2="22" y2="26" stroke={INK} strokeWidth={0.75} />
      {/* Sable résiduel */}
      <Line x1="5.5" y1="21.5" x2="18.5" y2="21.5" stroke={INK} strokeWidth={1.2} />
    </Svg>
  );
}

// ── Ligne séparatrice 0.3pt bord-à-bord ──────────────────────────────────────
function SepLine() {
  return <View style={{ height: 0.3, width: '100%', backgroundColor: RULE }} />;
}

// ── Bloc : icône + texte centré ───────────────────────────────────────────────
type BlockProps = { icon: React.ReactElement; text: string };

function ContentBlock({ icon, text }: BlockProps) {
  return (
    <View style={{ alignItems: 'center', width: '80%' }}>
      <View style={{ marginBottom: 8 }}>{icon}</View>
      <Text
        style={{
          fontFamily: 'Montserrat',
          fontWeight: 300,
          fontSize: 14,
          color: BODY,
          textAlign: 'center',
          lineHeight: 1.4,
        }}
      >
        {text}
      </Text>
    </View>
  );
}

// ── Document PDF complet ──────────────────────────────────────────────────────
function PosterDocument({ name }: { name: string }) {
  return (
    <Document>
      <Page size="A4" style={{ backgroundColor: BG, padding: 0 }}>

        {/* ── EN-TÊTE : nom + filet haut à ≈15 % ─────────────────────────── */}
        <View style={{
          paddingTop:        HEADER_PAD_TOP,
          paddingHorizontal: 60,
          paddingBottom:     NAME_PAD_BOT,
          alignItems:        'center',
        }}>
          <Text style={{
            fontFamily:    'Playfair Display',
            fontWeight:    700,
            fontSize:      48,
            color:         INK,
            textAlign:     'center',
            letterSpacing: 2,
          }}>
            {name.toUpperCase()}
          </Text>
        </View>

        <SepLine />

        {/* ── ZONE CENTRALE — flex 1, espace équidistant ──────────────────── */}
        <View style={{
          flex:              1,
          flexDirection:     'column',
          alignItems:        'center',
          justifyContent:    'space-evenly',
          paddingHorizontal: 60,
        }}>

          {/* Slogan SÉRÉNITÉ NUMÉRIQUE */}
          <View style={{ alignItems: 'center' }}>
            <Text style={{
              fontFamily:    'Montserrat',
              fontWeight:    300,
              fontSize:      28,
              color:         INK,
              textAlign:     'center',
              letterSpacing: 12,
            }}>
              {'SÉRÉNITÉ NUMÉRIQUE'}
            </Text>
          </View>

          {/* Bloc 1 — Cadenas */}
          <ContentBlock
            icon={<IconLock />}
            text={
              "Votre numéro est protégé et crypté.\n" +
              "Nous ne l'utilisons que pour une seule chose :\n" +
              "vous inviter à améliorer nos services."
            }
          />

          {/* Bloc 2 — Bulle */}
          <ContentBlock
            icon={<IconBubble />}
            text={
              "Zéro Spam.\n" +
              "Vous recevrez un seul message WhatsApp.\n" +
              "Aucune publicité, aucune relance."
            }
          />

          {/* Bloc 3 — Sablier */}
          <ContentBlock
            icon={<IconHourglass />}
            text={
              "Anonymisation sous 90 jours :\n" +
              "Vos données de visite sont automatiquement effacées\n" +
              "de nos systèmes 90 jours après votre passage.\n" +
              "Nous ne conservons aucun historique de vos habitudes."
            }
          />
        </View>

        {/* ── PHRASE STOP ─────────────────────────────────────────────────── */}
        <View style={{
          alignItems:        'center',
          paddingHorizontal: 60,
          paddingBottom:     20,
          marginTop:         20,
        }}>
          <Text style={{
            fontFamily: 'Montserrat',
            fontWeight: 700,
            fontSize:   18,
            color:      STOP,
            textAlign:  'center',
            lineHeight: 1.5,
          }}>
            {"C'est vous qui décidez : répondez STOP\nà tout moment pour tout arrêter."}
          </Text>
        </View>

        {/* ── FILET BAS à ≈85 % ───────────────────────────────────────────── */}
        <SepLine />

        {/* ── FOOTER REPUTEXA ─────────────────────────────────────────────── */}
        <View style={{
          alignItems:   'center',
          paddingTop:   FOOTER_PAD_TOP,
          paddingBottom: Math.max(FOOTER_PAD_BOT, 50),
          gap: 4,
        }}>

          {/* Monogramme ® cercle */}
          <Svg width={22} height={22} viewBox="0 0 22 22">
            <Circle cx="11" cy="11" r="9.5"
              stroke={FOOT} strokeWidth={0.55} fill="none" />
            <Path
              d="M7.5 6.5 L7.5 15.5 M7.5 6.5 L12 6.5 C14.2 6.5 14.2 10.5 12 10.5 L7.5 10.5 M11.5 10.5 L14.5 15.5"
              stroke={FOOT} strokeWidth={0.75} fill="none"
            />
          </Svg>

          <Text style={{
            fontFamily:    'Montserrat',
            fontWeight:    700,
            fontSize:      9,
            color:         FOOT,
            letterSpacing: 2,
          }}>
            {'REPUTEXA'}
          </Text>

          <Text style={{
            fontFamily: 'Montserrat',
            fontWeight: 300,
            fontSize:   7.5,
            color:      FOOT,
            textAlign:  'center',
          }}>
            {'Protection des données & e-réputation'}
          </Text>
        </View>

      </Page>
    </Document>
  );
}

// ── Export public ─────────────────────────────────────────────────────────────
export async function generateCompliancePosterPdfBuffer(
  establishmentName: string,
  _logoDataUrl?: string | null
): Promise<Buffer> {
  return renderToBuffer(
    <PosterDocument name={establishmentName || 'Votre établissement'} />
  );
}
