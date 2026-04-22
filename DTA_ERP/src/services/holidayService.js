import api from './api';

const holidayService = {
    createHoliday: async (holidayData) => {
        try {
            const response = await api.post('/holidays', holidayData);
            return response.data.data;
        } catch (error) {
            throw error;
        }
    },

    getHolidays: async () => {
        try {
            const response = await api.get('/holidays');
            return response.data.data;
        } catch (error) {
            throw error;
        }
    },

    deleteHoliday: async (id) => {
        try {
            const response = await api.delete(`/holidays/${id}`);
            return response.data.data;
        } catch (error) {
            throw error;
        }
    }
};

export default holidayService;
