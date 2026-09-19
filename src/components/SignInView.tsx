import React, { useState } from 'react';
import { 
  LogIn, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw, 
  ExternalLink, 
  ShieldAlert, 
  KeyRound, 
  Sparkles,
  WifiOff,
  Globe
} from 'lucide-react';
import { 
  signIn, 
  signInWithEmail, 
  signUpWithEmail, 
  resetPassword, 
  parseAuthError, 
  AuthErrorInfo,
  firebaseConfig 
} from '../lib/firebase';

interface SignInViewProps {
  onSuccess: () => void;
  onOpenDiagnostics: () => void;
  version?: string;
}

export type SupportedLang = 'ja' | 'en' | 'fr';

export const translations = {
  ja: {
    title: "NavFOR サインイン",
    subtitle: "Navigation Focus Objectives & Results (目的にフォーカスし、結果へと導くナビゲーションシステム)",
    chooseMethod: "ログイン方法を選択",
    googleTab: "Googleでログイン",
    emailTab: "メール & パスワード",
    signInAction: "ログイン",
    signUpAction: "新規アカウント作成",
    emailLabel: "メールアドレス",
    emailPlaceholder: "name@gmail.com または 学校・企業アドレス",
    passwordLabel: "パスワード",
    passwordPlaceholder: "6文字以上のパスワード",
    confirmPasswordLabel: "パスワード（確認）",
    confirmPasswordPlaceholder: "もう一度パスワードを入力",
    forgotPassword: "パスワードをお忘れですか？",
    btnSignIn: "ログインして開始",
    btnSignUp: "アカウントを作成してログイン",
    btnResetPassword: "再設定メールを送信",
    noAccount: "アカウントをお持ちでないですか？",
    createOne: "新規作成",
    hasAccount: "すでにアカウントをお持ちですか？",
    backToSignIn: "ログインに戻る",
    wifiNoticeTitle: "大学・企業などのセキュアなWiFi環境について",
    wifiNoticeDesc: "学校や企業のWiFiセキュリティ環境では、Googleログインのポップアップが遮断され「接続できません」となることがあります。その場合はこちらの「メール & パスワード」をご利用ください（ポップアップ不要で直接認証できます）。",
    resetHeading: "パスワード再設定",
    resetDesc: "ご登録のGmailアドレス（または学校・企業メールアドレス）を入力してください。Firebaseより安全なパスワード再設定リンクが記載された案内メールを自動送信します。メール内のリンクを開いて新しいパスワードを設定してください。",
    resetSentSuccess: (email: string) => `「${email}」にパスワード再設定用の案内メールを送信しました。受信トレイ（迷惑メールフォルダ含む）をご確認ください。`,
    resetSentTitle: "再設定メールを送信しました",
    resetSentDetail: (email: string) => `「${email}」宛にパスワード再設定用のセキュアリンクを送信しました。メール内のリンクをクリックし、新しいパスワードを設定してください。設定完了後、新しいパスワードでサインインいただけます。`,
    resendEmailBtn: "メールが届かない場合は再送信",
    diagnosticsBtn: "設定診断 & トラブルシューティング",
    cloudSync: "クラウド同期",
    enterEmail: "メールアドレスを入力してください",
    enterPassword: "パスワードを入力してください",
    shortPassword: "パスワードは6文字以上必要です",
    passwordMismatch: "パスワードが一致しません",
    privacyNotice: "サインイン後、あなたのアカウント専用のデータのみが表示されます",
    previewNotice: "プレビュー画面（iframe）でポップアップがブロックされる場合は、別タブで開いてお試しください。",
    openNewTab: "新しいタブで開く"
  },
  en: {
    title: "Sign in to NavFOR",
    subtitle: "Navigation Focus Objectives & Results - Focus on what matters, navigate to results",
    chooseMethod: "Select sign-in method",
    googleTab: "Sign in with Google",
    emailTab: "Email & Password",
    signInAction: "Sign In",
    signUpAction: "Create Account",
    emailLabel: "Email address",
    emailPlaceholder: "name@gmail.com or school / work email",
    passwordLabel: "Password",
    passwordPlaceholder: "At least 6 characters",
    confirmPasswordLabel: "Confirm password",
    confirmPasswordPlaceholder: "Re-enter password",
    forgotPassword: "Forgot password?",
    btnSignIn: "Sign In & Continue",
    btnSignUp: "Create Account & Sign In",
    btnResetPassword: "Send Reset Link",
    noAccount: "Don't have an account?",
    createOne: "Sign up",
    hasAccount: "Already have an account?",
    backToSignIn: "Back to sign in",
    wifiNoticeTitle: "Notice for Campus & Corporate WiFi",
    wifiNoticeDesc: "In restricted campus or corporate networks, Google login popups may be blocked with a connection error. Use Email & Password authentication to sign in directly without popups.",
    resetHeading: "Reset Password",
    resetDesc: "Enter your registered Gmail or work/school email address. A password reset email with a secure link will be sent directly to your inbox. Click the link to set your new password.",
    resetSentSuccess: (email: string) => `Password reset instructions sent to "${email}". Please check your inbox.`,
    resetSentTitle: "Password Reset Link Sent",
    resetSentDetail: (email: string) => `We sent a secure password reset link to "${email}". Please check your inbox (including spam folder) and open the link to set a new password.`,
    resendEmailBtn: "Resend email if not received",
    diagnosticsBtn: "Diagnostics & Troubleshooting",
    cloudSync: "Cloud Sync",
    enterEmail: "Please enter your email address",
    enterPassword: "Please enter your password",
    shortPassword: "Password must be at least 6 characters",
    passwordMismatch: "Passwords do not match",
    privacyNotice: "Once signed in, only your account's folders and files will be displayed.",
    previewNotice: "If popups are blocked in iframe preview, open in a new tab.",
    openNewTab: "Open in New Tab"
  },
  fr: {
    title: "Connexion à NavFOR",
    subtitle: "Navigation Focus Objectives & Results - Concentrez-vous sur vos objectifs",
    chooseMethod: "Méthode de connexion",
    googleTab: "Continuer avec Google",
    emailTab: "E-mail et mot de passe",
    signInAction: "Se connecter",
    signUpAction: "Créer un compte",
    emailLabel: "Adresse e-mail",
    emailPlaceholder: "nom@gmail.com ou e-mail professionnel",
    passwordLabel: "Mot de passe",
    passwordPlaceholder: "Au moins 6 caractères",
    confirmPasswordLabel: "Confirmer le mot de passe",
    confirmPasswordPlaceholder: "Retapez votre mot de passe",
    forgotPassword: "Mot de passe oublié ?",
    btnSignIn: "Se connecter",
    btnSignUp: "Créer un compte et se connecter",
    btnResetPassword: "Envoyer le lien",
    noAccount: "Vous n'avez pas de compte ?",
    createOne: "Inscrivez-vous",
    hasAccount: "Vous avez déjà un compte ?",
    backToSignIn: "Retour à la connexion",
    wifiNoticeTitle: "Réseaux WiFi sécurisés (Campus / Entreprise)",
    wifiNoticeDesc: "Sur les réseaux protégés, la fenêtre Google peut être bloquée. Utilisez l'e-mail et mot de passe pour vous connecter directement sans fenêtre contextuelle.",
    resetHeading: "Réinitialiser le mot de passe",
    resetDesc: "Saisissez votre adresse Gmail ou e-mail. Un lien sécurisé vous sera envoyé par e-mail pour définir un nouveau mot de passe.",
    resetSentSuccess: (email: string) => `Instructions envoyées à « ${email} ». Veuillez vérifier votre boîte de réception.`,
    resetSentTitle: "Lien de réinitialisation envoyé",
    resetSentDetail: (email: string) => `Un lien de réinitialisation sécurisé a été envoyé à « ${email} ». Vérifiez votre boîte de réception (et spams) pour définir un nouveau mot de passe.`,
    resendEmailBtn: "Renvoyer l'e-mail si non reçu",
    diagnosticsBtn: "Diagnostic et dépannage",
    cloudSync: "Synchronisation Cloud",
    enterEmail: "Veuillez saisir votre adresse e-mail",
    enterPassword: "Veuillez saisir votre mot de passe",
    shortPassword: "Le mot de passe doit comporter au moins 6 caractères",
    passwordMismatch: "Les mots de passe ne correspondent pas",
    privacyNotice: "Après connexion, seuls les fichiers de votre compte seront affichés.",
    previewNotice: "Si les fenêtres sont bloquées dans l'aperçu, ouvrez dans un nouvel onglet.",
    openNewTab: "Ouvrir dans un nouvel onglet"
  }
};

export const SignInView: React.FC<SignInViewProps> = ({
  onSuccess,
  onOpenDiagnostics,
  version = "3.1.4"
}) => {
  // Detect language: stored preference or browser language
  const [lang, setLang] = useState<SupportedLang>(() => {
    try {
      const saved = localStorage.getItem('navfor_lang') as SupportedLang;
      if (saved === 'ja' || saved === 'en' || saved === 'fr') return saved;
      const browserLang = (typeof navigator !== 'undefined' ? navigator.language : '') || '';
      if (browserLang.startsWith('ja')) return 'ja';
      if (browserLang.startsWith('fr')) return 'fr';
      return 'en';
    } catch {
      return 'en';
    }
  });

  const t = translations[lang] || translations.en;

  const handleSetLang = (newLang: SupportedLang) => {
    setLang(newLang);
    try {
      localStorage.setItem('navfor_lang', newLang);
    } catch {}
  };

  // Auth mode: 'google' or 'email'
  const [authMethod, setAuthMethod] = useState<'google' | 'email'>('google');
  
  // Email mode: 'signin' or 'signup'
  const [emailMode, setEmailMode] = useState<'signin' | 'signup'>('signin');
  
  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Password reset flow
  const [isResetMode, setIsResetMode] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);

  // States
  const [loading, setLoading] = useState(false);
  const [errorInfo, setErrorInfo] = useState<AuthErrorInfo | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setErrorInfo(null);
    setInfoMessage(null);
    try {
      await signIn();
      onSuccess();
    } catch (err: any) {
      console.error('Google Sign-In Error:', err);
      const parsed = parseAuthError(err);
      setErrorInfo(parsed);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorInfo(null);
    setInfoMessage(null);

    if (!email.trim()) {
      setErrorInfo({
        code: 'validation/empty-email',
        title: t.enterEmail,
        message: t.enterEmail,
        suggestion: t.enterEmail,
        actionType: 'general'
      });
      return;
    }

    if (!password) {
      setErrorInfo({
        code: 'validation/empty-password',
        title: t.enterPassword,
        message: t.enterPassword,
        suggestion: t.enterPassword,
        actionType: 'general'
      });
      return;
    }

    if (emailMode === 'signup') {
      if (password.length < 6) {
        setErrorInfo({
          code: 'validation/short-password',
          title: t.shortPassword,
          message: t.shortPassword,
          suggestion: t.shortPassword,
          actionType: 'general'
        });
        return;
      }
      if (password !== confirmPassword) {
        setErrorInfo({
          code: 'validation/password-mismatch',
          title: t.passwordMismatch,
          message: t.passwordMismatch,
          suggestion: t.passwordMismatch,
          actionType: 'general'
        });
        return;
      }
    }

    setLoading(true);
    try {
      if (emailMode === 'signin') {
        await signInWithEmail(email, password);
      } else {
        await signUpWithEmail(email, password);
      }
      onSuccess();
    } catch (err: any) {
      console.error('Email Auth Error:', err);
      const parsed = parseAuthError(err);
      setErrorInfo(parsed);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorInfo({
        code: 'validation/empty-email',
        title: t.enterEmail,
        message: t.enterEmail,
        suggestion: t.enterEmail,
        actionType: 'general'
      });
      return;
    }

    setLoading(true);
    setErrorInfo(null);
    try {
      await resetPassword(email);
      setResetEmailSent(true);
      setInfoMessage(t.resetSentSuccess(email));
    } catch (err: any) {
      console.error('Reset Password Error:', err);
      const parsed = parseAuthError(err);
      setErrorInfo(parsed);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenNewTab = () => {
    window.open(window.location.href, '_blank');
  };

  return (
    <div className="w-full min-h-full flex flex-col items-center justify-start sm:justify-center p-4 sm:p-8 py-8 sm:py-12">
      <div className="w-full max-w-lg bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden shrink-0">
        
        {/* Brand & Language Header */}
        <div className="p-6 sm:p-8 bg-slate-50/80 border-b border-slate-100 text-center relative">
          
          {/* Language Selector in top-right: EN, JP, FR */}
          <div className="absolute top-4 right-4 flex items-center gap-1 bg-white/90 border border-slate-200 rounded-full px-2 py-1 shadow-xs text-[11px] font-semibold text-slate-600">
            <Globe size={13} className="text-slate-400" />
            <button 
              type="button"
              onClick={() => handleSetLang('en')}
              className={`px-1.5 py-0.5 rounded cursor-pointer ${lang === 'en' ? 'bg-indigo-600 text-white font-bold' : 'hover:text-indigo-600'}`}
            >
              EN
            </button>
            <span className="text-slate-300">|</span>
            <button 
              type="button"
              onClick={() => handleSetLang('ja')}
              className={`px-1.5 py-0.5 rounded cursor-pointer ${lang === 'ja' ? 'bg-indigo-600 text-white font-bold' : 'hover:text-indigo-600'}`}
            >
              JP
            </button>
            <span className="text-slate-300">|</span>
            <button 
              type="button"
              onClick={() => handleSetLang('fr')}
              className={`px-1.5 py-0.5 rounded cursor-pointer ${lang === 'fr' ? 'bg-indigo-600 text-white font-bold' : 'hover:text-indigo-600'}`}
            >
              FR
            </button>
          </div>

          <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center mx-auto shadow-lg shadow-indigo-100/60 mb-3 overflow-hidden border border-slate-100 p-1">
            <img 
              src={`${(import.meta as any).env?.BASE_URL || '/'}icon-192.png`} 
              alt="NavFOR Logo" 
              className="w-full h-full object-contain" 
              referrerPolicy="no-referrer" 
            />
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
            {t.title}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium max-w-sm mx-auto leading-relaxed">
            {t.subtitle}
          </p>
          <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-200/60 text-slate-600 text-[10px] font-mono font-bold">
            <span>{t.cloudSync}</span>
            <span>•</span>
            <span>V{version}</span>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-8 space-y-6">
          
          {/* Method Selection Tabs */}
          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
              {t.chooseMethod}
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl">
              <button
                type="button"
                onClick={() => {
                  setAuthMethod('google');
                  setErrorInfo(null);
                  setInfoMessage(null);
                  setIsResetMode(false);
                }}
                className={`py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 ${
                  authMethod === 'google'
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <img 
                  src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
                  className="w-4 h-4" 
                  alt="Google" 
                />
                <span className="truncate">{t.googleTab}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAuthMethod('email');
                  setErrorInfo(null);
                  setInfoMessage(null);
                }}
                className={`py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 ${
                  authMethod === 'email'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Mail size={16} />
                <span className="truncate">{t.emailTab}</span>
              </button>
            </div>
          </div>

          {/* Error / Alert notification banner */}
          {errorInfo && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs space-y-2 animate-in fade-in duration-200">
              <div className="flex items-start gap-2.5 text-amber-900 font-bold">
                <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <span>{errorInfo.title}</span>
              </div>
              <p className="text-amber-800 text-[11px] leading-relaxed pl-6">
                {errorInfo.message}
              </p>
              {errorInfo.suggestion && (
                <div className="bg-white/80 p-2.5 rounded-xl border border-amber-200/60 text-[11px] text-amber-900 ml-6">
                  <span className="font-bold">ヒント: </span>
                  {errorInfo.suggestion}
                </div>
              )}
              {errorInfo.actionType === 'domain_config' && (
                <div className="pl-6 pt-1">
                  <button
                    type="button"
                    onClick={onOpenDiagnostics}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline flex items-center gap-1"
                  >
                    <ShieldAlert size={13} />
                    <span>設定診断画面を開いて詳細を確認</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Info message banner */}
          {infoMessage && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 flex items-start gap-2.5 animate-in fade-in duration-200">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
              <p className="text-[11px] leading-relaxed">{infoMessage}</p>
            </div>
          )}

          {/* Method 1: Google Sign-in */}
          {authMethod === 'google' && (
            <div className="space-y-4">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full py-3.5 px-4 bg-white border-2 border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/30 text-slate-700 font-bold rounded-2xl transition-all flex items-center justify-center gap-3 shadow-xs active:scale-[0.99] disabled:opacity-50 text-xs sm:text-sm"
              >
                {loading ? (
                  <RefreshCw className="animate-spin text-indigo-600" size={18} />
                ) : (
                  <img 
                    src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
                    className="w-5 h-5" 
                    alt="Google" 
                  />
                )}
                <span>{t.googleTab}</span>
              </button>

              {/* Campus / Corporate Network Security Guidance */}
              <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl text-[11px] text-slate-600 space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-slate-700">
                  <WifiOff size={14} className="text-amber-500" />
                  <span>{t.wifiNoticeTitle}</span>
                </div>
                <p className="leading-relaxed">
                  {t.wifiNoticeDesc}
                </p>
                <div className="pt-1 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMethod('email');
                      setErrorInfo(null);
                    }}
                    className="text-indigo-600 hover:text-indigo-800 font-bold underline"
                  >
                    → {t.emailTab}
                  </button>
                </div>
              </div>

              {/* iframe helper if inside iframe */}
              {isInIframe && (
                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={handleOpenNewTab}
                    className="text-[11px] text-slate-400 hover:text-indigo-600 inline-flex items-center gap-1 transition-colors"
                  >
                    <ExternalLink size={12} />
                    <span>{t.openNewTab}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Method 2: Email & Password */}
          {authMethod === 'email' && (
            <div className="space-y-4">
              {!isResetMode ? (
                <>
                  {/* Mode switch (Sign in vs Sign up) */}
                  <div className="flex items-center justify-between pb-1">
                    <span className="text-xs font-bold text-slate-700">
                      {emailMode === 'signin' ? t.signInAction : t.signUpAction}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setEmailMode(emailMode === 'signin' ? 'signup' : 'signin');
                        setErrorInfo(null);
                        setInfoMessage(null);
                      }}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-bold underline"
                    >
                      {emailMode === 'signin' 
                        ? `${t.noAccount} ${t.createOne}` 
                        : `${t.hasAccount} ${t.backToSignIn}`}
                    </button>
                  </div>

                  <form onSubmit={handleEmailAuth} className="space-y-3.5">
                    {/* Email field */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        {t.emailLabel}
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <Mail size={16} />
                        </div>
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder={t.emailPlaceholder}
                          className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-medium focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-slate-800"
                        />
                      </div>
                    </div>

                    {/* Password field */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold text-slate-700">
                          {t.passwordLabel}
                        </label>
                        {emailMode === 'signin' && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsResetMode(true);
                              setErrorInfo(null);
                              setInfoMessage(null);
                            }}
                            className="text-[11px] text-slate-400 hover:text-indigo-600 transition-colors"
                          >
                            {t.forgotPassword}
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <Lock size={16} />
                        </div>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder={t.passwordPlaceholder}
                          className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-medium focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-slate-800"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>

                    {/* Password Confirmation (Signup only) */}
                    {emailMode === 'signup' && (
                      <div className="animate-in fade-in duration-150">
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          {t.confirmPasswordLabel}
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                            <Lock size={16} />
                          </div>
                          <input
                            type={showPassword ? 'text' : 'password'}
                            required
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder={t.confirmPasswordPlaceholder}
                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-medium focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-slate-800"
                          />
                        </div>
                      </div>
                    )}

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white rounded-2xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 disabled:opacity-50 mt-2"
                    >
                      {loading ? (
                        <RefreshCw className="animate-spin" size={18} />
                      ) : (
                        <LogIn size={18} />
                      )}
                      <span>
                        {emailMode === 'signin' ? t.btnSignIn : t.btnSignUp}
                      </span>
                    </button>
                  </form>
                </>
              ) : (
                /* Password Reset Flow */
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2 font-bold text-slate-800 text-xs sm:text-sm">
                      <KeyRound size={16} className="text-indigo-600" />
                      <span>{t.resetHeading}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsResetMode(false);
                        setResetEmailSent(false);
                        setErrorInfo(null);
                        setInfoMessage(null);
                      }}
                      className="text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer"
                    >
                      {t.backToSignIn}
                    </button>
                  </div>

                  {resetEmailSent ? (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-3 animate-in fade-in">
                      <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs sm:text-sm">
                        <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                        <span>{t.resetSentTitle}</span>
                      </div>
                      <p className="text-xs text-emerald-900 leading-relaxed">
                        {t.resetSentDetail(email)}
                      </p>
                      <div className="pt-2 flex flex-col sm:flex-row gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setIsResetMode(false);
                            setResetEmailSent(false);
                            setErrorInfo(null);
                            setInfoMessage(null);
                          }}
                          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                        >
                          <LogIn size={14} />
                          <span>{t.backToSignIn}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setResetEmailSent(false)}
                          className="px-3 py-2 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-100/60 rounded-xl font-semibold text-xs transition-colors text-center cursor-pointer"
                        >
                          {t.resendEmailBtn}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleResetPassword} className="space-y-4">
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {t.resetDesc}
                      </p>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">
                          {t.emailLabel}
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                            <Mail size={16} />
                          </div>
                          <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="name@gmail.com"
                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-medium focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-slate-800"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white rounded-2xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 disabled:opacity-50 cursor-pointer"
                      >
                        {loading ? (
                          <RefreshCw className="animate-spin" size={18} />
                        ) : (
                          <KeyRound size={18} />
                        )}
                        <span>{t.btnResetPassword}</span>
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Privacy & Account isolation notice */}
          <div className="pt-2 border-t border-slate-100 text-center">
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 font-medium">
              <Sparkles size={12} className="text-indigo-400 shrink-0" />
              <span>{t.privacyNotice}</span>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={onOpenDiagnostics}
            className="text-slate-400 hover:text-slate-700 font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <ShieldAlert size={14} />
            <span>{t.diagnosticsBtn}</span>
          </button>

          <span className="text-[10px] text-slate-400 font-mono">
            Firebase Auth Secured
          </span>
        </div>
      </div>
    </div>
  );
};
