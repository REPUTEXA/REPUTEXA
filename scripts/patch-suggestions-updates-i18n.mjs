/**
 * Ajoute / met à jour les clés i18n pour Suggestions, Mises à jour, modale release, erreurs API.
 * Usage: node scripts/patch-suggestions-updates-i18n.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dir = path.join(root, 'messages');

const LOCALES = ['fr', 'en', 'es', 'de', 'it', 'pt', 'ja', 'zh'];

const BUNDLES = {
  fr: {
    ApiAppSuggestions: {
      titleRequired: 'Le titre est requis.',
      uploadPhotoError: "Erreur lors de l'envoi de la photo.",
      missingId: 'Identifiant manquant.',
      invalidStatus: 'Statut invalide (PENDING, IN_PROGRESS, DONE).',
      suggestionNotFound: 'Suggestion introuvable.',
      aiGenerateError:
        'Erreur lors de la génération IA. Vérifiez la clé ANTHROPIC_API_KEY.',
    },
    Dashboard: {
      updatesPage: {
        title: 'Mises à jour',
        intro:
          "Les fonctionnalités livrées grâce à vos retours. L'outil évolue en temps réel.",
        notAuthenticated: 'Vous n’êtes pas connecté·e.',
      },
      updatesList: {
        editLabel: 'Modifier',
        deleteLabel: 'Supprimer',
        scheduledWithDate: 'Programmé · {date}',
        addMedia: 'Ajouter un média',
        noContentFallback: 'Mise à jour disponible — {title}.',
      },
      featureRelease: {
        toastSaveError: 'Enregistrement impossible. Réessayez dans un instant.',
        badgeNew: 'Nouveau',
        communiqueDate: 'Communiqué du {date}',
        linkAllUpdates: 'Toutes les mises à jour',
        ctaGotIt: 'C’est parti !',
        ctaBusy: '…',
      },
    },
    Suggestions: {
      list: {
        errUpvote: 'Impossible d’enregistrer votre vote.',
        originalLanguageHint: 'Rédigée en {language}',
      },
    },
  },
  en: {
    ApiAppSuggestions: {
      titleRequired: 'Title is required.',
      uploadPhotoError: 'Could not upload the photo.',
      missingId: 'Missing id.',
      invalidStatus: 'Invalid status (PENDING, IN_PROGRESS, DONE).',
      suggestionNotFound: 'Suggestion not found.',
      aiGenerateError: 'AI generation failed. Check ANTHROPIC_API_KEY.',
    },
    Dashboard: {
      updatesPage: {
        title: 'Updates',
        intro: 'Features we ship thanks to your feedback. The product keeps improving.',
        notAuthenticated: 'You are not signed in.',
      },
      updatesList: {
        editLabel: 'Edit',
        deleteLabel: 'Delete',
        scheduledWithDate: 'Scheduled · {date}',
        addMedia: 'Add media',
        noContentFallback: 'Update available — {title}.',
      },
      featureRelease: {
        toastSaveError: 'Could not save. Please try again in a moment.',
        badgeNew: 'New',
        communiqueDate: 'Release note from {date}',
        linkAllUpdates: 'All updates',
        ctaGotIt: 'Got it!',
        ctaBusy: '…',
      },
    },
    Suggestions: {
      list: {
        errUpvote: 'Could not save your vote.',
        originalLanguageHint: 'Written in {language}',
      },
    },
  },
  es: {
    ApiAppSuggestions: {
      titleRequired: 'El título es obligatorio.',
      uploadPhotoError: 'No se pudo subir la foto.',
      missingId: 'Falta el identificador.',
      invalidStatus: 'Estado no válido (PENDING, IN_PROGRESS, DONE).',
      suggestionNotFound: 'Sugerencia no encontrada.',
      aiGenerateError: 'Error al generar con IA. Compruebe ANTHROPIC_API_KEY.',
    },
    Dashboard: {
      updatesPage: {
        title: 'Actualizaciones',
        intro:
          'Funciones que entregamos gracias a tus comentarios. El producto sigue mejorando.',
        notAuthenticated: 'No has iniciado sesión.',
      },
      updatesList: {
        editLabel: 'Editar',
        deleteLabel: 'Eliminar',
        scheduledWithDate: 'Programado · {date}',
        addMedia: 'Añadir multimedia',
        noContentFallback: 'Actualización disponible — {title}.',
      },
      featureRelease: {
        toastSaveError: 'No se pudo guardar. Inténtalo de nuevo en un momento.',
        badgeNew: 'Novedad',
        communiqueDate: 'Nota de versión del {date}',
        linkAllUpdates: 'Todas las actualizaciones',
        ctaGotIt: '¡Vamos!',
        ctaBusy: '…',
      },
    },
    Suggestions: {
      list: {
        errUpvote: 'No se pudo registrar tu voto.',
        originalLanguageHint: 'Redactada en {language}',
      },
    },
  },
  de: {
    ApiAppSuggestions: {
      titleRequired: 'Der Titel ist erforderlich.',
      uploadPhotoError: 'Foto konnte nicht hochgeladen werden.',
      missingId: 'Fehlende ID.',
      invalidStatus: 'Ungültiger Status (PENDING, IN_PROGRESS, DONE).',
      suggestionNotFound: 'Vorschlag nicht gefunden.',
      aiGenerateError: 'KI-Generierung fehlgeschlagen. Prüfen Sie ANTHROPIC_API_KEY.',
    },
    Dashboard: {
      updatesPage: {
        title: 'Updates',
        intro:
          'Funktionen, die wir dank Ihres Feedbacks ausliefern. Das Produkt wird stetig besser.',
        notAuthenticated: 'Sie sind nicht angemeldet.',
      },
      updatesList: {
        editLabel: 'Bearbeiten',
        deleteLabel: 'Löschen',
        scheduledWithDate: 'Geplant · {date}',
        addMedia: 'Medien hinzufügen',
        noContentFallback: 'Update verfügbar — {title}.',
      },
      featureRelease: {
        toastSaveError: 'Speichern nicht möglich. Bitte versuchen Sie es gleich erneut.',
        badgeNew: 'Neu',
        communiqueDate: 'Release-Hinweis vom {date}',
        linkAllUpdates: 'Alle Updates',
        ctaGotIt: 'Los geht’s!',
        ctaBusy: '…',
      },
    },
    Suggestions: {
      list: {
        errUpvote: 'Ihre Stimme konnte nicht gespeichert werden.',
        originalLanguageHint: 'Verfasst auf {language}',
      },
    },
  },
  it: {
    ApiAppSuggestions: {
      titleRequired: 'Il titolo è obbligatorio.',
      uploadPhotoError: 'Impossibile caricare la foto.',
      missingId: 'ID mancante.',
      invalidStatus: 'Stato non valido (PENDING, IN_PROGRESS, DONE).',
      suggestionNotFound: 'Suggerimento non trovato.',
      aiGenerateError: 'Generazione IA non riuscita. Verificare ANTHROPIC_API_KEY.',
    },
    Dashboard: {
      updatesPage: {
        title: 'Aggiornamenti',
        intro:
          'Funzionalità rilasciate grazie al tuo feedback. Il prodotto continua a migliorare.',
        notAuthenticated: 'Accesso non effettuato.',
      },
      updatesList: {
        editLabel: 'Modifica',
        deleteLabel: 'Elimina',
        scheduledWithDate: 'Programmato · {date}',
        addMedia: 'Aggiungi media',
        noContentFallback: 'Aggiornamento disponibile — {title}.',
      },
      featureRelease: {
        toastSaveError: 'Impossibile salvare. Riprova tra un attimo.',
        badgeNew: 'Novità',
        communiqueDate: 'Nota di rilascio del {date}',
        linkAllUpdates: 'Tutti gli aggiornamenti',
        ctaGotIt: 'Ci siamo!',
        ctaBusy: '…',
      },
    },
    Suggestions: {
      list: {
        errUpvote: 'Impossibile registrare il voto.',
        originalLanguageHint: 'Scritta in {language}',
      },
    },
  },
  pt: {
    ApiAppSuggestions: {
      titleRequired: 'O título é obrigatório.',
      uploadPhotoError: 'Não foi possível enviar a foto.',
      missingId: 'ID em falta.',
      invalidStatus: 'Estado inválido (PENDING, IN_PROGRESS, DONE).',
      suggestionNotFound: 'Sugestão não encontrada.',
      aiGenerateError: 'Falha na geração por IA. Verifique ANTHROPIC_API_KEY.',
    },
    Dashboard: {
      updatesPage: {
        title: 'Atualizações',
        intro:
          'Funcionalidades que lançamos graças ao seu feedback. O produto continua a evoluir.',
        notAuthenticated: 'Sessão não iniciada.',
      },
      updatesList: {
        editLabel: 'Editar',
        deleteLabel: 'Eliminar',
        scheduledWithDate: 'Agendado · {date}',
        addMedia: 'Adicionar média',
        noContentFallback: 'Atualização disponível — {title}.',
      },
      featureRelease: {
        toastSaveError: 'Não foi possível guardar. Tente novamente dentro de momentos.',
        badgeNew: 'Novo',
        communiqueDate: 'Nota de lançamento de {date}',
        linkAllUpdates: 'Todas as atualizações',
        ctaGotIt: 'Vamos lá!',
        ctaBusy: '…',
      },
    },
    Suggestions: {
      list: {
        errUpvote: 'Não foi possível registar o seu voto.',
        originalLanguageHint: 'Redigida em {language}',
      },
    },
  },
  ja: {
    ApiAppSuggestions: {
      titleRequired: 'タイトルは必須です。',
      uploadPhotoError: '写真をアップロードできませんでした。',
      missingId: 'ID がありません。',
      invalidStatus: 'ステータスが無効です（PENDING, IN_PROGRESS, DONE）。',
      suggestionNotFound: '提案が見つかりません。',
      aiGenerateError: 'AI の生成に失敗しました。ANTHROPIC_API_KEY を確認してください。',
    },
    Dashboard: {
      updatesPage: {
        title: 'アップデート',
        intro: '皆さまのフィードバックで届けた機能。プロダクトは日々改善されています。',
        notAuthenticated: 'ログインしていません。',
      },
      updatesList: {
        editLabel: '編集',
        deleteLabel: '削除',
        scheduledWithDate: '予定 · {date}',
        addMedia: 'メディアを追加',
        noContentFallback: 'アップデートがあります — {title}。',
      },
      featureRelease: {
        toastSaveError: '保存できませんでした。しばらくしてからもう一度お試しください。',
        badgeNew: '新着',
        communiqueDate: '{date} のリリースノート',
        linkAllUpdates: 'すべてのアップデート',
        ctaGotIt: '了解！',
        ctaBusy: '…',
      },
    },
    Suggestions: {
      list: {
        errUpvote: '投票を保存できませんでした。',
        originalLanguageHint: '記述言語：{language}',
      },
    },
  },
  zh: {
    ApiAppSuggestions: {
      titleRequired: '标题为必填项。',
      uploadPhotoError: '无法上传照片。',
      missingId: '缺少 ID。',
      invalidStatus: '状态无效（PENDING、IN_PROGRESS、DONE）。',
      suggestionNotFound: '未找到该建议。',
      aiGenerateError: 'AI 生成失败。请检查 ANTHROPIC_API_KEY。',
    },
    Dashboard: {
      updatesPage: {
        title: '更新',
        intro: '根据您的反馈交付的功能。产品持续改进。',
        notAuthenticated: '您尚未登录。',
      },
      updatesList: {
        editLabel: '编辑',
        deleteLabel: '删除',
        scheduledWithDate: '已计划 · {date}',
        addMedia: '添加媒体',
        noContentFallback: '有可用更新 — {title}。',
      },
      featureRelease: {
        toastSaveError: '无法保存。请稍后再试。',
        badgeNew: '新功能',
        communiqueDate: '{date} 的发布说明',
        linkAllUpdates: '所有更新',
        ctaGotIt: '知道了！',
        ctaBusy: '…',
      },
    },
    Suggestions: {
      list: {
        errUpvote: '无法保存您的投票。',
        originalLanguageHint: '原文语言：{language}',
      },
    },
  },
};

function deepMerge(target, source) {
  if (source == null || typeof source !== 'object' || Array.isArray(source)) return target;
  for (const k of Object.keys(source)) {
    const sv = source[k];
    if (sv != null && typeof sv === 'object' && !Array.isArray(sv) && typeof target[k] === 'object' && !Array.isArray(target[k])) {
      deepMerge(target[k], sv);
    } else {
      target[k] = sv;
    }
  }
  return target;
}

for (const loc of LOCALES) {
  const p = path.join(dir, `${loc}.json`);
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  const b = BUNDLES[loc];
  if (!b) throw new Error(`No bundle for ${loc}`);
  j.ApiAppSuggestions = { ...(j.ApiAppSuggestions ?? {}), ...b.ApiAppSuggestions };
  j.Dashboard = j.Dashboard ?? {};
  deepMerge(j.Dashboard, b.Dashboard);
  j.Suggestions = j.Suggestions ?? {};
  j.Suggestions.list = { ...(j.Suggestions.list ?? {}), ...b.Suggestions.list };
  fs.writeFileSync(p, JSON.stringify(j));
}

console.log('Patched', LOCALES.join(', '));
