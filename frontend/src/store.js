import { configureStore, createSlice } from '@reduxjs/toolkit';

const session = createSlice({
  name: 'session',
  initialState: { token: null, user: null },
  reducers: {
    signedIn: (_, action) => action.payload,
    signedOut: () => ({ token: null, user: null }),
  },
});
const cart = createSlice({
  name: 'cart',
  initialState: { items: [], subtotalCents: 0, shippingCents: 0, totalCents: 0 },
  reducers: {
    received: (_, action) => action.payload,
    cleared: () => ({ items: [], subtotalCents: 0, shippingCents: 0, totalCents: 0 }),
  },
});
export const { signedIn, signedOut } = session.actions;
export const { received, cleared } = cart.actions;
export const store = configureStore({ reducer: { session: session.reducer, cart: cart.reducer } });

export async function api(path, options = {}) {
  const token = store.getState().session.token;
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  if (response.status === 401 && token) {
    store.dispatch(signedOut());
    store.dispatch(cleared());
    throw new Error('نشست شما پایان یافت. دوباره وارد شوید.');
  }
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      data?.message ||
        (response.status === 403
          ? 'اجازهٔ دسترسی ندارید.'
          : 'درخواست انجام نشد. دوباره تلاش کنید.'),
    );
  return data;
}
