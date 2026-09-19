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

export const testFirestoreConnection = async (): Promise<{ ok: boolean; message: string }> => {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return { ok: true, message: "Firestore サーバーと正常に通信できました。" };
  } catch (err: any) {
    if (err?.code === 'permission-denied' || err?.message?.includes('Missing or insufficient permissions')) {
      // 権限エラーが出るということは、Firestoreサーバー自体との通信は確立されており、セキュリティルールが正しく動作している証拠
      return { ok: true, message: "Firestore サーバーと正常に通信できています (セキュリティルール稼働中)。" };
    }
    if (err instanceof Error && err.message.includes('the client is offline')) {
      return { ok: false, message: "Firestore クライアントがオフラインです。ネットワーク接続をご確認ください。" };
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

export function parseAuthError(err: any): AuthErrorInfo {
  const code = err?.code || (err instanceof Error && 'code' in err ? (err as any).code : 'auth/unknown');
  const rawMessage = err?.message || String(err);

  if (code === 'auth/unauthorized-domain') {
    const currentHost = typeof window !== 'undefined' ? window.location.hostname : '';
    return {
      code,
      title: '承認されていないドメインです (auth/unauthorized-domain)',
      message: `現在アクセスしているドメイン「${currentHost}」がFirebase Authenticationの承認済みドメインに登録されていません。`,
      suggestion: `Firebase Console > Authentication > Settings > 承認済みドメイン (Authorized domains) に「${currentHost}」を追加してください。`,
      actionType: 'authorized_domain'
    };
  }

  if (code === 'auth/operation-not-allowed' || code === 'auth/configuration-not-found') {
    const isEmailError = rawMessage.toLowerCase().includes('password') || rawMessage.toLowerCase().includes('email');
    return {
      code,
      title: isEmailError ? 'メール/パスワード認証が無効です' : '認証プロバイダが無効です',
      message: isEmailError
        ? 'Firebaseプロジェクトで「メール/パスワード」認証プロバイダが有効化されていません。'
        : 'Firebaseプロジェクト側で該当の認証プロバイダ（Googleなど）が有効化されていません。',
      suggestion: 'Firebase Console > Authentication > Sign-in method で該当プロバイダを有効化（Enable）してください。',
      actionType: 'provider_enable'
    };
  }

  if (code === 'auth/user-not-found') {
    return {
      code,
      title: 'アカウントが見つかりません',
      message: '入力されたメールアドレスのアカウントは登録されていません。',
      suggestion: 'メールアドレスをご確認いただくか、「新規登録」タブからアカウントを作成してください。',
      actionType: 'general'
    };
  }

  if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
    return {
      code,
      title: '認証に失敗しました',
      message: 'メールアドレスまたはパスワードが正しくありません。',
      suggestion: 'パスワードをご確認ください。お忘れの場合は「パスワード再設定」をお試しください。',
      actionType: 'general'
    };
  }

  if (code === 'auth/email-already-in-use') {
    return {
      code,
      title: 'メールアドレスが既に使用されています',
      message: 'このメールアドレスは既に登録されています。',
      suggestion: '「ログイン」タブに切り替えてパスワードを入力してログインしてください。',
      actionType: 'general'
    };
  }

  if (code === 'auth/weak-password') {
    return {
      code,
      title: 'パスワードの強度が不足しています',
      message: 'パスワードが短すぎるか推測されやすい文字列です。',
      suggestion: '6文字以上の安全なパスワードを設定してください。',
      actionType: 'general'
    };
  }

  if (code === 'auth/invalid-email') {
    return {
      code,
      title: 'メールアドレスの形式が正しくありません',
      message: '有効なメールアドレス（例: user@example.com）を入力してください。',
      suggestion: '入力内容をご確認ください。',
      actionType: 'general'
    };
  }

  if (code === 'auth/popup-blocked') {
    return {
      code,
      title: 'ポップアップがブロックされました (auth/popup-blocked)',
      message: 'ブラウザのポップアップブロックやネットワーク制限により、Googleログイン画面を開けませんでした。',
      suggestion: '「メール認証」でログインするか、別タブでアプリを開いてお試しください。',
      actionType: 'popup_block'
    };
  }

  if (code === 'auth/popup-closed-by-user') {
    return {
      code,
      title: 'ログインがキャンセルされました',
      message: '認証完了前にログイン用ポップアップウィンドウが閉じられました。',
      suggestion: '再度ボタンをクリックするか、メール認証をご利用ください。',
      actionType: 'general'
    };
  }

  if (code === 'auth/cancelled-popup-request') {
    return {
      code,
      title: 'リクエストが重複しました',
      message: '複数のログインポップアップが同時にリクエストされました。',
      suggestion: '少し待ってから再度お試しください。',
      actionType: 'general'
    };
  }

  if (code === 'auth/network-request-failed') {
    return {
      code,
      title: 'ネットワーク通信エラー (auth/network-request-failed)',
      message: 'Firebaseサーバーへの接続に失敗しました。WiFiのセキュリティやプロキシにより接続が遮断されている可能性があります。',
      suggestion: 'Googleログインのポップアップが遮断されるWiFi環境では、「メール認証」でのログインをお試しください。',
      actionType: 'network'
    };
  }

  return {
    code,
    title: `認証エラー (${code})`,
    message: rawMessage,
    suggestion: 'Firebase ConsoleのAuthentication設定、またはネットワーク環境をご確認ください。',
    actionType: 'general'
  };
}

