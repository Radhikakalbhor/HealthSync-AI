'use client';

import React from 'react';
import { Globe } from 'lucide-react';
import { useTranslation, SupportedLocale } from '@/lib/i18n';

export default function LanguageSelector() {
  const { locale, setLocale, languages } = useTranslation();

  return (
    <div className="flex items-center space-x-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg p-1 text-xs">
      <Globe className="w-3.5 h-3.5 text-slate-500 ml-1" />
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as SupportedLocale)}
        className="bg-transparent border-none text-slate-700 dark:text-slate-200 text-xs font-medium focus:outline-none cursor-pointer pr-1"
        aria-label="Language Selector"
      >
        {languages.map((lang) => (
          <option key={lang.code} value={lang.code} className="bg-white text-slate-900">
            {lang.nativeName}
          </option>
        ))}
      </select>
    </div>
  );
}
