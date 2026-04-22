import api from './api';

const taskService = {
    // 1. Get My Tasks - Tasks assigned to me
    getMyTasks: async () => {
        const response = await api.get('/tasks/my');
        return response.data.data;
    },

    // 2. Get Delegated Tasks - Tasks created/assigned by me
    getDelegatedTasks: async () => {
        const response = await api.get('/tasks/delegated');
        return response.data.data;
    },

    // 3. Get Subscribed Tasks - Tasks I'm following
    getSubscribedTasks: async () => {
        const response = await api.get('/tasks/subscribed');
        return response.data.data;
    },

    // 4. Get All Tasks - Comprehensive view
    getAllTasks: async () => {
        const response = await api.get('/tasks/all');
        return response.data.data;
    },

    // 5. Get Deleted Tasks - Recycle bin
    getDeletedTasks: async () => {
        const response = await api.get('/tasks/deleted');
        return response.data.data;
    },

    // 6. Create Task
    createTask: async (formData) => {
        const response = await api.post('/tasks', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data.data;
    }
};

export default taskService;
