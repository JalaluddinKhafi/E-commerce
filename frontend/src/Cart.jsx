import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { api, cleared } from './store';
import { money, useShop } from './App';
import { DeliveryAddressPicker } from './Addresses';

function Summary({ cart, children }) {
  return (
    <aside className="panel summary">
      <h2>خلاصهٔ سفارش</h2>
      <div>
        <span>جمع کالاها</span>
        <strong>{money(cart.subtotalCents)}</strong>
      </div>
      <div>
        <span>ارسال</span>
        <strong>{cart.shippingCents === 0 ? 'رایگان' : money(cart.shippingCents)}</strong>
      </div>
      <div className="summary-total">
        <span>مبلغ نهایی</span>
        <strong>{money(cart.totalCents)}</strong>
      </div>
      <p className="muted">ارسال رایگان از {money(5000)}. پرداخت هنگام تحویل.</p>
      {children}
    </aside>
  );
}
function CartLoading({ state, retry }) {
  return (
    <section className="shell page empty" role={state.error ? 'alert' : 'status'}>
      {state.error ? (
        <>
          <p>{state.error}</p>
          <button onClick={retry}>تلاش دوباره</button>
        </>
      ) : (
        'در حال بارگذاری سبد…'
      )}
    </section>
  );
}
export function CartPage() {
  const cart = useSelector((s) => s.cart);
  const { busy, setQuantity, cartState, refresh } = useShop();
  if (cartState.loading || cartState.error)
    return <CartLoading state={cartState} retry={refresh} />;
  return (
    <section className="shell page">
      <span className="eyebrow">انتخاب‌های تازهٔ شما</span>
      <h1>سبد خرید</h1>
      {!cart.items.length ? (
        <div className="empty">
          <h2>سبد شما هنوز خالی است</h2>
          <p>از میان محصولات تازه انتخاب کنید.</p>
          <Link className="button" to="/">
            رفتن به فروشگاه
          </Link>
        </div>
      ) : (
        <div className="cart-layout">
          <div className="panel cart-items">
            {cart.items.map(({ product: p, quantity }) => (
              <article className="cart-row" key={p.id}>
                <Link to={`/products/${p.id}`}>
                  <img src={p.image} alt={p.name} />
                </Link>
                <div>
                  <Link to={`/products/${p.id}`}>
                    <h3>{p.name}</h3>
                  </Link>
                  <p className="muted">{money(p.priceCents)} / عدد</p>
                  {(!p.active || p.stock < quantity) && (
                    <p className="text-error">
                      موجودی تغییر کرده؛ تعداد را کم یا کالا را حذف کنید.
                    </p>
                  )}
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() => setQuantity(p.id, 0)}
                  >
                    حذف {p.name}
                  </button>
                </div>
                <div className="quantity">
                  <button
                    aria-label={`کاهش تعداد ${p.name}`}
                    disabled={busy || quantity <= 1}
                    onClick={() => setQuantity(p.id, quantity - 1)}
                  >
                    −
                  </button>
                  <output aria-label={`تعداد ${p.name}`}>{quantity}</output>
                  <button
                    aria-label={`افزایش تعداد ${p.name}`}
                    disabled={busy || quantity >= Math.min(p.stock, 99)}
                    onClick={() => setQuantity(p.id, quantity + 1)}
                  >
                    +
                  </button>
                </div>
                <strong>{money(p.priceCents * quantity)}</strong>
              </article>
            ))}
          </div>
          <Summary cart={cart}>
            <Link className="button wide" to="/checkout">
              ادامه و ثبت سفارش ←
            </Link>
            <Link className="back" to="/">
              ادامهٔ خرید
            </Link>
          </Summary>
        </div>
      )}
    </section>
  );
}
export function CheckoutPage() {
  const cart = useSelector((s) => s.cart);
  const user = useSelector((s) => s.session.user);
  const { busy, task, refresh, cartState } = useShop();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [recipient, setRecipient] = useState(user?.name || '');
  // Keep the key across failed requests, including a lost response after a successful commit.
  const [requestKey] = useState(() => crypto.randomUUID());
  const [submitted, setSubmitted] = useState(false);
  async function submit(event) {
    event.preventDefault();
    if (submitted) return;
    await task(async () => {
      try {
        await api('/orders', {
          method: 'POST',
          body: { address, phone, recipient, requestKey, expectedTotalCents: cart.totalCents },
        });
      } catch (error) {
        refresh();
        throw error;
      }
      setSubmitted(true);
      dispatch(cleared());
      refresh();
      navigate('/orders', { replace: true });
    }, 'سفارش شما با موفقیت ثبت شد.');
  }
  if (cartState.loading || cartState.error)
    return <CartLoading state={cartState} retry={refresh} />;
  if (!cart.items.length)
    return (
      <section className="shell page empty">
        <h1>سبد شما خالی است</h1>
        <Link className="button" to="/">
          انتخاب محصولات
        </Link>
      </section>
    );
  return (
    <section className="shell page">
      <span className="eyebrow">آخرین قدم تا تازگی</span>
      <h1>ثبت سفارش</h1>
      <div className="cart-layout">
        <form id="checkout" className="panel checkout-form" onSubmit={submit}>
          <h2>مشخصات تحویل</h2>
          <DeliveryAddressPicker
            onSelect={(entry) => {
              setAddress(entry?.address || '');
              setPhone(entry?.phone || '');
              setRecipient(entry?.recipient || user.name);
            }}
          />
          <label>
            نام گیرنده
            <input
              required
          <label>
            نشانی کامل
            <textarea
              autoComplete="street-address"
              required
              maxLength={500}
              rows={4}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="شهر، خیابان، کوچه و شمارهٔ خانه"
            />
          </label>
          <label>
            شماره تلفن
            <input
              type="tel"
              autoComplete="tel"
              dir="ltr"
              required
              minLength={5}
              maxLength={40}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>
          <div className="payment">
            <strong>پرداخت هنگام تحویل</strong>
            <p>اطلاعات کارت بانکی درخواست نمی‌شود. مبلغ نهایی را هنگام دریافت سفارش پرداخت کنید.</p>
          </div>
          <p className="muted">قیمت و موجودی در لحظهٔ ثبت، دوباره در سرور بررسی می‌شود.</p>
        </form>
        <Summary cart={cart}>
          <button form="checkout" className="wide" disabled={busy || submitted}>
            {busy ? 'در حال ثبت…' : 'تأیید و ثبت سفارش'}
          </button>
          <Link className="back" to="/cart">
            بازگشت به سبد
          </Link>
        </Summary>
      </div>
    </section>
  );
}
