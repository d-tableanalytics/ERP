import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchHelpTicketConfig } from "../store/slices/helpTicketConfigSlice";


const useHolidayCheck = () => {
  const dispatch = useDispatch();

  const { holidays = [], isLoading } = useSelector(
    (state) => state.helpTicketConfig
  );

 
  useEffect(() => {
    if (!holidays.length) {
      dispatch(fetchHelpTicketConfig());
    }
  }, [dispatch, holidays.length]);

  /**
   * Check if a date is a holiday
   * @param {string | Date} dateTime
   * @returns {boolean}
   */
  const isHolidayDate = (dateTime) => {
    if (!dateTime || !holidays.length) return false;

    const selectedDate = new Date(dateTime).toDateString();

    return holidays.some((h) => {
      const holidayDate = new Date(h.holiday_date).toDateString();
      return holidayDate === selectedDate;
    });
  };

  return {
    holidays,
    isHolidayDate,
    isHolidayLoading: isLoading,
  };
};

export default useHolidayCheck;
