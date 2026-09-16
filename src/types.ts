export type Category = 'Urgent' | 'Focus' | 'Archive' | 'Trash';

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
  deadline?: number; // timestamp
  isAllDay?: boolean;
  order?: number; // custom execution order
  timelineColumn?: string; // custom abstract timeline column/stage
  timelinePresetColumns?: Record<string, string>; // presetKey -> columnId mapping
}

export interface TaskHistory {
  taskId: string;
  action: string;
  timestamp: number;
}
