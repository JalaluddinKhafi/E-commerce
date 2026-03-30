import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from './store';
import { LoadState, useLoad, useShop } from './App';

const blank = { label: '', recipient: '', phone: '', address: '', isDefault: false };
const payload = (entry) => ({
  label: entry.label,
  recipient: entry.recipient,
  phone: entry.phone,
  address: entry.address,
  isDefault: entry.isDefault,
});

export function AddressesPage() {
  const { revision, refresh, task, busy } = useShop();
  const resource = useLoad('/account/addresses', revision);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blank);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const entries = resource.data || [];
  function edit(entry) {
    setConfirmDelete(null);
    setForm({ ...entry });
    setEditing(entry.id || 'new');
  }
  function field(key, value) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }
  async function save(event) {
    event.preventDefault();
    await task(async () => {
      await api(editing === 'new' ? '/account/addresses' : `/account/addresses/${editing}`, {
        method: editing === 'new' ? 'POST' : 'PUT',
        body: payload(form),
      });
      setEditing(null);
      refresh();
    }, 'نشانی ذخیره شد.');
  }
  async function remove(entry) {
    await task(async () => {
      try {
        await api(`/account/addresses/${entry.id}`, { method: 'DELETE' });
        setConfirmDelete(null);
        if (editing === entry.id) setEditing(null);
      } finally {
        refresh();
      }
    }, 'نشانی حذف شد.');
  }
  async function makeDefault(entry) {
    await task(async () => {
      await api(`/account/addresses/${entry.id}`, {
        method: 'PUT',
        body: { ...payload(entry), isDefault: true },
      });
      refresh();
    }, 'نشانی پیش‌فرض تغییر کرد.');
  }
  return (
    <section className="shell page address-page">
      <Link className="back" to="/account">
        ← بازگشت به حساب من
      </Link>
      <div className="address-heading">
        <div>
          <span className="eyebrow">تحویل راحت‌تر، خرید سریع‌تر</span>
          <h1>نشانی‌های من</h1>
          <p className="muted">
            حداکثر ۱۰ نشانی در حساب شما ذخیره می‌شود. تغییر آن‌ها، نشانی سفارش‌های قبلی را عوض
            نمی‌کند.
          </p>
        </div>
        <button
          disabled={busy || resource.loading || entries.length >= 10}
          onClick={() => edit(blank)}
        >
          نشانی جدید +
        </button>
      </div>
      <LoadState resource={resource}>
        {entries.length ? (
          <div className="address-grid">
            {entries.map((entry) => (
              <article
                className={`address-card ${entry.isDefault ? 'is-default' : ''}`}
                key={entry.id}
              >
                <div className="address-card-heading">
                  <h2>{entry.label}</h2>
                  {entry.isDefault && <span className="badge">پیش‌فرض</span>}
                </div>
                <strong className="address-recipient">{entry.recipient}</strong>
                <p className="address-text">{entry.address}</p>
                <p className="address-phone">
                  <span>تلفن تحویل</span>
                  <bdi>{entry.phone}</bdi>
                </p>
                <div className="address-actions">
                  <button className="outline" disabled={busy} onClick={() => edit(entry)}>
                    ویرایش {entry.label}
                  </button>
                  {!entry.isDefault && (
                    <button className="quiet" disabled={busy} onClick={() => makeDefault(entry)}>
                      پیش‌فرض کردن {entry.label}
                    </button>
                  )}
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() => setConfirmDelete(entry.id)}
                  >
                    حذف {entry.label}
                  </button>
                </div>
                {confirmDelete === entry.id && (
                  <div
                    className="address-confirm"
                    role="group"
