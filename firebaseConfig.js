import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/database';

const firebaseConfig = {
  apiKey: "AIzaSyBlkFKlgW0J-YqPX3IRvyxEfzXJLH_KzXo",
  authDomain: "group-7-6a880.firebaseapp.com",
  databaseURL: "https://group-7-6a880-default-rtdb.firebaseio.com",
  projectId: "group-7-6a880",
  storageBucket: "group-7-6a880.appspot.com",
  messagingSenderId: "449484425785",
  appId: "1:449484425785:web:43d3b88ffa4311f47f9be8",
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

export const auth = firebase.auth();
export const db = firebase.database();

export { getAuth, getDatabase, ref, push, set, update, onValue } from 'firebase/compat/database';
import { getAuth, getDatabase, ref, push, set, update, onValue } from 'firebase/compat/database';