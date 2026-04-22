import api from './api';

const notificationService = {
    getNotifications: async () => {
        const response = await api.get('/notifications');
        return response.data.data;
    },
    markAsRead: async (id) => {
        const response = await api.put(`/notifications/${id}/read`);
        return response.data.data;
    },
    markAllAsRead: async () => {
        const response = await api.put('/notifications/read-all');
        return response.data.data;
    },
    deleteNotification: async (id) => {
        const response = await api.delete(`/notifications/${id}`);
        return response.data.data;
    },
    clearAll: async () => {
        const response = await api.delete('/notifications/clear-all');
        return response.data.data;
    },
    getSettings: async () => {
        const response = await api.get('/notification-settings');
        return response.data.data;
    },
    updateSettings: async (settings) => {
        const response = await api.post('/notification-settings', settings);
        return response.data.data;
    }
};

export default notificationService;
