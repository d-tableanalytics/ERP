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
        const authString = localStorage.getItem('auth');
        const directToken = localStorage.getItem('token');
        
        if (directToken) {
            config.headers.Authorization = `Bearer ${directToken}`;
        } else if (authString) {
            const auth = JSON.parse(authString);
            if (auth && auth.token) {
                config.headers.Authorization = `Bearer ${auth.token}`;
            }
        } else {
            // Try 'user' as well since some projects use different keys
            const userString = localStorage.getItem('user');
            if (userString) {
                const user = JSON.parse(userString);
                if (user && user.token) {
                    config.headers.Authorization = `Bearer ${user.token}`;
                } else if (user && user.user && user.user.token) {
                     config.headers.Authorization = `Bearer ${user.user.token}`;
                }
            }
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
            console.error('Unauthorized request - clearing auth and redirecting to login');
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem('loginTime');
            // We can't use dispatch here easily, so we use window.location
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
    return data;
};

export default api;
