import { useState } from 'react';
import { api } from './store';
import { LoadState, money, statusName, useLoad, useShop } from './App';
import { OrderCard } from './Account';

const blankProduct = {
  name: '',
  description: '',
  category: 'Vegetables',
  image: '/images/img-pro-01.jpg',
  priceCents: 100,
  stock: 0,
  active: true,
};
const nextStatuses = {
  PLACED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
};

export default function Admin() {
  const { revision, task, busy, refresh } = useShop();
  const products = useLoad('/admin/products', revision);
  const orders = useLoad('/admin/orders', revision);
  const [tab, setTab] = useState('products');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ ...blankProduct });
  const [confirmArchive, setConfirmArchive] = useState(null);
  function edit(p) {
    setEditing(p.id || 'new');
    setForm({ ...p });
  }
  function field(name, value) {
    setForm((f) => ({ ...f, [name]: value }));
  }
  async function save(event) {
    event.preventDefault();
    await task(async () => {
      const { name, description, category, image, priceCents, stock, active } = form;
      await api(editing === 'new' ? '/admin/products' : `/admin/products/${editing}`, {
        method: editing === 'new' ? 'POST' : 'PUT',
        body: { name, description, category, image, priceCents, stock, active },
      });
      setEditing(null);
      refresh();
    }, 'محصول ذخیره شد.');
  }
  async function archive(id) {
    await task(async () => {
      await api(`/admin/products/${id}`, { method: 'DELETE' });
      setConfirmArchive(null);
      refresh();
    }, 'محصول از فروشگاه پنهان شد.');
  }
  async function updateStatus(id, status) {
    await task(async () => {
      await api(`/admin/orders/${id}`, { method: 'PATCH', body: { status } });
      refresh();
    }, 'وضعیت سفارش به‌روز شد.');
  }
  return (
    <section className="shell page">
      <span className="eyebrow">پنل مدیریت</span>
      <h1>پشت صحنهٔ تازه‌مارکت</h1>
      <div className="stats">
        <div className="panel">
          <span>محصولات</span>
          <strong>{products.data?.length ?? '—'}</strong>
        </div>
        <div className="panel">
          <span>سفارش‌ها</span>
          <strong>{orders.data?.length ?? '—'}</strong>
        </div>
        <div className="panel">
          <span>مبلغ سفارش‌های لغونشده</span>
          <strong>
            {orders.data
              ? money(
                  orders.data
                    .filter((o) => o.status !== 'CANCELLED')
                    .reduce((sum, o) => sum + o.totalCents, 0),
                )
              : '—'}
          </strong>
        </div>
      </div>
      <div className="toolbar">
        <div className="tabs">
          <button className={tab === 'products' ? 'active' : ''} onClick={() => setTab('products')}>
            مدیریت محصولات
          </button>
          <button className={tab === 'orders' ? 'active' : ''} onClick={() => setTab('orders')}>
            مدیریت سفارش‌ها
          </button>
        </div>
        {tab === 'products' && (
          <button disabled={busy} onClick={() => edit(blankProduct)}>
            محصول جدید +
          </button>
        )}
      </div>
      {tab === 'products' ? (
        <>
          <LoadState resource={products}>
            <div className="panel table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>محصول</th>
                    <th>قیمت</th>
                    <th>موجودی</th>
                    <th>وضعیت</th>
                    <th>عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {products.data?.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div className="table-product">
                          <img src={p.image} alt="" />
                          <span>
                            {p.name}
                            <small>{p.category}</small>
                          </span>
                        </div>
                      </td>
                      <td>{money(p.priceCents)}</td>
                      <td>{p.stock}</td>
                      <td>{p.active ? 'فعال' : 'پنهان'}</td>
                      <td>
                        <div className="actions">
                          <button className="outline" disabled={busy} onClick={() => edit(p)}>
                            ویرایش
                          </button>
                          {p.active &&
                            (confirmArchive === p.id ? (
                              <>
                                <button
                                  className="danger"
                                  disabled={busy}
                                  onClick={() => archive(p.id)}
                                >
                                  تأیید پنهان‌کردن
                                </button>
                                <button className="quiet" onClick={() => setConfirmArchive(null)}>
                                  انصراف
                                </button>
                              </>
                            ) : (
                              <button
                                className="text-button"
                                disabled={busy}
                                onClick={() => setConfirmArchive(p.id)}
                              >
                                پنهان‌کردن
                              </button>
                            ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </LoadState>
          {editing && (
            <form className="panel product-form" onSubmit={save}>
              <div className="section-heading">
                <h2>{editing === 'new' ? 'افزودن محصول' : 'ویرایش محصول'}</h2>
                <button type="button" className="quiet" onClick={() => setEditing(null)}>
                  بستن ×
                </button>
              </div>
              <div className="form-grid">
                <label>
                  نام محصول
                  <input
                    autoFocus
                    required
                    maxLength={120}
                    value={form.name}
                    onChange={(e) => field('name', e.target.value)}
                  />
                </label>
                <label>
                  دسته‌بندی
                  <input
                    required
                    maxLength={60}
                    value={form.category}
                    onChange={(e) => field('category', e.target.value)}
                  />
                </label>
                <label>
                  قیمت به سنت امریکا
                  <input
                    type="number"
                    required
                    min={1}
                    max={1000000}
                    step={1}
                    value={form.priceCents}
                    onChange={(e) => field('priceCents', Number(e.target.value))}
                  />
                  <small>۱۰۰ سنت = ۱ دالر</small>
                </label>
                <label>
                  موجودی
                  <input
                    type="number"
                    required
                    min={0}
                    max={100000}
                    step={1}
                    value={form.stock}
                    onChange={(e) => field('stock', Number(e.target.value))}
                  />
                </label>
              </div>
              <label>
                تصویر
                <select value={form.image} onChange={(e) => field('image', e.target.value)}>
                  {[1, 2, 3, 4].map((n) => (
                    <option key={n} value={`/images/img-pro-0${n}.jpg`}>
                      تصویر محصول {n}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                توضیحات
                <textarea
                  required
                  maxLength={2000}
                  rows={3}
                  value={form.description}
                  onChange={(e) => field('description', e.target.value)}
                />
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => field('active', e.target.checked)}
                />
                نمایش در فروشگاه
              </label>
              <div className="actions">
                <button disabled={busy}>ذخیرهٔ محصول</button>
                <button className="outline" type="button" onClick={() => setEditing(null)}>
                  انصراف
                </button>
              </div>
            </form>
          )}
        </>
      ) : (
        <LoadState resource={orders}>
          {orders.data?.length ? (
            <div className="order-list">
              {orders.data.map((o) => (
                <OrderCard key={o.id} order={o}>
                  <div className="actions order-actions">
                    {(nextStatuses[o.status] || []).map((status) => (
                      <button
                        key={status}
                        className={status === 'CANCELLED' ? 'outline' : ''}
                        disabled={busy}
                        onClick={() => updateStatus(o.id, status)}
                      >
                        {statusName(status)}
                      </button>
                    ))}
                  </div>
                </OrderCard>
              ))}
            </div>
          ) : (
            <div className="empty">هنوز سفارشی ثبت نشده است.</div>
          )}
        </LoadState>
      )}
    </section>
  );
}
