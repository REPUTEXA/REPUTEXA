'use client';

import { useCallback, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { PDFDocument } from 'pdf-lib';
import { toast } from 'sonner';
import { Copy, Download, Image as ImageIcon, Upload } from 'lucide-react';
import { BrandSeal } from '@/components/admin/BrandSeal';
import { AGENCY_BRAND_CONFIG } from '@/lib/agency-brand-config';
import { captureBrandSealPngBytes } from '@/lib/admin/brand-seal-capture';
import { qrPayloadToPngBytes } from '@/lib/admin/qr-png';
import { sha256HexOfBytes } from '@/lib/crypto/sha256-hex';

type Props = {
  registrationLabel: string;
};

const EXPORT_BOX_ID = 'brand-seal-export-light';
/** Largeur max du sceau sur la page PDF (points PDF ≈ 1/72 in) */
const PDF_SEAL_MAX_WIDTH_PT = 130;
const PDF_QR_MAX_WIDTH_PT = 48;
const PDF_SEAL_GAP_PT = 6;
const PDF_SEAL_MARGIN_PT = 28;

export function AdminBrandSealPanel({ registrationLabel }: Props) {
  const locale = useLocale();
  const t = useTranslations('Dashboard.adminBrandSettings');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [busy, setBusy] = useState(false);

  const copyRegistration = useCallback(async () => {
    const raw = AGENCY_BRAND_CONFIG.registrationNumber.trim();
    try {
      await navigator.clipboard.writeText(raw);
      toast.success(t('copySuccess'));
    } catch {
      toast.error(t('copyError'));
    }
  }, [t]);

  const downloadPng = useCallback(async () => {
    try {
      const bytes = await captureBrandSealPngBytes(EXPORT_BOX_ID);
      const blob = new Blob([new Uint8Array(bytes)], { type: 'image/png' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'reputexa-brand-seal.png';
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(t('downloadSuccess'));
    } catch {
      toast.error(t('downloadError'));
    }
  }, [t]);

  const copySealImage = useCallback(async () => {
    try {
      const bytes = await captureBrandSealPngBytes(EXPORT_BOX_ID);
      const blob = new Blob([new Uint8Array(bytes)], { type: 'image/png' });
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      toast.success(t('copyImageSuccess'));
    } catch {
      toast.error(t('copyImageError'));
    }
  }, [t]);

  const stampPdf = useCallback(
    async (file: File) => {
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      if (!isPdf) {
        toast.error(t('certifyErrorNotPdf'));
        return;
      }
      setBusy(true);
      try {
        const documentId = crypto.randomUUID();
        const verifyUrl = `${window.location.origin}/${locale}/verify/${documentId}`;

        const sealBytes = await captureBrandSealPngBytes(EXPORT_BOX_ID);
        const qrBytes = await qrPayloadToPngBytes(verifyUrl, 220);

        const pdfBytesIn = new Uint8Array(await file.arrayBuffer());
        const pdfDoc = await PDFDocument.load(pdfBytesIn, { ignoreEncryption: false });
        const sealImage = await pdfDoc.embedPng(sealBytes);
        const qrImage = await pdfDoc.embedPng(qrBytes);
        const pages = pdfDoc.getPages();
        const lastPage = pages[pages.length - 1];
        const { width } = lastPage.getSize();
        const m = PDF_SEAL_MARGIN_PT;

        const qrScale = PDF_QR_MAX_WIDTH_PT / qrImage.width;
        const qrDims = qrImage.scale(qrScale);
        const sealScale = PDF_SEAL_MAX_WIDTH_PT / sealImage.width;
        const sealDims = sealImage.scale(sealScale);
        const blockW = qrDims.width + PDF_SEAL_GAP_PT + sealDims.width;
        let x = width - blockW - m;
        lastPage.drawImage(qrImage, {
          x,
          y: m,
          width: qrDims.width,
          height: qrDims.height,
        });
        x += qrDims.width + PDF_SEAL_GAP_PT;
        lastPage.drawImage(sealImage, {
          x,
          y: m,
          width: sealDims.width,
          height: sealDims.height,
        });

        const outBytes = await pdfDoc.save();
        const hex = await sha256HexOfBytes(outBytes);

        const register = await fetch('/api/admin/document-attestations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            documentId,
            contentSha256: hex,
            issuerLegalName: AGENCY_BRAND_CONFIG.legalNameUpper,
            sourceFilename: file.name,
          }),
        });
        if (!register.ok) {
          toast.error(t('attestRegisterError'));
        }

        const base = file.name.replace(/\.pdf$/i, '');
        const outName = `${base}-certified.pdf`;
        const blob = new Blob([new Uint8Array(outBytes)], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = outName;
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        toast.success(t('certifySuccess'));
      } catch {
        toast.error(t('certifyError'));
      } finally {
        setBusy(false);
      }
    },
    [t, locale],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      const f = e.dataTransfer.files?.[0];
      if (f) void stampPdf(f);
    },
    [stampPdf],
  );

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) void stampPdf(f);
      e.target.value = '';
    },
    [stampPdf],
  );

  const commonSealProps = {
    legalName: AGENCY_BRAND_CONFIG.legalNameUpper,
    registrationLabel,
    registrationNumber: AGENCY_BRAND_CONFIG.registrationNumber,
    headquartersAddress: AGENCY_BRAND_CONFIG.headquartersAddress,
    logoSrc: AGENCY_BRAND_CONFIG.logoSrc,
  };

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-6">
        <BrandSeal variant="dark" {...commonSealProps} />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={copyRegistration}
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-700/80 bg-zinc-900/60 px-4 py-2.5 text-xs font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-800/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
        >
          <Copy className="h-3.5 w-3.5 opacity-80" strokeWidth={2} />
          {t('copyRegistration')}
        </button>
        <button
          type="button"
          onClick={downloadPng}
          className="inline-flex items-center gap-2 rounded-xl border border-amber-500/35 bg-amber-950/30 px-4 py-2.5 text-xs font-medium text-amber-100/95 transition hover:border-amber-400/50 hover:bg-amber-950/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/45"
        >
          <Download className="h-3.5 w-3.5 opacity-90" strokeWidth={2} />
          {t('downloadPng')}
        </button>
        <button
          type="button"
          onClick={copySealImage}
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-700/80 bg-zinc-900/60 px-4 py-2.5 text-xs font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-800/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
        >
          <ImageIcon className="h-3.5 w-3.5 opacity-80" strokeWidth={2} />
          {t('copyImage')}
        </button>
      </div>

      <div className="space-y-3 rounded-2xl border border-zinc-800/70 bg-zinc-950/40 p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-700/60 bg-zinc-900/50">
            <Upload className="h-5 w-5 text-zinc-400" strokeWidth={1.75} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">{t('certifyTitle')}</h3>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">{t('certifyLead')}</p>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={onFileChange}
        />

        <button
          type="button"
          disabled={busy}
          onDragEnter={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragActive(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.currentTarget.contains(e.relatedTarget as Node)) return;
            setDragActive(false);
          }}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={[
            'flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-10 text-center transition',
            busy ? 'cursor-wait opacity-70' : 'cursor-pointer hover:border-zinc-500',
            dragActive ? 'border-amber-500/55 bg-amber-950/20' : 'border-zinc-600/80 bg-zinc-900/30',
          ].join(' ')}
        >
          <span className="text-xs font-medium text-zinc-300">
            {busy ? t('certifyProcessing') : dragActive ? t('certifyDropzoneActive') : t('certifyDropzone')}
          </span>
          <span className="text-[11px] text-zinc-500">{t('certifyFileButton')}</span>
        </button>
      </div>

      <div className="pointer-events-none fixed left-[-10000px] top-0" aria-hidden>
        <BrandSeal id={EXPORT_BOX_ID} variant="light" {...commonSealProps} />
      </div>
    </div>
  );
}
