export type Category = 'Urgent' | 'Focus' | 'Archive' | 'Trash';

export type RecurrenceType = 'none' | 'daily' | 'every_x_days' | 'weekly' | 'every_x_weeks';

export interface TaskRecurrence {
  type: RecurrenceType;
  interval?: number; // e.g. every X days or every X weeks
  endDate?: number;  // optional end timestamp for recurrence
}

export interface Task {
  id: string;
  userId: string;
  title: string;
  project: string;
  category: Category;
  createdAt: number; // timestamp
  updatedAt: number; // timestamp
  isDone: boolean;
  notes?: string;
  urls?: string[];
  isStarred?: boolean;
  isPinned?: boolean;
  section?: string;
  startDate?: number; // timestamp for "when / start date" (いつ・開始日)
  deadline?: number; // timestamp for deadline / due date (締切)
  isAllDay?: boolean;
  recurrence?: TaskRecurrence; // repetition settings (繰り返し)
  order?: number; // custom execution order
  timelineColumn?: string; // custom abstract timeline column/stage
  timelineStep?: number; // custom step/slot index within phase/stage for grid positioning
  timelinePresetColumns?: Record<string, string>; // presetKey -> columnId mapping
}

export interface TaskHistory {
  taskId: string;
  action: string;
  timestamp: number;
}

export interface FolderMeta {
  path: string; // e.g. "General", "Marketing", "Marketing/Design"
  section: string; // Workspace section, e.g. "General"
  title?: string;
  name?: string;
  isStarred?: boolean;
  isPinned?: boolean;
  isDone?: boolean;
  startDate?: number; // timestamp
  deadline?: number; // timestamp
  isAllDay?: boolean;
  recurrence?: TaskRecurrence;
  notes?: string;
  urls?: string[];
  category?: Category; // 'Focus' | 'Archive' | 'Trash'
  createdAt?: number;
  updatedAt?: number;
}
