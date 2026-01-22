const addBusinessHours = (startDate, hoursToAdd, config, holidays) => {
    // 1. Parse Inputs
    let cursor = new Date(startDate);
    let hoursRemaining = parseFloat(hoursToAdd);

    // Parse Office Hours (e.g., '09:00:00' -> hours=9, mins=0)
    const [startHour, startMinute] = config.office_start_time.split(':').map(Number);
    const [endHour, endMinute] = config.office_end_time.split(':').map(Number);
    const workingDays = config.working_days || [1, 2, 3, 4, 5, 6]; // Default Mon-Sat
    const holidayDates = new Set(holidays.map(h => {
        const d = new Date(h.holiday_date);
        return d.toISOString().split('T')[0];
    }));

    // Helper: Reset cursor to start of current day
    const resetToOfficeStart = (date) => {
        date.setHours(startHour, startMinute, 0, 0);
        return date;
    };

    // Helper: Check if date is working day (not weekend, not holiday)
    const isWorkingDay = (date) => {
        const dayOfWeek = date.getDay() || 7; // JS 0=Sun, convert to 7=Sun to match DB convention likely 1-7 or handle 0
        // Adjust for JS: 0=Sun, 1=Mon...6=Sat. 
        // User config: 1=Mon...7=Sun likely.
        // Let's assume standard JS for simplicity first, but config default says 1=Mon...
        // Let's standardise: JS 0(Sun)-6(Sat). 
        // Config: 1(Mon)-7(Sun).
        // Map JS to Config: 0->7, 1->1 ... 6->6.
        const configDay = dayOfWeek === 0 ? 7 : dayOfWeek;

        const dateString = date.toISOString().split('T')[0];

        if (!workingDays.includes(configDay)) return false;
        if (holidayDates.has(dateString)) return false;
        return true;
    };

    // Helper: Move to next valid working day start
    const moveToNextWorkingDay = (date) => {
        do {
            date.setDate(date.getDate() + 1);
        } while (!isWorkingDay(date));
        return resetToOfficeStart(date);
    };

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

    return cursor;
};

module.exports = { addBusinessHours };
