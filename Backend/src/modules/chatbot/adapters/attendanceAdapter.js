const db = require('../../../config/db.config');
const { resolveDateRange, formatDDMMYYYY, nowIST } = require('../utils/time');

/**
 * Attendance adapter — read-only summary of a user's punches.
 * Supports a specific date or a relative period ("today", "this week", "this month").
 */

function summarize(row) {
  if (!row) return null;
  return {
    date: row.attendance_date,
    dateFormatted: formatDDMMYYYY(row.attendance_date),
    inTime: row.in_time,
    outTime: row.out_time,
    status: row.status || null,
    location: row.location || null,
    leaveType: row.type_of_leave || null,
    hoursWorked: row.houres_worked || null,
  };
}

async function getStatus(userId, { date, period } = {}) {
  if (date) {
    const { rows } = await db.query(
      `SELECT id, attendance_date, in_time, out_time, status, location, type_of_leave, houres_worked
         FROM attendance WHERE user_id = $1 AND attendance_date = $2`,
      [userId, date]
    );
    return { period: 'specific', date, days: rows.map(summarize) };
  }

  if (!period || String(period).toLowerCase() === 'today') {
    const today = nowIST().toISOString().slice(0, 10);
    const { rows } = await db.query(
      `SELECT id, attendance_date, in_time, out_time, status, location, type_of_leave, houres_worked
         FROM attendance WHERE user_id = $1 AND attendance_date = $2`,
      [userId, today]
    );
    return { period: 'today', date: today, days: rows.map(summarize) };
  }

  const range = resolveDateRange(period);
  if (!range) {
    return { period, days: [] };
  }
  const fromIso = range.from.toISOString().slice(0, 10);
  const toIso = range.to.toISOString().slice(0, 10);
  const { rows } = await db.query(
    `SELECT id, attendance_date, in_time, out_time, status, location, type_of_leave, houres_worked
       FROM attendance WHERE user_id = $1 AND attendance_date BETWEEN $2 AND $3
       ORDER BY attendance_date DESC`,
    [userId, fromIso, toIso]
  );

  const days = rows.map(summarize);
  const presentDays = days.filter((d) => String(d.status || '').toLowerCase() === 'present').length;
  const leaveDays = days.filter((d) => d.leaveType).length;
  return { period, from: fromIso, to: toIso, days, presentDays, leaveDays };
}

module.exports = { getStatus, _summarize: summarize };
