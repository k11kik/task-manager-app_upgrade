import { isSameDay, startOfDay, differenceInCalendarDays, differenceInCalendarWeeks } from 'date-fns';
import { Task } from '../types';

/**
 * Checks if a task occurs on a given date, considering:
 * 1. Specific deadline (締切)
 * 2. Specific startDate (開始日 / いつ)
 * 3. Or a date range between startDate and deadline
 * 4. Recurrence rules (繰り返し: daily, every X days, weekly, every X weeks)
 */
export function isTaskOccurringOnDate(task: Task, targetDate: Date, includeRecurrence: boolean = true): boolean {
  const targetTime = targetDate.getTime();
  const targetDayStart = startOfDay(targetDate).getTime();

  // 1. Direct match on deadline
  if (task.deadline && isSameDay(new Date(task.deadline), targetDate)) {
    return true;
  }

  // 2. Direct match on startDate
  if (task.startDate && isSameDay(new Date(task.startDate), targetDate)) {
    return true;
  }

  // 3. Span between startDate and deadline (if not recurring)
  if (task.startDate && task.deadline && (!task.recurrence || task.recurrence.type === 'none')) {
    const startDay = startOfDay(new Date(task.startDate)).getTime();
    const deadlineDay = startOfDay(new Date(task.deadline)).getTime();
    if (startDay <= deadlineDay) {
      if (targetDayStart >= startDay && targetDayStart <= deadlineDay) {
        return true;
      }
    }
  }

  // 4. Recurrence logic
  if (includeRecurrence && task.recurrence && task.recurrence.type !== 'none') {
    const originMs = task.startDate || task.deadline || task.createdAt;
    if (!originMs) return false;

    const originDate = new Date(originMs);
    const originDayStart = startOfDay(originDate).getTime();

    // Must occur on or after the recurrence origin date
    if (targetDayStart < originDayStart) {
      return false;
    }

    // Must occur on or before the recurrence end date if specified
    if (task.recurrence.endDate) {
      const endDayStart = startOfDay(new Date(task.recurrence.endDate)).getTime();
      if (targetDayStart > endDayStart) {
        return false;
      }
    }

    const { type, interval = 1 } = task.recurrence;
    const safeInterval = Math.max(1, interval);

    switch (type) {
      case 'daily': {
        return true;
      }
      case 'every_x_days': {
        const daysDiff = Math.round(differenceInCalendarDays(targetDate, originDate));
        return daysDiff >= 0 && daysDiff % safeInterval === 0;
      }
      case 'weekly': {
        // Same day of the week as origin date
        return targetDate.getDay() === originDate.getDay();
      }
      case 'every_x_weeks': {
        // Same day of the week and multiples of X weeks apart
        if (targetDate.getDay() !== originDate.getDay()) return false;
        const weeksDiff = Math.abs(Math.round(differenceInCalendarWeeks(targetDate, originDate, { weekStartsOn: 1 })));
        return weeksDiff % safeInterval === 0;
      }
      default:
        return false;
    }
  }

  return false;
}
