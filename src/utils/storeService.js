import {
  collection, getDocs, doc, getDoc, addDoc, updateDoc, deleteDoc,
  setDoc, query, where, serverTimestamp
} from 'firebase/firestore';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { db, auth } from '../firebase/config';

// ─── Staff account credentials ────────────────────────────────────────────────

// Detect whether input is an email address
const isEmail = (input) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.trim());

// Create a staff account: stores credentials in staffAccounts + role in store staff subcollection
export const createStaffAccount = async ({ phoneNumber, email, password, name, storeId, storeSlug, role, addedBy }) => {
  const phone = phoneNumber ? phoneNumber.replace(/[^0-9+]/g, '') : '';
  // Use phone as doc key if available, otherwise sanitized email
  const docKey = phone || email.replace(/[^a-z0-9]/gi, '_');

  await setDoc(doc(db, 'staffAccounts', docKey), {
    phoneNumber: phone || null,
    email: email || null,
    password,
    name,
    storeId,
    storeSlug,
    role,
    createdAt: serverTimestamp(),
  }, { merge: true });

  await setDoc(doc(db, 'stores', storeId, 'staff', docKey), {
    role,
    name,
    phoneNumber: phone || null,
    email: email || null,
    addedBy,
    addedAt: serverTimestamp(),
  });
};

// Get all stores a user has access to (used after login for store selector)
export const getStoresForUser = async (phoneOrUid) => {
  const results = [];
  try {
    // Check staffAccounts for phone-based accounts
    const accountSnap = await getDoc(doc(db, 'staffAccounts', phoneOrUid));
    if (accountSnap.exists()) {
      const data = accountSnap.data();
      if (data.storeId) {
        const storeSnap = await getDoc(doc(db, 'stores', data.storeId));
        if (storeSnap.exists()) {
          results.push({ id: storeSnap.id, ...storeSnap.data(), myRole: data.role });
        }
      }
    }
    // Also check all stores' staff subcollections (handles Firebase Auth owners)
    if (results.length === 0) {
      const storesSnap = await getDocs(collection(db, 'stores'));
      for (const storeDoc of storesSnap.docs) {
        const staffSnap = await getDoc(doc(db, 'stores', storeDoc.id, 'staff', phoneOrUid));
        if (staffSnap.exists()) {
          results.push({ id: storeDoc.id, ...storeDoc.data(), myRole: staffSnap.data().role });
        }
      }
    }
  } catch (err) {
    console.error('getStoresForUser error:', err);
  }
  return results;
};

// Verify staff login — accepts email or phone + password
// Returns { storeSlug, storeId, role, name, phoneNumber, uid } or null
export const verifyStaffLogin = async (identifier, password) => {
  const input = identifier.trim();

  if (isEmail(input)) {
    // ── Email path ────────────────────────────────────────────────────────────

    // 1. Try staffAccounts by email field first (staff added with email)
    const emailQuery = query(collection(db, 'staffAccounts'), where('email', '==', input));
    const emailSnap = await getDocs(emailQuery);
    if (!emailSnap.empty) {
      const data = emailSnap.docs[0].data();
      if (data.password === password) {
        return { storeSlug: data.storeSlug, storeId: data.storeId, role: data.role, name: data.name, phoneNumber: data.phoneNumber || input };
      }
      return null; // email found but wrong password
    }

    // 2. Fall back to Firebase Auth (store owners created via SuperAdmin)
    try {
      const cred = await signInWithEmailAndPassword(auth, input, password);
      const uid = cred.user.uid;
      // Find which store this Firebase Auth user owns
      const storesSnap = await getDocs(collection(db, 'stores'));
      for (const storeDoc of storesSnap.docs) {
        const staffSnap = await getDoc(doc(db, 'stores', storeDoc.id, 'staff', uid));
        if (staffSnap.exists()) {
          const staffData = staffSnap.data();
          return {
            storeSlug: storeDoc.data().slug,
            storeId: storeDoc.id,
            role: staffData.role || 'owner',
            name: staffData.name || input,
            phoneNumber: uid,
          };
        }
      }
      // Firebase Auth succeeded but no staff role found — treat as owner of their store
      const ownedStore = storesSnap.docs.find(d => d.data().ownerId === uid);
      if (ownedStore) {
        return {
          storeSlug: ownedStore.data().slug,
          storeId: ownedStore.id,
          role: 'owner',
          name: input,
          phoneNumber: uid,
        };
      }
    } catch (authErr) {
      // Firebase Auth failed — wrong password or no Firebase account
      if (authErr.code === 'auth/wrong-password' || authErr.code === 'auth/invalid-credential') return null;
      if (authErr.code === 'auth/user-not-found') return null;
      throw authErr;
    }
    return null;

  } else {
    // ── Phone number path ─────────────────────────────────────────────────────
    const phone = input.replace(/[^0-9+]/g, '');
    const snap = await getDoc(doc(db, 'staffAccounts', phone));
    if (!snap.exists()) return null;
    const data = snap.data();
    if (data.password !== password) return null;
    return { storeSlug: data.storeSlug, storeId: data.storeId, role: data.role, name: data.name, phoneNumber: phone };
  }
};

// Get staff account by phone
export const getStaffAccount = async (phoneNumber) => {
  const phone = phoneNumber.replace(/[^0-9+]/g, '');
  const snap = await getDoc(doc(db, 'staffAccounts', phone));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

// Change staff password — verifies current password first
export const changeStaffPassword = async (phoneNumber, currentPassword, newPassword) => {
  const phone = phoneNumber.replace(/[^0-9+]/g, '');
  const snap = await getDoc(doc(db, 'staffAccounts', phone));
  if (!snap.exists()) throw new Error('Account not found.');
  if (snap.data().password !== currentPassword) throw new Error('Current password is incorrect.');
  if (!newPassword || newPassword.length < 4) throw new Error('New password must be at least 4 characters.');
  await updateDoc(doc(db, 'staffAccounts', phone), { password: newPassword });
};

// ─── Store CRUD ──────────────────────────────────────────────────────────────

export const getStoreBySlug = async (slug) => {
  const q = query(collection(db, 'stores'), where('slug', '==', slug));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
};

export const getStoreById = async (storeId) => {
  const d = await getDoc(doc(db, 'stores', storeId));
  return d.exists() ? { id: d.id, ...d.data() } : null;
};

export const getAllStores = async () => {
  const snap = await getDocs(collection(db, 'stores'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const getStoresByOwner = async (ownerId) => {
  const q = query(collection(db, 'stores'), where('ownerId', '==', ownerId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const createStore = async (storeData) => {
  const ref = await addDoc(collection(db, 'stores'), {
    ...storeData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
};

export const updateStore = async (storeId, data) => {
  await updateDoc(doc(db, 'stores', storeId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
};

export const slugify = (name) =>
  name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ─── Staff ───────────────────────────────────────────────────────────────────

// Called when a store is first created — registers the creator as owner
export const ensureOwnerRole = async (storeId, user) => {
  if (!storeId || !user?.phoneNumber) return;
  const ref = doc(db, 'stores', storeId, 'staff', user.phoneNumber);
  await setDoc(ref, {
    role: 'owner',
    name: user.name || user.displayName || user.phoneNumber,
    phoneNumber: user.phoneNumber,
    addedBy: user.phoneNumber,
    addedAt: serverTimestamp(),
  }, { merge: true });
};

export const getStoreStaff = async (storeId) => {
  const snap = await getDocs(collection(db, 'stores', storeId, 'staff'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const removeStaffMember = async (storeId, phoneNumber) => {
  await deleteDoc(doc(db, 'stores', storeId, 'staff', phoneNumber));
};

export const updateStaffRole = async (storeId, phoneNumber, newRole) => {
  await updateDoc(doc(db, 'stores', storeId, 'staff', phoneNumber), {
    role: newRole,
    updatedAt: serverTimestamp(),
  });
};

// ─── Invites ─────────────────────────────────────────────────────────────────

const generateCode = () =>
  Math.random().toString(36).substring(2, 6).toUpperCase() +
  Math.random().toString(36).substring(2, 6).toUpperCase();

export const createInvite = async (storeId, role, createdByPhone) => {
  const code = generateCode();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  await setDoc(doc(db, 'stores', storeId, 'invites', code), {
    code,
    role,
    storeId,
    createdBy: createdByPhone,
    createdAt: serverTimestamp(),
    expiresAt,
    usedBy: null,
    usedAt: null,
  });
  return code;
};

export const getInvite = async (storeId, code) => {
  const d = await getDoc(doc(db, 'stores', storeId, 'invites', code));
  return d.exists() ? { id: d.id, ...d.data() } : null;
};

export const acceptInvite = async (storeId, code, user) => {
  const inviteRef = doc(db, 'stores', storeId, 'invites', code);
  const inviteSnap = await getDoc(inviteRef);

  if (!inviteSnap.exists()) throw new Error('Invite not found.');

  const invite = inviteSnap.data();

  if (invite.usedBy) throw new Error('This invite has already been used.');
  if (invite.expiresAt?.toDate?.() < new Date()) throw new Error('This invite has expired.');

  // Write staff doc
  await setDoc(doc(db, 'stores', storeId, 'staff', user.phoneNumber), {
    role: invite.role,
    name: user.name || user.displayName || user.phoneNumber,
    phoneNumber: user.phoneNumber,
    addedBy: invite.createdBy,
    addedAt: serverTimestamp(),
  });

  // Mark invite as used
  await updateDoc(inviteRef, {
    usedBy: user.phoneNumber,
    usedAt: serverTimestamp(),
  });

  return invite.role;
};

export const getStoreInvites = async (storeId) => {
  const snap = await getDocs(collection(db, 'stores', storeId, 'invites'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const revokeInvite = async (storeId, code) => {
  await deleteDoc(doc(db, 'stores', storeId, 'invites', code));
};
