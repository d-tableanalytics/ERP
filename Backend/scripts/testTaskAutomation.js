require('dotenv').config();
const { processRecurringTasks } = require('./src/utils/taskAutomation');
const db = require('./src/config/db.config');

const testAutomation = async () => {
    console.log('--- STARTING MANUAL TEST OF TASK AUTOMATION ---');
    try {
        await processRecurringTasks();
        console.log('--- TEST COMPLETED ---');
    } catch (err) {
        console.error('Test failed:', err);
    } finally {
        // We don't close the pool here because processRecurringTasks might still have pending queries if not awaited properly, 
        // but it is awaited. However, some connections might stay open.
        process.exit(0);
    }
};

testAutomation();
