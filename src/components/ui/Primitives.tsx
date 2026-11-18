import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, ImageOff, Info, TriangleAlert, X } from 'lucide-react';

export function StatusText({
  tone,
  label,
}: {
  tone: 'success' | 'warning' | 'danger' | 'neutral';
  label: string;
}) {
  const styles = {
    success: 'text-[#156E3F]',
    warning: 'text-[#9A5B13]',
    danger: 'text-[#B42318]',
    neutral: 'text-[#6A5866]',
  }[tone];

  const Icon =
    tone === 'success'
      ? CheckCircle2
      : tone === 'warning'
        ? TriangleAlert
        : tone === 'danger'
          ? AlertCircle
          : Info;

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap ${styles}`}>
      <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

export function SafeImage({
  src,
  alt,
  className = '',
  fallbackTitle,
}: {
  src?: string;
  alt: string;
  className?: string;
  fallbackTitle?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-[#EEE2DF] text-[#423441] border border-[#C5AEB5] p-4 text-center ${className}`}
        role="img"
        aria-label={alt}
      >
        <ImageOff className="w-6 h-6 mb-1.5 text-[#705267]" aria-hidden="true" />
        <span className="text-xs font-medium">{fallbackTitle || alt}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel,
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#211D25]/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div className="w-full max-w-md rounded-xl bg-white border border-[#C5AEB5] p-6">
        <div className="flex items-start justify-between gap-4 mb-3">
          <h3 id="confirm-modal-title" className="text-lg font-bold text-[#211D25]">
            {title}
          </h3>
          <button
            type="button"
            onClick={onCancel}
            aria-label="إغلاق النافذة"
            className="p-1.5 rounded-lg text-[#6A5866] hover:bg-[#EEE2DF] hover:text-[#211D25]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-[#423441] leading-relaxed mb-6">{description}</p>
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-[#C5AEB5] text-[#423441] hover:bg-[#EEE2DF] whitespace-nowrap"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 text-sm font-medium rounded-lg text-white whitespace-nowrap transition-colors ${
              danger ? 'bg-[#B42318] hover:bg-[#912018]' : 'bg-[#705267] hover:bg-[#423441]'
            }`}
          >
            {loading ? 'جاري التنفيذ...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function formatIsoShort(iso?: string): string {
  if (!iso) return '—';
  return iso.slice(0, 16).replace('T', ' ');
}

export function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-[#D8C7CD]">
      <div>
        <h2 className="text-2xl font-bold text-[#211D25] tracking-tight">{title}</h2>
        {subtitle && <p className="text-sm text-[#6A5866] mt-1">{subtitle}</p>}
      </div>
      {action && <div className="flex items-center gap-3 shrink-0">{action}</div>}
    </div>
  );
}
