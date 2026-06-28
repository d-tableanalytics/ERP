import api from './api';

const holidayService = {
    createHoliday: async (holidayData) => {
        const response = await api.post('/holidays', holidayData);
        return response.data.data;
    },

    getHolidays: async () => {
        const response = await api.get('/holidays');
        return response.data.data;
    },

    deleteHoliday: async (id) => {
        const response = await api.delete(`/holidays/${id}`);
        return response.data.data;
    }
};

export default holidayService;
