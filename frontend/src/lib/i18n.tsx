'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export type SupportedLocale = 'en' | 'hi' | 'mr';

interface LanguageOption {
  code: SupportedLocale;
  name: string;
  nativeName: string;
}

export const LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी' },
];

const TRANSLATIONS: Record<SupportedLocale, Record<string, string>> = {
  en: {
    // Navigation
    nav_dashboard: 'Dashboard',
    nav_documents: 'Documents',
    nav_reminders: 'Reminders',
    nav_assistant: 'AI Assistant',
    nav_timeline: 'Medical Timeline',
    nav_analytics: 'Health Trends',
    nav_summary: 'Doctor Summary',
    nav_emergency: 'Emergency Card',
    nav_family: 'Family Profiles',

    // Common Actions
    btn_upload: 'Upload Record',
    btn_save: 'Save Changes',
    btn_download_pdf: 'Download PDF Summary',
    btn_generate_briefing: 'Generate Doctor Briefing',
    btn_share_qr: 'Share Secure QR',
    btn_revoke: 'Revoke Access',
    btn_add_family: 'Add Family Member',
    btn_cancel: 'Cancel',
    btn_copy_link: 'Copy Link',
    status_copied: 'Copied!',

    // Timeline
    timeline_title: 'Unified Medical Timeline',
    timeline_subtitle: 'A chronological view of your clinical history across all uploaded documents.',
    timeline_all: 'All Categories',
    timeline_prescriptions: 'Prescriptions',
    timeline_labs: 'Lab Reports',
    timeline_imaging: 'Imaging Scans',
    timeline_search_placeholder: 'Search timeline by doctor, facility, or medication...',

    // Analytics
    analytics_title: 'Biomarker Health Trends',
    analytics_subtitle: 'Longitudinal lab analytics grouped strictly by compatible clinical units.',
    analytics_no_data: 'No laboratory data points found. Upload blood test reports to visualize trends.',
    analytics_unit_note: 'Values with different measurement units are graphed as distinct series.',

    // Doctor Summary
    summary_title: 'Doctor Visit Summary & Briefing',
    summary_subtitle: 'Consolidate active medicines, recent lab investigations, and prepare questions for your physician.',
    summary_active_meds: 'Active Medications',
    summary_prev_meds: 'Previous Medications',
    summary_recent_labs: 'Recent Laboratory Values',
    summary_briefing_heading: 'Pre-Visit Consultation Briefing',
    summary_specialty_label: 'Consulting Specialty',
    summary_concern_label: 'Primary Concern / Symptoms',

    // Emergency Card
    emergency_title: 'Emergency Health Card',
    emergency_subtitle: 'Instant life-saving information accessible via physical QR or secure digital badge.',
    emergency_blood_group: 'Blood Group',
    emergency_contact: 'Emergency Contact',
    emergency_relation: 'Relationship',
    emergency_phone: 'Phone Number',
    emergency_allergies: 'Known Allergies',
    emergency_meds: 'Confirmed Medications',
    emergency_notes: 'Critical Clinical Notes',
    emergency_scan_qr: 'Scan QR to View Medical Badge',

    // Family
    family_title: 'Family Health Profiles',
    family_subtitle: 'Manage and switch medical records for children, elderly parents, or dependents.',
    family_add_modal_title: 'Add Family Member Profile',
    family_name_label: 'Full Name',
    family_relation_label: 'Relationship',
    family_dob_label: 'Date of Birth',

    // Disclaimer
    medical_disclaimer: 'HealthSync AI organizes and visualizes existing patient records. It NEVER diagnoses diseases, prescribes medicines, or changes treatments. Always consult your physician.',
  },
  hi: {
    // Navigation
    nav_dashboard: 'डैशबोर्ड',
    nav_documents: 'दस्तावेज़',
    nav_reminders: 'दवा रिमाइंडर',
    nav_assistant: 'एआई सहायक',
    nav_timeline: 'मेडिकल टाइमलाइन',
    nav_analytics: 'स्वास्थ्य रुझान',
    nav_summary: 'डॉक्टर सारांश',
    nav_emergency: 'आपातकालीन कार्ड',
    nav_family: 'परिवार प्रोफाइल',

    // Common Actions
    btn_upload: 'दस्तावेज़ अपलोड करें',
    btn_save: 'परिवर्तन सहेजें',
    btn_download_pdf: 'पीडीएफ सारांश डाउनलोड करें',
    btn_generate_briefing: 'डॉक्टर ब्रीफिंग बनाएं',
    btn_share_qr: 'सुरक्षित क्यूआर साझा करें',
    btn_revoke: 'पहुंच रद्द करें',
    btn_add_family: 'सदस्य जोड़ें',
    btn_cancel: 'रद्द करें',
    btn_copy_link: 'लिंक कॉपी करें',
    status_copied: 'कॉपी हो गया!',

    // Timeline
    timeline_title: 'एकीकृत मेडिकल टाइमलाइन',
    timeline_subtitle: 'आपके सभी अपलोड किए गए मेडिकल रिकॉर्ड्स का कालानुक्रमिक इतिहास।',
    timeline_all: 'सभी श्रेणियां',
    timeline_prescriptions: 'पर्चे (Prescriptions)',
    timeline_labs: 'लैब रिपोर्ट',
    timeline_imaging: 'इमेजिंग स्कैन',
    timeline_search_placeholder: 'डॉक्टर, क्लिनिक या दवा के नाम से खोजें...',

    // Analytics
    analytics_title: 'बायोमार्कर स्वास्थ्य रुझान',
    analytics_subtitle: 'समय के साथ प्रयोगशाला परिणामों का सटीक विश्लेषण (माप की इकाइयों के अनुसार)।',
    analytics_no_data: 'कोई लैब डेटा नहीं मिला। रुझान देखने के लिए रक्त परीक्षण रिपोर्ट अपलोड करें।',
    analytics_unit_note: 'विभिन्न माप इकाइयों वाले मान अलग-अलग रेखांकन में दिखाए जाते हैं।',

    // Doctor Summary
    summary_title: 'डॉक्टर विज़िट सारांश और ब्रीफिंग',
    summary_subtitle: 'सक्रिय दवाएं, हालिया टेस्ट और अपने डॉक्टर के लिए सवाल तैयार करें।',
    summary_active_meds: 'वर्तमान दवाएं',
    summary_prev_meds: 'पुरानी दवाएं',
    summary_recent_labs: 'हालिया लैब परिणाम',
    summary_briefing_heading: 'परामर्श पूर्व तैयारी',
    summary_specialty_label: 'डॉक्टर की विशेषता',
    summary_concern_label: 'मुख्य समस्या या लक्षण',

    // Emergency Card
    emergency_title: 'आपातकालीन स्वास्थ्य कार्ड',
    emergency_subtitle: 'क्यूआर कोड द्वारा तुरंत उपलब्ध महत्वपूर्ण जीवन रक्षक स्वास्थ्य जानकारी।',
    emergency_blood_group: 'रक्त समूह',
    emergency_contact: 'आपातकालीन संपर्क',
    emergency_relation: 'संबंध',
    emergency_phone: 'फोन नंबर',
    emergency_allergies: 'ज्ञात एलर्जी',
    emergency_meds: 'पुष्ट दवाएं',
    emergency_notes: 'महत्वपूर्ण नैदानिक टिप्पणियां',
    emergency_scan_qr: 'कार्ड देखने के लिए क्यूआर स्कैन करें',

    // Family
    family_title: 'पारिवारिक स्वास्थ्य प्रोफाइल',
    family_subtitle: 'बच्चों, माता-पिता या आश्रितों के मेडिकल रिकॉर्ड्स का सुरक्षित प्रबंधन।',
    family_add_modal_title: 'परिवार का सदस्य जोड़ें',
    family_name_label: 'पूरा नाम',
    family_relation_label: 'संबंध',
    family_dob_label: 'जन्म तिथि',

    // Disclaimer
    medical_disclaimer: 'हेल्थसिंक एआई केवल मौजूदा मेडिकल रिकॉर्ड्स को व्यवस्थित करता है। यह कभी बीमारी का निदान या दवा की सिफारिश नहीं करता।',
  },
  mr: {
    // Navigation
    nav_dashboard: 'डॅशबोर्ड',
    nav_documents: 'कागदपत्रे',
    nav_reminders: 'औषध स्मरणपत्र',
    nav_assistant: 'एआय सहाय्यक',
    nav_timeline: 'वैद्यकीय टाइमलाइन',
    nav_analytics: 'आरोग्य कल (Analytics)',
    nav_summary: 'डॉक्टर सारांश',
    nav_emergency: 'आपत्कालीन कार्ड',
    nav_family: 'कुटुंब प्रोफाइल',

    // Common Actions
    btn_upload: 'रेकॉर्ड अपलोड करा',
    btn_save: 'बदल जतन करा',
    btn_download_pdf: 'पीडीएफ सारांश डाउनलोड करा',
    btn_generate_briefing: 'डॉक्टर ब्रीफिंग तयार करा',
    btn_share_qr: 'सुरक्षित क्यूआर शेअर करा',
    btn_revoke: 'प्रवेश रद्द करा',
    btn_add_family: 'कुटुंब सदस्य जोडा',
    btn_cancel: 'रद्द करा',
    btn_copy_link: 'लिंक कॉपी करा',
    status_copied: 'कॉपी झाले!',

    // Timeline
    timeline_title: 'एकात्मिक वैद्यकीय टाइमलाइन',
    timeline_subtitle: 'तुमच्या सर्व अपलोड केलेल्या वैद्यकीय कागदपत्रांचा कालक्रमानुसार इतिहास.',
    timeline_all: 'सर्व श्रेणी',
    timeline_prescriptions: 'प्रिस्क्रिप्शन',
    timeline_labs: 'लॅब अहवाल',
    timeline_imaging: 'इमेजिंग स्कॅन',
    timeline_search_placeholder: 'डॉक्टर, रुग्णालय किंवा औषध शोधा...',

    // Analytics
    analytics_title: 'बायोमार्कर्स आरोग्य कल',
    analytics_subtitle: 'काळानुरूप रक्त तपासणीचे सुसंगत एककांनुसार दृश्य विश्लेषण.',
    analytics_no_data: 'लॅब डेटा उपलब्ध नाही. कल पाहण्यासाठी रक्त तपासणी अहवाल अपलोड करा.',
    analytics_unit_note: 'वेगवेगळी मोजमाप एकके असलेल्या चाचण्या स्वतंत्र आलेखावर दाखवल्या जातात.',

    // Doctor Summary
    summary_title: 'डॉक्टर भेट सारांश व पूर्वतयारी',
    summary_subtitle: 'चालू औषधे, अलीकडील चाचण्या आणि डॉक्टरांना विचारण्यासाठी प्रश्न तयार करा.',
    summary_active_meds: 'सध्या चालू औषधे',
    summary_prev_meds: 'मागील औषधे',
    summary_recent_labs: 'अलीकडील लॅब मूल्ये',
    summary_briefing_heading: 'डॉक्टर भेटीची पूर्वतयारी',
    summary_specialty_label: 'तपासणी विभाग / तज्ज्ञ',
    summary_concern_label: 'मुख्य तक्रार किंवा लक्षणे',

    // Emergency Card
    emergency_title: 'आपत्कालीन आरोग्य कार्ड',
    emergency_subtitle: 'क्यूआर स्कॅनद्वारे तात्काळ उपलब्ध होणारी महत्त्वाची आरोग्य माहिती.',
    emergency_blood_group: 'रक्तगट',
    emergency_contact: 'आपत्कालीन संपर्क व्यक्ती',
    emergency_relation: 'नाते',
    emergency_phone: 'फोन नंबर',
    emergency_allergies: 'ज्ञात ॲलर्जी',
    emergency_meds: 'नियमित औषधे',
    emergency_notes: 'महत्त्वाच्या वैद्यकीय नोंदी',
    emergency_scan_qr: 'कार्ड पाहण्यासाठी क्यूआर स्कॅन करा',

    // Family
    family_title: 'कौटुंबिक आरोग्य प्रोफाइल',
    family_subtitle: 'मुले, वृद्ध पालक किंवा अवलंबित सदस्यांच्या नोंदींचे स्वतंत्र व्यवस्थापन.',
    family_add_modal_title: 'कुटुंब सदस्य जोडा',
    family_name_label: 'पूर्ण नाव',
    family_relation_label: 'नाते',
    family_dob_label: 'जन्मतारीख',

    // Disclaimer
    medical_disclaimer: 'हेल्थसिंक एआय केवळ वैद्यकीय नोंदी संघटित करते. हे कोणत्याही आजाराचे निदान करत नाही किंवा औषधे देत नाही.',
  },
};

interface I18nContextType {
  locale: SupportedLocale;
  setLocale: (loc: SupportedLocale) => void;
  t: (key: string) => string;
  languages: LanguageOption[];
}

const I18nContext = createContext<I18nContextType>({
  locale: 'en',
  setLocale: () => {},
  t: (key: string) => key,
  languages: LANGUAGES,
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLocale>('en');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('healthsync_locale') as SupportedLocale;
      if (saved && (saved === 'en' || saved === 'hi' || saved === 'mr')) {
        setLocaleState(saved);
      }
    }
  }, []);

  const setLocale = (newLocale: SupportedLocale) => {
    setLocaleState(newLocale);
    if (typeof window !== 'undefined') {
      localStorage.setItem('healthsync_locale', newLocale);
    }
  };

  const t = (key: string): string => {
    const dict = TRANSLATIONS[locale] || TRANSLATIONS.en;
    return dict[key] || TRANSLATIONS.en[key] || key;
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, languages: LANGUAGES }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  return useContext(I18nContext);
}
