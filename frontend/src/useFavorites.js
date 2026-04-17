import { useEffect, useRef, useState } from 'react';
import { api } from './store';

const storageKey = 'freshshop:favorites';
function readGuestIds() {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) || '[]');
    return Array.isArray(stored)
      ? [...new Set(stored.filter((id) => Number.isSafeInteger(id) && id > 0))].slice(0, 100)
      : [];
  } catch {
    return [];
  }
}

export function useFavorites({ user, task }) {
  const [guestIds, setGuestIds] = useState(readGuestIds);
  const [products, setProducts] = useState([]);
  const [state, setState] = useState({ loading: false, error: '' });
  const [attempt, setAttempt] = useState(0);
  const currentAccount = useRef(user?.id || null);
  currentAccount.current = user?.id || null;

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(guestIds));
    } catch {
      /* Guest choices remain available in memory if storage is unavailable. */
    }
  }, [guestIds]);
  useEffect(() => {
    let active = true;
    setProducts([]);
    if (!user) {
      setState({ loading: false, error: '' });
      return () => {
        active = false;
      };
    }
    setState({ loading: true, error: '' });
    api('/wishlist')
      .then((data) => {
        if (active) {
          setProducts(data);
          setState({ loading: false, error: '' });
        }
      })
      .catch((error) => {
        if (active) setState({ loading: false, error: error.message });
