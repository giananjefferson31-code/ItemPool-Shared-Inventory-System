import React, { useState, useEffect, useCallback } from "react";
import { useForm, Controller } from "react-hook-form";
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  Modal, ScrollView, StyleSheet, SafeAreaView,
  Alert, ActivityIndicator, StatusBar,
} from "react-native";
import {
  db_createUser, db_loginUser, db_logoutUser,
  db_addItem, db_updateDescription, db_deleteItem,
  db_claimItem, db_returnItem,
  db_subscribeToPool, db_subscribeToMyItems, db_subscribeToBorrowed,
  db_isUsernameTaken,
} from "./firebase";

// VALIDATION
const authRules = {
  username: {
    required: "Username is required",
    minLength: { value: 3,  message: "At least 3 characters" },
    maxLength: { value: 20, message: "20 characters max" },
    pattern:   { value: /^[a-zA-Z0-9_]+$/, message: "Letters, numbers, underscores only" },
  },
  password: {
    required: "Password is required",
    minLength: { value: 6, message: "At least 6 characters" },
  },
};

const itemRules = {
  name: {
    required: "Item name is required",
    minLength: { value: 2,  message: "At least 2 characters" },
    maxLength: { value: 50, message: "50 characters max" },
  },
  description: {
    required: "Description is required",
    minLength: { value: 5,   message: "At least 5 characters" },
    maxLength: { value: 200, message: "200 characters max" },
  },
};

const descriptionOnlyRules = { description: itemRules.description };

// userAuthentication
const useAuth = () => {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const registerForm = useForm({ mode: "onChange" });
  const loginForm    = useForm({ mode: "onChange" });

  const register = useCallback(async ({ username, password }) => {
    setLoading(true); setError(null);
    try {
      const taken = await db_isUsernameTaken(username);
      if (taken) { setError("Username already taken"); return false; }
      const newUser = await db_createUser(username, password);
      setUser(newUser); return true;
    } catch (e) { setError(e.message); return false; }
    finally { setLoading(false); }
  }, []);

  const login = useCallback(async ({ username, password }) => {
    setLoading(true); setError(null);
    try {
      const u = await db_loginUser(username, password);
      setUser(u); return true;
    } catch (e) { setError("Invalid username or password"); return false; }
    finally { setLoading(false); }
  }, []);

  const logout = useCallback(async () => {
    setLoading(true);
    try { await db_logoutUser(); setUser(null); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  return { user, loading, error, register, login, logout, registerForm, loginForm };
};

// userPool
const usePool = (user) => {
  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const addItemForm = useForm({ mode: "onBlur" });

  useEffect(() => {
    if (!user) return;
    const unsub = db_subscribeToPool((poolItems) => setItems(poolItems));
    return unsub;
  }, [user]);

  const addItem = useCallback(async ({ name, description }) => {
    if (!user) { setError("Must be logged in"); return false; }
    setLoading(true); setError(null);
    try { await db_addItem(name, description, user); addItemForm.reset(); return true; }
    catch (e) { setError(e.message); return false; }
    finally { setLoading(false); }
  }, [user]);

  return { items, loading, error, addItem, addItemForm };
};

// userItem
const useItem = (user) => {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const editForm = useForm({ mode: "onBlur" });

  const isOwner    = useCallback((item) => item?.ownerId === user?.uid,             [user]);
  const isBorrowed = useCallback((item) => item?.borrowedBy != null,                []);
  const canDelete  = useCallback((item) => isOwner(item) && !isBorrowed(item),      [isOwner, isBorrowed]);
  const canClaim   = useCallback((item) => !isBorrowed(item) && !isOwner(item),     [isBorrowed, isOwner]);

  const claimItem = useCallback(async (item) => {
    if (!user || !canClaim(item)) { setError("Item unavailable"); return false; }
    setLoading(true); setError(null);
    try { await db_claimItem(item.id, user); return true; }
    catch (e) { setError(e.message); return false; }
    finally { setLoading(false); }
  }, [user, canClaim]);

  const returnItem = useCallback(async (item) => {
    if (!user || item?.borrowedBy !== user.uid) { setError("Not the borrower"); return false; }
    setLoading(true); setError(null);
    try { await db_returnItem(item.id); return true; }
    catch (e) { setError(e.message); return false; }
    finally { setLoading(false); }
  }, [user]);

  const updateDescription = useCallback(async (item, { description }) => {
    if (!isOwner(item)) { setError("Only the owner can edit"); return false; }
    setLoading(true); setError(null);
    try { await db_updateDescription(item.id, description); editForm.reset(); return true; }
    catch (e) { setError(e.message); return false; }
    finally { setLoading(false); }
  }, [isOwner]);

  const deleteItem = useCallback(async (item) => {
    if (!canDelete(item)) { setError("Cannot delete a borrowed item"); return false; }
    setLoading(true); setError(null);
    try { await db_deleteItem(item.id); return true; }
    catch (e) { setError(e.message); return false; }
    finally { setLoading(false); }
  }, [canDelete]);

  return { loading, error, isOwner, isBorrowed, canDelete, canClaim, claimItem, returnItem, updateDescription, deleteItem, editForm };
};

// useMyItems
const useMyItems = (user) => {
  const [ownedItems,    setOwnedItems]    = useState([]);
  const [borrowedItems, setBorrowedItems] = useState([]);
  const [loading,       setLoading]       = useState(true);

  useEffect(() => {
    if (!user) { setOwnedItems([]); setBorrowedItems([]); return; }
    setLoading(true);
    const unsubOwned    = db_subscribeToMyItems(user.uid,  (items) => { setOwnedItems(items);    setLoading(false); });
    const unsubBorrowed = db_subscribeToBorrowed(user.uid, (items) => setBorrowedItems(items));
    return () => { unsubOwned(); unsubBorrowed(); };
  }, [user]);

  return { ownedItems, borrowedItems, loading };
};

// UI Components
const Field = ({ control, name, rules, placeholder, secureTextEntry, error }) => (
  <View style={s.fieldWrap}>
    <Controller
      control={control} name={name} rules={rules}
      render={({ field: { onChange, onBlur, value } }) => (
        <TextInput
          style={[s.input, error && s.inputError]}
          placeholder={placeholder} placeholderTextColor="#aaa"
          onBlur={onBlur} onChangeText={onChange} value={value}
          secureTextEntry={secureTextEntry} autoCapitalize="none"
        />
      )}
    />
    {error && <Text style={s.fieldError}>{error.message}</Text>}
  </View>
);

const Btn = ({ label, onPress, variant = "primary", disabled, loading: spin }) => (
  <TouchableOpacity
    style={[s.btn, variant === "ghost" && s.btnGhost, variant === "danger" && s.btnDanger, disabled && s.btnDisabled]}
    onPress={onPress} disabled={disabled || spin} activeOpacity={0.75}
  >
    {spin
      ? <ActivityIndicator color={variant === "primary" ? "#fff" : C.accent} size="small" />
      : <Text style={[s.btnTxt, variant === "ghost" && s.btnTxtGhost, variant === "danger" && s.btnTxtDanger]}>{label}</Text>}
  </TouchableOpacity>
);

const Tag = ({ borrowed }) => (
  <View style={[s.tag, borrowed ? s.tagBorrowed : s.tagFree]}>
    <Text style={[s.tagTxt, borrowed ? s.tagTxtBorrowed : s.tagTxtFree]}>{borrowed ? "Borrowed" : "Available"}</Text>
  </View>
);

// Authentication Screen
const AuthScreen = ({ auth: A }) => {
  const [mode, setMode] = useState("login");
  const isLogin = mode === "login";

  const { control, handleSubmit, formState: { errors }, reset } = useForm({ mode: "onChange" });

  const switchMode = (m) => { reset(); setMode(m); };
  const onSubmit = handleSubmit((data) => isLogin ? A.login(data) : A.register(data));

  return (
    <SafeAreaView style={s.authRoot}>
      <StatusBar barStyle="dark-content" />
      <View style={s.authCard}>
        <Text style={s.logo}>ITEMPOOL</Text>
        <Text style={s.authSub}>Shared Inventory System</Text>
        <View style={s.tabRow}>
          {["login", "register"].map((m) => (
            <TouchableOpacity key={m} style={[s.tab, mode === m && s.tabActive]} onPress={() => switchMode(m)}>
              <Text style={[s.tabTxt, mode === m && s.tabTxtActive]}>{m === "login" ? "Log In" : "Register"}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Field control={control} name="username" rules={authRules.username} placeholder="Username" error={errors.username} />
        <Field control={control} name="password" rules={authRules.password} placeholder="Password" secureTextEntry error={errors.password} />
        {A.error && <Text style={s.authError}>{A.error}</Text>}
        <TouchableOpacity
          style={s.btn}
          onPress={onSubmit}
          disabled={A.loading}
          activeOpacity={0.75}
        >
          {A.loading
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={s.btnTxt}>{isLogin ? "Log In" : "Create Account"}</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};


// Item Detail
const ItemModal = ({ item, onClose, user, itemHook: I }) => {
  const [editing, setEditing] = useState(false);
  const { control, handleSubmit, formState: { errors }, setValue } = I.editForm;
  if (!item) return null;
  const owned    = I.isOwner(item);
  const borrowed = I.isBorrowed(item);
  const handleEdit = handleSubmit((data) => I.updateDescription(item, data).then((ok) => ok && setEditing(false)));

  return (
    <Modal visible={!!item} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.sheet}>
          <View style={s.sheetHeader}>
            <Text style={s.sheetTitle}>{item.name}</Text>
            <TouchableOpacity onPress={onClose}><Text style={s.closeBtn}>✕</Text></TouchableOpacity>
          </View>
          <Tag borrowed={borrowed} />
          <Text style={s.ownerLabel}>Added by {item.ownerUsername}</Text>
          {editing ? (
            <>
              <Field control={control} name="description" rules={descriptionOnlyRules.description} placeholder="New description" error={errors.description} />
              <View style={s.row}>
                <Btn label="Save"   onPress={handleEdit}             loading={I.loading} />
                <Btn label="Cancel" onPress={() => setEditing(false)} variant="ghost" />
              </View>
            </>
          ) : (
            <Text style={s.sheetDesc}>{item.description}</Text>
          )}
          {borrowed && item.borrowedByUsername && (
            <Text style={s.borrowedBy}>Currently with: {item.borrowedByUsername}</Text>
          )}
          {!editing && (
            <View style={s.actionRow}>
              {!owned && (
                <Btn label="Get Item" onPress={() => { I.claimItem(item); onClose(); }} disabled={borrowed} />
              )}
              {owned && (
                <Btn label="Edit Description" onPress={() => { setValue("description", item.description); setEditing(true); }} variant="ghost" />
              )}
              {owned && (
                <Btn label="Delete" variant="danger" disabled={borrowed}
                  onPress={() => Alert.alert("Delete", "Remove this item?", [
                    { text: "Cancel" },
                    { text: "Delete", style: "destructive", onPress: () => { I.deleteItem(item); onClose(); } },
                  ])}
                />
              )}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

// Pool Screen
const PoolScreen = ({ user, pool, itemHook }) => {
  const [selected,    setSelected]    = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const { control, handleSubmit, formState: { errors } } = pool.addItemForm || useForm({ mode: "onChange" });
  const onAdd = handleSubmit((data) => pool.addItem(data).then((ok) => ok && setShowAddForm(false)));

  return (
    <View style={s.screen}>
      <View style={s.screenHeader}>
        <Text style={s.screenTitle}>The Pool</Text>
        <TouchableOpacity style={s.addBtn} onPress={() => setShowAddForm((p) => !p)}>
          <Text style={s.addBtnTxt}>{showAddForm ? "✕" : "+ Add"}</Text>
        </TouchableOpacity>
      </View>
      {showAddForm && (
        <View style={s.addForm}>
          <Field control={control} name="name"        rules={itemRules.name}        placeholder="Item name"   error={errors.name} />
          <Field control={control} name="description" rules={itemRules.description} placeholder="Description" error={errors.description} />
          {pool.error && <Text style={s.authError}>{pool.error}</Text>}
          <Btn label="Add to Pool" onPress={onAdd} loading={pool.loading} />
        </View>
      )}
      {pool.loading && <ActivityIndicator style={{ marginTop: 32 }} color={C.accent} />}
      <FlatList
        data={pool.items} keyExtractor={(i) => i.id} contentContainerStyle={s.list}
        renderItem={({ item }) => {
          const borrowed = itemHook.isBorrowed(item);
          return (
            <TouchableOpacity style={[s.card, borrowed && s.cardBorrowed]} onPress={() => setSelected(item)} activeOpacity={0.8}>
              <View style={s.cardTop}>
                <Text style={[s.cardName, borrowed && s.cardNameBorrowed]} numberOfLines={1}>{item.name}</Text>
                <Tag borrowed={borrowed} />
              </View>
              <Text style={[s.cardDesc, borrowed && s.cardDescBorrowed]} numberOfLines={2}>{item.description}</Text>
              <Text style={s.cardOwner}>by {item.ownerUsername}</Text>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={<Text style={s.empty}>No items in the pool yet.</Text>}
      />
      <ItemModal item={selected} onClose={() => setSelected(null)} user={user} itemHook={itemHook} />
    </View>
  );
};

// Dashboard Screen
const DashboardScreen = ({ user, myItems, itemHook, onLogout }) => {
  const [selected, setSelected] = useState(null);

  const Section = ({ title, data, emptyMsg, isBorrowedSection }) => (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      {data.length === 0
        ? <Text style={s.empty}>{emptyMsg}</Text>
        : data.map((item) => {
            const borrowed = itemHook.isBorrowed(item);
            return (
              <TouchableOpacity key={item.id} style={[s.card, borrowed && !isBorrowedSection && s.cardBorrowed]} onPress={() => setSelected(item)} activeOpacity={0.8}>
                <View style={s.cardTop}>
                  <Text style={[s.cardName, borrowed && !isBorrowedSection && s.cardNameBorrowed]} numberOfLines={1}>{item.name}</Text>
                  {!isBorrowedSection && <Tag borrowed={borrowed} />}
                </View>
                <Text style={[s.cardDesc, borrowed && !isBorrowedSection && s.cardDescBorrowed]} numberOfLines={2}>{item.description}</Text>
                {borrowed && !isBorrowedSection && item.borrowedByUsername && (
                  <Text style={s.cardOwner}>With: {item.borrowedByUsername}</Text>
                )}
                {isBorrowedSection && (
                  <Btn label="Return" onPress={() => itemHook.returnItem(item)} variant="ghost" />
                )}
              </TouchableOpacity>
            );
          })}
    </View>
  );

  return (
    <View style={s.screen}>
      <View style={s.screenHeader}>
        <View>
          <Text style={s.screenTitle}>Dashboard</Text>
          <Text style={s.screenSub}>@{user.username}</Text>
        </View>
        <TouchableOpacity onPress={onLogout}><Text style={s.logoutTxt}>Log out</Text></TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={s.list}>
        {myItems.loading
          ? <ActivityIndicator color={C.accent} style={{ marginTop: 32 }} />
          : <>
              <Section title="My Items"       data={myItems.ownedItems}    emptyMsg="You haven't added anything yet." isBorrowedSection={false} />
              <Section title="Borrowed Items" data={myItems.borrowedItems} emptyMsg="Nothing borrowed right now."    isBorrowedSection={true}  />
            </>}
      </ScrollView>
      <ItemModal item={selected} onClose={() => setSelected(null)} user={user} itemHook={itemHook} />
    </View>
  );
};

// Root App
export default function App() {
  const [tab,    setTab]    = useState("pool");
  const auth     = useAuth();
  const pool     = usePool(auth.user);
  const itemHook = useItem(auth.user);
  const myItems  = useMyItems(auth.user);

  if (!auth.user) return <AuthScreen auth={auth} />;

  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="dark-content" />
      <View style={s.body}>
        {tab === "pool"
          ? <PoolScreen      user={auth.user} pool={pool} itemHook={itemHook} />
          : <DashboardScreen user={auth.user} myItems={myItems} itemHook={itemHook} onLogout={auth.logout} />}
      </View>
      <View style={s.tabBar}>
        {[["pool", "Pool"], ["dash", "Dashboard"]].map(([key, label]) => (
          <TouchableOpacity key={key} style={s.tabItem} onPress={() => setTab(key)}>
            <Text style={[s.tabItemTxt, tab === key && s.tabItemTxtActive]}>{label}</Text>
            {tab === key && <View style={s.tabIndicator} />}
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}



// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const C = {
  bg:        "#F7F7F5",
  surface:   "#FFFFFF",
  border:    "#E8E8E4",
  accent:    "#1A1A1A",
  accentSub: "#555",
  muted:     "#999",
  borrowed:  "#D4D4CE",
  danger:    "#C0392B",
  tag:       "#E8F5E9",
  tagTxt:    "#2E7D32",
  tagB:      "#EDEDED",
  tagBTxt:   "#888",
};

// ─── STYLES ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:             { flex: 1, backgroundColor: C.bg },
  body:             { flex: 1 },
  screen:           { flex: 1, backgroundColor: C.bg },
  screenHeader:     { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 16, paddingTop: 48, borderBottomWidth: 1, borderColor: C.border, backgroundColor: C.surface },
  screenTitle:      { fontSize: 20, fontWeight: "700", color: C.accent, letterSpacing: -0.5 },
  screenSub:        { fontSize: 13, color: C.muted, marginTop: 1 },
  list:             { padding: 16, gap: 10 },
  section:          { marginBottom: 24 },
  sectionTitle:     { fontSize: 13, fontWeight: "600", color: C.muted, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 10 },
  row:              { flexDirection: "row", gap: 8 },
  actionRow:        { flexDirection: "row", gap: 8, marginTop: 16 },
  empty:            { textAlign: "center", color: C.muted, marginTop: 24, fontSize: 14 },
  authRoot:         { flex: 1, backgroundColor: C.bg, justifyContent: "center", padding: 24 },
  authCard:         { backgroundColor: C.surface, borderRadius: 16, padding: 28, borderWidth: 1, borderColor: C.border },
  logo:             { fontSize: 26, fontWeight: "800", color: C.accent, letterSpacing: -1, textAlign: "center" },
  authSub:          { fontSize: 13, color: C.muted, textAlign: "center", marginBottom: 24, marginTop: 4 },
  authError:        { color: C.danger, fontSize: 13, marginBottom: 8, textAlign: "center" },
  tabRow:           { flexDirection: "row", marginBottom: 20, borderRadius: 8, overflow: "hidden", borderWidth: 1, borderColor: C.border },
  tab:              { flex: 1, paddingVertical: 10, alignItems: "center", backgroundColor: C.bg },
  tabActive:        { backgroundColor: C.accent },
  tabTxt:           { fontSize: 14, fontWeight: "500", color: C.accentSub },
  tabTxtActive:     { color: "#fff" },
  card:             { backgroundColor: C.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: C.border },
  cardBorrowed:     { backgroundColor: "#F2F2EF", borderColor: C.borrowed },
  cardTop:          { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  cardName:         { fontSize: 15, fontWeight: "600", color: C.accent, flex: 1, marginRight: 8 },
  cardNameBorrowed: { color: C.muted },
  cardDesc:         { fontSize: 13, color: C.accentSub, lineHeight: 18 },
  cardDescBorrowed: { color: C.borrowed },
  cardOwner:        { fontSize: 12, color: C.muted, marginTop: 6 },
  tag:              { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  tagFree:          { backgroundColor: C.tag },
  tagBorrowed:      { backgroundColor: C.tagB },
  tagTxt:           { fontSize: 11, fontWeight: "600" },
  tagTxtFree:       { color: C.tagTxt },
  tagTxtBorrowed:   { color: C.tagBTxt },
  fieldWrap:        { marginBottom: 12 },
  input:            { backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: C.accent },
  inputError:       { borderColor: C.danger },
  fieldError:       { color: C.danger, fontSize: 12, marginTop: 4 },
  addForm:          { padding: 16, borderBottomWidth: 1, borderColor: C.border, backgroundColor: C.surface },
  btn:              { backgroundColor: C.accent, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 18, alignItems: "center", flex: 1, justifyContent: "center", minHeight: 44 },
  btnGhost:         { backgroundColor: "transparent", borderWidth: 1, borderColor: C.border },
  btnDanger:        { backgroundColor: "transparent", borderWidth: 1, borderColor: C.danger },
  btnDisabled:      { opacity: 0.4 },
  btnTxt:           { color: "#fff", fontWeight: "600", fontSize: 14, textAlign: "center", width: "100%" },
  btnTxtGhost:      { color: C.accentSub },
  btnTxtDanger:     { color: C.danger },
  addBtn:           { backgroundColor: C.accent, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 },
  addBtnTxt:        { color: "#fff", fontWeight: "600", fontSize: 13 },
  logoutTxt:        { color: C.muted, fontSize: 14 },
  tabBar:           { flexDirection: "row", borderTopWidth: 1, borderColor: C.border, backgroundColor: C.surface },
  tabItem:          { flex: 1, alignItems: "center", paddingVertical: 12 },
  tabItemTxt:       { fontSize: 14, color: C.muted, fontWeight: "500" },
  tabItemTxtActive: { color: C.accent, fontWeight: "700" },
  tabIndicator:     { width: 20, height: 2, backgroundColor: C.accent, borderRadius: 1, marginTop: 4 },
  overlay:          { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  sheet:            { backgroundColor: C.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 36 },
  sheetHeader:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  sheetTitle:       { fontSize: 20, fontWeight: "700", color: C.accent, flex: 1 },
  closeBtn:         { fontSize: 18, color: C.muted, paddingLeft: 12 },
  sheetDesc:        { fontSize: 15, color: C.accentSub, lineHeight: 22, marginVertical: 12 },
  ownerLabel:       { fontSize: 12, color: C.muted, marginVertical: 6 },
  borrowedBy:       { fontSize: 13, color: C.accentSub, marginTop: 8, fontStyle: "italic" },
});
