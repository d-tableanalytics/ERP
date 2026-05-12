import { fetchJSON } from './api';
import { API_BASE_URL } from '../config';

export function login({ email, password }) {
  return fetchJSON(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ Work_Email: email, Password: password }),
  });
}

export function register({ name, email, password }) {
  return fetchJSON(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      First_Name: name,
      Last_Name: '',
      Work_Email: email,
      Password: password,
    }),
  });
}

export function getMe() {
  const token = localStorage.getItem('token');
  return fetchJSON(`${API_BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}
