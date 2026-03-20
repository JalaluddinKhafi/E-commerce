import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { api, cleared, signedIn, signedOut } from './store';
import { date, LoadState, money, statusName, useLoad, useShop } from './App';

export function Auth({ register = false }) {
  const user = useSelector((s) => s.session.user);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { task, busy } = useShop();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const requested = location.state?.from;
  const target =
    typeof requested === 'string' &&
    requested.startsWith('/') &&
    !requested.startsWith('//') &&
    !['/login', '/register'].includes(requested)
      ? requested
      : '/';
  if (user) return <Navigate to={target} replace />;
  async function submit(event) {
    event.preventDefault();
    await task(
      async () => {
        const session = await api(`/auth/${register ? 'register' : 'login'}`, {
          method: 'POST',
          body: { ...(register ? { name } : {}), email, password },
        });
        dispatch(signedIn(session));
        setPassword('');
        navigate(target, { replace: true });
      },
      register ? 'حساب شما ساخته شد.' : 'خوش آمدید.',
    );
  }
  return (
    <section className="shell page auth-layout">
      <div className="auth-intro">
        <span className="eyebrow">خوش آمدید به تازه‌مارکت</span>
        <h1>
          سبد تازهٔ شما،
          <br />
          همین‌جا منتظر است.
        </h1>
        <p>سفارش‌ها و سبد خرید به حساب شما متصل است. برای شروع وارد شوید یا یک حساب بسازید.</p>
        <span className="auth-leaf" aria-hidden="true">
          ❧
        </span>
      </div>
      <form className="panel auth-form" onSubmit={submit}>
        <h2>{register ? 'ساخت حساب' : 'ورود به حساب'}</h2>
        {register && (
          <label>
            نام شما
            <input
              autoComplete="name"
              required
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
        )}
        <label>
          ایمیل
          <input
            type="email"
            dir="ltr"
            autoComplete="email"
            required
            maxLength={254}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          رمز عبور
          <input
            type="password"
            dir="ltr"
            autoComplete={register ? 'new-password' : 'current-password'}
            minLength={register ? 12 : undefined}
            maxLength={72}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {register && <p className="muted">رمز عبور حداقل ۱۲ نویسه و حداکثر ۷۲ بایت باشد.</p>}
        <button className="wide" disabled={busy}>
          {busy ? 'لطفاً صبر کنید…' : register ? 'ساخت حساب' : 'ورود'}
        </button>
        <p>
          {register ? 'حساب دارید؟ ' : 'تازه به ما پیوسته‌اید؟ '}
          <Link to={register ? '/login' : '/register'} state={location.state}>
            {register ? 'وارد شوید' : 'ثبت‌نام کنید'}
          </Link>
        </p>
        <p className="muted">برای امنیت، پس از بازکردن دوبارهٔ صفحه وارد حساب شوید.</p>
      </form>
    </section>
  );
}

export function OrderCard({ order, children }) {
  return (
    <article className="panel order-card">
      <div className="order-heading">
        <div>
          <strong>سفارش #{order.id}</strong>
          <p className="muted">{date(order.createdAt)}</p>
        </div>
        <span className={`badge status-${order.status.toLowerCase()}`}>
          {statusName(order.status)}
        </span>
      </div>
      <div className="order-items">
        {order.items.map((i) => (
          <div className="order-line" key={i.productId}>
            <img src={i.image} alt="" />
            <span>
              {i.name}
              <small>
                {i.quantity} × {money(i.priceCents)}
              </small>
            </span>
            <strong>{money(i.quantity * i.priceCents)}</strong>
          </div>
        ))}
      </div>
      <div className="order-footer">
        <div>
          {order.recipient && <p>گیرنده: {order.recipient}</p>}
          <p>نشانی: {order.address}</p>
          <p>
            تلفن: <bdi>{order.phone}</bdi>
          </p>
        </div>
        <div>
          <p>ارسال: {money(order.shippingCents)}</p>
          <strong>مجموع: {money(order.totalCents)}</strong>
          <small>پرداخت هنگام تحویل</small>
        </div>
      </div>
      {children}
    </article>
  );
}
export function OrdersPage() {
  const { revision, task, busy, refresh } = useShop();
  const [confirmId, setConfirmId] = useState(null);
  const resource = useLoad('/orders', revision);
  async function cancel(orderId) {
    await task(async () => {
      try {
        await api(`/orders/${orderId}/cancel`, { method: 'POST' });
        setConfirmId(null);
      } finally {
        // Refresh even after a conflict: a manager may have started preparation.
        refresh();
      }
    }, 'سفارش لغو شد.');
  }
  return (
    <section className="shell page">
      <span className="eyebrow">از ثبت تا تحویل</span>
      <h1>سفارش‌های من</h1>
      <LoadState resource={resource}>
        {resource.data?.length ? (
          <div className="order-list">
            {resource.data.map((o) => (
              <OrderCard key={o.id} order={o}>
                {o.status === 'PLACED' && (
                  <div className="order-actions">
                    {confirmId === o.id ? (
                      <>
                        <p>این سفارش لغو شود؟ موجودی کالاها به فروشگاه برمی‌گردد.</p>
                        <div className="actions">
                          <button disabled={busy} onClick={() => cancel(o.id)}>
                            تأیید لغو سفارش #{o.id}
                          </button>
                          <button
                            className="outline"
                            disabled={busy}
                            onClick={() => setConfirmId(null)}
                          >
                            انصراف
                          </button>
                        </div>
                      </>
                    ) : (
                      <button
                        className="outline"
                        disabled={busy}
                        onClick={() => setConfirmId(o.id)}
                      >
                        لغو سفارش #{o.id}
                      </button>
                    )}
                  </div>
                )}
              </OrderCard>
            ))}
          </div>
        ) : (
          <div className="empty">
            <h2>هنوز سفارشی ندارید</h2>
            <Link className="button" to="/">
              شروع خرید
            </Link>
          </div>
        )}
      </LoadState>
    </section>
  );
}

export function AccountProfile() {
  const { user, token } = useSelector((s) => s.session);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { task, busy } = useShop();
  const [name, setName] = useState(user.name);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  function endSession() {
    dispatch(signedOut());
    dispatch(cleared());
    navigate('/login', { replace: true });
  }
  async function saveProfile(event) {
    event.preventDefault();
    await task(async () => {
      const updated = await api('/account/profile', { method: 'PUT', body: { name } });
      dispatch(signedIn({ user: updated, token }));
      setName(updated.name);
    }, 'نام شما به‌روز شد.');
  }
  async function changePassword(event) {
    event.preventDefault();
    await task(async () => {
      if (newPassword !== confirmation) throw new Error('تکرار رمز عبور مطابقت ندارد.');
      await api('/account/password', { method: 'POST', body: { currentPassword, newPassword } });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmation('');
      endSession();
    }, 'رمز تغییر کرد و همهٔ نشست‌ها بسته شدند. با رمز جدید وارد شوید.');
  }
  async function signOutAll() {
    await task(async () => {
      await api('/account/logout-all', { method: 'POST' });
      endSession();
    }, 'همهٔ نشست‌های حساب بسته شدند.');
  }
  return (
    <section className="shell page">
      <span className="eyebrow">اطلاعات و امنیت حساب</span>
      <h1>حساب من</h1>
      <div className="form-grid">
        <form className="panel" onSubmit={saveProfile} aria-labelledby="profile-title">
          <h2 id="profile-title">اطلاعات شخصی</h2>
          <label>
            نام شما
            <input
              required
              maxLength={100}
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            ایمیل حساب
            <input type="email" dir="ltr" value={user.email} readOnly />
          </label>
          <p className="muted">ایمیل ورود در این بخش قابل تغییر نیست.</p>
          <button disabled={busy}>ذخیرهٔ نام</button>
        </form>
        <form className="panel" onSubmit={changePassword} aria-labelledby="password-title">
          <h2 id="password-title">تغییر رمز عبور</h2>
          <label>
            رمز فعلی
            <input
              type="password"
              dir="ltr"
              autoComplete="current-password"
              required
              maxLength={72}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </label>
          <label>
            رمز جدید
            <input
              type="password"
              dir="ltr"
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={72}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </label>
          <label>
            تکرار رمز جدید
            <input
              type="password"
              dir="ltr"
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={72}
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
            />
          </label>
          <p className="muted">
            حداقل ۱۲ نویسه و حداکثر ۷۲ بایت. پس از تغییر رمز، همهٔ دستگاه‌ها باید دوباره وارد شوند.
          </p>
          <button disabled={busy}>تغییر رمز و خروج از همهٔ نشست‌ها</button>
        </form>
      </div>
      <section className="panel order-actions">
        <h2>امنیت نشست‌ها</h2>
        <p>اگر حساب را روی دستگاه دیگری باز کرده‌اید، می‌توانید همهٔ نشست‌ها را هم‌زمان ببندید.</p>
        {confirmSignOut ? (
          <div className="actions">
            <button disabled={busy} onClick={signOutAll}>
              تأیید خروج از همهٔ نشست‌ها
            </button>
            <button className="outline" disabled={busy} onClick={() => setConfirmSignOut(false)}>
              انصراف
            </button>
          </div>
        ) : (
          <button className="outline" disabled={busy} onClick={() => setConfirmSignOut(true)}>
            خروج از همهٔ نشست‌ها
          </button>
        )}
      </section>
    </section>
  );
}
