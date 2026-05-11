const { pool } = require("../config/db.config");

exports.getDashboardSummary = async (req, res) => {
  const { id: userId, role } = req.user;
  const isAdmin = role === "Admin" || role === "SuperAdmin";

  try {
    // 1. Delegation Stats
    let delegationQuery = `SELECT status, COUNT(*) as count FROM delegation`;
    if (!isAdmin) delegationQuery += ` WHERE doer_id = $1`;
    delegationQuery += ` GROUP BY status`;

    const delegationResult = await pool.query(
      delegationQuery,
      isAdmin ? [] : [userId],
    );
    const delegationStats = delegationResult.rows.reduce(
      (acc, row) => {
        acc[row.status] = parseInt(row.count);
        acc.total = (acc.total || 0) + parseInt(row.count);
        return acc;
      },
      { total: 0 },
    );

    // 2. Task Stats (Modern Task Management)
    let tasksQuery = `SELECT status, COUNT(*) as count FROM tasks`;
    if (!isAdmin) tasksQuery += ` WHERE doer_id = $1`;
    tasksQuery += ` GROUP BY status`;

    const tasksResult = await pool.query(
      tasksQuery,
      isAdmin ? [] : [userId],
    );
    const tasksStats = tasksResult.rows.reduce(
      (acc, row) => {
        acc[row.status] = parseInt(row.count);
        acc.total = (acc.total || 0) + parseInt(row.count);
        return acc;
      },
      { total: 0 },
    );

    // 3. Legacy Checklist Stats (Backward compatibility)
    let checklistStats = { total: 0 };
    try {
      let checklistQuery = `SELECT status, COUNT(*) as count FROM checklist`;
      if (!isAdmin) checklistQuery += ` WHERE doer_id = $1`;
      checklistQuery += ` GROUP BY status`;

      const checklistResult = await pool.query(
        checklistQuery,
        isAdmin ? [] : [userId],
      );
      checklistStats = checklistResult.rows.reduce(
        (acc, row) => {
          acc[row.status] = parseInt(row.count);
          acc.total = (acc.total || 0) + parseInt(row.count);
          return acc;
        },
        { total: 0 },
      );
    } catch (e) {
      console.log("Checklist table may not exist, skipping legacy stats.");
    }

    // 3. O2D Stats
    let o2dQuery = `SELECT overall_status as status, COUNT(*) as count FROM o2d_orders`;
    // O2D usually visible to all or filtered by role, but for now we'll do total for dashboard
    o2dQuery += ` GROUP BY overall_status`;

    const o2dResult = await pool.query(o2dQuery);
    const o2dStats = o2dResult.rows.reduce(
      (acc, row) => {
        acc[row.status] = parseInt(row.count);
        acc.total = (acc.total || 0) + parseInt(row.count);
        return acc;
      },
      { total: 0 },
    );

    // 4. Help Ticket Stats
    let ticketQuery = `SELECT status, COUNT(*) as count FROM help_tickets`;
    if (!isAdmin) ticketQuery += ` WHERE raised_by = $1 OR problem_solver = $1`;
    ticketQuery += ` GROUP BY status`;

    const ticketResult = await pool.query(ticketQuery, isAdmin ? [] : [userId]);
    const ticketStats = ticketResult.rows.reduce(
      (acc, row) => {
        acc[row.status] = parseInt(row.count);
        acc.total = (acc.total || 0) + parseInt(row.count);
        return acc;
      },
      { total: 0 },
    );

    // 5. IMS Stats (Simple count of products and total stock)
    const imsResult = await pool.query(
      `SELECT COUNT(*) as products, SUM(total_qty) as total_stock FROM stock_master`,
    );
    const imsStats = {
      products: parseInt(imsResult.rows[0].products || 0),
      totalStock: parseFloat(imsResult.rows[0].total_stock || 0),
    };

    // 6. Overall Performance (Calculated for the 60/40 ratio visualization)
    // We'll define "Done" as COMPLETED/Verified/etc. across all modules
    const doneCount =
      (delegationStats["COMPLETED"] || 0) +
      (tasksStats["Completed"] || 0) +
      (tasksStats["Verified"] || 0) +
      (checklistStats["Verified"] || 0) +
      (checklistStats["Completed"] || 0) +
      (o2dStats["COMPLETED"] || 0) +
      (ticketStats["RESOLVED"] || 0) +
      (ticketStats["CLOSED"] || 0);

    const totalCount =
      delegationStats.total +
      tasksStats.total +
      checklistStats.total +
      o2dStats.total +
      ticketStats.total;

    const performance = {
      done: doneCount,
      notDone: totalCount - doneCount,
      total: totalCount,
      percentDone:
        totalCount > 0 ? ((doneCount / totalCount) * 100).toFixed(1) : 0,
    };

    res.json({
      success: true,
      data: {
        delegation: delegationStats,
        tasks: tasksStats,
        checklist: checklistStats,
        o2d: o2dStats,
        helpTicket: ticketStats,
        ims: imsStats,
        performance,
      }
    });
  } catch (err) {
    console.error("Error in getDashboardSummary:", err);
    res.status(500).json({ success: false, message: "Error fetching dashboard stats" });
  }
};
