import "server-only";
import { initializeApp, getApps, getApp, cert, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

// Server-only Admin SDK: full access, bypasses all Firestore security rules.
// Firestore's rules deny every direct client read/write (see
// firebase/firestore.rules) — the public API routes and the admin server
// actions, both using this client, are the only path to the database.
//
// Initialization is lazy (first real use, not module import) so that
// `next build`'s route-collection step — which imports every route module —
// doesn't fail just because credentials aren't configured yet in this
// environment (e.g. local dev before .env.local is filled in).
let app: App | undefined;

function getAdminApp(): App {
  if (app) return app;
  if (getApps().length) {
    app = getApp();
    return app;
  }

  app = initializeApp({
    credential: cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
  return app;
}

function lazy<T extends object>(getInstance: () => T): T {
  let instance: T | undefined;
  return new Proxy({} as T, {
    get(_target, prop, receiver) {
      if (!instance) instance = getInstance();
      return Reflect.get(instance, prop, receiver);
    },
  });
}

export const adminAuth: Auth = lazy(() => getAuth(getAdminApp()));
export const adminDb: Firestore = lazy(() => getFirestore(getAdminApp()));
