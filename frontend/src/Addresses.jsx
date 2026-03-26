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
