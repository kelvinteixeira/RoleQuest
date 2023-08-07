import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyB7VdMHqEBi4PNTaGjIqK7kuqhw_8Qui6Q",
  authDomain: "auth-2bf96.firebaseapp.com",
  projectId: "auth-2bf96",
  storageBucket: "auth-2bf96.appspot.com",
  messagingSenderId: "730363962328",
  appId: "1:730363962328:web:36fb89d2d845593a6d88ad",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
