import React, { useState, useEffect } from 'react';
import { 
  X, 
  Check, 
  Copy, 
  ExternalLink, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw, 
  LogIn, 
  User, 
  ShieldAlert, 
  Database, 
  HelpCircle,
  Sparkles,
  Globe,
  Info
} from 'lucide-react';
import { 
  signIn, 
  signInGuest, 
  firebaseConfig, 
  parseAuthError, 
  AuthErrorInfo, 
  testFirestoreConnection 
} from '../lib/firebase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialError?: any;
  onSuccess?: () => void;
  onEnableLocalMode?: () => void;
  isLocalMode?: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialError,
  onSuccess,
  onEnableLocalMode,
  isLocalMode
}) => {
  const [loading, setLoading] = useState(false);
  const [errorInfo, setErrorInfo] = useState<AuthErrorInfo | null>(null);
  const [copied, setCopied] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{ checked: boolean; ok?: boolean; message?: string }>({ checked: false });
  const [activeTab, setActiveTab] = useState<'signin' | 'diagnostics'>('signin');

  const currentHost = typeof window !== 'undefined' ? window.location.hostname : '';
  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;
  const consoleProvidersUrl = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/providers`;
  const consoleSettingsUrl = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/settings`;

  useEffect(() => {
    if (initialError) {
      const parsed = parseAuthError(initialError);
      setErrorInfo(parsed);
      setActiveTab('diagnostics');
    }
  }, [initialError]);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setErrorInfo(null);
    try {
      await signIn();
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Google Sign-In Error:', err);
      const parsed = parseAuthError(err);
      setErrorInfo(parsed);
      setActiveTab('diagnostics');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestSignIn = async () => {
    setLoading(true);
    setErrorInfo(null);
    try {
      await signInGuest();
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Guest Sign-In Error:', err);
      const parsed = parseAuthError(err);
      setErrorInfo(parsed);
      setActiveTab('diagnostics');
    } finally {
      setLoading(false);
    }
  };

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
      const res = await testFirestoreConnection();
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
              N
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 leading-none">Firebase 連携 &amp; ログイン設定</h2>
              <p className="text-xs text-slate-500 mt-1">NavFOR クラウド同期ナビゲーション</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab switchers */}
        <div className="flex border-b border-slate-200 px-6 bg-slate-50/30 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('signin')}
            className={`py-3 px-4 border-b-2 flex items-center gap-1.5 transition-all ${
              activeTab === 'signin'
                ? 'border-indigo-600 text-indigo-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <LogIn size={15} />
            サインイン
          </button>
          <button
            onClick={() => setActiveTab('diagnostics')}
            className={`py-3 px-4 border-b-2 flex items-center gap-1.5 transition-all ${
              activeTab === 'diagnostics'
                ? 'border-indigo-600 text-indigo-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldAlert size={15} />
            設定診断 &amp; トラブルシューティング
            {errorInfo && (
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse ml-0.5" />
            )}
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 custom-scrollbar flex-1">
          {/* Active Error Alert Banner if any */}
          {errorInfo && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-left space-y-2.5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="text-red-600 shrink-0 mt-0.5" size={18} />
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-bold text-red-900">{errorInfo.title}</h4>
                  <p className="text-xs text-red-700 mt-1 leading-relaxed">{errorInfo.message}</p>
                </div>
              </div>

              <div className="bg-white/80 rounded-lg p-3 text-xs border border-red-100 text-slate-700 space-y-2">
                <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <HelpCircle size={14} className="text-indigo-600" />
                  解決手順:
                </div>
                <p className="text-slate-600 leading-relaxed">{errorInfo.suggestion}</p>

                {errorInfo.actionType === 'authorized_domain' && (
                  <div className="mt-2 pt-2 border-t border-red-100 flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-mono bg-slate-100 px-2 py-1 rounded border border-slate-200 text-slate-800">
                      {currentHost}
                    </span>
                    <button
                      onClick={handleCopyHost}
                      className="px-2.5 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded text-xs font-bold flex items-center gap-1 transition-colors"
                    >
                      {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                      {copied ? 'コピーしました' : 'ドメインをコピー'}
                    </button>
                    <a
                      href={consoleSettingsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 bg-slate-800 text-white hover:bg-slate-900 rounded text-xs font-bold flex items-center gap-1 transition-colors ml-auto"
                    >
                      <ExternalLink size={13} />
                      Firebase設定を開く
                    </a>
                  </div>
                )}

                {errorInfo.actionType === 'provider_enable' && (
                  <div className="mt-2 pt-2 border-t border-red-100">
                    <a
                      href={consoleProvidersUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg text-xs font-bold transition-colors"
                    >
                      <ExternalLink size={13} />
                      Firebase ConsoleでGoogleプロバイダを有効化する
                    </a>
                  </div>
                )}

                {errorInfo.actionType === 'popup_block' && (
                  <div className="mt-2 pt-2 border-t border-red-100 flex items-center gap-2">
                    <button
                      onClick={handleOpenNewTab}
                      className="px-3 py-1.5 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
                    >
                      <ExternalLink size={13} />
                      新しいタブでアプリを開いてログインする
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'signin' ? (
            <div className="space-y-4">
              {/* Option 1: Google Login */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">推奨ログイン方法</span>
                  <span className="text-[10px] bg-indigo-100 text-indigo-700 font-bold px-2 py-0.5 rounded-full">リアルタイム同期</span>
                </div>
                <button
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  className="w-full py-3 px-4 bg-white border border-slate-300 text-slate-700 rounded-xl font-bold hover:bg-slate-100 active:scale-[0.99] transition-all flex items-center justify-center gap-3 shadow-sm hover:shadow"
                >
                  {loading ? (
                    <RefreshCw className="animate-spin text-slate-400" size={18} />
                  ) : (
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
                  )}
                  Googleアカウントでログイン
                </button>
                <p className="text-[11px] text-slate-500 mt-2 text-center">
                  Googleアカウントに紐付いてタスクやプロジェクトがクラウド（Firestore）に自動バックアップされます。
                </p>
              </div>

              {/* Iframe Warning if relevant */}
              {isInIframe && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2.5">
                  <Info size={16} className="text-amber-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold text-amber-900">プレビュー環境 (iframe) 内で実行中</p>
                    <p className="mt-0.5 text-amber-700 leading-relaxed">
                      ブラウザの制限によりGoogleログインのポップアップが遮断される場合があります。
                      開かない場合は右上の「新しいタブで開く」をご利用ください。
                    </p>
                    <button
                      onClick={handleOpenNewTab}
                      className="mt-2 font-bold underline text-amber-900 hover:text-amber-950 inline-flex items-center gap-1"
                    >
                      <ExternalLink size={12} />
                      新しいタブでアプリを開く
                    </button>
                  </div>
                </div>
              )}

              {/* Option 2: Guest Mode (Firebase Anonymous Auth) */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700">ゲストアカウントとして開始</span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded-full">即時利用</span>
                </div>
                <p className="text-xs text-slate-500 mb-3 leading-relaxed">
                  Googleログインの設定が完了していなくても、Firebaseの匿名認証でクラウド同期を即座に試せます。
                </p>
                <button
                  onClick={handleGuestSignIn}
                  disabled={loading}
                  className="w-full py-2.5 px-4 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900 active:scale-[0.99] transition-all flex items-center justify-center gap-2 text-xs"
                >
                  <User size={15} />
                  ゲストアカウントで開始する (Firebase匿名認証)
                </button>
              </div>

              {/* Option 3: Local Offline Mode */}
              {onEnableLocalMode && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-700">ローカルモード (オフライン即時利用)</span>
                    {isLocalMode && (
                      <span className="text-[10px] bg-indigo-100 text-indigo-700 font-bold px-2 py-0.5 rounded-full">現在選択中</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mb-3 leading-relaxed">
                    ログイン不要でブラウザのローカルストレージを使って今すぐ全機能（プロジェクト階層、ToDo、フォーカススロット等）を利用開始できます。
                  </p>
                  <button
                    onClick={() => {
                      onEnableLocalMode();
                      onClose();
                    }}
                    className="w-full py-2.5 px-4 bg-white border border-slate-300 text-slate-700 rounded-xl font-bold hover:bg-slate-100 transition-all text-xs flex items-center justify-center gap-2"
                  >
                    <Database size={15} className="text-indigo-600" />
                    ローカルモードで使い始める
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Diagnostics Tab */
            <div className="space-y-4 text-xs">
              {/* Project Info Table */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <h4 className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                  <Database size={14} className="text-indigo-600" />
                  Firebase 構成情報
                </h4>

                <div className="grid grid-cols-1 gap-2 bg-white p-3 rounded-lg border border-slate-200 font-mono text-[11px]">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-sans">Project ID:</span>
                    <span className="font-bold text-slate-800">{firebaseConfig.projectId}</span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-sans">Auth Domain:</span>
                    <span className="text-slate-700">{firebaseConfig.authDomain}</span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-sans">Firestore DB:</span>
                    <span className="text-slate-700 truncate max-w-xs">{firebaseConfig.firestoreDatabaseId}</span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-1">
                    <span className="text-slate-500 font-sans">現在アクセス中のホスト:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">{currentHost}</span>
                      <button
                        onClick={handleCopyHost}
                        className="text-slate-400 hover:text-indigo-600 p-1 rounded transition-colors"
                        title="ホスト名をコピー"
                      >
                        {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Firestore Connection Test */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                    <Globe size={14} className="text-indigo-600" />
                    Firestore 疎通テスト
                  </h4>
                  <button
                    onClick={handleTestConnection}
                    disabled={testingConnection}
                    className="px-3 py-1 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
                  >
                    <RefreshCw size={12} className={testingConnection ? 'animate-spin' : ''} />
                    テスト実行
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
                    <span>{connectionStatus.message}</span>
                  </div>
                )}
              </div>

              {/* Step-by-Step Setup Guide */}
              <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-4 space-y-3">
                <h4 className="font-bold text-indigo-950 flex items-center gap-1.5">
                  <Sparkles size={14} className="text-indigo-600" />
                  Google Sign-in が動かない場合の確認チェックリスト
                </h4>

                <ol className="space-y-2 text-indigo-900 leading-relaxed list-decimal list-inside text-xs">
                  <li className="pl-1">
                    <strong>Google認証プロバイダの有効化</strong>:
                    <br />
                    <span className="text-slate-600 pl-4 inline-block mt-0.5">
                      Firebase Console &gt; Authentication &gt;「Sign-in method」で「Google」プロバイダが「有効」になっていることを確認します。
                    </span>
                    <div className="mt-1 pl-4">
                      <a
                        href={consoleProvidersUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-bold text-indigo-700 hover:underline"
                      >
                        <ExternalLink size={11} />
                        Sign-in method 設定を開く
                      </a>
                    </div>
                  </li>

                  <li className="pl-1 pt-1">
                    <strong>承認済みドメイン（Authorized domains）の追加</strong>:
                    <br />
                    <span className="text-slate-600 pl-4 inline-block mt-0.5">
                      Firebase Console &gt; Authentication &gt;「設定 (Settings)」&gt;「承認済みドメイン」に、現在アプリを開いているドメイン「<code className="bg-white px-1 py-0.5 rounded border border-indigo-200 text-indigo-800 font-mono text-[10px]">{currentHost}</code>」を追加します。
                    </span>
                    <div className="mt-1 pl-4 flex items-center gap-2">
                      <button
                        onClick={handleCopyHost}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-indigo-200 text-indigo-700 rounded text-[11px] font-bold hover:bg-indigo-50 transition-colors"
                      >
                        {copied ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                        {copied ? 'コピー済み' : 'ドメイン名をコピー'}
                      </button>
                      <a
                        href={consoleSettingsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-bold text-indigo-700 hover:underline"
                      >
                        <ExternalLink size={11} />
                        承認済みドメイン設定を開く
                      </a>
                    </div>
                  </li>

                  <li className="pl-1 pt-1">
                    <strong>プレビュー iframe によるポップアップ制限</strong>:
                    <br />
                    <span className="text-slate-600 pl-4 inline-block mt-0.5">
                      ブラウザが iframe 内のポップアップ（window.open）を自動ブロックすることがあります。右上の「新しいタブで開く」アイコンから別タブで開いてお試しください。
                    </span>
                  </li>
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="text-[11px] text-slate-500">
            {isLocalMode ? (
              <span className="text-amber-600 font-semibold">現在ローカルモードで動作中</span>
            ) : (
              <span>クラウド同期: 未接続</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
