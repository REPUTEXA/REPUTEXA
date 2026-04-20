/**
 * One-shot merge: DepartmentContactForm, PricingPage.legalAcceptCheckbox,
 * LandingFooter legal row (non-en/fr locales). Run: node scripts/patch-native-surface-i18n.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MESSAGES = path.join(__dirname, '..', 'messages');

const legalAcceptCheckbox = {
  en: 'I accept the <terms>Terms of Service</terms> and <privacy>Privacy Policy</privacy> of REPUTEXA.',
  fr: "J'accepte les <terms>Conditions Générales d'Utilisation</terms> et la <privacy>Politique de confidentialité</privacy> de REPUTEXA.",
  de: 'Ich akzeptiere die <terms>Allgemeinen Geschäftsbedingungen</terms> und die <privacy>Datenschutzerklärung</privacy> von REPUTEXA.',
  es: 'Acepto los <terms>Términos del servicio</terms> y la <privacy>Política de privacidad</privacy> de REPUTEXA.',
  it: "Accetto i <terms>Termini di servizio</terms> e l'<privacy>Informativa sulla privacy</privacy> di REPUTEXA.",
  pt: 'Aceito os <terms>Termos de utilização</terms> e a <privacy>Política de privacidade</privacy> da REPUTEXA.',
  ja: 'REPUTEXAの<terms>利用規約</terms>および<privacy>プライバシーポリシー</privacy>に同意します。',
  zh: '我同意 REPUTEXA 的<terms>服务条款</terms>和<privacy>隐私政策</privacy>。',
};

const landingFooterLegal = {
  de: {
    legalMentions: 'Impressum',
    legalPrivacy: 'Datenschutz',
    legalTerms: 'AGB',
    legalCookies: 'Cookies',
    linkSitemap: 'Sitemap',
  },
  es: {
    legalMentions: 'Aviso legal',
    legalPrivacy: 'Privacidad',
    legalTerms: 'Términos',
    legalCookies: 'Cookies',
    linkSitemap: 'Mapa del sitio',
  },
  it: {
    legalMentions: 'Note legali',
    legalPrivacy: 'Privacy',
    legalTerms: 'Termini',
    legalCookies: 'Cookie',
    linkSitemap: 'Mappa del sito',
  },
  pt: {
    legalMentions: 'Informações legais',
    legalPrivacy: 'Privacidade',
    legalTerms: 'Termos',
    legalCookies: 'Cookies',
    linkSitemap: 'Mapa do site',
  },
  ja: {
    legalMentions: '法的表記',
    legalPrivacy: 'プライバシー',
    legalTerms: '利用規約',
    legalCookies: 'Cookie',
    linkSitemap: 'サイトマップ',
  },
  zh: {
    legalMentions: '法律信息',
    legalPrivacy: '隐私政策',
    legalTerms: '服务条款',
    legalCookies: 'Cookie',
    linkSitemap: '网站地图',
  },
};

const departmentContactForm = {
  en: {
    labelFullName: 'Full name',
    placeholderFullName: 'Jane Doe',
    labelWorkEmail: 'Work email',
    placeholderEmail: 'you@company.com',
    labelMessage: 'Message',
    selectPlaceholder: 'Select…',
    attachmentCvButton: 'Résumé / portfolio',
    attachmentHint: 'PDF, DOC, DOCX, images · up to {maxFiles} files, {maxMb} MB each',
    ariaRemoveFile: 'Remove file',
    sending: 'Sending…',
    toastFileTooBig: '{name} exceeds {maxMb} MB.',
    toastFieldRequired: 'The field "{field}" is required.',
    toastAllRequired: 'Please fill in all required fields.',
    toastGenericError: 'Something went wrong.',
    toastNetworkError: 'Network error. Please email {email}.',
    successTitle: 'Your message was sent',
    successBody:
      '{teamLabel} usually replies within two business days. Check your spam folder if you do not see a confirmation.',
    successResetCta: 'Send another message',
  },
  fr: {
    labelFullName: 'Nom complet',
    placeholderFullName: 'Jean Dupont',
    labelWorkEmail: 'Email professionnel',
    placeholderEmail: 'vous@exemple.com',
    labelMessage: 'Message',
    selectPlaceholder: 'Sélectionner…',
    attachmentCvButton: 'CV / Portfolio',
    attachmentHint: 'PDF, DOC, DOCX, images · max {maxFiles} fichiers, {maxMb} Mo',
    ariaRemoveFile: 'Supprimer',
    sending: 'Envoi en cours…',
    toastFileTooBig: '{name} dépasse {maxMb} Mo.',
    toastFieldRequired: 'Le champ « {field} » est obligatoire.',
    toastAllRequired: 'Tous les champs obligatoires doivent être renseignés.',
    toastGenericError: 'Une erreur est survenue.',
    toastNetworkError: 'Erreur réseau. Écrivez-nous à {email}.',
    successTitle: 'Message envoyé au département concerné',
    successBody:
      '{teamLabel} vous répondra sous 48h ouvrées. Vérifiez vos spams si vous ne recevez pas de confirmation.',
    successResetCta: 'Envoyer un autre message',
  },
  de: {
    labelFullName: 'Vollständiger Name',
    placeholderFullName: 'Max Mustermann',
    labelWorkEmail: 'Geschäftliche E-Mail',
    placeholderEmail: 'sie@firma.de',
    labelMessage: 'Nachricht',
    selectPlaceholder: 'Auswählen…',
    attachmentCvButton: 'Lebenslauf / Portfolio',
    attachmentHint: 'PDF, DOC, DOCX, Bilder · max. {maxFiles} Dateien, je {maxMb} MB',
    ariaRemoveFile: 'Entfernen',
    sending: 'Wird gesendet…',
    toastFileTooBig: '{name} überschreitet {maxMb} MB.',
    toastFieldRequired: 'Das Feld „{field}“ ist erforderlich.',
    toastAllRequired: 'Bitte füllen Sie alle Pflichtfelder aus.',
    toastGenericError: 'Etwas ist schiefgelaufen.',
    toastNetworkError: 'Netzwerkfehler. Schreiben Sie uns an {email}.',
    successTitle: 'Ihre Nachricht wurde gesendet',
    successBody:
      '{teamLabel} antwortet in der Regel innerhalb von zwei Werktagen. Prüfen Sie den Spam-Ordner, falls keine Bestätigung ankommt.',
    successResetCta: 'Weitere Nachricht senden',
  },
  es: {
    labelFullName: 'Nombre completo',
    placeholderFullName: 'María García',
    labelWorkEmail: 'Correo profesional',
    placeholderEmail: 'tu@empresa.com',
    labelMessage: 'Mensaje',
    selectPlaceholder: 'Seleccionar…',
    attachmentCvButton: 'CV / Portafolio',
    attachmentHint: 'PDF, DOC, DOCX, imágenes · máx. {maxFiles} archivos, {maxMb} MB cada uno',
    ariaRemoveFile: 'Eliminar',
    sending: 'Enviando…',
    toastFileTooBig: '{name} supera {maxMb} MB.',
    toastFieldRequired: 'El campo «{field}» es obligatorio.',
    toastAllRequired: 'Rellene todos los campos obligatorios.',
    toastGenericError: 'Algo salió mal.',
    toastNetworkError: 'Error de red. Escríbanos a {email}.',
    successTitle: 'Mensaje enviado',
    successBody:
      '{teamLabel} suele responder en dos días laborables. Revise la carpeta de spam si no recibe confirmación.',
    successResetCta: 'Enviar otro mensaje',
  },
  it: {
    labelFullName: 'Nome e cognome',
    placeholderFullName: 'Mario Rossi',
    labelWorkEmail: 'Email di lavoro',
    placeholderEmail: 'nome.cognome@azienda.it',
    labelMessage: 'Messaggio',
    selectPlaceholder: 'Seleziona…',
    attachmentCvButton: 'CV / Portfolio',
    attachmentHint: 'PDF, DOC, DOCX, immagini · max {maxFiles} file, {maxMb} MB ciascuno',
    ariaRemoveFile: 'Rimuovi',
    sending: 'Invio in corso…',
    toastFileTooBig: '{name} supera {maxMb} MB.',
    toastFieldRequired: 'Il campo «{field}» è obbligatorio.',
    toastAllRequired: 'Compila tutti i campi obbligatori.',
    toastGenericError: 'Si è verificato un errore.',
    toastNetworkError: 'Errore di rete. Scrivici a {email}.',
    successTitle: 'Messaggio inviato',
    successBody:
      '{teamLabel} risponde di solito entro due giorni lavorativi. Controlla lo spam se non ricevi conferma.',
    successResetCta: 'Invia un altro messaggio',
  },
  pt: {
    labelFullName: 'Nome completo',
    placeholderFullName: 'João Silva',
    labelWorkEmail: 'Email profissional',
    placeholderEmail: 'voce@empresa.com',
    labelMessage: 'Mensagem',
    selectPlaceholder: 'Selecionar…',
    attachmentCvButton: 'CV / Portfólio',
    attachmentHint: 'PDF, DOC, DOCX, imagens · máx. {maxFiles} ficheiros, {maxMb} MB cada',
    ariaRemoveFile: 'Remover',
    sending: 'A enviar…',
    toastFileTooBig: '{name} excede {maxMb} MB.',
    toastFieldRequired: 'O campo «{field}» é obrigatório.',
    toastAllRequired: 'Preencha todos os campos obrigatórios.',
    toastGenericError: 'Ocorreu um erro.',
    toastNetworkError: 'Erro de rede. Escreva para {email}.',
    successTitle: 'Mensagem enviada',
    successBody:
      '{teamLabel} responde normalmente em dois dias úteis. Verifique o spam se não vir confirmação.',
    successResetCta: 'Enviar outra mensagem',
  },
  ja: {
    labelFullName: 'お名前',
    placeholderFullName: '山田 太郎',
    labelWorkEmail: '勤務先メール',
    placeholderEmail: 'name@company.co.jp',
    labelMessage: 'メッセージ',
    selectPlaceholder: '選択…',
    attachmentCvButton: '履歴書 / ポートフォリオ',
    attachmentHint: 'PDF、DOC、DOCX、画像 · 最大{maxFiles}ファイル、各{maxMb}MBまで',
    ariaRemoveFile: '削除',
    sending: '送信中…',
    toastFileTooBig: '{name} は {maxMb}MB を超えています。',
    toastFieldRequired: '「{field}」は必須です。',
    toastAllRequired: '必須項目をすべて入力してください。',
    toastGenericError: 'エラーが発生しました。',
    toastNetworkError: '通信エラーです。{email} までメールでご連絡ください。',
    successTitle: '送信しました',
    successBody:
      '{teamLabel} は通常2営業日以内に返信します。確認メールが届かない場合は迷惑メールフォルダをご確認ください。',
    successResetCta: '別のメッセージを送る',
  },
  zh: {
    labelFullName: '姓名',
    placeholderFullName: '张三',
    labelWorkEmail: '工作邮箱',
    placeholderEmail: 'zhangsan@company.com',
    labelMessage: '留言',
    selectPlaceholder: '请选择…',
    attachmentCvButton: '简历 / 作品集',
    attachmentHint: 'PDF、DOC、DOCX、图片 · 最多 {maxFiles} 个文件，每个 {maxMb} MB',
    ariaRemoveFile: '移除',
    sending: '发送中…',
    toastFileTooBig: '{name} 超过 {maxMb} MB。',
    toastFieldRequired: '「{field}」为必填项。',
    toastAllRequired: '请填写所有必填字段。',
    toastGenericError: '出错了。',
    toastNetworkError: '网络错误。请发邮件至 {email}。',
    successTitle: '消息已发送',
    successBody: '{teamLabel} 通常在两个工作日内回复。若未收到确认邮件，请查看垃圾邮件文件夹。',
    successResetCta: '再发一条消息',
  },
};

const files = fs.readdirSync(MESSAGES).filter((f) => f.endsWith('.json') && f !== 'legal-fr.json');

for (const f of files) {
  const locale = f.replace(/\.json$/, '');
  const full = path.join(MESSAGES, f);
  const data = JSON.parse(fs.readFileSync(full, 'utf8'));

  data.DepartmentContactForm = departmentContactForm[locale] || departmentContactForm.en;

  if (!data.PricingPage || typeof data.PricingPage !== 'object') {
    throw new Error(`Missing PricingPage in ${f}`);
  }
  data.PricingPage.legalAcceptCheckbox = legalAcceptCheckbox[locale] || legalAcceptCheckbox.en;

  if (landingFooterLegal[locale]) {
    data.LandingFooter = { ...data.LandingFooter, ...landingFooterLegal[locale] };
  }

  fs.writeFileSync(full, JSON.stringify(data));
  console.log('patched', f);
}
