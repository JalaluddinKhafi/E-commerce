import { createContext, useContext, useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { api, cleared, received, signedOut } from './store';
import { Catalog, ProductDetail, Wishlist } from './Catalog';
import { AccountProfile, Auth, OrdersPage } from './Account';
import { CartPage, CheckoutPage } from './Cart';
import Admin from './Admin';
import { useFavorites } from './useFavorites';
import { AddressesPage } from './Addresses';

const ShopContext = createContext(null);
export const useShop = () => useContext(ShopContext);
export const money = (cents) =>
  new Intl.NumberFormat('fa-AF', { style: 'currency', currency: 'USD' }).format(cents / 100);
export const date = (value) => new Date(value).toLocaleString('fa-AF');
export const statusName = (value) =>
  ({
    PLACED: 'ثبت شده',
    PROCESSING: 'در حال آماده‌سازی',
    SHIPPED: 'ارسال شده',
    DELIVERED: 'تحویل شده',
    CANCELLED: 'لغو شده',
  })[value] || value;

export function useLoad(path, revision = 0) {
  const [state, setState] = useState({ loading: true, data: null, error: '' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    if (!path) {
      setState({ loading: false, data: null, error: '' });
      return () => {
    setState({ loading: true, data: null, error: '' });
    api(path)
      .then((data) => active && setState({ loading: false, data, error: '' }))
      .catch((error) => active && setState({ loading: false, data: null, error: error.message }));
    return () => {
      active = false;
    };
  }, [path, revision, attempt]);
  return { ...state, retry: () => setAttempt((a) => a + 1) };
}
export function LoadState({ resource, children }) {
  if (resource.loading)
    return (
      <div className="empty" role="status">
        در حال بارگذاری…
      </div>
    );
  if (resource.error)
    return (
      <div className="empty" role="alert">
        <p>{resource.error}</p>
        <button onClick={resource.retry}>تلاش دوباره</button>
      </div>
    );
  return children;
}
export function Protected({ children, admin = false }) {
  const user = useSelector((s) => s.session.user);
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (admin && user.role !== 'ADMIN') return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const user = useSelector((s) => s.session.user);
  const cart = useSelector((s) => s.cart);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [cartState, setCartState] = useState({ loading: false, error: '' });
  const [favorites, setFavorites] = useState(() => {
    try {
      const ids = JSON.parse(localStorage.getItem('freshshop:favorites') || '[]');
      return Array.isArray(ids) ? ids.filter(Number.isSafeInteger) : [];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    let active = true;
    if (user) {
      setCartState({ loading: true, error: '' });
      api('/cart')
        .then((data) => {
          if (active) {
            dispatch(received(data));
            setCartState({ loading: false, error: '' });
          }
        })
        .catch((error) => {
          if (active) setCartState({ loading: false, error: error.message });
        });
    } else {
      dispatch(cleared());
      setCartState({ loading: false, error: '' });
    }
    return () => {
      active = false;
    };
  }, [user?.id, revision, dispatch]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);
  useEffect(() => {
    if (!notice || notice.error) return;
    const timeout = setTimeout(() => setNotice(null), 4500);
    return () => clearTimeout(timeout);
  }, [notice]);

  async function task(action, success) {
    setBusy(true);
    setNotice(null);
    try {
      await action();
      if (success) setNotice({ text: success });
      return true;
    } catch (error) {
      setNotice({ error: true, text: error.message });
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function setQuantity(id, quantity) {
    return task(async () => {
      dispatch(received(await api(`/cart/${id}`, { method: 'PUT', body: { quantity } })));
    });
  }
  async function add(product) {
    if (!user) {
      navigate('/login', { state: { from: location.pathname } });
      return;
    }
    const quantity = (cart.items.find((i) => i.product.id === product.id)?.quantity || 0) + 1;
    if (await setQuantity(product.id, quantity)) setNotice({ text: 'به سبد خرید اضافه شد.' });
  }
  function favorite(id) {
    setFavorites((previous) => {
      const next = previous.includes(id) ? previous.filter((i) => i !== id) : [...previous, id];
      try {
        localStorage.setItem('freshshop:favorites', JSON.stringify(next));
      } catch {
        /* In-memory favorites still work. */
      }
      return next;
    });
  }
  const context = {
    busy,
    task,
    add,
    setQuantity,
    revision,
    refresh: () => setRevision((v) => v + 1),
    favorites,
    favorite,
    cartState,
  };
  return (
    <ShopContext.Provider value={context}>
      <a className="skip" href="#main">
        رفتن به محتوا
      </a>
      <div className="announcement">
        تازگی هر روز، درِ خانهٔ شما <span>ارسال رایگان برای سفارش‌های بالاتر از {money(5000)}</span>
      </div>
      <header>
        <div className="shell header-inner">
          <Link className="brand" to="/" aria-label="تازه‌مارکت، صفحه اصلی">
            <span className="brand-mark">❧</span>
            <span>
              تازه‌مارکت<small>از باغ تا خانه</small>
            </span>
          </Link>
          <nav aria-label="ناوبری اصلی">
            <Link to="/">فروشگاه</Link>
            <Link to="/wishlist">
              علاقه‌مندی‌ها <span className="count">{favorites.length}</span>
            </Link>
            {user && <Link to="/orders">سفارش‌ها</Link>}
            {user && <Link to="/account">حساب من</Link>}
            {user?.role === 'ADMIN' && <Link to="/admin">مدیریت</Link>}
          </nav>
          <div className="header-actions">
            <Link className="cart-link" to="/cart">
              سبد خرید{' '}
              <span className="count">{cart.items.reduce((n, i) => n + i.quantity, 0)}</span>
            </Link>
            {user ? (
              <button
                className="quiet"
                onClick={() => {
                  dispatch(signedOut());
                  dispatch(cleared());
                  navigate('/');
                }}
              >
                خروج · {user.name}
              </button>
            ) : (
              <Link className="quiet" to="/login">
                ورود / ثبت‌نام
              </Link>
            )}
          </div>
        </div>
      </header>
      {notice && (
        <div
          className={`notice ${notice.error ? 'error' : ''}`}
          role={notice.error ? 'alert' : 'status'}
        >
          <span>{notice.text}</span>
          <button aria-label="بستن پیام" onClick={() => setNotice(null)}>
            ×
          </button>
        </div>
      )}
      <main id="main">
        <Routes>
          <Route path="/" element={<Catalog />} />
          <Route path="/products/:id" element={<ProductDetail />} />
          <Route path="/wishlist" element={<Wishlist />} />
          <Route path="/login" element={<Auth />} />
          <Route path="/register" element={<Auth register />} />
          <Route
            path="/account"
            element={
              <Protected>
                <AccountProfile />
              </Protected>
            }
          />
          <Route
            path="/cart"
            element={
              <Protected>
                <CartPage />
              </Protected>
            }
          />
          <Route
            path="/checkout"
            element={
              <Protected>
                <CheckoutPage />
              </Protected>
            }
          />
          <Route
            path="/orders"
            element={
              <Protected>
                <OrdersPage />
              </Protected>
            }
          />
          <Route
            path="/admin"
            element={
              <Protected admin>
                <Admin />
              </Protected>
            }
          />
          <Route
            path="*"
            element={
              <section className="shell empty">
                <h1>صفحه پیدا نشد</h1>
                <Link className="button" to="/">
                  بازگشت به فروشگاه
                </Link>
              </section>
            }
          />
        </Routes>
      </main>
      <footer>
        <div className="shell footer-inner">
          <div>
            <strong>تازه‌مارکت</strong>
            <p>انتخاب‌های تازه برای زندگی روزمره.</p>
          </div>
          <div>
            <Link to="/">خرید محصولات</Link>
            <Link to="/orders">پیگیری سفارش</Link>
            <span>پرداخت هنگام تحویل · قیمت‌ها به دالر امریکا</span>
          </div>
        </div>
        <div className="shell footer-note">
          ارسال {money(500)}؛ سفارش‌های {money(5000)} و بیشتر رایگان. پرداخت آنلاین هنوز فعال نشده
          است.
        </div>
      </footer>
    </ShopContext.Provider>
  );
}
