import api from './api';

const teamService = {
    getUsers: async () => {
        const response = await api.get('/auth/users');
        return response.data;
    },
    createTeam: async (teamData) => {
        const response = await api.post('/teams', teamData);
        return response.data;
    },
    getTeams: async () => {
        const response = await api.get('/teams');
        return response.data;
    },
    getTeamMembers: async (teamId) => {
        const response = await api.get(`/teams/${teamId}/members`);
        return response.data;
    },
    getMyTeamMembers: async () => {
        const response = await api.get('/teams/my-members');
        return response.data;
    },
    removeMember: async (teamId, userId) => {
        const response = await api.delete(`/teams/${teamId}/members/${userId}`);
        return response.data;
    }
};

export default teamService;
