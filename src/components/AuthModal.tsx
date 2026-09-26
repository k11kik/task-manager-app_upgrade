import React, { useState, useEffect } from 'react';
import { 
  X, 
  Check, 
  Copy, 
  ExternalLink, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw, 
  ShieldAlert, 
  HelpCircle,
  Sparkles,
  Globe,
  WifiOff
} from 'lucide-react';
import { 
  firebaseConfig, 
  parseAuthError, 
  AuthErrorInfo, 
  testFirestoreConnection 
} from '../lib/firebase';

export type AuthModalLang = 'en' | 'fr' | 'ja';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialError?: any;
  onSuccess?: () => void;
  language?: AuthModalLang;
  onChangeLanguage?: (lang: AuthModalLang) => void;
}

const translations = {
  en: {
    modalTitle: "Settings & Diagnostics",
    modalSubtitle: "Cloud Synchronization & Network Diagnostics",
    cloudTestTitle: "Cloud Server Connection Test",
    cloudTestDesc: "Verify whether your device can reach the cloud database (Firestore).",
    runTest: "Run Test",
    connectionSuccess: "Cloud database connection is active and healthy.",
    troubleshootTitle: "Sign-in Troubleshooting Tips",
    wifiTipTitle: "1. Campus or Corporate WiFi (Strict Security)",
    wifiTipDesc: "Secured enterprise/school networks frequently block Google login popups. Use Email & Password authentication to sign in directly without popups.",
    iframeTipTitle: "2. Blocked inside Embedded Preview (iframe)",
    iframeTipDesc: "Browser security may block popups inside iframe previews. Open the app in a new browser tab to resolve this.",
    openNewTab: "Open in New Tab",
    devSectionTitle: "Developer Details & Firebase Config (Debug)",
    showDetails: "Show details",
    hideDetails: "Hide details",
    copied: "Copied",
    copyHost: "Copy host",
    signInProvidersLink: "Sign-in Providers Settings",
    authorizedDomainsLink: "Authorized Domains Settings",
    closeBtn: "Close"
  },
  fr: {
    modalTitle: "Paramètres et Diagnostic",
    modalSubtitle: "Synchronisation Cloud & Diagnostic Réseau",
    cloudTestTitle: "Test de connexion au serveur Cloud",
    cloudTestDesc: "Vérifie si votre appareil peut contacter la base de données Firestore.",
    runTest: "Lancer le test",
    connectionSuccess: "La connexion à la base de données Cloud est active et normale.",
    troubleshootTitle: "Conseils en cas de problème de connexion",
    wifiTipTitle: "1. Réseau WiFi sécurisé (Campus / Entreprise)",
    wifiTipDesc: "Les réseaux protégés bloquent souvent les popups Google. Utilisez l'e-mail et mot de passe pour vous connecter directement sans popup.",
    iframeTipTitle: "2. Blocage dans la fenêtre intégrée (iframe)",
    iframeTipDesc: "La sécurité du navigateur peut bloquer les fenêtres dans l'aperçu. Ouvrez l'application dans un nouvel onglet.",
    openNewTab: "Ouvrir dans un nouvel onglet",
    devSectionTitle: "Détails Développeur & Configuration Firebase",
    showDetails: "Afficher",
    hideDetails: "Masquer",
    copied: "Copié",
    copyHost: "Copier l'hôte",
    signInProvidersLink: "Paramètres Fournisseurs d'authentification",
    authorizedDomainsLink: "Paramètres Domaines autorisés",
    closeBtn: "Fermer"
  },
  ja: {
    modalTitle: "設定診断 & トラブルシューティング",
    modalSubtitle: "NavFOR クラウド同期・ネットワーク設定診断",
    cloudTestTitle: "クラウドサーバー接続テスト",
    cloudTestDesc: "お使いの端末がクラウドデータベース（Firestore）と通信可能か確認します。",
    runTest: "テスト実行",
    connectionSuccess: "クラウドデータベースとの通信は正常です。",
    troubleshootTitle: "サインインできない場合の解決ヒント",
    wifiTipTitle: "① 大学・職場の強固なWiFiで「接続できません」と出る場合",
    wifiTipDesc: "学校や企業のセキュリティ環境ではGoogleポップアップが自動ブロックされることがあります。サインイン画面の「メール & パスワード」からログインすると、ポップアップを開かずに直接認証できます。",
    iframeTipTitle: "② プレビュー画面（iframe）でポップアップが抑止される場合",
    iframeTipDesc: "ブラウザの設定でiframe内のポップアップが抑止されている場合があります。別タブで開くことで解消されます。",
    openNewTab: "新しいタブで開く",
    devSectionTitle: "開発者向け詳細・Firebase構成情報（デバッグ用）",
    showDetails: "表示する",
    hideDetails: "閉じる",
    copied: "コピー済み",
    copyHost: "ホスト名をコピー",
    signInProvidersLink: "Sign-in Providers設定",
    authorizedDomainsLink: "承認済みドメイン設定",
    closeBtn: "閉じる"
  }
};

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialError,
  language: externalLang,
  onChangeLanguage,
}) => {
  // Default language is English (en), with French and Japanese support
  const [localLang, setLocalLang] = useState<AuthModalLang>(() => {
    try {
      const saved = (localStorage.getItem('navfor_lang') || localStorage.getItem('navfor_language')) as AuthModalLang;
      if (saved === 'en' || saved === 'fr' || saved === 'ja') return saved;
      return 'en';
    } catch {
      return 'en';
    }
  });

  const lang = externalLang || localLang;
  const t = translations[lang] || translations.en;

  const handleSetLang = (newLang: AuthModalLang) => {
    setLocalLang(newLang);
    try {
      localStorage.setItem('navfor_lang', newLang);
      localStorage.setItem('navfor_language', newLang);
    } catch {}
    onChangeLanguage?.(newLang);
  };

  const [errorInfo, setErrorInfo] = useState<AuthErrorInfo | null>(null);
  const [copied, setCopied] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{ checked: boolean; ok?: boolean; message?: string }>({ checked: false });

  const currentHost = typeof window !== 'undefined' ? window.location.hostname : '';
  const consoleProvidersUrl = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/providers`;
  const consoleSettingsUrl = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/settings`;

  useEffect(() => {
    if (initialError) {
      const parsed = parseAuthError(initialError, lang);
      setErrorInfo(parsed);
    }
  }, [initialError, lang]);

  if (!isOpen) return null;

  const handleCopyHost = () => {
    if (navigator.clipboard && currentHost) {
      navigator.clipboard.writeText(currentHost);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    try {
      const res = await testFirestoreConnection(lang);
      setConnectionStatus({ checked: true, ok: res.ok, message: res.message });
    } catch (e: any) {
      setConnectionStatus({ checked: true, ok: false, message: e?.message || String(e) });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleOpenNewTab = () => {
    window.open(window.location.href, '_blank');
  };

  return (
    <div 
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 pt-16 pb-6 bg-slate-900/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[calc(100vh-5.5rem)] my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-xs overflow-hidden border border-slate-100 p-0.5">
              <img 
                src={`${(import.meta as any).env?.BASE_URL || '/'}icon-192.png`} 
                alt="NavFOR" 
                className="w-full h-full object-contain" 
                referrerPolicy="no-referrer" 
              />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-800 leading-none">{t.modalTitle}</h2>
              <p className="text-[11px] text-slate-500 mt-1">{t.modalSubtitle}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Language Selector: EN, JP, FR */}
            <div className="flex items-center bg-slate-200/80 p-0.5 rounded-lg text-[10px] font-bold">
              {(['en', 'ja', 'fr'] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => handleSetLang(l)}
                  className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                    lang === l ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {l === 'ja' ? 'JP' : l.toUpperCase()}
                </button>
              ))}
            </div>

            <button 
              onClick={onClose}
              className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4 custom-scrollbar flex-1 text-xs">
          {/* Active Error Banner */}
          {errorInfo && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl space-y-1.5 text-xs">
              <div className="flex items-center gap-2 text-red-800 font-bold">
                <AlertTriangle size={16} className="text-red-600 shrink-0" />
                <span>{errorInfo.title}</span>
              </div>
              <p className="text-red-700 pl-6 leading-relaxed">
                {errorInfo.message}
              </p>
              {errorInfo.suggestion && (
                <p className="text-red-600 font-medium pl-6 text-[11px] pt-1">
                  💡 {errorInfo.suggestion}
                </p>
              )}
            </div>
          )}

          {/* Cloud Connection Test */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                  <Globe size={14} className="text-indigo-600" />
                  {t.cloudTestTitle}
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {t.cloudTestDesc}
                </p>
              </div>
              <button
                onClick={handleTestConnection}
                disabled={testingConnection}
                className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw size={12} className={testingConnection ? 'animate-spin' : ''} />
                {t.runTest}
              </button>
            </div>
            {connectionStatus.checked && (
              <div className={`p-2.5 rounded-lg border text-xs flex items-center gap-2 mt-2 ${
                connectionStatus.ok 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}>
                {connectionStatus.ok ? (
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle size={16} className="text-red-600 shrink-0" />
                )}
                <span>
                  {connectionStatus.ok 
                    ? t.connectionSuccess 
                    : `${connectionStatus.message}`}
                </span>
              </div>
            )}
          </div>

          {/* Troubleshooting Guide for End-Users */}
          <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-4 space-y-3">
            <h4 className="font-bold text-indigo-950 flex items-center gap-1.5">
              <Sparkles size={14} className="text-indigo-600" />
              {t.troubleshootTitle}
            </h4>

            <div className="space-y-2 text-indigo-950 text-xs">
              <div className="bg-white/85 p-3 rounded-lg border border-indigo-100">
                <p className="font-bold text-indigo-900 mb-1 flex items-center gap-1.5">
                  <WifiOff size={13} className="text-amber-600" />
                  {t.wifiTipTitle}
                </p>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  {t.wifiTipDesc}
                </p>
              </div>

              <div className="bg-white/85 p-3 rounded-lg border border-indigo-100">
                <p className="font-bold text-indigo-900 mb-1 flex items-center gap-1.5">
                  <ExternalLink size={13} className="text-indigo-600" />
                  {t.iframeTipTitle}
                </p>
                <p className="text-slate-600 text-[11px] leading-relaxed mb-2">
                  {t.iframeTipDesc}
                </p>
                <button
                  type="button"
                  onClick={handleOpenNewTab}
                  className="px-2.5 py-1 bg-indigo-600 text-white rounded-lg text-[11px] font-bold hover:bg-indigo-700 transition-colors inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <ExternalLink size={12} />
                  {t.openNewTab}
                </button>
              </div>
            </div>
          </div>

          {/* Collapsible Developer Section */}
          <details className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-600 group">
            <summary className="font-bold cursor-pointer text-xs text-slate-600 select-none flex items-center justify-between list-none">
              <span className="flex items-center gap-1.5">
                <HelpCircle size={13} className="text-slate-400" />
                {t.devSectionTitle}
              </span>
              <span className="text-[10px] text-indigo-600 group-open:hidden">{t.showDetails}</span>
              <span className="text-[10px] text-slate-400 hidden group-open:inline">{t.hideDetails}</span>
            </summary>

            <div className="mt-3 space-y-3 pt-3 border-t border-slate-200/80">
              <div className="grid grid-cols-1 gap-2 bg-white p-2.5 rounded-lg border border-slate-200 font-mono text-[11px]">
                <div className="flex justify-between py-0.5 border-b border-slate-100">
                  <span className="text-slate-500 font-sans">Project ID:</span>
                  <span className="font-bold text-slate-800">{firebaseConfig.projectId}</span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-slate-100">
                  <span className="text-slate-500 font-sans">Auth Domain:</span>
                  <span className="text-slate-700">{firebaseConfig.authDomain}</span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-slate-100">
                  <span className="text-slate-500 font-sans">Firestore DB:</span>
                  <span className="text-slate-700 truncate max-w-xs">{firebaseConfig.firestoreDatabaseId}</span>
                </div>
                <div className="flex items-center justify-between py-0.5">
                  <span className="text-slate-500 font-sans">Current Host:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded text-[10px]">{currentHost}</span>
                    <button
                      onClick={handleCopyHost}
                      className="text-slate-400 hover:text-indigo-600 p-0.5 rounded cursor-pointer"
                      title={t.copyHost}
                    >
                      {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 text-[11px]">
                <a
                  href={consoleProvidersUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 hover:underline flex items-center gap-1 font-semibold"
                >
                  <ExternalLink size={11} />
                  {t.signInProvidersLink}
                </a>
                <a
                  href={consoleSettingsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 hover:underline flex items-center gap-1 font-semibold"
                >
                  <ExternalLink size={11} />
                  {t.authorizedDomainsLink}
                </a>
              </div>
            </div>
          </details>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-[11px] text-slate-500 font-medium">
            Firebase Auth &amp; Firestore
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
          >
            {t.closeBtn}
          </button>
        </div>
      </div>
    </div>
  );
};
