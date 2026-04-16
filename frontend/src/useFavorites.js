import { useEffect, useRef, useState } from 'react';
import { api } from './store';

const storageKey = 'freshshop:favorites';
function readGuestIds() {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) || '[]');
    return Array.isArray(stored)
