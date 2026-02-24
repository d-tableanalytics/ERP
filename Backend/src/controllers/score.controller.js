const scoreModel = require('../models/score.model');

// ===============================
// ✅ Helpers
// ===============================
const getWeekLabel = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const firstDay = new Date(date.getFullYear(), 0, 1);
    const pastDays = Math.floor((date - firstDay) / (1000 * 60 * 60 * 24));
    const week = Math.ceil((pastDays + firstDay.getDay() + 1) / 7);
    return `Week ${week}/${date.getFullYear()}`;
};

// ===============================
// ✅ Score API (Detailed List)
// ===============================
exports.getScore = async (req, res) => {
    const { id: userId, role } = req.user;

    try {
        const tasks = await scoreModel.getConsolidatedTasks(userId, role);
        const total = tasks.length;

        if (total === 0) {
            return res.json({
                totalTasks: 0,
                scores: { pending: 0, late: 0, completed: 0 },
                counts: { pending: 0, late: 0, onTime: 0 },
                tasks: []
            });
        }

        const now = new Date();

        const pendingTasks = tasks.filter(t => 
            (t.status !== 'COMPLETED' && t.status !== 'Completed' && t.status !== 'Verified')
        ).length;

        const lateTasks = tasks.filter(t => {
            const isCompleted = t.status === 'COMPLETED' || t.status === 'Completed' || t.status === 'Verified';
            const dueDate = t.due_date ? new Date(t.due_date) : null;
            
            if (!isCompleted) {
                return dueDate && dueDate < now;
            } else {
                const completeDate = t.completed_at ? new Date(t.completed_at) : (t.status === 'Verified' ? now : null);
                return dueDate && completeDate && completeDate > dueDate;
            }
        }).length;

        const onTimeCompletedTasks = tasks.filter(t => {
            const isCompleted = t.status === 'COMPLETED' || t.status === 'Completed' || t.status === 'Verified';
            const dueDate = t.due_date ? new Date(t.due_date) : null;
            const completeDate = t.completed_at ? new Date(t.completed_at) : (t.status === 'Verified' ? now : null);
            
            return isCompleted && (!dueDate || (completeDate && completeDate <= dueDate));
        }).length;

        // Status counts for persistence
        const redTasks = tasks.filter(t => t.status === "NEED REVISION").length;
        const yellowTasks = tasks.filter(t => t.status === "HOLD").length;
        const greenTasks = tasks.filter(t => t.status === "COMPLETED" || t.status === "Completed" || t.status === "Verified").length;

        const pendingScore = ((pendingTasks / total) * -100).toFixed(1);
        const lateScore = ((lateTasks / total) * -100).toFixed(1);
        const completedScore = ((onTimeCompletedTasks / total) * 100).toFixed(1);

        // ✅ Save to Database
        await scoreModel.saveScore({
            userId,
            totalTasks: total,
            pendingScore,
            lateScore,
            completedScore,
            redCount: redTasks,
            yellowCount: yellowTasks,
            greenCount: greenTasks
        });

        const scoreRows = tasks.map((d, index) => ({
            id: index + 1,
            delegation_id: d.id,
            name: d.doer_name,
            task: d.delegation_name,
            date: d.due_date,
            score: Number(d.revision_count || 0),
            status: d.status,
            week_no: getWeekLabel(d.due_date),
            created_at: now,
            source: d.source
        }));

        res.json({
            totalTasks: total,
            tasks: scoreRows
        });

    } catch (err) {
        console.error('Error in getScore:', err);
        res.status(500).json({ message: 'Error calculating scores' });
    }
};

// ===============================
// ✅ Score Summary API
// ===============================
exports.getScoreSummary = async (req, res) => {
    const { id: userId, role } = req.user;

    try {
        const tasks = await scoreModel.getConsolidatedTasks(userId, role);
        const total = tasks.length;

        const redTasks = tasks.filter(t => t.status === "NEED REVISION").length;
        const yellowTasks = tasks.filter(t => t.status === "HOLD").length;
        const greenTasks = tasks.filter(t => t.status === "COMPLETED" || t.status === "Completed" || t.status === "Verified").length;

        const percent = (count) =>
            total > 0 ? ((count / total) * 100).toFixed(1) : 0;

        res.json({
            totalTasks: total,
            red: { count: redTasks, percent: percent(redTasks) },
            yellow: { count: yellowTasks, percent: percent(yellowTasks) },
            green: { count: greenTasks, percent: percent(greenTasks) }
        });
    } catch (err) {
        console.error('Error in getScoreSummary:', err);
        res.status(500).json({ message: 'Error fetching score summary' });
    }
};
