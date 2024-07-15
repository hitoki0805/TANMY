import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { firebaseConfig } from "./APIkeys/firebaseAPI";
import { initializeApp } from "firebase/app";

// Firebaseの初期化
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// ログイン状態の確認
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("User is logged in:", user);
        // Firestoreの操作をここに追加
    } else {
        console.log("No user is logged in");
        window.location.href = 'authentication.html'; // ログインページに遷移
    }
});

document.getElementById('logout-button').addEventListener('click', function() {
    firebase.auth().signOut().then(() => {
        // ログアウト成功
        window.location.href = 'authentication.html'; // ログインページに遷移
    }).catch((error) => {
        console.error("Error logging out: ", error);
    });
});