export type FirebaseUser = {
  uid: string;
  displayName: string | null;
  email: string | null;
};

type FirebaseAuth = {
  signInWithPopup(provider: unknown): Promise<{ user: FirebaseUser }>;
};

type FirebaseCompat = {
  apps: unknown[];
  initializeApp(config: Record<string, string>): unknown;
  auth: (() => FirebaseAuth) & { GoogleAuthProvider: new () => unknown };
};

declare global {
  interface Window {
    firebase?: FirebaseCompat;
  }
}

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

function configured() {
  return Object.values(config).every(Boolean);
}

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('No se pudo cargar Firebase.')), { once: true });
      if (window.firebase) resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('No se pudo cargar Firebase.'));
    document.head.appendChild(script);
  });
}

export async function signInWithFirebaseGoogle(): Promise<FirebaseUser> {
  if (!configured()) {
    throw new Error('Firebase todavía no está configurado para este entorno.');
  }
  await loadScript('https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js');
  await loadScript('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth-compat.js');
  const firebase = window.firebase;
  if (!firebase) throw new Error('Firebase no se pudo inicializar.');
  if (!firebase.apps.length) firebase.initializeApp(config as Record<string, string>);
  const provider = new firebase.auth.GoogleAuthProvider();
  const response = await firebase.auth().signInWithPopup(provider);
  return response.user;
}
