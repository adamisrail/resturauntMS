// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBZA2X3ZRhxmPEKtB_TjzkToT6RPNclquk",
  authDomain: "testmenu-6f164.firebaseapp.com",
  databaseURL: "https://testmenu-6f164-default-rtdb.firebaseio.com",
  projectId: "testmenu-6f164",
  storageBucket: "testmenu-6f164.firebasestorage.app",
  messagingSenderId: "489447499794",
  appId: "1:489447499794:web:e2cff540976932b68b50cb",
  measurementId: "G-YJ5VYTPRYN"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
// const analytics = getAnalytics(app); // Uncomment when needed for analytics

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app; 