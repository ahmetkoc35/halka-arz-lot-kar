import { useEffect, useState } from 'react';

import { verifyAdminSecret } from '../services/tablesApi';

const STORAGE_KEY = 'halkaArzAdminToken';

export const useAdminMode = () => {
  const [adminToken, setAdminToken] = useState(() => window.localStorage.getItem(STORAGE_KEY) ?? '');
  const [activationError, setActivationError] = useState('');
  const isAdmin = Boolean(adminToken);

  const activateAdmin = async (secret: string) => {
    try {
      await verifyAdminSecret(secret);
      window.localStorage.setItem(STORAGE_KEY, secret);
      setAdminToken(secret);
      setActivationError('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Admin sırrı geçersiz.';
      setActivationError(message);
      window.localStorage.removeItem(STORAGE_KEY);
      setAdminToken('');
      throw error;
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const secret = params.get('admin');
    if (!secret) return;

    activateAdmin(secret)
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
    activateAdmin,
    activationError,
    isAdmin,
    deactivateAdmin
  };
};
