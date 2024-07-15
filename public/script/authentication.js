import { firebaseConfig } from '../APIkeys/firebaseAPI.js';

// Firebaseを初期化します
firebase.initializeApp(firebaseConfig);

document.getElementById('login-form').addEventListener('submit', function(event) {
    event.preventDefault();
    var email = document.getElementById('email').value;
    var password = document.getElementById('password').value;

    firebase.auth().signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            // ログイン成功
            window.location.href = 'mainpage.html'; // メインページに遷移
        })
        .catch((error) => {
            console.error("Error logging in: ", error);
            alert("ログインに失敗しました。");
        });
});