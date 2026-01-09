import { fetchJSON } from './api';

export function login({ email, password }) {
  return fetchJSON('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
}

export function register({ name, email, password }) {
  return fetchJSON('/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  });
}
