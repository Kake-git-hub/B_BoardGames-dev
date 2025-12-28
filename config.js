// Embedded Firebase config (optional)
//
// 1) Firebase Console → Project settings → Your apps (Web) → Firebase SDK snippet
// 2) Copy the `firebaseConfig` object
// 3) Set ENABLE_EMBEDDED_FIREBASE_CONFIG = true and paste the object below
//
// Note: apiKey is not treated as a secret for Firebase client apps.

(function () {
  'use strict';

  // Keep false if you want to use the in-app setup screen (?screen=setup).
  var ENABLE_EMBEDDED_FIREBASE_CONFIG = false;

  if (!ENABLE_EMBEDDED_FIREBASE_CONFIG) return;

  // Paste your firebaseConfig here.
  // Example:
  // var firebaseConfig = {
  //   apiKey: "...",
  //   authDomain: "...",
  //   databaseURL: "https://<project>-default-rtdb.<region>.firebasedatabase.app",
  //   projectId: "...",
  //   storageBucket: "...",
  //   messagingSenderId: "...",
  //   appId: "..."
  // };
  var firebaseConfig = null;

  if (firebaseConfig && firebaseConfig.apiKey) {
    window.firebaseConfig = firebaseConfig;
  }
})();
