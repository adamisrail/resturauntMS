// All permission keys used throughout the admin panel
export const PERM = {
  // Dashboard
  VIEW_DASHBOARD: 'VIEW_DASHBOARD',
  VIEW_ANALYTICS: 'VIEW_ANALYTICS',

  // Products
  VIEW_PRODUCTS: 'VIEW_PRODUCTS',
  ADD_PRODUCT: 'ADD_PRODUCT',
  EDIT_PRODUCT: 'EDIT_PRODUCT',
  DELETE_PRODUCT: 'DELETE_PRODUCT',
  SEED_PRODUCTS: 'SEED_PRODUCTS',

  // Orders
  VIEW_ORDERS: 'VIEW_ORDERS',
  MANAGE_ORDERS: 'MANAGE_ORDERS',   // mark ready, clear table

  // Staff
  VIEW_STAFF: 'VIEW_STAFF',
  INVITE_MANAGER: 'INVITE_MANAGER',
  INVITE_STAFF: 'INVITE_STAFF',
  REMOVE_STAFF: 'REMOVE_STAFF',

  // Store
  EDIT_SETTINGS: 'EDIT_SETTINGS',
  MANAGE_TABLES: 'MANAGE_TABLES',
};

const OWNER_PERMS = new Set(Object.values(PERM));

const MANAGER_PERMS = new Set([
  PERM.VIEW_DASHBOARD,
  PERM.VIEW_ANALYTICS,
  PERM.VIEW_PRODUCTS,
  PERM.ADD_PRODUCT,
  PERM.EDIT_PRODUCT,
  PERM.VIEW_ORDERS,
  PERM.MANAGE_ORDERS,
  PERM.VIEW_STAFF,
  PERM.INVITE_STAFF,
  PERM.SEED_PRODUCTS,
]);

const STAFF_PERMS = new Set([
  PERM.VIEW_DASHBOARD,
  PERM.VIEW_PRODUCTS,
  PERM.VIEW_ORDERS,
  PERM.MANAGE_ORDERS,
]);

export const PERMISSIONS = {
  owner: OWNER_PERMS,
  manager: MANAGER_PERMS,
  staff: STAFF_PERMS,
};

// Returns true if role has the given permission
export const can = (role, permission) => {
  if (!role || !PERMISSIONS[role]) return false;
  return PERMISSIONS[role].has(permission);
};

export const ROLE_LABELS = {
  owner: 'Owner',
  manager: 'Manager',
  staff: 'Staff',
};

export const ROLE_COLORS = {
  owner: '#25D366',
  manager: '#4dabf7',
  staff: '#8696a0',
};
