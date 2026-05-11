const chatbotService = require('../src/modules/chatbot/chatbot.service');

// Mock dependencies to avoid DB connection issues
chatbotService.logConversation = async () => {};

// Mock DB pool for data queries
const mockPool = {
    query: async (q, params) => {
        if (q.includes('COUNT(*)')) {
            return { rows: [{ count: 5, pending_checklist: 2, pending_delegation: 3, completed_checklists: 10, completed_delegations: 5, overdue_checklist: 1, overdue_delegation: 1 }] };
        }
        if (q.includes('first_name')) {
            return { rows: [{ first_name: 'Test', last_name: 'User', designation: 'Developer', department: 'IT' }] };
        }
        return { rows: [] };
    }
};

// Replace pool in chatbotService (it's imported as { pool } from db.config, but used as this.pool in some places or via imported pool)
// Wait, chatbotService.js uses `require("../../config/db.config").pool`
// I'll mock the module if necessary, but first let's see if I can just override the logic or if it uses pool directly.
// In chatbotService.js: const { pool } = require("../../config/db.config");
// This is hard to mock after the fact without a tool or modifying the file.
// But I can still test the intent detection and knowledge matching which don't require the DB.

async function testQuery(message) {
    console.log(`\n--- Testing query: "${message}" ---`);
    // Pass Admin role to test more features
    const result = await chatbotService.processMessage(1, message, 'Admin');
    console.log(`Detected Intent: ${result.intent}`);
    console.log(`Response Type: ${result.responseType}`);
    console.log(`Response Content:\n${result.message}`);
    return result;
}

async function runTests() {
    console.log("STARTING CHATBOT FIX VERIFICATION\n");

    // Issue 1: Wrong Response Mapping
    await testQuery("How can I mark a task as completed?");
    await testQuery("How do I update task status?");

    // Issue 2: Generic Responses Instead of Exact Guidance
    await testQuery("Guide me to create a checklist");
    await testQuery("How do I complete a checklist?");
    await testQuery("Process of assigning checklist to team members");
    await testQuery("Guide me to see completed checklists");
    await testQuery("How do I check overdue tasks?");
    await testQuery("Help me create a recurring checklist");

    // Issue 3: Incorrect Count Response (This will try to hit the DB, might error if pool is not mocked)
    // We can see if it triggers 'data_query' intent
    await testQuery("Count of completed tasks");

    // Issue 4: Mixed Guidance + Data Query Handling
    await testQuery("How can I create and assign a checklist?");

    // Issue 5: Weak Ambiguous Query Handling
    await testQuery("task task task");
    await testQuery("checklist");

    console.log("\nVERIFICATION COMPLETE");
}

runTests().catch(err => {
    console.error("Test execution failed:", err);
});
