import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { getFirestore, collection, doc, addDoc, getDoc, setDoc, updateDoc, deleteDoc, query, where, onSnapshot, getDocs, serverTimestamp } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAbrXHya0vX_gF6k2FvlNgOyl09T1At478",
  authDomain: "shared-inventory-system.firebaseapp.com",
  projectId: "shared-inventory-system",
  storageBucket: "shared-inventory-system.firebasestorage.app",
  messagingSenderId: "140932123993",
  appId: "1:140932123993:web:a4352f30416f61627a5048",
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

const toEmail = (username) => `${username.toLowerCase()}@itempool.app`;

export const db_isUsernameTaken = async (username) => {
  const q = query(collection(db, "users"), where("username", "==", username));
  const snap = await getDocs(q);
  return !snap.empty;
};

export const db_createUser = async (username, password) => {
  const email = toEmail(username);
  const cred  = await createUserWithEmailAndPassword(auth, email, password);
  await setDoc(doc(db, "users", cred.user.uid), { username, email });
  return { uid: cred.user.uid, username };
};

export const db_loginUser = async (username, password) => {
  const email = toEmail(username);
  const cred  = await signInWithEmailAndPassword(auth, email, password);
  const snap  = await getDoc(doc(db, "users", cred.user.uid));
  return { uid: cred.user.uid, username: snap.data()?.username ?? username };
};

export const db_logoutUser = async () => { await signOut(auth); };

export const db_addItem = async (name, description, owner) => {
  await addDoc(collection(db, "items"), { name, description, ownerId: owner.uid, ownerUsername: owner.username, borrowedBy: null, borrowedByUsername: null, createdAt: serverTimestamp() });
};

export const db_updateDescription = async (itemId, description) => {
  await updateDoc(doc(db, "items", itemId), { description });
};

export const db_deleteItem = async (itemId) => { await deleteDoc(doc(db, "items", itemId)); };

export const db_claimItem = async (itemId, user) => {
  await updateDoc(doc(db, "items", itemId), { borrowedBy: user.uid, borrowedByUsername: user.username });
};

export const db_returnItem = async (itemId) => {
  await updateDoc(doc(db, "items", itemId), { borrowedBy: null, borrowedByUsername: null });
};

export const db_subscribeToPool = (callback) => {
  return onSnapshot(collection(db, "items"), (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
};

export const db_subscribeToMyItems = (uid, callback) => {
  const q = query(collection(db, "items"), where("ownerId", "==", uid));
  return onSnapshot(q, (snap) => { callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); });
};

export const db_subscribeToBorrowed = (uid, callback) => {
  const q = query(collection(db, "items"), where("borrowedBy", "==", uid));
  return onSnapshot(q, (snap) => { callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); });
};