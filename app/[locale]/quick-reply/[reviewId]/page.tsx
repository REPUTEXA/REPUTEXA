'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';

type Review = {
  id: string;
  reviewer_name: string;
  rating: number;
  comment: string;
  source: string;
  ai_response: string | null;
  response_text: string | null;
  status: string;
};

export default function QuickReplyPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const reviewId = params?.reviewId as string;
  const token = searchParams?.get('t') ?? '';
  const [review, setReview] = useState<Review | null>(null);
  const [responseText, setResponseText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!reviewId || !token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`/api/quick-reply?reviewId=${encodeURIComponent(reviewId)}&token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setReview(data);
        setResponseText(data.ai_response || data.response_text || '');
      })
      .catch(() => toast.error('Lien invalide ou expiré'))
      .finally(() => setLoading(false));
  }, [reviewId, token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewId || !token || !responseText.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/quick-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewId, token, responseText: responseText.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erreur');
      setSuccess(true);
      toast.success('Réponse enregistrée ✅');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!review) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <p className="text-slate-600">Lien invalide ou expiré.</p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-emerald-600" />
          </div>
          <h1 className="font-display font-bold text-xl text-slate-900">Réponse enregistrée</h1>
          <p className="text-slate-500 mt-1">Merci, vous pouvez fermer cette page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-xl mx-auto">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
          <h1 className="font-display font-bold text-xl text-slate-900 mb-4">Modifier la réponse</h1>
          <div className="mb-4 p-3 rounded-xl bg-slate-50">
            <p className="text-sm font-medium text-slate-700">{review.reviewer_name}</p>
            <p className="text-amber-600 text-sm font-semibold mt-0.5">{review.rating}/5 étoiles</p>
            <p className="text-sm text-slate-600 mt-2">{review.comment}</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="response" className="block text-sm font-medium text-slate-700 mb-1.5">
                Votre réponse
              </label>
              <textarea
                id="response"
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
                rows={5}
                required
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                placeholder="Votre réponse professionnelle..."
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 rounded-xl font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Valider la réponse
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
