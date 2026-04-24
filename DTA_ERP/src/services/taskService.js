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

    // 5a. Get Task by Id
    getTaskById: async (id) => {
        const response = await api.get(`/tasks/${id}`);
        return response.data.data;
    },

    // 5b. Update Task
    updateTask: async (id, updates) => {
        const isFormData = typeof FormData !== 'undefined' && updates instanceof FormData;
        const response = await api.patch(`/tasks/${id}`, updates, isFormData
            ? { headers: { 'Content-Type': 'multipart/form-data' } }
            : undefined);
        return response.data.data;
    },

    // 5c. Add Remark
    addRemark: async (id, remarkData) => {
        const response = await api.post(`/tasks/${id}/remarks`, remarkData);
        return response.data.data;
    },

    // 5d. Subscribe Task
    subscribeTask: async (id) => {
        const response = await api.patch(`/tasks/${id}/subscribe`);
        return response.data.data;
    },

    // 6a. Soft Delete Task
    softDeleteTask: async (id) => {
        const response = await api.patch(`/tasks/${id}/trash`);
        return response.data.data;
    },

    // 6b. Restore Task
    restoreTask: async (id) => {
        const response = await api.patch(`/tasks/${id}/restore`);
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
