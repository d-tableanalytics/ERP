import axios from 'axios';
import { API_BASE_URL } from '../config';

const api = axios.create({
    baseURL: `${API_BASE_URL}/api`,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add interceptor for auth token
api.interceptors.request.use(
    (config) => {
        try {
            const directToken = localStorage.getItem('token');
            if (directToken) {
                config.headers.Authorization = `Bearer ${directToken}`;
                return config;
            }

            const authString = localStorage.getItem('auth');
            if (authString) {
                const auth = JSON.parse(authString);
                if (auth?.token) {
                    config.headers.Authorization = `Bearer ${auth.token}`;
                    return config;
                }
            }

            // Fallback: read from 'user' key (legacy support)
            const userString = localStorage.getItem('user');
            if (userString) {
                const user = JSON.parse(userString);
                const token = user?.token || user?.user?.token;
                if (token) {
                    config.headers.Authorization = `Bearer ${token}`;
                }
            }
        } catch (e) {
            // Corrupted localStorage — skip auth header, server will 401
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Add response interceptor for 401 handling
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // Clear all auth data and redirect to login
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem('auth');
            localStorage.removeItem('loginTime');
            if (window.location.pathname !== '/login') {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export const fetchJSON = async (url, options = {}) => {
    const response = await fetch(url, options);
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.message || 'Network response was not ok');
    }
    // Automatically unwrap standardized responses
    return data.success && data.data !== undefined ? data.data : data;
};

export default api;
