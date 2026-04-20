/**
 * Manifestes culturels par locale — ancrage « ultra-natif » (ex. Milan pour l’italien).
 * Injectés à 100 % dans les passes transcréation + auto-critique Babel.
 */

export function getCulturalManifestForLocale(localeCode: string): string {
  const lc = localeCode.toLowerCase();
  if (lc === 'it') {
    return `MANIFESTE CULTUREL — Italie (référence Milan & nord premium · CHR luxe)
Obligation absolue : appliquer ces règles à 100 % sur tout texte visible, y compris exemples, placeholders et noms fictifs.

• Identité locale : l’application doit sembler conçue pour un directeur d’exploitation milanais / nord-italien (ton premium hôtel-restaurant-bar, jamais « traduit du français »).

• Noms & enseignes fictifs : privilégier cognoms italiens (ex. Rossi, Bianchi, Fontana, Colombo, Ricci) ; prénoms (Marco, Giulia, Luca, Alessandra, Chiara) ; enseignes crédibles (ex. Ristorante La Brisa, Caffè Duomo, Hotel Navigli) ; villes : Milano en tête, puis Bergamo, Como, Verona, Torino, Roma si le contexte l’exige.

• Terminologie produit (alignement glossaire, sans exception quand le sens correspond) : « Locale » pour l’établissement / le point de vente ; « Valutazione » pour la note ou le score ; « Recensione » pour l’avis client ; « Cruscotto » pour le tableau de bord pilotage lorsque l’UI le porte.

• Formats : téléphones +39, codes postaux italiens crédibles, devise €.

• Style : majordome italien — formel, élégant, idiomatique CHR ; éviter calques, anglicismes inutiles et formulations robotiques.`;
  }
  if (lc === 'es') {
    return `MANIFIESTO CULTURAL — España (hostelería y retail premium peninsular)
Aplicación estricta al 100 % en todo texto visible, ejemplos y placeholders.

• Localización : tono de herramienta profesional para directivos de establecimientos en España (formal y cercano según B2B).

• Nombres ficticios : apellidos (García, Martínez, López, Fernández, Sánchez) ; nombres (Carlos, María, Javier, Elena) ; ciudades (Madrid, Barcelona, Sevilla, Valencia, Bilbao) ; marcas de ejemplo creíbles.

• Terminología (glosario) : « Establecimiento » para el local ; « Valoración » para puntuación ; « Reseña » para reseña de cliente ; « Panel de control » para el espacio de mando cuando encaje.

• Formatos : +34, código postal español, €.

• Estilo : directivo premium, sin calcas del francés ni frases literales genéricas.`;
  }
  if (lc === 'de') {
    return `KULTUR-MANIFEST — Deutschland / DACH (Premium-Gastgewerbe & Betrieb)
Strikte Anwendung zu 100 % auf alle sichtbaren Texte, Beispiele und Platzhalter.

• Lokaler Fokus : Ton und Beispiele wie für Betriebsleiter:innen in Deutschland / DACH (B2B-Sie, professionell, klar).

• Beispielnamen : Nachnamen (Müller, Schmidt, Schneider, Weber, Fischer) ; Vornamen (Thomas, Anna, Stefan, Julia) ; Städte (Berlin, München, Hamburg, Köln, Wien nur wenn Kontext passt).

• Terminologie (Glossar) : « Betrieb » für den Standort / die Einrichtung ; « Bewertung » für Note/Score und Kundenbewertung je nach Kontext ; « Abonnement » ; « Dashboard » wo UI-üblich.

• Formate : +49, PLZ DE, €.

• Stil : kein Französisch-Kalkül ; idiomatisches Hochdeutsch ; keine wortwörtliche Robotik.`;
  }
  if (lc === 'pt') {
    return `MANIFESTO CULTURAL — Portugal (referência premium hotelaria / restauração / retalho B2B)
Aplicação obrigatória a 100 % a todo o texto visível, exemplos e placeholders.

• Tom : profissional de confiança para diretores de estabelecimento em Portugal (formalidade adequada B2B, cordialidade contida).

• Nomes fictícios : apelidos portugueses (Silva, Santos, Ferreira, Pereira, Costa) ; prénomes (João, Maria, Pedro, Ana) ; cidades (Lisboa, Porto, Braga, Coimbra, Faro).

• Terminologia (glossário) : « Estabelecimento » / contexto local ; « Avaliação » para nota ou classificação ; « Painel » para o espaço de comando quando fizer sentido.

• Formatos : +351, código postal PT, €.

• Estilo : português europeu idiomático ; sem calques do francês ; sem tradução palavra a palavra.`;
  }
  if (lc === 'ja') {
    return `文化的マニフェスト — 日本（高級ホテル・飲食・小売B2B向けSaaS）
ユーザーに見える全テキスト、例示・プレースホルダーに100%適用。

• トーン：敬語を基調とした丁寧・上質なビジネス文体（過則な砕けた表現は避ける）。「翻訳されたフランス語」に聞こえない自然な日本語。

• 固有名の例：日本人名・カタカナの店名・国内都市（東京、大阪、京都、福岡、札幌など）。電話・郵便番号は日本の形式。

• 製品用語：ダッシュボード、レビュー、評判、サブスクリプション等はグロッサリーと整合。

• スタイル：ラグジュアリー×テックのプロフェッショナル。読みやすさと信頼感を最優先。`;
  }
  if (lc === 'zh') {
    return `文化定调 — 中国大陆（高端酒店 / 餐饮 / 零售 B2B SaaS）
适用于所有可见文案、示例与占位符，100% 执行。

• 语气：正式、可信赖、偏商务书面语；避免翻译腔与法语直译痕迹。

• 示例名：常见中文姓名、真实城市（北京、上海、深圳、广州、成都等）；格式 +86、邮编与人民币语境合理。

• 术语：与词汇表一致（控制台、门店、评价、订阅、试用等）。

• 使用简体中文；简洁、清晰、高端体验。`;
  }
  if (lc === 'en' || lc === 'en-us') {
    return `CULTURAL MANIFEST — United States (premium hospitality SaaS, B2B)
Apply 100% to every visible string, demo names, and placeholders.

• Tone : confident, clear, US English (International Tech / Business Standard). Not UK spelling.

• Sample names : US-credible given names and surnames ; cities (New York, San Francisco, Austin, Chicago, Miami) as fits context.

• Terminology : align with glossary (Dashboard, Property, Review, Subscription, etc.).

• Style : no French calque ; no literal translationese ; natural product copy.`;
  }
  if (lc === 'en-gb') {
    return `CULTURAL MANIFEST — United Kingdom (premium hospitality SaaS, B2B)
Apply 100% to every visible string, demo names, and placeholders.

• Tone : professional British English : UK spelling (colour, organisation, centre), vocabulary and punctuation conventions.

• Sample names : UK-credible names; cities (London, Edinburgh, Manchester, Bristol, Cardiff) when context fits.

• Terminology : align with glossary ; UK-preferred wording (e.g. "Premises" where appropriate).

• Style : no Americanisms unless product-locked ; no French calque ; natural, native UK copy.`;
  }
  return '';
}
