// src/lib/firebase.js
import { initializeApp, getApps } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getFirestore } from "firebase/firestore";
// QUAN TRỌNG: Thêm 2 dòng này để nhập thư viện Auth
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  // --- THẦY DÁN API KEY CỦA THẦY VÀO ĐÂY NHÉ ---
    apiKey: "AIzaSyCH0uMBlSGfT92B7bZrwgPksI4bq2KezXE",
  authDomain: "online-exam-system-c6b7a.firebaseapp.com",
  databaseURL: "https://online-exam-system-c6b7a-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "online-exam-system-c6b7a",
  storageBucket: "online-exam-system-c6b7a.firebasestorage.app",
  messagingSenderId: "150254325152",
  appId: "1:150254325152:web:1f7dba6174821195a128c5",
  measurementId: "G-K1KHG5RBE2"
};

// Khởi tạo app
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

const db = getDatabase(app);
const firestore = getFirestore(app);

// QUAN TRỌNG: Khởi tạo thêm 2 biến này
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// QUAN TRỌNG: Xuất khẩu auth và googleProvider ra ngoài để file khác dùng được
export { db, firestore, auth, googleProvider };