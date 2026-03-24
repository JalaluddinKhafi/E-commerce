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
