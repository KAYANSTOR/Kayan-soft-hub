import React, { useState } from 'react';
import { FileText, Plus, Trash2 } from 'lucide-react';
import { hubApi, type BootstrapPayload } from '../lib/api';
import { findMediaReferences, hasPermission } from '../shared/domain';
import type { MediaAsset } from '../shared/types';
import { SafeImage, SectionHeader } from './ui/Primitives';

export function MediaLibraryView({
  data,
  searchQuery,
  onRefresh,
  onNotify,
}: {
  data: BootstrapPayload;
  searchQuery: string;
  onRefresh: () => Promise<void>;
  onNotify: (msg: string, tone?: 'success' | 'error') => void;
}) {
  const [catFilter, setCatFilter] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    fileName: '',
    url: '/src/assets/images/kayan_hero_studio_1794962896296.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 245000,
    category: 'projects' as MediaAsset['category'],
    altText: '',
  });

  const canManage = hasPermission(data.currentUser, 'media.manage');

  const filtered = data.media.filter((m) => {
    const q = searchQuery.trim().toLowerCase();
    const matchSearch =
      !q || m.fileName.toLowerCase().includes(q) || m.altText.toLowerCase().includes(q);
    const matchCat = catFilter === 'all' || m.category === catFilter;
    return matchSearch && matchCat;
  });

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    try {
      await hubApi.addMedia(form);
      setShowAdd(false);
      setForm({ ...form, fileName: '', altText: '' });
      await onRefresh();
      onNotify('تمت إضافة الملف إلى مكتبة الوسائط الموحدة.');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'تعذر رفع الملف', 'error');
    }
  }

  async function handleDelete(id: string) {
    try {
      await hubApi.deleteMedia(id);
      await onRefresh();
      onNotify('تم حذف الملف من مكتبة الوسائط بعد التحقق من عدم ارتباطه.');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'تعذر حذف الملف', 'error');
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="مكتبة الوسائط الموحدة"
        subtitle="إدارة الصور والملفات والتحقق من نوعها وحجمها ومنع حذف أي ملف مرتبط بصفحة أو مقال أو مشروع."
        action={
          canManage ? (
            <button
              type="button"
              onClick={() => setShowAdd(!showAdd)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#705267] text-white text-xs font-medium whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة ملف وسائط</span>
            </button>
          ) : undefined
        }
      />

      {showAdd && (
        <form onSubmit={handleUpload} className="bg-white border border-[#705267] rounded-xl p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">اسم الملف</label>
              <input
                required
                placeholder="case_study_cover.jpg"
                value={form.fileName}
                onChange={(e) => setForm({ ...form, fileName: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[#C5AEB5] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">التصنيف</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as MediaAsset['category'] })}
                className="w-full px-3 py-2 rounded-lg border border-[#C5AEB5] text-sm bg-white"
              >
                <option value="hero">واجهة Hero</option>
                <option value="projects">المشاريع</option>
                <option value="articles">المقالات</option>
                <option value="services">الخدمات</option>
                <option value="documents">ملفات PDF</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">النص البديل Alt Text</label>
              <input
                required
                placeholder="وصف واضح للصورة لتحسين SEO وإمكانية الوصول"
                value={form.altText}
                onChange={(e) => setForm({ ...form, altText: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[#C5AEB5] text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-lg border border-[#C5AEB5] text-xs">
              إلغاء
            </button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-[#705267] text-white text-xs font-medium">
              حفظ في المكتبة
            </button>
          </div>
        </form>
      )}

      <div className="flex items-center gap-1 p-1 bg-[#EEE2DF] rounded-lg w-fit flex-wrap">
        {[
          { id: 'all', label: 'الكل' },
          { id: 'hero', label: 'الواجهات' },
          { id: 'projects', label: 'المشاريع' },
          { id: 'articles', label: 'المقالات' },
          { id: 'documents', label: 'المستندات' },
        ].map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCatFilter(c.id)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium ${
              catFilter === c.id ? 'bg-white text-[#211D25]' : 'text-[#423441]'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((asset) => {
          const refs = findMediaReferences(asset.url, {
            pages: data.pages,
            articles: data.articles,
            projects: data.projects,
          });
          return (
            <div key={asset.id} className="bg-white border border-[#D8C7CD] rounded-xl overflow-hidden flex flex-col justify-between">
              <div>
                {asset.mimeType.startsWith('image/') ? (
                  <SafeImage src={asset.url} alt={asset.altText} className="w-full h-44 object-cover" />
                ) : (
                  <div className="h-44 bg-[#EEE2DF] flex items-center justify-center">
                    <FileText className="w-10 h-10 text-[#705267]" />
                  </div>
                )}
                <div className="p-4">
                  <h4 className="font-bold text-sm text-[#211D25] truncate" dir="ltr">
                    {asset.fileName}
                  </h4>
                  <p className="text-xs text-[#6A5866] mt-1">{asset.altText}</p>
                  <div className="text-[11px] text-[#6A5866] mt-2 tabular-nums">
                    {(asset.sizeBytes / 1024).toFixed(0)} KB · {asset.category}
                  </div>
                  <div className="text-[11px] text-[#423441] mt-2">
                    {refs.length > 0 ? `مستخدم في (${refs.length}): ${refs.join('، ')}` : 'غير مستخدم حالياً'}
                  </div>
                </div>
              </div>
              {canManage && (
                <div className="px-4 py-3 border-t border-[#EEE2DF] flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleDelete(asset.id)}
                    className="inline-flex items-center gap-1 text-xs text-[#B42318] hover:underline"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>حذف الملف</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
