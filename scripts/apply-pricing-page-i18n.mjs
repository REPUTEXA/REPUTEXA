/**
 * One-shot sync: replace PricingPage in locale files with full plan copy (Vision/Pulse/Zenith).
 * Run: node scripts/apply-pricing-page-i18n.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const messagesDir = path.join(__dirname, '..', 'messages');

/** @type {Record<string, Record<string, string>>} */
const PAGES = {
  de: {
    headline: 'Wählen Sie Ihren Plan',
    subtitle: 'Kostenlose Testphase · Unverbindlich',
    monthly: 'Monatlich',
    annual: 'Jährlich',
    annualBadge: '-20%',
    perMonth: '/Monat',
    perYear: '/Jahr',
    billedAnnually: 'Jährlich abgerechnet ({amount})',
    establishments: 'Standorte',
    perEstablishments: 'für {count} Standorte',
    savings: 'Sparen Sie {amount}',
    savingsBadge: 'Sparen Sie {amount}',
    savingsPerYear: 'Sie sparen {amount} / Jahr',
    backToDashboard: 'Zurück zum Dashboard',
    ctaChoose: 'Diesen Plan wählen',
    ctaSubscribe: 'Kostenlos testen',
    ctaTrial: 'Kostenlos testen',
    checkoutError: 'Fehler bei der Weiterleitung zur Zahlung',
    paymentCancelledToast: 'Zahlung nicht abgeschlossen. Ihre Auswahl wurde gespeichert.',
    resumeCheckoutToast: 'Sie hatten ein Abo begonnen. Möchten Sie fortfahren?',
    stripeReassurance: 'Sichere Zahlung über Stripe. Ohne Verpflichtung.',
    trialMention:
      '0 € heute. Karte nötig, um den Zugang zu aktivieren. Kündigung mit einem Klick im Kundenbereich.',
    prorataMessage:
      'Der Prorata wird automatisch berechnet. Sie zahlen nur die Differenz zum Zeitpunkt der Änderung.',
    legalSectionTitle: 'Rechtliche Bestätigungen',
    legalSectionSubtitle: 'Erforderlich, um zur Zahlung fortzufahren.',
    zenithDataConsent:
      'Ich bestätige, dass meine Kunden über die Nutzung ihrer Daten zur Bewertungsanfrage (WhatsApp) informiert sind, im Einklang mit der DSGVO.',
    legalCheckHint: 'Aktivieren Sie das Kontrollkästchen, um die Zahlung freizuschalten.',
    planBlockedZenith: 'Akzeptieren Sie die Bedingungen und die Kundenbestätigung, um fortzufahren.',
    planBlockedDefault: 'Akzeptieren Sie die Bedingungen, um fortzufahren.',
    visionTitle: 'Vision',
    visionDesc:
      'Einstieg: Zeit sparen und ein sauberes Google-Profil – ohne das erweiterte Toolkit der höheren Pläne.',
    visionFeature1:
      'Unbegrenzte, automatisierte Bewertungsantworten mit echter Personalisierung: Das Modell liest jeden Satz und spiegelt die Wortwahl des Gastes (z. B. „Danke für den Gratiskaffee“ → die Antwort nimmt darauf Bezug). Formelles „Sie“, professioneller Ton, keine generischen Textbausteine.',
    visionFeature2:
      'Monatlicher PDF-Report per E-Mail: kurzer Gesundheitscheck – Volumen, Durchschnittsnote, Trend. Faktenbericht, nicht die volle „Berater-“ PDF wie bei Pulse/Zenith.',
    visionFeature3:
      'Menschlich klingend: Niemand soll an eine Maschine denken – saubere Syntax, angemessene Empathie, nie übertrieben.',
    visionFeature4:
      'Eine Hauptsprache pro Konto (Ihr Markt – z. B. spanisches Business → natürliches Spanisch). Schlechte Bewertungen lösen keine WhatsApp-Alarme aus: Sie erscheinen im Alert-Tab im Dashboard mit bearbeitbarem KI-Entwurf, dann Warteschlange mit menschlichem Veröffentlichungsfenster wie andere Antworten.',
    visionFeature5:
      'Vision-Umfang: keine Echtzeit-WhatsApp-Alarme, kein automatisiertes Sammeln, kein fortgeschrittenes SEO oder Triple-Engine – Pulse oder Zenith für diese Bausteine.',
    pulseTitle: 'Pulse',
    pulseDesc:
      'Ruhe im Kopf: aktives Monitoring, schwierige Bewertungen auf WhatsApp, Reports die konkret sagen, was zu tun ist.',
    pulseBadge: 'Am beliebtesten',
    pulseFeature1:
      'Gleiche Textqualität wie Vision: Zeile für Zeile, Gastworte aufgegriffen, formelles Sie, null Floskeln.',
    pulseFeature2:
      '1–2-Sterne-Alerts auf WhatsApp (~30 s): Sie sehen Bewertung und Vorschlag; bearbeiten per Text oder Sprache, Veröffentlichen → realistischer Timer in der Warteschlange.',
    pulseFeature3:
      'Monatliches „Berater“-PDF: mehr als Zahlen – Vergleich zu Vorperioden, wiederkehrende Themen, konkrete Impulse, vorhersageartige / interne Audit-Zeilen wenn die Daten es hergeben.',
    pulseFeature4:
      'Wöchentlicher WhatsApp-Recap (Montag 8:00 UTC): klare Kennzahlen, was läuft / was stört, Berater-Ton – Details und Archiv pro Woche unter Statistiken.',
    pulseFeature5:
      'Schild gegen toxische Reviews: Fall im Dashboard + von der KI erstelltes Melde-Dossier zum Prüfen und Einreichen; bedrohliche/ beleidigende Inhalte können zusätzlich sofort per WhatsApp mit Link zu Alerts gehen.',
    pulseFeature6:
      'KI klingt nicht roboterhaft: nicht zu steif, nicht zu aufdringlich.',
    pulseFeature7:
      'Drei interne Entwürfe, bewertet nach Sozialbeweis-Kriterien – nur die stärkste Variante geht in die Warteschlange.',
    pulseFeature8:
      'Mehrsprachige Antworten nativ (kein Maschinendolmetscher) für Touristen und internationale Gäste.',
    zenithBadge: 'Empfohlen',
    zenithTitle: 'Zenith',
    zenithDesc:
      '24/7 Marketing-Verstand: alles aus Pulse, plus Maps-SEO, Bewertungsgewinnung und dreifache KI-Prüfung.',
    zenithFeature1:
      'Antworten mit gleicher Qualität – genaues Lesen, Echo der Gastformulierungen, formelles Sie, Struktur-Wiederholungen vermeiden.',
    zenithFeature2:
      'Triple-KI-Prüfung (drei Ansätze + Richter), bevor die Antwort in die Warteschlange kommt.',
    zenithFeature3:
      'Schlechte-Bewertungs-Alerts auf WhatsApp + bearbeitbarer Vorschlag + Warteschlangen-Veröffentlichung wie bei Pulse.',
    zenithFeature4:
      'Monatliches strategisches PDF, an die wöchentlichen Memos geknüpft – die Story reift im Zeitverlauf.',
    zenithFeature5:
      'Wöchentlicher WhatsApp-Recap + Archiv pro Woche unter Statistiken (Filter Standort).',
    zenithFeature6:
      'Maps-SEO-Boost: schwache Suchintentionen finden, Keywords natürlich in Antworten und WhatsApp-Ansprachen einweben.',
    zenithFeature7:
      'Gleicher Workflow bei Hassreviews wie Pulse: Fall in Alerts fertig + sofortige WhatsApp bei schweren Drohungen.',
    zenithFeature8:
      'Automatisierte Bewertungsgewinnung per WhatsApp (Kasse / Webhook), Einwilligung sauber, menschlicher Ton – wie in REPUTEXA vorgesehen.',
    zenithFeature10: 'Native Mehrsprachigkeit auf allen kundenorientierten Oberflächen.',
  },
  es: {
    headline: 'Elige tu plan',
    subtitle: 'Prueba gratuita · Sin compromiso',
    monthly: 'Mensual',
    annual: 'Anual',
    annualBadge: '-20%',
    perMonth: '/mes',
    perYear: '/año',
    billedAnnually: 'Facturado anualmente ({amount})',
    establishments: 'Establecimientos',
    perEstablishments: 'para {count} establecimientos',
    savings: 'Ahorre {amount}',
    savingsBadge: 'Ahorre {amount}',
    savingsPerYear: 'Ahorra {amount} / año',
    backToDashboard: 'Volver al dashboard',
    ctaChoose: 'Elegir este plan',
    ctaSubscribe: 'Prueba gratuita',
    ctaTrial: 'Prueba gratuita',
    checkoutError: 'Error al redirigir al pago',
    paymentCancelledToast: 'Pago no completado. Tus opciones se han guardado.',
    resumeCheckoutToast: 'Habías empezado una suscripción. ¿Quieres continuar?',
    stripeReassurance: 'Pago seguro con Stripe. Sin compromiso.',
    trialMention:
      '0 € hoy. Tarjeta requerida para validar el acceso. Cancelación en un clic desde tu espacio cliente.',
    prorataMessage:
      'El prorrateo se calcula automáticamente. Solo pagas la diferencia en el momento del cambio.',
    legalSectionTitle: 'Compromisos legales',
    legalSectionSubtitle: 'Necesario para continuar al pago.',
    zenithDataConsent:
      'Confirmo que mis clientes están informados del uso de sus datos para solicitar reseñas (WhatsApp), conforme al RGPD.',
    legalCheckHint: 'Marca esta casilla para activar el pago.',
    planBlockedZenith: 'Acepta las condiciones y la confirmación a clientes para continuar.',
    planBlockedDefault: 'Acepta las condiciones para continuar.',
    visionTitle: 'Vision',
    visionDesc:
      'Entrada: ahorrar tiempo y mantener limpia tu ficha de Google, sin la caja de herramientas de los planes superiores.',
    visionFeature1:
      'Respuestas automáticas ilimitadas y realmente personalizadas: el modelo lee cada frase y refleja las palabras del cliente (p. ej. «gracias por el café invitación» → la respuesta menciona ese detalle). Tratamiento de «usted», tono impecable, cero pegotes genéricos.',
    visionFeature2:
      'Informe PDF mensual por correo: chequeo ejecutivo breve — volumen, nota media, tendencia. Solo hechos, no el PDF «consultor» de Pulse/Zenith.',
    visionFeature3:
      'Tono humano: nadie debe pensar en una máquina — sintaxis cuidada, empatía justa, nada exagerado.',
    visionFeature4:
      'Un idioma principal por cuenta (tu mercado; p. ej. negocio en España → español natural). Las malas reseñas no disparan WhatsApp: van a la pestaña Alertas con borrador IA editable, luego cola de publicación con retraso creíble, como el resto.',
    visionFeature5:
      'Alcance Vision: sin alertas WhatsApp en tiempo real, sin captación automatizada, sin SEO avanzado ni triple motor — sube a Pulse o Zenith.',
    pulseTitle: 'Pulse',
    pulseDesc:
      'Tranquilidad: monitorización activa, reseñas duras en WhatsApp, informes que dicen qué hacer.',
    pulseBadge: 'El más popular',
    pulseFeature1:
      'Mismo estándar redaccional que Vision: lectura línea a línea, eco del cliente, usted, mensajes no genéricos.',
    pulseFeature2:
      'Alertas 1–2★ por WhatsApp (~30 s): ves la reseña y la propuesta; editas por texto o voz, Publicar → cola con temporizador realista.',
    pulseFeature3:
      'PDF mensual «consultor»: más allá de cifras — comparación con meses previos, temas recurrentes, acciones concretas, líneas tipo predicción/auditoría interna si los datos lo permiten.',
    pulseFeature4:
      'Recap semanal por WhatsApp (lunes 8:00 UTC): cifras claras, qué funciona / qué duele, tono consultor — detalle e histórico por semana en Estadísticas.',
    pulseFeature5:
      'Escudo reseñas tóxicas: caso en el panel + dossier de denuncia argumentado (IA) para revisar y enviar; amenazas o insultos graves pueden además disparar WhatsApp inmediato con enlace a Alertas.',
    pulseFeature6:
      'IA indistinguible en la forma: ni demasiado «robot educado», ni exceso de entusiasmo.',
    pulseFeature7:
      'Triple borrador interno + selección de la mejor respuesta (criterios de prueba social) antes de la cola.',
    pulseFeature8:
      'Respuestas multilingües nativas (no traducción automática) para turistas y clientela internacional.',
    zenithBadge: 'Recomendado',
    zenithTitle: 'Zenith',
    zenithDesc:
      'Marketing 24/7: todo Pulse, más SEO Maps, captación de reseñas y triple capa IA.',
    zenithFeature1:
      'Misma promesa de calidad — lectura fina, eco del cliente, usted, anti-repetición de estructura.',
    zenithFeature2:
      'Triple verificación IA (tres lógicas + juez): la respuesta más convincente pasa a la cola.',
    zenithFeature3:
      'Malas reseñas por WhatsApp + sugerencia editable + publicación en cola, como Pulse.',
    zenithFeature4:
      'PDF mensual táctico/estratégico enlazado a tus recaps semanales para una visión que madura.',
    zenithFeature5: 'Recap semanal WhatsApp + archivo por semana en Estadísticas (filtro establecimiento).',
    zenithFeature6:
      'Boost SEO Maps: detectar intenciones débiles e inyectar keywords con naturalidad en respuestas y captación WhatsApp.',
    zenithFeature7:
      'Mismo flujo que Pulse para reseñas de odio: caso listo en Alertas + WhatsApp inmediato si hay amenazas graves.',
    zenithFeature8:
      'Captación de reseñas automatizada vía WhatsApp (POS / webhook), consentimiento claro, tono humano — como prevé REPUTEXA.',
    zenithFeature10: 'Multilingüe nativo en todas las piezas visibles al cliente.',
  },
  it: {
    headline: 'Scegli il tuo piano',
    subtitle: 'Prova gratuita · Nessun impegno',
    monthly: 'Mensile',
    annual: 'Annuale',
    annualBadge: '-20%',
    perMonth: '/mese',
    perYear: '/anno',
    billedAnnually: 'Fatturato annualmente ({amount})',
    establishments: 'Stabilimenti',
    perEstablishments: 'per {count} stabilimenti',
    savings: 'Risparmia {amount}',
    savingsBadge: 'Risparmia {amount}',
    savingsPerYear: 'Risparmi {amount} / anno',
    backToDashboard: 'Torna al dashboard',
    ctaChoose: 'Scegli questo piano',
    ctaSubscribe: 'Prova gratuita',
    ctaTrial: 'Prova gratuita',
    checkoutError: 'Errore nel reindirizzamento al pagamento',
    paymentCancelledToast: 'Pagamento non completato. Le tue scelte sono state conservate.',
    resumeCheckoutToast: 'Avevi iniziato un abbonamento. Vuoi riprendere?',
    stripeReassurance: 'Pagamento sicuro con Stripe. Senza impegno.',
    trialMention:
      '0 € oggi. Carta richiesta per validare l’accesso. Disdetta in un clic dall’area cliente.',
    prorataMessage:
      'Il pro rata è calcolato automaticamente. Paghi solo la differenza al momento del cambio.',
    legalSectionTitle: 'Impegni legali',
    legalSectionSubtitle: 'Necessario per proseguire verso il pagamento.',
    zenithDataConsent:
      'Confermo che i miei clienti sono informati sull’uso dei loro dati per sollecitare recensioni (WhatsApp), conformemente al GDPR.',
    legalCheckHint: 'Spunta questa casella per abilitare il pagamento.',
    planBlockedZenith: 'Accetta le condizioni e la conferma clienti per continuare.',
    planBlockedDefault: 'Accetta le condizioni per continuare.',
    visionTitle: 'Vision',
    visionDesc:
      'Ingresso: risparmiare tempo e tenere pulita la scheda Google, senza il toolkit dei piani superiori.',
    visionFeature1:
      'Risposte automatiche illimitate e davvero personalizzate: il modello legge ogni frase e rispecchia le parole dell’ospite (es. «grazie per il caffè offerto» → la risposta cita quel gesto). Lei formale, tono impeccabile, zero incollaggi generici.',
    visionFeature2:
      'Report PDF mensile via email: check-up esecutivo breve — volume, media, trend. Solo fatti, non il PDF «cabinet» di Pulse/Zenith.',
    visionFeature3:
      'Tono umano: nessuno deve pensare a una macchina — sintassi curata, empatia giusta, mai esagerata.',
    visionFeature4:
      'Una lingua principale per account (il tuo mercato; es. attività spagnola → spagnolo naturale). Le recensioni negative non attivano WhatsApp: finiscono nel tab Avvisi con bozza IA modificabile, poi coda di pubblicazione con ritardo credibile.',
    visionFeature5:
      'Ambito Vision: niente alert WhatsApp in tempo reale, nessuna raccolta automatizzata, niente SEO avanzato né triplo motore — passa a Pulse o Zenith.',
    pulseTitle: 'Pulse',
    pulseDesc:
      'Tranquillità: monitoraggio attivo, recensioni difficili su WhatsApp, report che dicono cosa fare.',
    pulseBadge: 'Il più popolare',
    pulseFeature1:
      'Stesso standard di Vision: lettura riga per riga, eco del cliente, Lei, messaggi non generici.',
    pulseFeature2:
      'Alert 1–2★ su WhatsApp (~30 s): vedi recensione e bozza; modifichi testo o voce, Pubblica → coda con timer realistico.',
    pulseFeature3:
      'PDF mensile «consulente»: oltre ai numeri — confronto con mesi precedenti, temi ricorrenti, mosse concrete, linee predittive/audit interno se i dati lo consentono.',
    pulseFeature4:
      'Recap settimanale WhatsApp (lunedì 8:00 UTC): numeri chiari, cosa va / cosa blocca, tono consulente — dettaglio e archivio per settimana in Statistiche.',
    pulseFeature5:
      'Scudo recensioni tossiche: caso in dashboard + dossier di segnalazione argomentato (IA) da rivedere; minacce o insulti gravi possono anche attivare WhatsApp immediato con link agli Avvisi.',
    pulseFeature6:
      'IA non sembra robot: né troppo «educata meccanica», né troppo entusiasta.',
    pulseFeature7:
      'Tripla bozza interna + scelta della migliore (criteri di prova sociale) prima della coda.',
    pulseFeature8:
      'Risposte multilingue native (non traduzione automatica) per turisti e clientela internazionale.',
    zenithBadge: 'Consigliato',
    zenithTitle: 'Zenith',
    zenithDesc:
      'Marketing 24/7: tutto Pulse, più SEO Maps, acquisizione recensioni e tripla verifica IA.',
    zenithFeature1:
      'Stessa qualità — lettura attenta, eco del cliente, Lei, anti-ripetizione di struttura.',
    zenithFeature2:
      'Tripla verifica IA (tre logiche + giudice): la risposta più convincente entra in coda.',
    zenithFeature3:
      'Alert recensioni negative su WhatsApp + suggerimento modificabile + pubblicazione in coda come Pulse.',
    zenithFeature4:
      'PDF mensile strategico collegato ai recap settimanali per una visione che matura nel tempo.',
    zenithFeature5:
      'Recap settimanale WhatsApp + archivio per settimana in Statistiche (filtro stabilimento).',
    zenithFeature6:
      'Boost SEO Maps: individuare intenti deboli e inserire keyword con naturalezza in risposte e solleciti WhatsApp.',
    zenithFeature7:
      'Stesso flusso di Pulse per recensioni d’odio: caso pronto negli Avvisi + WhatsApp immediato su minacce gravi.',
    zenithFeature8:
      'Raccolta recensioni automatizzata via WhatsApp (cassa / webhook), consenso chiaro, tono umano — come previsto in REPUTEXA.',
    zenithFeature10: 'Multilingue nativo su tutte le superfici rivolte al cliente.',
  },
  ja: {
    headline: 'プランを選ぶ',
    subtitle: '無料トライアル · 契約不要',
    monthly: '月額',
    annual: '年額',
    annualBadge: '-20%',
    perMonth: '/月',
    perYear: '/年',
    billedAnnually: '年払い（{amount}）',
    establishments: '店舗数',
    perEstablishments: '{count} 店舗用',
    savings: '{amount} お得',
    savingsBadge: '{amount} お得',
    savingsPerYear: '年間 {amount} 節約',
    backToDashboard: 'ダッシュボードに戻る',
    ctaChoose: 'このプランを選ぶ',
    ctaSubscribe: '無料で試す',
    ctaTrial: '無料で試す',
    checkoutError: '決済ページへのリダイレクトエラー',
    paymentCancelledToast: 'お支払いが完了しませんでした。選択内容は保存されています。',
    resumeCheckoutToast: '購読を開始されていました。続けますか？',
    stripeReassurance: 'Stripeによる安全な決済。契約不要。',
    trialMention:
      '本日のお支払い 0 円。アクセス有効化にカードが必要です。解約はアカウント画面からワンクリック。',
    prorataMessage: '日割りは自動計算されます。変更時は差額のみお支払いください。',
    legalSectionTitle: '法的確認',
    legalSectionSubtitle: 'お支払いに進むために必要です。',
    zenithDataConsent:
      'お客様は口コミ依頼（WhatsApp）に連絡先を使う旨をGDPRに沿って通知済みであることを確認します。',
    legalCheckHint: 'チェックを入れると決済が有効になります。',
    planBlockedZenith: '条件とお客様への確認に同意して続行してください。',
    planBlockedDefault: '条件に同意して続行してください。',
    visionTitle: 'ビジョン',
    visionDesc:
      '入門プラン：時間短縮とGoogleプロフィールの健全維持。上位プランの高度機能は含みません。',
    visionFeature1:
      '無制限の自動返信、細かくパーソナライズ：文ごとに読み、ゲストの言い回しを反映（例：「おかわりコーヒーありがとう」→その一言に触れる）。敬体、品格、テンプレ感ゼロ。',
    visionFeature2:
      '月次PDFをメール配信：件数・平均評価・推移の短い健康診断。事実のみ。Pulse/ゼニスの「コンサル版」PDFではありません。',
    visionFeature3:
      '人間らしいトーン：機械と思わせない文体、ほどよい共感、過剰な煽りなし。',
    visionFeature4:
      'アカウントごとに主言語1つ（市場に合わせた自然な語り口）。低評価はWhatsApp通知しません：ダッシュボードの「アラート」タブで編集可能なAI下書き→他と同様に人間味のある公開待ち行列へ。',
    visionFeature5:
      'ビジョン範囲：リアルタイムWhatsApp通知・自動収集・高度SEO・三重エンジンなし。それらはPulse/ゼニスへ。',
    pulseTitle: 'パルス',
    pulseDesc:
      '安心のモニター、厳しいレビューをWhatsAppで、何をすべきか示すレポート。',
    pulseBadge: '最も人気',
    pulseFeature1:
      'ビジョンと同じ文章品質：一行ずつ読む、ゲストの語を拾う、敬体、汎用文禁止。',
    pulseFeature2:
      '1–2★ をWhatsAppで約30秒通知：本文と案を確認、テキスト/音声で調整→公開で現実的なタイマー付きキューへ。',
    pulseFeature3:
      '月次「コンサル」PDF：数値だけでなく前期比、繰り返しテーマ、具体的打ち手、データが許すなら予測/内部監査の一文も。',
    pulseFeature4:
      '週次WhatsApp要約（月曜8:00 UTC）：数字、好調点/懸念、コンサル調トーク——詳細と週ごとアーカイブは統計へ。',
    pulseFeature5:
      '有害レビュー対策：ダッシュボード案件＋AI作成の申告用ブリーフを確認して提出。深刻な脅迫・侮辱はアラートへのリンク付き即時WhatsAppも。',
    pulseFeature6: '体裁は人間的：キッチすぎず、乗り過ぎず。',
    pulseFeature7: '内部3案を社会的証拠の基準で採点——最強のみキューへ。',
    pulseFeature8:
      '観光客・多言語ゲスト向けにネイティブ多言語（機械翻訳ではない）。',
    zenithBadge: 'おすすめ',
    zenithTitle: 'ゼニス',
    zenithDesc:
      '24/7マーケ脳：パルスの全機能にMaps SEO、獲得、三重IAガードを追加。',
    zenithFeature1:
      '同じ品質バー——丁寧な読解、言い回しの反映、敬体、構造の繰り返し抑制。',
    zenithFeature2: '三重IA検証（3アプローチ＋ジャッジ）してからキューへ。',
    zenithFeature3:
      '低評価のWhatsApp通知＋編集可能案＋キュー公開はパルスと同じ。',
    zenithFeature4:
      '週次要約とつながる月次戦略PDFで、物語が時間とともに熟成。',
    zenithFeature5:
      '週次WhatsApp＋統計で週単位アーカイブ（店舗フィルター）。',
    zenithFeature6:
      'Maps SEO：弱い意図を拾い、返信とWhatsApp獲得に自然に語を織り込む。',
    zenithFeature7:
      'ヘイトレビューもパルス同様：アラートに案件完成＋深刻な脅威では即時WhatsApp。',
    zenithFeature8:
      'WhatsAppでの自動レビュー誘導（レジ/Webhook）、同意の明確化、人間トーン——REPUTEXA設計どおり。',
    zenithFeature10: '顧客向け画面はすべてネイティブ多言語。',
  },
  pt: {
    headline: 'Escolha o seu plano',
    subtitle: 'Teste gratuito · Sem compromisso',
    monthly: 'Mensal',
    annual: 'Anual',
    annualBadge: '-20%',
    perMonth: '/mês',
    perYear: '/ano',
    billedAnnually: 'Faturado anualmente ({amount})',
    establishments: 'Estabelecimentos',
    perEstablishments: 'para {count} estabelecimentos',
    savings: 'Economize {amount}',
    savingsBadge: 'Economize {amount}',
    savingsPerYear: 'Poupe {amount} / ano',
    backToDashboard: 'Voltar ao dashboard',
    ctaChoose: 'Escolher este plano',
    ctaSubscribe: 'Teste gratuito',
    ctaTrial: 'Teste gratuito',
    checkoutError: 'Erro ao redirecionar para o pagamento',
    paymentCancelledToast: 'Pagamento não concluído. As suas opções foram guardadas.',
    resumeCheckoutToast: 'Começou uma subscrição. Deseja continuar?',
    stripeReassurance: 'Pagamento seguro via Stripe. Sem compromisso.',
    trialMention:
      '0 € hoje. Cartão necessário para validar o acesso. Cancelamento com um clique na área de cliente.',
    prorataMessage:
      'O prorata é calculado automaticamente. Paga apenas a diferença no momento da alteração.',
    legalSectionTitle: 'Compromissos legais',
    legalSectionSubtitle: 'Necessário para seguir para o pagamento.',
    zenithDataConsent:
      'Confirmo que os meus clientes estão informados do uso dos dados para pedidos de avaliação (WhatsApp), em conformidade com o RGPD.',
    legalCheckHint: 'Marque a caixa para ativar o pagamento.',
    planBlockedZenith: 'Aceite os termos e a confirmação aos clientes para continuar.',
    planBlockedDefault: 'Aceite os termos para continuar.',
    visionTitle: 'Vision',
    visionDesc:
      'Porta de entrada: ganhar tempo e manter a ficha Google impecável, sem a caixa de ferramentas dos planos superiores.',
    visionFeature1:
      'Respostas automáticas ilimitadas e realmente personalizadas: o modelo lê cada frase e espelha as palavras do cliente (ex.: «obrigado pelo café oferecido» → a resposta refere esse gesto). Tratamento formal, tom profissional, zero copy genérico.',
    visionFeature2:
      'PDF mensal por e-mail: check-up executivo curto — volume, média, tendência. Só factos, não o PDF «consultoria» de Pulse/Zenith.',
    visionFeature3:
      'Tom humano: ninguém deve pensar numa máquina — sintaxe cuidada, empatia certa, nunca exagerada.',
    visionFeature4:
      'Uma língua principal por conta (o seu mercado; ex. negócio espanhol → espanhol natural). Más críticas não disparam WhatsApp: vão ao separador Alertas com rascunho IA editável, depois fila de publicação com atraso credível.',
    visionFeature5:
      'Âmbito Vision: sem alertas WhatsApp em tempo real, sem recolha automática, sem SEO avançado nem triplo motor — suba para Pulse ou Zenith.',
    pulseTitle: 'Pulse',
    pulseDesc:
      'Tranquilidade: monitorização ativa, críticas difíceis no WhatsApp, relatórios que dizem o que fazer.',
    pulseBadge: 'Mais popular',
    pulseFeature1:
      'Mesmo padrão que Vision: leitura linha a linha, eco do cliente, formal, zero genéricos.',
    pulseFeature2:
      'Alertas 1–2★ no WhatsApp (~30 s): vê a crítica e a proposta; edita texto ou voz, Publicar → fila com temporizador realista.',
    pulseFeature3:
      'PDF mensal «consultor»: além dos números — comparação com meses anteriores, temas recorrentes, jogadas concretas, linhas preditivas/auditoria interna quando os dados permitem.',
    pulseFeature4:
      'Recap semanal WhatsApp (segunda 8:00 UTC): números claros, o que corre / o que magoa, tom consultor — detalhe e arquivo por semana em Estatísticas.',
    pulseFeature5:
      'Escudo a críticas tóxicas: caso no painel + dossiê de reporte argumentado (IA) a rever e submeter; ameaças ou insultos graves podem também disparar WhatsApp imediato com link para Alertas.',
    pulseFeature6:
      'IA não soa robô: nem demasiado «educada mecânica», nem desmedidamente entusiasta.',
    pulseFeature7:
      'Triplo rascunho interno + escolha da melhor resposta (critérios de prova social) antes da fila.',
    pulseFeature8:
      'Respostas multilingues nativas (não tradução automática) para turistas e clientela internacional.',
    zenithBadge: 'Recomendado',
    zenithTitle: 'Zenith',
    zenithDesc:
      'Marketing 24/7: tudo do Pulse, mais SEO Maps, captação de avaliações e tripla verificação IA.',
    zenithFeature1:
      'Mesma promessa de qualidade — leitura fina, eco do cliente, formal, anti-repetição de estrutura.',
    zenithFeature2:
      'Tripla verificação IA (três lógicas + juiz): a resposta mais convincente vai para a fila.',
    zenithFeature3:
      'Críticas fracas por WhatsApp + sugestão editável + publicação em fila como no Pulse.',
    zenithFeature4:
      'PDF mensal estratégico ligado aos seus recaps semanais para uma visão que amadurece.',
    zenithFeature5:
      'Recap semanal WhatsApp + arquivo por semana em Estatísticas (filtro estabelecimento).',
    zenithFeature6:
      'Boost SEO Maps: detetar intenções fracas e injetar keywords com naturalidade em respostas e captação WhatsApp.',
    zenithFeature7:
      'Mesmo fluxo que Pulse para ódio a marcas: caso pronto em Alertas + WhatsApp imediato em ameaças graves.',
    zenithFeature8:
      'Captação automatizada de avaliações via WhatsApp (POS / webhook), consentimento claro, tom humano — como previsto na REPUTEXA.',
    zenithFeature10: 'Multilingue nativo em todas as superfícies visíveis ao cliente.',
  },
  zh: {
    headline: '选择套餐',
    subtitle: '免费试用 · 无需承诺',
    monthly: '月付',
    annual: '年付',
    annualBadge: '-20%',
    perMonth: '/月',
    perYear: '/年',
    billedAnnually: '按年计费（{amount}）',
    establishments: '门店',
    perEstablishments: '{count} 家门店',
    savings: '节省 {amount}',
    savingsBadge: '节省 {amount}',
    savingsPerYear: '每年节省 {amount}',
    backToDashboard: '返回控制台',
    ctaChoose: '选择此套餐',
    ctaSubscribe: '免费试用',
    ctaTrial: '免费试用',
    checkoutError: '跳转支付失败',
    paymentCancelledToast: '支付未完成。您的选项已保留。',
    resumeCheckoutToast: '您已开始订阅。是否继续？',
    stripeReassurance: 'Stripe 安全支付。无需长期合约。',
    trialMention: '今日实付 0。需绑定卡片以开通。可在账户内一键取消。',
    prorataMessage: '按比例自动计算，变更时仅需补差价。',
    legalSectionTitle: '法律确认',
    legalSectionSubtitle: '继续付款前必审。',
    zenithDataConsent:
      '我确认已按 GDPR 要求告知客户：将使用其联系方式通过 WhatsApp 邀请评价。',
    legalCheckHint: '勾选后方可启用付款。',
    planBlockedZenith: '请同意条款与客户确认后继续。',
    planBlockedDefault: '请同意条款后继续。',
    visionTitle: 'Vision',
    visionDesc: '入门：省时并保持 Google 资料整洁，不含高级套餐的完整工具箱。',
    visionFeature1:
      '无限自动回复、深度个性化：逐句阅读并呼应顾客原话（如「谢谢赠饮咖啡」→回复会点到该细节）。敬体、得体、无套话。',
    visionFeature2:
      '每月邮件 PDF：简短体检——量、均分、趋势。仅事实摘要，非 Pulse/Zenith 的「顾问级」报告。',
    visionFeature3: '拟人语气：读起来不像机器——句式干净、适度共情、不夸张。',
    visionFeature4:
      '每账号主语言一种（随市场，如西班牙业务→自然西语）。差评不发 WhatsApp：进入控制台「警报」页可编辑 AI 草稿，再进入仿人工延迟发布队列。',
    visionFeature5:
      'Vision 范围：无实时 WhatsApp 警报、无自动获客、无高级 SEO 或三引擎——请升 Pulse 或 Zenith。',
    pulseTitle: 'Pulse',
    pulseDesc: '安心监测：难题评价上 WhatsApp，报告直指行动。',
    pulseBadge: '最受欢迎',
    pulseFeature1:
      '与 Vision 同级写作：逐行阅读、复述顾客用词、敬体、拒绝泛泛回复。',
    pulseFeature2:
      '1–2★ 约 30 秒内 WhatsApp 推送：可看原文与建议稿；文字或语音修改后发布→进入带真实感计时的队列。',
    pulseFeature3:
      '每月「顾问」PDF：不止数字——环比、重复主题、可执行打法，数据允许时含预测/内审式句子。',
    pulseFeature4:
      '每周 WhatsApp 小结（周一 8:00 UTC）：清晰数字、利好/痛点、顾问口吻——详情与按周存档见统计页。',
    pulseFeature5:
      '有害评价护盾：控制台个案 + AI 生成的申诉材料供您复核提交；严重威胁/辱骂可另发即时 WhatsApp 链至警报。',
    pulseFeature6: '读起来像人：不僵硬、不浮夸。',
    pulseFeature7: '内部三稿按社会认同标准打分——仅最佳进入队列。',
    pulseFeature8: '面向游客与多语顾客的母语级多语（非机翻）。',
    zenithBadge: '推荐',
    zenithTitle: 'Zenith',
    zenithDesc: '24/7 营销中枢：含 Pulse 全部，另加地图 SEO、获客与三重 AI 把关。',
    zenithFeature1: '同级品质——细读、呼应措辞、敬体、避免结构重复。',
    zenithFeature2: '三重 IA 校验（三路推理 + 裁判）后再入队。',
    zenithFeature3: '差评 WhatsApp 提醒 + 可改编建议 + 排队发布，与 Pulse 相同。',
    zenithFeature4: '月度战略 PDF 与每周纪要联动，叙事随时间沉淀。',
    zenithFeature5: '每周 WhatsApp + 统计内按周归档（可按门店筛选）。',
    zenithFeature6: '地图 SEO：识别弱意图词，自然植入回复与 WhatsApp 邀约。',
    zenithFeature7: '与 Pulse 相同的仇恨/攻击流：警报内备好个案，严重威胁即时 WhatsApp。',
    zenithFeature8:
      'WhatsApp 自动邀评（收银/Webhook），同意合规、语气人性化——与 REPUTEXA 设计一致。',
    zenithFeature10: '所有顾客触点均为母语级多语。',
  },
};

const PRETTY = new Set(['pt', 'zh']);

for (const [code, pricingPage] of Object.entries(PAGES)) {
  const f = path.join(messagesDir, `${code}.json`);
  if (!fs.existsSync(f)) continue;
  const raw = fs.readFileSync(f, 'utf8');
  const data = JSON.parse(raw);
  data.PricingPage = pricingPage;
  const out = PRETTY.has(code) ? JSON.stringify(data, null, 2) : JSON.stringify(data);
  fs.writeFileSync(f, out + '\n', 'utf8');
  console.log('patched', code);
}
