'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { PublicPageShell } from '@/components/public-page-shell';
import {
  ChevronDown,
  Bot,
  Shield,
  Plug,
  Mail,
  MessageSquare,
  Search,
  ArrowRight,
  CreditCard,
  BarChart2,
  Globe,
} from 'lucide-react';

type FAQ = {
  question: string;
  answer: string;
};

type Category = {
  id: string;
  icon: React.ElementType;
  label: string;
  color: string;
  faqs: FAQ[];
};

type RawFaq = { q: string; a: string };
type RawCategory = { id: string; label: string; faqs: RawFaq[] };

const CATEGORY_META: Record<string, { icon: React.ElementType; color: string }> = {
  ai: { icon: Bot, color: 'text-violet-400' },
  shield: { icon: Shield, color: 'text-emerald-400' },
  integration: { icon: Plug, color: 'text-blue-400' },
  billing: { icon: CreditCard, color: 'text-amber-400' },
  stats: { icon: BarChart2, color: 'text-pink-400' },
  global: { icon: Globe, color: 'text-cyan-400' },
};

function AccordionItem({ question, answer }: FAQ) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-white/10 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-4 text-left group"
        aria-expanded={open}
      >
        <span className="text-sm font-medium text-white group-hover:text-[#2563eb] transition-colors pr-4">
          {question}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-gray-500 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="pb-4">
          <p className="text-sm text-gray-400 leading-relaxed">{answer}</p>
        </div>
      )}
    </div>
  );
}

export default function HelpPage() {
  const tShell = useTranslations('PublicPages');
  const t = useTranslations('HelpPage');
  const rawCategories = t.raw('categories') as RawCategory[];
  const categories: Category[] = useMemo(
    () =>
      rawCategories.map((c) => {
        const meta = CATEGORY_META[c.id] ?? CATEGORY_META.ai;
        return {
          id: c.id,
          label: c.label,
          icon: meta.icon,
          color: meta.color,
          faqs: c.faqs.map((f) => ({ question: f.q, answer: f.a })),
        };
      }),
    [rawCategories],
  );
  const [activeCategory, setActiveCategory] = useState(() => categories[0]?.id ?? 'ai');
  const category = categories.find((c) => c.id === activeCategory) ?? categories[0]!;

  return (
    <PublicPageShell title={tShell('help.title')} subtitle={tShell('help.subtitle')}>
      <div className="relative max-w-xl mx-auto mb-12">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
        <input
          type="text"
          placeholder={t('searchPlaceholder')}
          className="w-full pl-11 pr-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#2563eb]/40 focus:border-[#2563eb] transition-colors"
        />
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <aside className="lg:w-56 shrink-0">
          <nav className="flex flex-row lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
            {categories.map(({ id, icon: Icon, label, color }) => (
              <button
                key={id}
                onClick={() => setActiveCategory(id)}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
                  activeCategory === id
                    ? 'bg-[#2563eb]/20 text-[#2563eb]'
                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon className={`w-4 h-4 ${activeCategory === id ? 'text-[#2563eb]' : color}`} />
                {label}
              </button>
            ))}
          </nav>
        </aside>

        <div className="flex-1 min-w-0">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-2">
            <div className="flex items-center gap-3 py-4 border-b border-white/10 mb-2">
              <category.icon className={`w-5 h-5 ${category.color}`} />
              <h2 className="font-display font-semibold text-white">{category.label}</h2>
              <span className="ml-auto text-xs text-gray-500">
                {t('questionsCount', { count: category.faqs.length })}
              </span>
            </div>
            {category.faqs.map((faq, i) => (
              <AccordionItem key={`${category.id}-${i}`} {...faq} />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2563eb]/20">
              <MessageSquare className="w-5 h-5 text-[#2563eb]" />
            </div>
            <div>
              <p className="font-semibold text-white text-sm">{t('supportChatTitle')}</p>
              <p className="text-xs text-gray-500">{t('supportChatSub')}</p>
            </div>
          </div>
          <p className="text-sm text-gray-400 mb-4 leading-relaxed">{t('supportChatBody')}</p>
          <Link
            href="/contact"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#2563eb] hover:underline"
          >
            {t('supportChatCta')} <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2563eb]/20">
              <Mail className="w-5 h-5 text-[#2563eb]" />
            </div>
            <div>
              <p className="font-semibold text-white text-sm">{t('supportEmailTitle')}</p>
              <p className="text-xs text-gray-500">{t('supportEmailSub')}</p>
            </div>
          </div>
          <p className="text-sm text-gray-400 mb-4 leading-relaxed">{t('supportEmailBody')}</p>
          <Link
            href="/contact"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#2563eb] hover:underline"
          >
            {t('supportEmailCta')} <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </PublicPageShell>
  );
}
