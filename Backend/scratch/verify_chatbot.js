const chatbotService = require('../src/modules/chatbot/chatbot.service');

// Mock dependencies
chatbotService.logConversation = async () => {};
chatbotService.handleDataQuery = async (userId, message) => {
    return { message: "Mocked data response", type: 'data-query' };
};
chatbotService.pool = {
    query: async () => ({ rows: [] })
};

async function testQuery(message) {
    console.log(`\nTesting query: "${message}"`);
    const result = await chatbotService.processMessage(1, message, 'Employee');
    console.log(`Intent: ${result.intent}`);
    console.log(`Type: ${result.responseType}`);
    console.log(`Response Snippet: ${result.message.substring(0, 100)}...`);
    return result;
}

async function runTests() {
    // 1. "how i can complete tasks"
    await testQuery("how i can complete tasks");
    
    // 2. "guide me show i complete tasks"
    await testQuery("guide me show i complete tasks");
    
    // 3. "how i can create checklist"
    await testQuery("how i can create checklist");
    
    // 4. "show my pending tasks"
    await testQuery("show my pending tasks");

    // 5. "show my completed tasks"
    await testQuery("show my completed tasks");

    // 6. "count of checklists"
    await testQuery("count of checklists");
}

runTests().catch(console.error);
