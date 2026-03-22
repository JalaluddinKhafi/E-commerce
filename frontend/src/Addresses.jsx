import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from './store';
import { LoadState, useLoad, useShop } from './App';

const blank = { label: '', recipient: '', phone: '', address: '', isDefault: false };
const payload = (entry) => ({
