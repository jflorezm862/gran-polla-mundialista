import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey:            "AIzaSyBXScpSvjgty8yP0mVXtm6ivR56OaWb6nI",
  authDomain:        "quiniela-mundialista-202-b1df6.firebaseapp.com",
  projectId:         "quiniela-mundialista-202-b1df6",
  storageBucket:     "quiniela-mundialista-202-b1df6.firebasestorage.app",
  messagingSenderId: "608681566077",
  appId:             "1:608681566077:web:3bdf4f846f2cce2d4fb614",
};

const app  = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);
