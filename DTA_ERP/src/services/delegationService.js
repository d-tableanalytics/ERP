import api from './api';

const delegationService = {
    createDelegation: async (delegationData) => {
        const response = await api.post('/delegations', delegationData);
        return response.data;
    },
    createDelegationTemplate: async (templateData) => {
        const response = await api.post('/delegations/templates', templateData);
        return response.data;
    },
    getDelegations: async (filters = {}) => {
        // Clean up undefined or null filters
        const cleanFilters = Object.fromEntries(
            Object.entries(filters).filter(([_, v]) => v != null && v !== '')
        );
        const query = new URLSearchParams(cleanFilters).toString();
        const response = await api.get(`/delegations?${query}`);
        return response.data;
    },
    getDelegationById: async (id) => {
        const response = await api.get(`/delegations/${id}`);
        return response.data;
    },
    updateDelegation: async (id, updates) => {
        const response = await api.patch(`/delegations/${id}`, updates);
        return response.data;
    },
    deleteDelegation: async (id, payload = {}) => {
        const response = await api.delete(`/delegations/${id}`, { data: payload });
        return response.data;
    },
    getDeletedDelegations: async (filters = {}) => {
        const cleanFilters = Object.fromEntries(
            Object.entries(filters).filter(([_, v]) => v != null && v !== '')
        );
        const query = new URLSearchParams(cleanFilters).toString();
        const response = await api.get(`/delegations/deleted?${query}`);
        return response.data;
    },
    restoreDelegation: async (id) => {
        const response = await api.patch(`/delegations/${id}/restore`);
        return response.data;
    },
    addRemark: async (id, remarkData) => {
        const response = await api.post(`/delegations/${id}/remarks`, remarkData);
        return response.data;
    },
    uploadFile: async (file, folder = 'general') => {
        const formData = new FormData();
        formData.append('file', file);
        const response = await api.post(`/delegations/upload?folder=${folder}`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
        return response.data;
    },
    getCategories: async () => {
        const response = await api.get('/categories/list');
        return response.data;
    },
    createCategory: async (categoryData) => {
        const response = await api.post('/categories/create', categoryData);
        return response.data;
    },
    deleteCategory: async (id) => {
        const response = await api.delete(`/categories/${id}`);
        return response.data;
    },
    createGroup: async (groupData) => {
        const response = await api.post('/groups/create', groupData);
        return response.data;
    },
    getGroups: async () => {
        const response = await api.get('/groups/list');
        return response.data;
    },
    getGroupMembers: async (groupId) => {
        const response = await api.get(`/groups/${groupId}/members`);
        return response.data;
    },
    getGroupById: async (groupId) => {
        const response = await api.get(`/groups/${groupId}`);
        return response.data;
    },
    updateGroup: async (groupId, groupData) => {
        const response = await api.patch(`/groups/${groupId}/update`, groupData);
        return response.data;
    },
    getTagsList: async () => {
        const response = await api.get('/tags/list');
        return response.data;
    },
    createTag: async (tagData) => {
        const response = await api.post('/tags/create', tagData);
        return response.data;
    },
    deleteTag: async (id) => {
        const response = await api.delete(`/tags/${id}`);
        return response.data;
    }
};

export default delegationService;
