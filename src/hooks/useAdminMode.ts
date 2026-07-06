import { useEffect, useState } from 'react';

import { verifyAdminSecret } from '../services/tablesApi';

const STORAGE_KEY = 'halkaArzAdminToken';

export const useAdminMode = () => {
  const [adminToken, setAdminToken] = useState(() => window.localStorage.getItem(STORAGE_KEY) ?? '');
  const [activationError, setActivationError] = useState('');
  const isAdmin = Boolean(adminToken);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const secret = params.get('admin');
    if (!secret) return;

    verifyAdminSecret(secret)
      .then(() => {
        window.localStorage.setItem(STORAGE_KEY, secret);
        setAdminToken(secret);
        setActivationError('');
      })
      .catch((error: Error) => {
        setActivationError(error.message);
        window.localStorage.removeItem(STORAGE_KEY);
        setAdminToken('');
      })
      .finally(() => {
        params.delete('admin');
        const nextSearch = params.toString();
        const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`;
        window.history.replaceState(null, '', nextUrl);
      });
  }, []);

  const deactivateAdmin = () => {
    window.localStorage.removeItem(STORAGE_KEY);
    setAdminToken('');
  };

  return {
    adminToken,
    activationError,
    isAdmin,
    deactivateAdmin
  };
};
