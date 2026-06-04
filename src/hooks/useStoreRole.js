import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useStore } from '../contexts/StoreContext';
import { can } from '../utils/permissions';

const useStoreRole = (user) => {
  const { store } = useStore();
  const [role, setRole] = useState(null);
  const [staffDoc, setStaffDoc] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!store?.id || !user?.phoneNumber) {
      setLoading(false);
      return;
    }

    const fetchRole = async () => {
      try {
        const ref = doc(db, 'stores', store.id, 'staff', user.phoneNumber);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          setRole(data.role);
          setStaffDoc({ id: snap.id, ...data });
        } else {
          setRole(null);
          setStaffDoc(null);
        }
      } catch (err) {
        console.error('Error fetching staff role:', err);
        setRole(null);
      } finally {
        setLoading(false);
      }
    };

    fetchRole();
  }, [store?.id, user?.phoneNumber]);

  return {
    role,
    staffDoc,
    loading,
    isOwner: role === 'owner',
    isManager: role === 'manager',
    isStaff: role === 'staff',
    hasAccess: role !== null,
    can: (permission) => can(role, permission),
  };
};

export default useStoreRole;
