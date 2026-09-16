import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut,
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
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
  const result = await signInWithEmailAndPassword(auth, email, pass);
  return result.user;
};

export const signUpWithEmail = async (email: string, pass: string) => {
  const result = await createUserWithEmailAndPassword(auth, email, pass);
  return result.user;
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
  actionType: 'authorized_domain' | 'provider_enable' | 'popup_block' | 'network' | 'general';
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
    return {
      code,
      title: 'Googleログインプロバイダが無効です (auth/operation-not-allowed)',
      message: 'Firebaseプロジェクト側でGoogle認証プロバイダが有効化されていません。',
      suggestion: 'Firebase Console > Authentication > Sign-in method で「Google」プロバイダを有効化（Enable）してください。',
      actionType: 'provider_enable'
    };
  }

  if (code === 'auth/popup-blocked') {
    return {
      code,
      title: 'ポップアップがブロックされました (auth/popup-blocked)',
      message: 'ブラウザのポップアップブロックまたはiframeのセキュリティ制限により、ログイン画面を開けませんでした。',
      suggestion: 'ブラウザのアドレスバーでポップアップを許可するか、画面右上の「新しいタブで開く」からアプリを別タブで開いて再度お試しください。',
      actionType: 'popup_block'
    };
  }

  if (code === 'auth/popup-closed-by-user') {
    return {
      code,
      title: 'ログインがキャンセルされました (auth/popup-closed-by-user)',
      message: '認証完了前にログイン用ポップアップウィンドウが閉じられました。',
      suggestion: '再度「Googleでログイン」ボタンをクリックしてログインを完了してください。',
      actionType: 'general'
    };
  }

  if (code === 'auth/cancelled-popup-request') {
    return {
      code,
      title: 'ログインリクエストが重複しました',
      message: '複数のログインポップアップが同時にリクエストされました。',
      suggestion: '少し待ってから再度1回クリックしてください。',
      actionType: 'general'
    };
  }

  if (code === 'auth/network-request-failed') {
    return {
      code,
      title: 'ネットワーク通信エラー (auth/network-request-failed)',
      message: 'Firebaseサーバーへの認証リクエストがタイムアウトまたは遮断されました。',
      suggestion: 'インターネット接続やセキュリティソフト、ブラウザの広告ブロック拡張機能の設定をご確認ください。',
      actionType: 'network'
    };
  }

  return {
    code,
    title: `認証エラー (${code})`,
    message: rawMessage,
    suggestion: 'Firebase ConsoleのAuthentication設定、またはブラウザのコンソールログをご確認ください。',
    actionType: 'general'
  };
}

