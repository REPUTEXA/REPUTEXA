/**
 * GET /api/review/publish?id=[REVIEW_ID]
 *
 * Route de publication intermédiaire.
 *
 * Flux :
 *  1. Récupère l'avis poli depuis review_queue.metadata.polished_review
 *  2. Retourne une page HTML autonome qui :
 *     a. Copie l'avis dans le presse-papier via navigator.clipboard.writeText
 *     b. Affiche un message de confirmation avec un compte à rebours (2s)
 *     c. Redirige vers le google_review_url du commerçant
 */

import { createAdminClient } from '@/lib/supabase/admin';

type ReviewQueueRow = {
  metadata: {
    polished_review?: string;
    raw_review?: string;
  } | null;
  user_id: string;
};

type ProfileRow = {
  google_review_url: string | null;
  establishment_name: string | null;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id  = url.searchParams.get('id')?.trim();

  if (!id) {
    return buildErrorPage('Lien invalide', 'Identifiant d\'avis manquant.');
  }

  const admin = createAdminClient();
  if (!admin) {
    return buildErrorPage('Service indisponible', 'Veuillez réessayer dans quelques instants.');
  }

  // ── Récupérer l'entrée review_queue ──────────────────────────────────────
  const { data: queueRow, error: queueError } = await admin
    .from('review_queue')
    .select('metadata, user_id')
    .eq('id', id)
    .maybeSingle();

  if (queueError || !queueRow) {
    return buildErrorPage('Avis introuvable', 'Ce lien a peut-être expiré ou déjà été utilisé.');
  }

  const row = queueRow as unknown as ReviewQueueRow;
  const meta = row.metadata;
  const reviewText = meta?.polished_review ?? meta?.raw_review ?? '';

  if (!reviewText) {
    return buildErrorPage(
      'Texte d\'avis manquant',
      'Nous n\'avons pas pu retrouver le texte de votre avis. Contactez le commerce directement.'
    );
  }

  // ── Récupérer le google_review_url du commerçant ─────────────────────────
  const { data: profile } = await admin
    .from('profiles')
    .select('google_review_url, establishment_name')
    .eq('id', row.user_id)
    .maybeSingle();

  const merchant = profile as ProfileRow | null;
  const googleUrl = merchant?.google_review_url?.trim() || null;
  const establishmentName = merchant?.establishment_name?.trim() || 'votre commerce favori';

  return buildPublishPage(reviewText, googleUrl, establishmentName);
}

// ── HTML builders ─────────────────────────────────────────────────────────────

function buildPublishPage(
  reviewText: string,
  googleUrl: string | null,
  establishmentName: string
): Response {
  const escapedText = reviewText
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$/g, '\\$');

  const redirectTarget = googleUrl ?? 'https://www.google.com/maps/search/' + encodeURIComponent(establishmentName);

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Publier votre avis — Reputexa</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
      color: #f8fafc;
    }

    .card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 1.5rem;
      padding: 2rem;
      max-width: 480px;
      width: 100%;
      box-shadow: 0 25px 50px rgba(0,0,0,0.5);
      text-align: center;
      animation: fadeIn 0.4s ease;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(12px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .logo { font-size: 2.5rem; margin-bottom: 1rem; }

    h1 {
      font-size: 1.35rem;
      font-weight: 700;
      margin-bottom: 0.5rem;
      color: #f1f5f9;
    }

    .subtitle {
      font-size: 0.875rem;
      color: #94a3b8;
      margin-bottom: 1.5rem;
      line-height: 1.5;
    }

    .review-box {
      background: #0f172a;
      border: 1px solid #1e3a5f;
      border-radius: 1rem;
      padding: 1.25rem;
      margin-bottom: 1.5rem;
      text-align: left;
      font-size: 0.9rem;
      line-height: 1.6;
      color: #e2e8f0;
      font-style: italic;
      white-space: pre-wrap;
      word-break: break-word;
      cursor: text;
      user-select: all;
    }

    /* ── Bandeau de statut ── */
    .status {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 1rem 1.25rem;
      border-radius: 1rem;
      margin-bottom: 1.5rem;
      font-size: 0.9rem;
      text-align: left;
      transition: all 0.3s ease;
    }
    .status.loading { background: #1e293b; border: 1px solid #334155; color: #94a3b8; }
    .status.copied  { background: #022c22; border: 1px solid #064e3b; }
    .status.fallback{ background: #1c1917; border: 1px solid #78350f; }

    .status-icon { font-size: 1.5rem; flex-shrink: 0; margin-top: 1px; }
    .status-text strong { display: block; font-size: 0.95rem; color: #f1f5f9; margin-bottom: 2px; }
    .status-text span { color: #94a3b8; font-size: 0.82rem; line-height: 1.4; }

    /* ── Bouton fallback (masqué par défaut) ── */
    .fallback-btn {
      display: none;
      align-items: center;
      justify-content: center;
      gap: 0.6rem;
      width: 100%;
      padding: 1rem;
      background: linear-gradient(135deg, #f59e0b, #d97706);
      color: #0c0a09;
      border: none;
      border-radius: 0.875rem;
      font-size: 1rem;
      font-weight: 700;
      cursor: pointer;
      margin-bottom: 1rem;
      letter-spacing: 0.01em;
      box-shadow: 0 4px 14px rgba(245,158,11,0.35);
      transition: transform 0.15s, box-shadow 0.15s;
    }
    .fallback-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(245,158,11,0.45); }
    .fallback-btn:active { transform: translateY(0); }
    .fallback-btn.visible { display: flex; }

    /* ── Lien manuel ── */
    .manual-link {
      display: block;
      text-align: center;
      font-size: 0.82rem;
      color: #475569;
      text-decoration: none;
      margin-top: 0.5rem;
      transition: color 0.2s;
    }
    .manual-link:hover { color: #94a3b8; }

    /* ── Barre de progression ── */
    .progress-wrap { margin-top: 1.25rem; }
    .progress-label { font-size: 0.78rem; color: #64748b; margin-bottom: 0.4rem; }
    .progress-bar {
      height: 4px;
      background: #334155;
      border-radius: 2px;
      overflow: hidden;
    }
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #2563eb, #38bdf8);
      width: 100%;
      transition: width 1.2s linear;
      border-radius: 2px;
    }

    .powered { margin-top: 2rem; font-size: 0.7rem; color: #475569; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">🌟</div>
    <h1>Votre avis est prêt !</h1>
    <p class="subtitle" id="subtitle">Merci de votre confiance — nous copions votre avis automatiquement…</p>

    <div class="review-box" id="review-text">${escapeHtml(reviewText)}</div>

    <div class="status loading" id="status-box">
      <span class="status-icon" id="status-icon">⏳</span>
      <div class="status-text">
        <strong id="status-title">Copie en cours…</strong>
        <span id="status-detail">Veuillez patienter un instant.</span>
      </div>
    </div>

    <!-- Bouton fallback visible uniquement si l'auto-copie échoue -->
    <button class="fallback-btn" id="fallback-btn" onclick="manualCopyAndRedirect()">
      📋 Copier l'avis et ouvrir Google
    </button>

    <a class="manual-link" id="manual-link" href="${redirectTarget}" target="_blank" rel="noopener noreferrer">
      Ouvrir Google sans copie automatique →
    </a>

    <div class="progress-wrap" id="progress-wrap" style="display:none">
      <p class="progress-label">Redirection vers Google dans un instant…</p>
      <div class="progress-bar"><div class="progress-fill" id="progress-fill"></div></div>
    </div>

    <p class="powered">Propulsé par <strong>Reputexa</strong></p>
  </div>

  <script>
    const REVIEW_TEXT  = \`${escapedText}\`;
    const REDIRECT_URL = '${redirectTarget.replace(/'/g, "\\'")}';
    const DELAY_MS     = 1200;

    function showSuccess() {
      const box = document.getElementById('status-box');
      box.className = 'status copied';
      document.getElementById('status-icon').textContent   = '✅';
      document.getElementById('status-title').textContent  = 'Votre avis a été copié !';
      document.getElementById('status-detail').textContent = 'Vous allez être redirigé vers Google pour le coller.';
      document.getElementById('subtitle').textContent      = 'Collez simplement votre avis (Ctrl+V ou ⌘+V) une fois sur Google.';
      startRedirect();
    }

    function showFallback() {
      const box = document.getElementById('status-box');
      box.className = 'status fallback';
      document.getElementById('status-icon').textContent   = '⚠️';
      document.getElementById('status-title').textContent  = 'Copie automatique indisponible';
      document.getElementById('status-detail').textContent = 'Appuyez sur le bouton ci-dessous pour copier votre avis et ouvrir Google.';
      document.getElementById('subtitle').textContent      = 'Un clic suffit pour publier votre avis sur Google.';
      const btn = document.getElementById('fallback-btn');
      btn.classList.add('visible');
    }

    function startRedirect() {
      const wrap = document.getElementById('progress-wrap');
      const fill = document.getElementById('progress-fill');
      wrap.style.display = 'block';
      // Déclenche la transition CSS (100% → 0%)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => { fill.style.width = '0%'; });
      });
      setTimeout(() => { window.location.href = REDIRECT_URL; }, DELAY_MS);
    }

    // ── Bouton fallback : copier + rediriger manuellement ────────────────────
    async function manualCopyAndRedirect() {
      const btn = document.getElementById('fallback-btn');
      btn.disabled = true;
      btn.textContent = '⏳ Copie en cours…';
      try {
        await navigator.clipboard.writeText(REVIEW_TEXT);
      } catch (_) {
        // Fallback ultime : tout sélectionner pour Ctrl+C
        const el = document.getElementById('review-text');
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        if (sel) { sel.removeAllRanges(); sel.addRange(range); }
      }
      btn.textContent = '✅ Copié — ouverture de Google…';
      setTimeout(() => { window.location.href = REDIRECT_URL; }, 600);
    }

    // ── Auto-copie dès le chargement ─────────────────────────────────────────
    window.addEventListener('load', async () => {
      try {
        await navigator.clipboard.writeText(REVIEW_TEXT);
        showSuccess();
      } catch (_) {
        showFallback();
      }
    });
  </script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function buildErrorPage(title: string, message: string): Response {
  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Erreur — Reputexa</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0f172a;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
      color: #f8fafc;
    }
    .card {
      background: #1e293b;
      border: 1px solid #7f1d1d;
      border-radius: 1.5rem;
      padding: 2rem;
      max-width: 400px;
      width: 100%;
      text-align: center;
    }
    h1 { font-size: 1.25rem; margin: 1rem 0 0.5rem; }
    p  { color: #94a3b8; font-size: 0.9rem; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="card">
    <div style="font-size:2.5rem">⚠️</div>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(message)}</p>
  </div>
</body>
</html>`;

  return new Response(html, {
    status: 400,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const dynamic = 'force-dynamic';
