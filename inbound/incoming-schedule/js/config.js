// config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDDw17I5NwibE9BXl0YoILPQqoPQfCKH4Q",
  authDomain: "inbound-d8267.firebaseapp.com",
  databaseURL: "https://inbound-d8267-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "inbound-d8267",
  storageBucket: "inbound-d8267.appspot.com", // ← sudah dibetulkan
  messagingSenderId: "852665126418",
  appId: "1:852665126418:web:e4f029b83995e29f3052cb"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// Promise login anonymous agar bisa ditunggu
const authPromise = new Promise((resolve, reject) => {
  onAuthStateChanged(auth, user => {
    if (user) {
      console.log("✅ Logged in as anonymous");
      resolve({ db, user });
    } else {
      signInAnonymously(auth)
        .then(() => {
          console.log("🔐 Anonymous login success");
        })
        .catch(reject);
    }
  });
});

export { authPromise };
