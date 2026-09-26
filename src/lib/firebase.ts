import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut,
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from 'firebase/auth';
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager, 
  getFirestore, 
  terminate, 
  clearIndexedDbPersistence,
  doc,
  getDocFromServer
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

export { firebaseConfig };

const app = initializeApp(firebaseConfig);

let firestoreDb;
try {
  firestoreDb = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
  }, firebaseConfig.firestoreDatabaseId);
} catch (e) {
  firestoreDb = getFirestore(app, firebaseConfig.firestoreDatabaseId);
}

export const db = firestoreDb; // CRITICAL: The app will break without this line
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const clearFirestoreCache = async () => {
  try {
    await terminate(db);
    await clearIndexedDbPersistence(db);
    // Note: The app will need to reload or re-initialize db after this
    return true;
  } catch (err) {
    console.error("Failed to clear Firestore cache:", err);
    return false;
  }
};

export const signIn = async (forceConsent = false) => {
  if (forceConsent) {
    googleProvider.setCustomParameters({ prompt: 'consent select_account' });
  } else {
    googleProvider.setCustomParameters({});
  }
  const result = await signInWithPopup(auth, googleProvider);
  return {
    user: result.user,
    credential: GoogleAuthProvider.credentialFromResult(result)
  };
};

export const signInGuest = async () => {
  const result = await signInAnonymously(auth);
  return result.user;
};

export const signInWithEmail = async (email: string, pass: string) => {
  const result = await signInWithEmailAndPassword(auth, email.trim(), pass);
  return result.user;
};

export const signUpWithEmail = async (email: string, pass: string) => {
  const result = await createUserWithEmailAndPassword(auth, email.trim(), pass);
  return result.user;
};

export const resetPassword = async (email: string) => {
  await sendPasswordResetEmail(auth, email.trim());
};

export const logOut = () => signOut(auth);

const getActiveLang = (lang?: string): 'ja' | 'en' | 'fr' => {
  if (lang === 'ja' || lang === 'en' || lang === 'fr') return lang;
  try {
    const saved = localStorage.getItem('navfor_lang') || localStorage.getItem('navfor_language');
    if (saved === 'ja' || saved === 'en' || saved === 'fr') return saved;
  } catch {}
  return 'en';
};

const L = (lang: string | undefined, ja: string, en: string, fr: string) => {
  const active = getActiveLang(lang);
  if (active === 'ja') return ja;
  if (active === 'fr') return fr;
  return en;
};

export const testFirestoreConnection = async (lang?: string): Promise<{ ok: boolean; message: string }> => {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return {
      ok: true,
      message: L(
        lang,
        "Firestore サーバーと正常に通信できました。",
        "Successfully connected to Firestore server.",
        "Connexion au serveur Firestore réussie."
      )
    };
  } catch (err: any) {
    if (err?.code === 'permission-denied' || err?.message?.includes('Missing or insufficient permissions')) {
      return {
        ok: true,
        message: L(
          lang,
          "Firestore サーバーと正常に通信できています (セキュリティルール稼働中)。",
          "Connected to Firestore server (Security rules active).",
          "Connecté au serveur Firestore (Règles de sécurité actives)."
        )
      };
    }
    if (err instanceof Error && err.message.includes('the client is offline')) {
      return {
        ok: false,
        message: L(
          lang,
          "Firestore クライアントがオフラインです。ネットワーク接続をご確認ください。",
          "Firestore client is offline. Please check your network connection.",
          "Le client Firestore est hors ligne. Veuillez vérifier votre connexion réseau."
        )
      };
    }
    return { ok: false, message: err?.message || String(err) };
  }
};

export interface AuthErrorInfo {
  code: string;
  title: string;
  message: string;
  suggestion: string;
  actionType: 'authorized_domain' | 'provider_enable' | 'popup_block' | 'network' | 'email_provider' | 'general';
}

export function parseAuthError(err: any, lang?: string): AuthErrorInfo {
  const code = err?.code || (err instanceof Error && 'code' in err ? (err as any).code : 'auth/unknown');
  const rawMessage = err?.message || String(err);

  if (code === 'auth/unauthorized-domain') {
    const currentHost = typeof window !== 'undefined' ? window.location.hostname : '';
    return {
      code,
      title: L(
        lang,
        '承認されていないドメインです (auth/unauthorized-domain)',
        'Unauthorized Domain (auth/unauthorized-domain)',
        'Domaine non autorisé (auth/unauthorized-domain)'
      ),
      message: L(
        lang,
        `現在アクセスしているドメイン「${currentHost}」がFirebase Authenticationの承認済みドメインに登録されていません。`,
        `The current domain "${currentHost}" is not registered in Firebase Authentication's authorized domains.`,
        `Le domaine actuel « ${currentHost} » n'est pas enregistré dans les domaines autorisés de Firebase Authentication.`
      ),
      suggestion: L(
        lang,
        `Firebase Console > Authentication > Settings > 承認済みドメイン (Authorized domains) に「${currentHost}」を追加してください。`,
        `Please add "${currentHost}" to Firebase Console > Authentication > Settings > Authorized domains.`,
        `Veuillez ajouter « ${currentHost} » dans Firebase Console > Authentication > Settings > Domaines autorisés.`
      ),
      actionType: 'authorized_domain'
    };
  }

  if (code === 'auth/operation-not-allowed' || code === 'auth/configuration-not-found') {
    const isEmailError = rawMessage.toLowerCase().includes('password') || rawMessage.toLowerCase().includes('email');
    return {
      code,
      title: isEmailError
        ? L(lang, 'メール/パスワード認証が無効です', 'Email/Password sign-in is disabled', 'L’authentification E-mail/Mot de passe est désactivée')
        : L(lang, '認証プロバイダが無効です', 'Authentication provider is disabled', 'Le fournisseur d’authentification est désactivé'),
      message: isEmailError
        ? L(lang, 'Firebaseプロジェクトで「メール/パスワード」認証プロバイダが有効化されていません。', 'The Email/Password authentication provider is not enabled in your Firebase project.', 'Le fournisseur E-mail/Mot de passe n’est pas activé dans votre projet Firebase.')
        : L(lang, 'Firebaseプロジェクト側で該当の認証プロバイダ（Googleなど）が有効化されていません。', 'The corresponding authentication provider (e.g., Google) is not enabled in your Firebase project.', 'Le fournisseur d’authentification correspondant (ex. Google) n’est pas activé dans votre projet Firebase.'),
      suggestion: L(
        lang,
        'Firebase Console > Authentication > Sign-in method で該当プロバイダを有効化（Enable）してください。',
        'Please enable the provider in Firebase Console > Authentication > Sign-in method.',
        'Veuillez activer le fournisseur dans Firebase Console > Authentication > Sign-in method.'
      ),
      actionType: 'provider_enable'
    };
  }

  if (code === 'auth/user-not-found') {
    return {
      code,
      title: L(lang, 'アカウントが見つかりません', 'Account not found', 'Compte introuvable'),
      message: L(lang, '入力されたメールアドレスのアカウントは登録されていません。', 'No account was found with this email address.', 'Aucun compte n’est associé à cette adresse e-mail.'),
      suggestion: L(lang, 'メールアドレスをご確認いただくか、「新規登録」タブからアカウントを作成してください。', 'Please check your email address or create a new account in the "Sign Up" tab.', 'Vérifiez votre adresse e-mail ou créez un compte via l’onglet « Inscription ».'),
      actionType: 'general'
    };
  }

  if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
    return {
      code,
      title: L(lang, '認証に失敗しました', 'Authentication failed', 'Échec de l’authentification'),
      message: L(lang, 'メールアドレスまたはパスワードが正しくありません。', 'Incorrect email address or password.', 'Adresse e-mail ou mot de passe incorrect.'),
      suggestion: L(lang, 'パスワードをご確認ください。お忘れの場合は「パスワード再設定」をお試しください。', 'Please check your password or use "Reset Password" if you forgot it.', 'Vérifiez votre mot de passe ou utilisez « Réinitialiser » en cas d’oubli.'),
      actionType: 'general'
    };
  }

  if (code === 'auth/email-already-in-use') {
    return {
      code,
      title: L(lang, 'メールアドレスが既に使用されています', 'Email already in use', 'Adresse e-mail déjà utilisée'),
      message: L(lang, 'このメールアドレスは既に登録されています。', 'This email address is already registered.', 'Cette adresse e-mail est déjà enregistrée.'),
      suggestion: L(lang, '「ログイン」タブに切り替えてパスワードを入力してログインしてください。', 'Please switch to the "Sign In" tab and sign in with your password.', 'Veuillez passer à l’onglet « Connexion » et vous connecter avec votre mot de passe.'),
      actionType: 'general'
    };
  }

  if (code === 'auth/weak-password') {
    return {
      code,
      title: L(lang, 'パスワードの強度が不足しています', 'Weak password', 'Mot de passe trop faible'),
      message: L(lang, 'パスワードが短すぎるか推測されやすい文字列です。', 'The password is too short or easy to guess.', 'Le mot de passe est trop court ou trop facile à deviner.'),
      suggestion: L(lang, '6文字以上の安全なパスワードを設定してください。', 'Please set a secure password of at least 6 characters.', 'Veuillez définir un mot de passe sécurisé d’au moins 6 caractères.'),
      actionType: 'general'
    };
  }

  if (code === 'auth/invalid-email') {
    return {
      code,
      title: L(lang, 'メールアドレスの形式が正しくありません', 'Invalid email format', 'Format d’e-mail invalide'),
      message: L(lang, '有効なメールアドレス（例: user@example.com）を入力してください。', 'Please enter a valid email address (e.g., user@example.com).', 'Veuillez saisir une adresse e-mail valide (ex. user@example.com).'),
      suggestion: L(lang, '入力内容をご確認ください。', 'Please check your input.', 'Veuillez vérifier votre saisie.'),
      actionType: 'general'
    };
  }

  if (code === 'auth/popup-blocked') {
    return {
      code,
      title: L(lang, 'ポップアップがブロックされました (auth/popup-blocked)', 'Popup Blocked (auth/popup-blocked)', 'Fenêtre popup bloquée (auth/popup-blocked)'),
      message: L(lang, 'ブラウザのポップアップブロックやネットワーク制限により、Googleログイン画面を開けませんでした。', 'Could not open the Google sign-in window due to popup blockers or network restrictions.', 'Impossible d’ouvrir la fenêtre de connexion Google en raison d’un bloqueur de popups ou de restrictions réseau.'),
      suggestion: L(lang, '「メール認証」でログインするか、別タブでアプリを開いてお試しください。', 'Please use "Email Sign-In" or open the app in a new tab.', 'Veuillez utiliser la connexion par e-mail ou ouvrir l’application dans un nouvel onglet.'),
      actionType: 'popup_block'
    };
  }

  if (code === 'auth/popup-closed-by-user') {
    return {
      code,
      title: L(lang, 'ログインがキャンセルされました', 'Sign-in cancelled', 'Connexion annulée'),
      message: L(lang, '認証完了前にログイン用ポップアップウィンドウが閉じられました。', 'The sign-in popup window was closed before authentication completed.', 'La fenêtre de connexion a été fermée avant la fin de l’authentification.'),
      suggestion: L(lang, '再度ボタンをクリックするか、メール認証をご利用ください。', 'Please click the button again or use Email Sign-In.', 'Cliquez à nouveau sur le bouton ou utilisez la connexion par e-mail.'),
      actionType: 'general'
    };
  }

  if (code === 'auth/cancelled-popup-request') {
    return {
      code,
      title: L(lang, 'リクエストが重複しました', 'Duplicate popup request', 'Requête popup en double'),
      message: L(lang, '複数のログインポップアップが同時にリクエストされました。', 'Multiple sign-in popups were requested at the same time.', 'Plusieurs fenêtres de connexion ont été demandées simultanément.'),
      suggestion: L(lang, '少し待ってから再度お試しください。', 'Please wait a moment and try again.', 'Veuillez patienter un instant et réessayer.'),
      actionType: 'general'
    };
  }

  if (code === 'auth/network-request-failed') {
    return {
      code,
      title: L(lang, 'ネットワーク通信エラー (auth/network-request-failed)', 'Network Error (auth/network-request-failed)', 'Erreur réseau (auth/network-request-failed)'),
      message: L(lang, 'Firebaseサーバーへの接続に失敗しました。WiFiのセキュリティやプロキシにより接続が遮断されている可能性があります。', 'Failed to connect to Firebase server. Your WiFi security or proxy may be blocking the connection.', 'Échec de la connexion au serveur Firebase. Votre réseau WiFi ou proxy bloque peut-être la connexion.'),
      suggestion: L(lang, 'Googleログインのポップアップが遮断されるWiFi環境では、「メール認証」でのログインをお試しください。', 'If Google login popups are blocked on your WiFi, please try signing in with Email.', 'Si les popups Google sont bloqués sur votre réseau WiFi, essayez la connexion par e-mail.'),
      actionType: 'network'
    };
  }

  return {
    code,
    title: L(lang, `認証エラー (${code})`, `Authentication Error (${code})`, `Erreur d’authentification (${code})`),
    message: rawMessage,
    suggestion: L(lang, 'Firebase ConsoleのAuthentication設定、またはネットワーク環境をご確認ください。', 'Please check your Firebase Console Authentication settings or network connection.', 'Veuillez vérifier vos paramètres Firebase Authentication ou votre connexion réseau.'),
    actionType: 'general'
  };
}

