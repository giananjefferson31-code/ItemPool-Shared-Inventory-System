import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Modal,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";

import { auth, db } from "./firebaseConfig";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";

import {
  ref,
  push,
  set,
  update,
  onValue,
  remove,
} from "firebase/database";


// ================= AUTH =================

const db_createUser = async (username, password) => {
  const email = `${username}@borrow.com`;
  const res = await createUserWithEmailAndPassword(auth, email, password);
  return { uid: res.user.uid, username };
};

const db_loginUser = async (username, password) => {
  const email = `${username}@borrow.com`;
  const res = await signInWithEmailAndPassword(auth, email, password);
  return { uid: res.user.uid, username };
};


// ================= DATABASE =================

const db_addItem = async (name, description, owner) => {
  const itemsRef = ref(db, "items");
  const newRef = push(itemsRef);

  await set(newRef, {
    name,
    description,
    ownerId: owner.uid,
    ownerName: owner.username,
    borrowedBy: null,
    deleted: false,
    createdAt: Date.now(),
  });
};

const db_claimItem = (id, uid) =>
  update(ref(db, `items/${id}`), { borrowedBy: uid });

const db_returnItem = (id) =>
  update(ref(db, `items/${id}`), { borrowedBy: null });

const db_deleteItem = (id) =>
  update(ref(db, `items/${id}`), { deleted: true });

// --- NEW: Update item function ---
const db_updateItem = (id, newName, newDesc) =>
  update(ref(db, `items/${id}`), { name: newName, description: newDesc });


// ================= LIVE DATA =================

const useItems = () => {
  const [items, setItems] = useState([]);

  useEffect(() => {
    const itemsRef = ref(db, "items");

    const unsubscribe = onValue(itemsRef, (snapshot) => {
      const data = snapshot.val();

      if (!data) {
        setItems([]);
        return;
      }

      const list = Object.keys(data)
        .map((key) => ({
          id: key,
          ...data[key],
        }))
        .filter((item) => !item.deleted);

      console.log("🔥 ITEMS:", list); // debug

      setItems(list);
    });

    return () => unsubscribe();
  }, []);

  return items;
};


// ================= APP =================

export default function App() {
  const [user, setUser] = useState(null);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [itemName, setItemName] = useState("");
  const [itemDesc, setItemDesc] = useState("");

  // --- NEW: State for update modal ---
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  const items = useItems();

  // --- NEW: Open edit modal with item data ---
  const openEdit = (item) => {
    setCurrentItem(item);
    setEditName(item.name);
    setEditDesc(item.description);
    setEditModalVisible(true);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F3F4F6" }}>

      <View style={{ flex: 1 }}>

        {/* HEADER */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Borrowing Pool</Text>
          <Text style={styles.headerSubtitle}>LIVE Firebase</Text>
        </View>

        {/* LOGIN */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Login</Text>

          <TextInput
            placeholder="Username"
            style={styles.input}
            value={username}
            onChangeText={setUsername}
          />

          <TextInput
            placeholder="Password"
            secureTextEntry
            style={styles.input}
            value={password}
            onChangeText={setPassword}
          />

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={async () => {
              try {
                const u = await db_loginUser(username, password);
                setUser(u);
                alert("✅ Logged in");
              } catch (e) {
                alert("❌ Login failed: " + e.message);
              }
            }}
          >
            <Text style={styles.buttonText}>Login</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: "#10B981", marginTop: 10 }]}
            onPress={async () => {
              try {
                const u = await db_createUser(username, password);
                setUser(u);
                alert("✅ Registered successfully");
              } catch (e) {
                if (e.code === "auth/email-already-in-use") {
                  alert("⚠️ This username already exists — use another one or login.");
                } else {
                  alert("❌ Register failed: " + e.message);
                }
              }
            }}
          >
            <Text style={styles.buttonText}>Register</Text>
          </TouchableOpacity>
        </View>

        {/* ADD ITEM */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Add Item</Text>

          <TextInput
            placeholder="Item Name"
            style={styles.input}
            value={itemName}
            onChangeText={setItemName}
          />

          <TextInput
            placeholder="Description"
            style={styles.input}
            value={itemDesc}
            onChangeText={setItemDesc}
          />

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={async () => {
              if (!user) return alert("⚠️ Login first");
              if (!itemName || !itemDesc) return alert("⚠️ Fill all fields");

              await db_addItem(itemName, itemDesc, user);

              setItemName("");
              setItemDesc("");

              alert("✅ Item added successfully");
            }}
          >
            <Text style={styles.buttonText}>Add Item</Text>
          </TouchableOpacity>
        </View>

        {/* --- NEW: EDIT ITEM MODAL --- */}
        <Modal visible={editModalVisible} animationType="slide" transparent>
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.sectionTitle}>Edit Item</Text>
              <TextInput
                style={styles.input}
                placeholder="New Name"
                value={editName}
                onChangeText={setEditName}
              />
              <TextInput
                style={styles.input}
                placeholder="New Description"
                value={editDesc}
                onChangeText={setEditDesc}
              />
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={async () => {
                  if (!editName || !editDesc) return alert("⚠️ Fill all fields");
                  await db_updateItem(currentItem.id, editName, editDesc);
                  setEditModalVisible(false);
                  alert("✅ Item updated");
                }}
              >
                <Text style={styles.buttonText}>Save Changes</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryButton, {backgroundColor: '#9CA3AF', marginTop:8}]}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* AVAILABLE ITEMS */}
        <Text style={styles.listTitle}>Available Items</Text>

        <FlatList
          style={{ flex: 1 }}
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 120 }}
          ListEmptyComponent={
            <Text style={{ textAlign: "center", marginTop: 20 }}>
              No items yet. Add one above 👆
            </Text>
          }
          renderItem={({ item }) => {
            const isOwner = user?.uid === item.ownerId;
            const isBorrowed = item.borrowedBy !== null;

            return (
              <View style={styles.itemCard}>

                <Text style={styles.itemTitle}>{item.name}</Text>
                <Text>{item.description}</Text>
                <Text>Owner: {item.ownerName}</Text>

                <Text style={{ color: isBorrowed ? "red" : "green" }}>
                  {isBorrowed ? "Borrowed" : "Available"}
                </Text>

                {!isOwner && !isBorrowed && (
                  <TouchableOpacity
                    style={styles.borrowBtn}
                    onPress={() => db_claimItem(item.id, user.uid)}
                  >
                    <Text style={styles.buttonText}>Borrow</Text>
                  </TouchableOpacity>
                )}

                {user?.uid === item.borrowedBy && (
                  <TouchableOpacity
                    style={styles.returnBtn}
                    onPress={() => db_returnItem(item.id)}
                  >
                    <Text style={styles.buttonText}>Return</Text>
                  </TouchableOpacity>
                )}

                {/* --- NEW: UPDATE & DELETE BUTTONS FOR OWNER --- */}
                {isOwner && (
                  <View style={{flexDirection:'row', gap:8, marginTop:8}}>
                    <TouchableOpacity
                      style={[styles.borrowBtn, {flex:1, backgroundColor: '#F59E0B'}]}
                      onPress={() => openEdit(item)}
                    >
                      <Text style={styles.buttonText}>Update</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.returnBtn, {flex:1}]}
                      onPress={() => {
                        db_deleteItem(item.id);
                        alert("🗑️ Item deleted");
                      }}
                    >
                      <Text style={styles.buttonText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                )}

              </View>
            );
          }}
        />

      </View>
    </SafeAreaView>
  );
}


// ================= STYLES =================

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F3F4F6" },

  header: {
    backgroundColor: "#4F46E5",
    padding: 25,
  },

  headerTitle: { color: "#fff", fontSize: 26, fontWeight: "bold" },
  headerSubtitle: { color: "#ddd" },

  card: {
    backgroundColor: "#fff",
    margin: 12,
    padding: 12,
    borderRadius: 10,
  },

  sectionTitle: { fontSize: 18, fontWeight: "bold" },

  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    marginVertical: 5,
    padding: 10,
    borderRadius: 8,
  },

  primaryButton: {
    backgroundColor: "#4F46E5",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },

  buttonText: { color: "#fff", fontWeight: "bold" },

  listTitle: {
    fontSize: 20,
    fontWeight: "bold", marginLeft: 12,
    marginTop: 10,
  },

  itemCard: {
    backgroundColor: "#fff",
    margin: 12,
    padding: 12,
    borderRadius: 10,
  },

  itemTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },

  borrowBtn: {
    backgroundColor: "#10B981",
    padding: 10,
    borderRadius: 8,
    marginTop: 5,
  },

  returnBtn: {
    backgroundColor: "#EF4444",
    padding: 10,
    borderRadius: 8,
    marginTop: 5,
  },

  // --- NEW: Modal styles ---
  modalContainer: {
    flex:1,
    backgroundColor:'rgba(0,0,0,0.5)',
    justifyContent:'center',
    padding:20
  },
  modalContent: {
    backgroundColor:'#fff',
    padding:20,
    borderRadius:10
  }
});// Added Update, Delete & Borrow features by careljajt-maker
// My separate contribution: Update, Delete & Borrow features added
// My contribution: Update, Delete & Borrow functions added by careljajt-maker
// My contribution: Update, Delete & Borrow features added by careljajt-maker
// My Contribution: Added Update, Delete & Borrow Functions | careljajt-maker
