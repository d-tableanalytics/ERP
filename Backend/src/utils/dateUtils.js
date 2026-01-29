const DAY_NAME_TO_NUMBER = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunday: 7,
};
const addBusinessHours = (startDate, hoursToAdd, config, holidays) => {
  console.log("startDate", startDate);
  console.log("hourses", hoursToAdd);
  console.log("config", config);
  console.log("holid", holidays);
  // 1. Parse Inputs
  let cursor = new Date(startDate);
  let hoursRemaining = parseFloat(hoursToAdd);

  // Parse Office Hours (e.g., '09:00:00' -> hours=9, mins=0)
  const [startHour, startMinute] = config.office_start_time
    .split(":")
    .map(Number);
  const [endHour, endMinute] = config.office_end_time.split(":").map(Number);
  const workingDays = config.working_days || [1, 2, 3, 4, 5, 6]; // Default Mon-Sat
  console.log("workingDays", workingDays);
  const holidayDates = new Set(
    holidays.map((h) => {
      const d = new Date(h.holiday_date);
      return d.toISOString().split("T")[0];
    }),
  );
  console.log("holidayDates", holidayDates);
  // Helper: Reset cursor to start of current day
  const resetToOfficeStart = (date) => {
    date.setHours(startHour, startMinute, 0, 0);
    return date;
  };
  console.log("resetToOfficeStart", resetToOfficeStart(cursor));
  // Helper: Check if date is working day (not weekend, not holiday)
  const isWorkingDay = (date) => {
    // JS: 0=Sun, 1=Mon ... 6=Sat
    const jsDay = date.getDay();
    const configDay = jsDay === 0 ? 7 : jsDay;

    // normalize working_days ONCE
    const normalizedWorkingDays = workingDays.map((d) =>
      typeof d === "string" ? DAY_NAME_TO_NUMBER[d.toLowerCase()] : d,
    );

    const dateString = date.toISOString().split("T")[0];

    if (!normalizedWorkingDays.includes(configDay)) return false;
    if (holidayDates.has(dateString)) return false;

    return true;
  };
  console.log("isWorkingDay", isWorkingDay(cursor));
  // Helper: Move to next valid working day start
  const moveToNextWorkingDay = (date) => {
    do {
      date.setDate(date.getDate() + 1);
    } while (!isWorkingDay(date));
    return resetToOfficeStart(date);
  };
  console.log("Before Checks:", moveToNextWorkingDay(cursor));
  // 2. Initial Checks
  // Ensure cursor is within working hours. If starts before/after/non-working, adjust.
  if (!isWorkingDay(cursor)) {
    cursor = moveToNextWorkingDay(cursor);
  } else {
    // Working day. Check time.
    const currentHour = cursor.getHours();
    const currentMinute = cursor.getMinutes();
    const currentTime = currentHour + currentMinute / 60;
    const officeStartTime = startHour + startMinute / 60;
    const officeEndTime = endHour + endMinute / 60;

    if (currentTime < officeStartTime) {
      cursor = resetToOfficeStart(cursor);
    } else if (currentTime >= officeEndTime) {
      cursor = moveToNextWorkingDay(cursor);
    }
  }

  // 3. Loop to add hours
  while (hoursRemaining > 0) {
    // At this point, cursor is guaranteed to be within a working day and >= office_start (or previously consumed)
    // But we must recalculate boundaries for the specific day

    const currentHour = cursor.getHours();
    const currentMinute = cursor.getMinutes();
    const currentTime = currentHour + currentMinute / 60;
    const officeEndTime = endHour + endMinute / 60;

    const hoursAvailableToday = officeEndTime - currentTime;

    if (hoursAvailableToday <= 0) {
      // Should not happen due to pre-check, but safety
      cursor = moveToNextWorkingDay(cursor);
      continue;
    }

    if (hoursRemaining <= hoursAvailableToday) {
      // Fits in today
      const millisToAdd = hoursRemaining * 60 * 60 * 1000;
      cursor = new Date(cursor.getTime() + millisToAdd);
      hoursRemaining = 0;
    } else {
      // Use up today, move to next day
      // We just advance the date? No, we need time to be exactly office end?
      // Actually, we don't need to "land" on office end. We just subtract hours.
      hoursRemaining -= hoursAvailableToday;
      cursor = moveToNextWorkingDay(cursor);
    }
  }
  console.log("Result:", cursor);
  return cursor;
};

module.exports = { addBusinessHours };
