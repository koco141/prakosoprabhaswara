import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc, onSnapshot } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDebqqoj77AJzvexAFMURlYMesy8mO9WRU",
  authDomain: "prakosoprabhaswara.firebaseapp.com",
  projectId: "prakosoprabhaswara",
  storageBucket: "prakosoprabhaswara.firebasestorage.app",
  messagingSenderId: "139703214214",
  appId: "1:139703214214:web:8866390c6a34f65eb17107",
  measurementId: "G-F943S45MEC"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// Whitelisted admin email
const adminWhitelist = ["gkoso2@gmail.com"];

export { auth, db, provider, signInWithPopup, signOut, onAuthStateChanged, doc, setDoc, getDoc, onSnapshot, adminWhitelist };
