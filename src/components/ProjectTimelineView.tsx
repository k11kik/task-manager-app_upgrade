import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Clock, 
  Folder, 
  FolderOpen, 
  FolderPlus,
  Plus, 
  Star, 
  CheckCircle2, 
  Circle, 
  Zap, 
  Pin,
  Layers,
  ArrowRight,
  Filter,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  CalendarDays,
  SlidersHorizontal,
  Edit2,
  Trash2,
  GripVertical,
  Check,
  X,
  RefreshCw,
  ListTodo,
  RotateCcw,
  Repeat,
  LayoutGrid,
  ArrowLeftRight
} from 'lucide-react';
import { Task, Category } from '../types';
import { cn } from '../lib/utils';
import { format, addDays, subDays, startOfDay, isSameDay, isToday, isTomorrow, differenceInCalendarDays } from 'date-fns';
import { isTaskOccurringOnDate } from '../lib/taskDateUtils';

export interface CustomTimelineColumn {
  id: string;
  label: string;
}

export type TimelineNavItem = 
  | { type: 'folder'; path: string; name: string; level: number; projectIndex: number; colIndex: number; slotKey: string }
  | { type: 'task'; taskId: string; task: Task; projectPath: string; projectIndex: number; colIndex: number; slotKey: string; cellIndex: number };

const DEFAULT_CUSTOM_COLUMNS: CustomTimelineColumn[] = [
  { id: 'phase-1', label: 'Phase 1' },
  { id: 'phase-2', label: 'Phase 2' },
  { id: 'phase-3', label: 'Phase 3' },
  { id: 'phase-4', label: 'Phase 4' },
  { id: 'phase-5', label: 'Phase 5' }
];

export const getTaskCurrentColumnId = (task: Task, cols: CustomTimelineColumn[]): string | undefined => {
  // 1. Check direct timelineColumn if it matches a column in current custom columns
  if (task.timelineColumn && cols.some(c => c.id === task.timelineColumn)) {
    return task.timelineColumn;
  }
  // 2. Check legacy timelinePresetColumns for backward compatibility
  if (task.timelinePresetColumns) {
    for (const colId of Object.values(task.timelinePresetColumns)) {
      if (colId && cols.some(c => c.id === colId)) {
        return colId;
      }
    }
  }
  return undefined;
};

// Helper for approaching or overdue deadline alerts
export const getTaskDeadlineAlert = (deadline?: number, isDone?: boolean, isJa: boolean = true) => {
  if (!deadline || isDone) return null;
  const now = Date.now();
  const targetDate = new Date(deadline);
  const isOverdue = deadline < now;
  const isTargetToday = isToday(targetDate);
  const isTargetTomorrow = isTomorrow(targetDate);
  const daysDiff = differenceInCalendarDays(targetDate, new Date());

  if (isOverdue) {
    return {
      isOverdue: true,
      label: isJa ? '期限切' : 'Overdue',
      tooltip: isJa ? `期限切れ: ${format(targetDate, 'yyyy/MM/dd HH:mm')}` : `Overdue: ${format(targetDate, 'yyyy/MM/dd HH:mm')}`
    };
  }
  if (isTargetToday) {
    return {
      isOverdue: false,
      label: isJa ? '本日' : 'Today',
      tooltip: isJa ? `本日締切: ${format(targetDate, 'HH:mm')}` : `Due today: ${format(targetDate, 'HH:mm')}`
    };
  }
  if (isTargetTomorrow) {
    return {
      isOverdue: false,
      label: isJa ? '明日' : 'Tomorrow',
      tooltip: isJa ? `明日締切: ${format(targetDate, 'MM/dd')}` : `Due tomorrow: ${format(targetDate, 'MM/dd')}`
    };
  }
  if (daysDiff <= 3 && daysDiff > 0) {
    return {
      isOverdue: false,
      label: isJa ? `あと${daysDiff}日` : `In ${daysDiff}d`,
      tooltip: isJa ? `締切間近: ${format(targetDate, 'MM/dd')}` : `Due soon: ${format(targetDate, 'MM/dd')}`
    };
  }
  return null;
};

interface ProjectTimelineViewProps {
  tasks: Task[];
  activeTaskId: string | null;
  onSelectTask: (taskId: string, isPermanent?: boolean) => void;
  onUpdateTask?: (taskId: string, updates: Partial<Task>) => void;
  onScheduleTask?: (taskId: string, deadline?: number) => void;
  onMoveTaskFolder?: (taskId: string, newProject: string) => void;
  onMoveFolder?: (sourceFolderPath: string, targetFolderPath: string) => void;
  onRenameFolder?: (oldFolderPath: string, newFolderPath: string) => void;
  onRenameTask?: (taskId: string, newTitle: string) => void;
  onToggleDone: (taskId: string) => void;
  onToggleStar: (taskId: string) => void;
  onTogglePin?: (taskId: string) => void;
  onMoveTask?: (taskId: string, category: Category) => void;
  onAddTask: (taskData: { 
    title: string; 
    project: string; 
    deadline?: number; 
    isAllDay?: boolean;
    timelineColumn?: string;
    timelinePresetColumns?: Record<string, string>;
    order?: number;
  }) => Promise<void>;
  activeSection?: string;
  language?: string;
  t: (key: string) => string;
}

export const ProjectTimelineView: React.FC<ProjectTimelineViewProps> = ({
  tasks,
  activeTaskId,
  onSelectTask,
  onUpdateTask,
  onScheduleTask,
  onMoveTaskFolder,
  onMoveFolder,
  onRenameFolder,
  onRenameTask,
  onToggleDone,
  onToggleStar,
  onTogglePin,
  onMoveTask,
  onAddTask,
  activeSection = 'dashboard',
  language = 'en',
  t
}) => {
  const isJa = language === 'ja';

  // Mode: 'calendar' (specific dates) vs 'custom' (abstract columns: 1 day, 1 week, custom stages)
  const [timelineMode, setTimelineMode] = useState<'calendar' | 'custom'>(() => {
    try {
      return (localStorage.getItem('navfor_timeline_mode') as 'calendar' | 'custom') || 'calendar';
    } catch {
      return 'calendar';
    }
  });

  const handleSetTimelineMode = (mode: 'calendar' | 'custom') => {
    setTimelineMode(mode);
    try {
      localStorage.setItem('navfor_timeline_mode', mode);
    } catch (e) {
      console.error(e);
    }
  };

  // Custom Columns State (Phases)
  const [customColumns, setCustomColumns] = useState<CustomTimelineColumn[]>(() => {
    try {
      const saved = localStorage.getItem(`navfor_custom_timeline_cols_${activeSection}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // If previous default was Day 1-7, migrate to new default Phase 1-5
          const isOldDayDefault = parsed.length === 7 && parsed[0]?.id === 'day-1' && parsed[6]?.id === 'day-7';
          if (!isOldDayDefault) {
            return parsed;
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_CUSTOM_COLUMNS;
  });

  const saveCustomColumns = (cols: CustomTimelineColumn[]) => {
    setCustomColumns(cols);
    try {
      localStorage.setItem(`navfor_custom_timeline_cols_${activeSection}`, JSON.stringify(cols));
    } catch (e) {
      console.error(e);
    }
  };

  // Reset custom columns/phases to default Phase 1 - 5
  const handleResetCustomColumns = () => {
    saveCustomColumns(DEFAULT_CUSTOM_COLUMNS);
  };

  // Column renaming state
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
  const [editingColumnLabel, setEditingColumnLabel] = useState('');

  // Calendar Timeline view window state (start date, number of days visible)
  const [windowStartDate, setWindowStartDate] = useState<Date>(() => subDays(startOfDay(new Date()), 2));
  const [daysCount, setDaysCount] = useState<number>(14); // 7, 14, 21, 30
  const [showUnscheduledColumn, setShowUnscheduledColumn] = useState(true);
  const [collapsedProjectPaths, setCollapsedProjectPaths] = useState<Set<string>>(new Set());

  // Fine Grid Step in hours (1h, 2h, 4h, 6h, 12h, 24h)
  const [gridStepHours, setGridStepHours] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('navfor_timeline_grid_step');
      return saved ? Number(saved) : 4;
    } catch {
      return 4;
    }
  });

  const handleSetGridStepHours = (hours: number) => {
    setGridStepHours(hours);
    try {
      localStorage.setItem('navfor_timeline_grid_step', String(hours));
    } catch (e) {
      console.error(e);
    }
  };

  // Grid ON / OFF toggle (works for both Dates and Custom/Stages modes)
  const [isGridEnabled, setIsGridEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('navfor_timeline_grid_enabled');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const handleToggleGrid = (enabled: boolean) => {
    setIsGridEnabled(enabled);
    try {
      localStorage.setItem('navfor_timeline_grid_enabled', String(enabled));
    } catch (e) {
      console.error(e);
    }
  };

  // Stage grid subdivisions for Custom/Stages mode (e.g. 2, 3, 4, 5)
  const [stageSubdivisions, setStageSubdivisions] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('navfor_timeline_stage_subdivisions');
      return saved ? Number(saved) : 3;
    } catch {
      return 3;
    }
  });

  const handleSetStageSubdivisions = (subs: number) => {
    setStageSubdivisions(subs);
    try {
      localStorage.setItem('navfor_timeline_stage_subdivisions', String(subs));
    } catch (e) {
      console.error(e);
    }
  };

  // Drag over fine grid slot state
  const [dragOverGridSlot, setDragOverGridSlot] = useState<{ project: string; slotIdx: number } | null>(null);

  // Per-workspace custom folders (including empty folders)
  const [customFolders, setCustomFolders] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`navfor_folders_${activeSection}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Re-sync customFolders when activeSection changes or custom folders updated
  useEffect(() => {
    const syncFolders = () => {
      try {
        const saved = localStorage.getItem(`navfor_folders_${activeSection}`);
        setCustomFolders(saved ? JSON.parse(saved) : []);
      } catch {
        setCustomFolders([]);
      }
    };
    syncFolders();
    window.addEventListener('navfor_folders_updated', syncFolders);
    return () => window.removeEventListener('navfor_folders_updated', syncFolders);
  }, [activeSection]);

  const saveCustomFolders = (folders: string[]) => {
    setCustomFolders(folders);
    try {
      localStorage.setItem(`navfor_folders_${activeSection}`, JSON.stringify(folders));
      window.dispatchEvent(new Event('navfor_folders_updated'));
    } catch (err) {
      console.error(err);
    }
  };

  // State for creating new project folder
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [targetParentFolder, setTargetParentFolder] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');

  // Active selected item in timeline for keyboard navigation & focus ('folder:PATH' or 'task:ID')
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectedFolderPath, setSelectedFolderPath] = useState<string | null>(null);
  const timelineGridRef = useRef<HTMLDivElement>(null);

  // Inline rename state for folder or task
  const [renamingItem, setRenamingItem] = useState<{
    type: 'folder' | 'task';
    idOrPath: string;
    initialValue: string;
  } | null>(null);
  const [renameInputValue, setRenameInputValue] = useState('');

  const startRenaming = (type: 'folder' | 'task', idOrPath: string, initialValue: string) => {
    setRenamingItem({ type, idOrPath, initialValue });
    setRenameInputValue(initialValue);
  };

  const handleRenameSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!renamingItem) return;

    const val = renameInputValue.trim();
    if (val && val !== renamingItem.initialValue) {
      if (renamingItem.type === 'task') {
        if (onRenameTask) {
          onRenameTask(renamingItem.idOrPath, val);
        }
      } else {
        // Folder rename
        if (onRenameFolder) {
          const oldPath = renamingItem.idOrPath;
          const parts = oldPath.split('/');
          parts[parts.length - 1] = val;
          const newPath = parts.join('/');
          onRenameFolder(oldPath, newPath);

          // Update collapsedProjectPaths state
          setCollapsedProjectPaths(prev => {
            const next = new Set<string>();
            prev.forEach(p => {
              if (p === oldPath) next.add(newPath);
              else if (p.startsWith(oldPath + '/')) next.add(p.replace(oldPath, newPath));
              else next.add(p);
            });
            return next;
          });

          setSelectedFolderPath(newPath);
          setSelectedKey(`folder:${newPath}`);
        }
      }
    }
    setRenamingItem(null);
    setRenameInputValue('');
  };

  // Sync selectedKey and selectedFolderPath when activeTaskId is selected from outside
  useEffect(() => {
    if (activeTaskId) {
      setSelectedKey(`task:${activeTaskId}`);
      setSelectedFolderPath(null);
      const task = tasks.find(t => t.id === activeTaskId);
      if (task?.project && collapsedProjectPaths.has(task.project)) {
        setCollapsedProjectPaths(prev => {
          const next = new Set(prev);
          next.delete(task.project);
          return next;
        });
      }
    }
  }, [activeTaskId, tasks]);

  // User adjustable project column width
  const [projectColWidth, setProjectColWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('navfor_timeline_project_col_width');
      if (saved) return parseInt(saved, 10);
    } catch {}
    return typeof window !== 'undefined' && window.innerWidth < 640 ? 210 : 256;
  });

  const isResizingProject = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const handleStartProjectResize = (clientX: number) => {
    isResizingProject.current = true;
    startXRef.current = clientX;
    startWidthRef.current = projectColWidth;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!isResizingProject.current) return;
      const currentX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const delta = currentX - startXRef.current;
      const newWidth = Math.max(140, Math.min(500, startWidthRef.current + delta));
      setProjectColWidth(newWidth);
    };

    const handleEnd = () => {
      if (!isResizingProject.current) return;
      isResizingProject.current = false;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
      try {
        setProjectColWidth(w => {
          localStorage.setItem('navfor_timeline_project_col_width', String(w));
          return w;
        });
      } catch {}
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleEnd);
  };

  // User adjustable ToDo List column width
  const [todoColWidth, setTodoColWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('navfor_timeline_todo_col_width');
      if (saved) return parseInt(saved, 10);
    } catch {}
    return 160;
  });

  const isResizingTodo = useRef(false);
  const startTodoXRef = useRef(0);
  const startTodoWidthRef = useRef(0);

  const handleStartTodoResize = (clientX: number) => {
    isResizingTodo.current = true;
    startTodoXRef.current = clientX;
    startTodoWidthRef.current = todoColWidth;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!isResizingTodo.current) return;
      const currentX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const delta = currentX - startTodoXRef.current;
      const newWidth = Math.max(100, Math.min(450, startTodoWidthRef.current + delta));
      setTodoColWidth(newWidth);
    };

    const handleEnd = () => {
      if (!isResizingTodo.current) return;
      isResizingTodo.current = false;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
      try {
        setTodoColWidth(w => {
          localStorage.setItem('navfor_timeline_todo_col_width', String(w));
          return w;
        });
      } catch {}
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleEnd);
  };

  // User adjustable Phase (custom) columns width
  const [customColWidths, setCustomColWidths] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('navfor_timeline_custom_col_widths');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  });

  const isResizingCustomCol = useRef<string | null>(null);
  const startCustomXRef = useRef(0);
  const startCustomWidthRef = useRef(0);

  const defaultCustomColWidth = useMemo(() => {
    const subs = isGridEnabled ? stageSubdivisions : 1;
    if (!isGridEnabled) return 200;
    if (subs <= 2) return 200;
    if (subs <= 3) return 240;
    if (subs <= 4) return 272;
    return 300;
  }, [isGridEnabled, stageSubdivisions]);

  const getCustomColWidth = useCallback((colId: string): number => {
    return customColWidths[colId] || defaultCustomColWidth;
  }, [customColWidths, defaultCustomColWidth]);

  const handleStartCustomColResize = (colId: string, clientX: number) => {
    isResizingCustomCol.current = colId;
    startCustomXRef.current = clientX;
    startCustomWidthRef.current = getCustomColWidth(colId);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!isResizingCustomCol.current) return;
      const currentX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const delta = currentX - startCustomXRef.current;
      const newWidth = Math.max(120, Math.min(800, startCustomWidthRef.current + delta));
      setCustomColWidths(prev => ({
        ...prev,
        [colId]: newWidth
      }));
    };

    const handleEnd = () => {
      if (!isResizingCustomCol.current) return;
      isResizingCustomCol.current = null;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
      try {
        setCustomColWidths(widths => {
          localStorage.setItem('navfor_timeline_custom_col_widths', JSON.stringify(widths));
          return widths;
        });
      } catch {}
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleEnd);
  };

  const handleResetColumnWidths = () => {
    const defaultProj = typeof window !== 'undefined' && window.innerWidth < 640 ? 210 : 256;
    setProjectColWidth(defaultProj);
    setTodoColWidth(160);
    setCustomColWidths({});
    try {
      localStorage.removeItem('navfor_timeline_project_col_width');
      localStorage.removeItem('navfor_timeline_todo_col_width');
      localStorage.removeItem('navfor_timeline_custom_col_widths');
    } catch {}
  };

  // Drag over target cell state
  const [dragOverCell, setDragOverCell] = useState<{ 
    project: string; 
    slotKey: string; // date timestamp, columnId, or 'backlog'
  } | null>(null);

  // Drag over task target state (for reordering before/after)
  const [dragOverTask, setDragOverTask] = useState<{
    taskId: string;
    position: 'before' | 'after';
  } | null>(null);

  // Quick inline task creation in timeline cell
  const isSubmittingQuickAddRef = useRef(false);
  const [quickAddCell, setQuickAddCell] = useState<{ 
    project: string; 
    slotKey: string; 
    type: 'calendar' | 'custom' | 'backlog';
    dateMs?: number;
    columnId?: string;
    stepIdx?: number;
    slotIdx?: number;
  } | null>(null);
  const [quickAddTitle, setQuickAddTitle] = useState('');

  // Generate date columns
  const timelineDates = useMemo(() => {
    const dates: Date[] = [];
    for (let i = 0; i < daysCount; i++) {
      dates.push(addDays(windowStartDate, i));
    }
    return dates;
  }, [windowStartDate, daysCount]);

  // Fine grid calculations for Calendar Mode
  const effectiveGridStep = isGridEnabled ? gridStepHours : 24;
  const slotDurationMs = useMemo(() => effectiveGridStep * 3600 * 1000, [effectiveGridStep]);
  const slotsPerDay = useMemo(() => Math.max(1, Math.round(24 / effectiveGridStep)), [effectiveGridStep]);
  const totalSlots = useMemo(() => daysCount * slotsPerDay, [daysCount, slotsPerDay]);
  const timelineStartMs = useMemo(() => startOfDay(windowStartDate).getTime(), [windowStartDate]);

  const slotWidth = useMemo(() => {
    if (!isGridEnabled) return 130;
    if (gridStepHours <= 1) return 30;
    if (gridStepHours <= 2) return 38;
    if (gridStepHours <= 4) return 46;
    if (gridStepHours <= 6) return 60;
    if (gridStepHours <= 12) return 84;
    return 130;
  }, [isGridEnabled, gridStepHours]);

  const totalGridWidth = useMemo(() => totalSlots * slotWidth, [totalSlots, slotWidth]);

  // Grid calculations for Custom/Stages Mode (Dates pattern without dates)
  const totalCustomGridWidth = useMemo(() => {
    return customColumns.reduce((sum, col) => sum + getCustomColWidth(col.id), 0);
  }, [customColumns, getCustomColWidth]);

  interface GridSlotInfo {
    index: number;
    startMs: number;
    endMs: number;
    date: Date;
    hour: number;
    isDayStart: boolean;
    isToday: boolean;
    dayIndex: number;
  }

  const gridSlots = useMemo<GridSlotInfo[]>(() => {
    const slots: GridSlotInfo[] = [];
    const today = startOfDay(new Date());
    for (let d = 0; d < daysCount; d++) {
      const dayDate = addDays(windowStartDate, d);
      const isDayToday = isSameDay(dayDate, today);
      for (let s = 0; s < slotsPerDay; s++) {
        const startMs = dayDate.getTime() + s * slotDurationMs;
        const endMs = startMs + slotDurationMs;
        const hour = s * gridStepHours;
        slots.push({
          index: d * slotsPerDay + s,
          startMs,
          endMs,
          date: dayDate,
          hour,
          isDayStart: s === 0,
          isToday: isDayToday,
          dayIndex: d
        });
      }
    }
    return slots;
  }, [windowStartDate, daysCount, slotsPerDay, slotDurationMs, gridStepHours]);

  // Current time line offset in px
  const nowOffsetPx = useMemo(() => {
    const nowMs = Date.now();
    const diffMs = nowMs - timelineStartMs;
    const totalMs = totalSlots * slotDurationMs;
    if (diffMs < 0 || diffMs > totalMs) return -1;
    return (diffMs / slotDurationMs) * slotWidth;
  }, [timelineStartMs, totalSlots, slotDurationMs, slotWidth]);

  // Active tasks for this section (Urgent + Focus)
  const activeTasks = useMemo(() => {
    return tasks.filter(t => t.category === 'Urgent' || t.category === 'Focus');
  }, [tasks]);

  // Group tasks by project matching TaskExplorerTree hierarchy and ordering
  const projectTree = useMemo(() => {
    interface Node {
      name: string;
      fullPath: string;
      level: number;
      subfolders: Map<string, Node>;
      tasks: Task[];
    }

    const root: Node = {
      name: 'root',
      fullPath: '',
      level: -1,
      subfolders: new Map(),
      tasks: []
    };

    const getOrCreateFolder = (pathParts: string[]): Node => {
      let current = root;
      let accPath = '';
      pathParts.forEach((part, idx) => {
        accPath = accPath ? `${accPath}/${part}` : part;
        if (!current.subfolders.has(part)) {
          current.subfolders.set(part, {
            name: part,
            fullPath: accPath,
            level: idx,
            subfolders: new Map(),
            tasks: []
          });
        }
        current = current.subfolders.get(part)!;
      });
      return current;
    };

    // 1. Include custom empty folders (matching Explorer)
    customFolders.forEach(folderPath => {
      if (!folderPath) return;
      const parts = folderPath.split(/[\/\\]/).map(p => p.trim()).filter(Boolean);
      if (parts.length > 0) {
        getOrCreateFolder(parts);
      }
    });

    // 2. Include all active tasks (Urgent or Focus, matching Explorer)
    activeTasks.forEach(task => {
      const proj = task.project?.trim() || 'General';
      const parts = proj.split(/[\/\\]/).map(p => p.trim()).filter(Boolean);
      const folder = getOrCreateFolder(parts.length > 0 ? parts : ['General']);
      folder.tasks.push(task);
    });

    // Traverse recursively matching Explorer display order (depth-first, sorted alphabetically)
    const result: { fullPath: string; name: string; level: number; tasks: Task[] }[] = [];

    const traverse = (node: Node) => {
      const sortedSubs = Array.from(node.subfolders.values()).sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
      );

      sortedSubs.forEach(sub => {
        result.push({
          fullPath: sub.fullPath,
          name: sub.name,
          level: sub.level,
          tasks: sub.tasks
        });
        traverse(sub);
      });
    };

    traverse(root);

    // If completely empty, ensure General exists
    if (result.length === 0) {
      result.push({
        fullPath: 'General',
        name: 'General',
        level: 0,
        tasks: []
      });
    }

    return result;
  }, [activeTasks, customFolders]);

  const toggleProjectCollapse = (path: string) => {
    setCollapsedProjectPaths(prev => {
      const next = new Set(prev);
      const isCurrentlyCollapsed = next.has(path);
      if (isCurrentlyCollapsed) {
        // Expanding parent: remove parent AND all its child/descendant folders so children are toggled open
        next.delete(path);
        projectTree.forEach(p => {
          if (p.fullPath.startsWith(path + '/')) {
            next.delete(p.fullPath);
          }
        });
      } else {
        // Collapsing parent: collapse this folder AND all its child/descendant folders
        next.add(path);
        projectTree.forEach(p => {
          if (p.fullPath.startsWith(path + '/')) {
            next.add(p.fullPath);
          }
        });
      }
      return next;
    });
  };

  // Visible projects in Timeline: a project row is displayed only if none of its parent ancestors are collapsed
  const visibleProjectTree = useMemo(() => {
    return projectTree.filter(project => {
      const parts = project.fullPath.split(/[\/\\]/).filter(Boolean);
      let current = '';
      for (let i = 0; i < parts.length - 1; i++) {
        current = current ? `${current}/${parts[i]}` : parts[i];
        if (collapsedProjectPaths.has(current)) {
          return false;
        }
      }
      return true;
    });
  }, [projectTree, collapsedProjectPaths]);

  // Check if all projects are collapsed
  const isAllProjectsCollapsed = useMemo(() => {
    if (projectTree.length === 0) return false;
    return projectTree.every(p => collapsedProjectPaths.has(p.fullPath));
  }, [projectTree, collapsedProjectPaths]);

  // Toggle Collapse All / Expand All projects
  const handleToggleCollapseAllProjects = () => {
    if (isAllProjectsCollapsed) {
      setCollapsedProjectPaths(new Set());
    } else {
      setCollapsedProjectPaths(new Set(projectTree.map(p => p.fullPath)));
    }
  };

  // Chronological execution sequence for each task within its project lane (#1, #2, ...)
  // Timeline tasks have higher priority than ToDo list tasks. Done tasks do not receive sequence numbers.
  const projectTaskSequenceMap = useMemo(() => {
    const map = new Map<string, number>();

    projectTree.forEach(project => {
      const nonDoneTasks = project.tasks.filter(t => !t.isDone);
      const sorted = [...nonDoneTasks].sort((a, b) => {
        if (timelineMode === 'calendar') {
          const aHas = typeof a.deadline === 'number';
          const bHas = typeof b.deadline === 'number';
          if (!aHas && !bHas) {
            return (a.order ?? 0) - (b.order ?? 0) || a.createdAt - b.createdAt;
          }
          // Timeline tasks (> ToDo tasks) come first!
          if (aHas && !bHas) return -1;
          if (!aHas && bHas) return 1;
          const aD = startOfDay(new Date(a.deadline!)).getTime();
          const bD = startOfDay(new Date(b.deadline!)).getTime();
          if (aD !== bD) return aD - bD;
          return (a.order ?? 0) - (b.order ?? 0) || a.createdAt - b.createdAt;
        } else {
          const aCol = getTaskCurrentColumnId(a, customColumns);
          const bCol = getTaskCurrentColumnId(b, customColumns);
          const aIdx = aCol ? customColumns.findIndex(c => c.id === aCol) : -1;
          const bIdx = bCol ? customColumns.findIndex(c => c.id === bCol) : -1;
          if (aIdx === -1 && bIdx === -1) {
            return (a.order ?? 0) - (b.order ?? 0) || a.createdAt - b.createdAt;
          }
          // Timeline tasks (> ToDo tasks) come first!
          if (aIdx !== -1 && bIdx === -1) return -1;
          if (aIdx === -1 && bIdx !== -1) return 1;
          if (aIdx !== bIdx) return aIdx - bIdx;
          return (a.order ?? 0) - (b.order ?? 0) || a.createdAt - b.createdAt;
        }
      });

      sorted.forEach((task, idx) => {
        map.set(task.id, idx + 1);
      });
    });

    return map;
  }, [projectTree, timelineMode, customColumns]);

  interface PlacedTask {
    task: Task;
    startPx: number;
    widthPx: number;
    endPx: number;
    rowIdx: number;
    topPx: number;
  }

  // Calculate layout of tasks for a project lane on the fine grid
  const getPlacedTasksForProject = (projectTasks: Task[]) => {
    const scheduled = projectTasks.filter(t => typeof t.deadline === 'number');

    scheduled.sort((a, b) => {
      const aTime = a.startDate || a.deadline!;
      const bTime = b.startDate || b.deadline!;
      return aTime - bTime || (a.order ?? 0) - (b.order ?? 0) || a.createdAt - b.createdAt;
    });

    const placed: PlacedTask[] = [];
    const rowEndPx: number[] = [];

    scheduled.forEach(task => {
      const startMs = task.startDate && task.startDate < task.deadline! 
        ? task.startDate 
        : task.deadline!;
      const endMs = task.deadline!;

      const startSlotIdx = (startMs - timelineStartMs) / slotDurationMs;
      const endSlotIdx = (endMs - timelineStartMs) / slotDurationMs;

      const startPx = Math.max(0, startSlotIdx * slotWidth);
      let widthPx: number;
      if (task.startDate && task.startDate < task.deadline!) {
        const spanPx = (endSlotIdx - startSlotIdx) * slotWidth;
        widthPx = Math.max(120, spanPx);
      } else {
        widthPx = Math.max(130, Math.min(260, slotWidth * 3 - 4));
      }
      const endPx = startPx + widthPx;

      let rowIdx = 0;
      while (rowIdx < rowEndPx.length && startPx < (rowEndPx[rowIdx] + 6)) {
        rowIdx++;
      }

      rowEndPx[rowIdx] = endPx;
      const topPx = 6 + rowIdx * 34;

      placed.push({
        task,
        startPx,
        widthPx,
        endPx,
        rowIdx,
        topPx
      });
    });

    const laneHeight = Math.max(54, (rowEndPx.length || 1) * 34 + 14);
    return { placed, laneHeight };
  };

  interface PlacedCustomTask {
    task: Task;
    startPx: number;
    widthPx: number;
    endPx: number;
    rowIdx: number;
    topPx: number;
    colIdx: number;
    stepIdx: number;
  }

  // Calculate layout of tasks for a project lane on the Custom Stages grid (Dates pattern without dates)
  const getPlacedCustomTasksForProject = (projectTasks: Task[]) => {
    // Tasks assigned to a custom column
    const scheduled = projectTasks.filter(t => Boolean(getTaskCurrentColumnId(t, customColumns)));

    // Sort by column index, then timelineStep, then order, then createdAt
    const colOrderMap = new Map<string, number>(customColumns.map((c, idx) => [c.id, idx]));
    scheduled.sort((a, b) => {
      const colA = colOrderMap.get(getTaskCurrentColumnId(a, customColumns) || '') ?? 999;
      const colB = colOrderMap.get(getTaskCurrentColumnId(b, customColumns) || '') ?? 999;
      if (colA !== colB) return colA - colB;
      const stepA = a.timelineStep ?? 0;
      const stepB = b.timelineStep ?? 0;
      if (stepA !== stepB) return stepA - stepB;
      return (a.order ?? 0) - (b.order ?? 0) || a.createdAt - b.createdAt;
    });

    const placed: PlacedCustomTask[] = [];
    const rowEndPx: number[] = [];
    const effectiveSubs = isGridEnabled ? stageSubdivisions : 1;

    // Cumulative horizontal start offsets for each custom column
    const colOffsets: number[] = [];
    let accX = 0;
    customColumns.forEach(col => {
      colOffsets.push(accX);
      accX += getCustomColWidth(col.id);
    });

    scheduled.forEach(task => {
      const colId = getTaskCurrentColumnId(task, customColumns);
      const colIdx = customColumns.findIndex(c => c.id === colId);
      if (colIdx === -1) return;

      const rawStep = task.timelineStep ?? 0;
      const stepIdx = Math.max(0, Math.min(effectiveSubs - 1, rawStep));

      const thisColWidth = getCustomColWidth(colId!);
      const thisSubSlotWidth = thisColWidth / effectiveSubs;

      // Horizontal coordinate calculation
      const startPx = colOffsets[colIdx] + stepIdx * thisSubSlotWidth + 4;
      // Width of chip: spans comfortably within step slot, minimum 110px
      const widthPx = Math.max(110, Math.min(thisColWidth - 8, thisSubSlotWidth * 1.5 - 8));
      const endPx = startPx + widthPx;

      let rowIdx = 0;
      while (rowIdx < rowEndPx.length && startPx < (rowEndPx[rowIdx] + 6)) {
        rowIdx++;
      }

      rowEndPx[rowIdx] = endPx;
      const topPx = 6 + rowIdx * 34;

      placed.push({
        task,
        startPx,
        widthPx,
        endPx,
        rowIdx,
        topPx,
        colIdx,
        stepIdx
      });
    });

    const laneHeight = Math.max(54, (rowEndPx.length || 1) * 34 + 14);
    return { placed, laneHeight };
  };

  const handleGridDrop = (e: React.DragEvent, projectPath: string, targetTimeMs: number) => {
    const data = getDraggedTaskData(e);
    if (!data?.taskId) return;

    const updates: Partial<Task> = {
      project: projectPath,
      deadline: targetTimeMs,
      isAllDay: false
    };

    if (onUpdateTask) {
      onUpdateTask(data.taskId, updates);
    } else {
      if (onMoveTaskFolder) onMoveTaskFolder(data.taskId, projectPath);
      if (onScheduleTask) onScheduleTask(data.taskId, targetTimeMs);
    }
    (window as any).__navforDraggingTask = null;
  };

  const handleCustomGridDrop = (e: React.DragEvent, projectPath: string, columnId: string, stepIdx: number) => {
    const data = getDraggedTaskData(e);
    if (!data?.taskId) return;

    const updates: Partial<Task> = {
      project: projectPath,
      timelineColumn: columnId,
      timelineStep: stepIdx
    };

    if (onUpdateTask) {
      onUpdateTask(data.taskId, updates);
    } else {
      if (onMoveTaskFolder) onMoveTaskFolder(data.taskId, projectPath);
    }
    (window as any).__navforDraggingTask = null;
  };

  // 2D representation of all visible tasks on the timeline for deterministic arrow key navigation
  const timelineLanes = useMemo(() => {
    return visibleProjectTree.map((project, pIdx) => {
      const projectTasks = project.tasks;

      // Unscheduled tasks (ToDo list) - Sorted: Active (A-Z), then Done (A-Z)
      const unscheduled = (showUnscheduledColumn 
        ? projectTasks.filter(t => timelineMode === 'calendar' ? !t.deadline : !getTaskCurrentColumnId(t, customColumns))
        : []
      ).sort((a, b) => {
        const aDone = Boolean(a.isDone);
        const bDone = Boolean(b.isDone);
        if (aDone !== bDone) return aDone ? 1 : -1;
        return (a.title || '').localeCompare(b.title || '', undefined, { numeric: true, sensitivity: 'base' });
      });

      // Scheduled / column tasks
      let scheduled: Task[] = [];
      if (timelineMode === 'calendar') {
        scheduled = projectTasks.filter(t => typeof t.deadline === 'number')
          .sort((a, b) => {
            const aTime = a.startDate || a.deadline!;
            const bTime = b.startDate || b.deadline!;
            return aTime - bTime || (a.order ?? 0) - (b.order ?? 0) || a.createdAt - b.createdAt;
          });
      } else {
        const colOrderMap = new Map<string, number>(customColumns.map((c, idx) => [c.id, idx]));
        scheduled = projectTasks.filter(t => Boolean(getTaskCurrentColumnId(t, customColumns)))
          .sort((a, b) => {
            const colA: number = colOrderMap.get(getTaskCurrentColumnId(a, customColumns) || '') ?? 999;
            const colB: number = colOrderMap.get(getTaskCurrentColumnId(b, customColumns) || '') ?? 999;
            if (colA !== colB) return colA - colB;
            return (a.order ?? 0) - (b.order ?? 0) || (Number(a.createdAt) - Number(b.createdAt));
          });
      }

      // Combine in visual left-to-right order with approximate horizontal coordinate
      const allTasksInLane = [
        ...unscheduled.map((t, idx) => ({ task: t, xApprox: -200 + idx * 10 })),
        ...scheduled.map((t) => {
          let xApprox = 0;
          if (timelineMode === 'calendar' && t.deadline) {
            xApprox = (t.deadline - timelineStartMs) / slotDurationMs;
          } else {
            const colIdx = customColumns.findIndex(c => c.id === getTaskCurrentColumnId(t, customColumns));
            xApprox = colIdx >= 0 ? colIdx * 100 + (t.order ?? 0) : 0;
          }
          return { task: t, xApprox };
        })
      ];

      return {
        project,
        pIdx,
        tasks: allTasksInLane
      };
    });
  }, [visibleProjectTree, showUnscheduledColumn, timelineMode, customColumns, timelineStartMs, slotDurationMs]);

  // 2D Spatial Arrow Key Navigation: moves up, down, left, right exactly as displayed on the timeline
  const navigateSpatialTask = (direction: 'up' | 'down' | 'left' | 'right') => {
    (window as any).__navforActivePane = 'timeline';

    // 1. Gather all rendered task chips inside the timeline
    const allTaskEls = Array.from(
      document.querySelectorAll('#timeline-root [id^="timeline-task-"]')
    ) as HTMLElement[];

    if (allTaskEls.length === 0) return;

    // If no task is currently active, select the first or last task
    if (!activeTaskId) {
      const targetEl = (direction === 'down' || direction === 'right') ? allTaskEls[0] : allTaskEls[allTaskEls.length - 1];
      const targetId = targetEl.id.replace('timeline-task-', '');
      onSelectTask(targetId);
      setSelectedKey(`task:${targetId}`);
      setSelectedFolderPath(null);
      targetEl.focus({ preventScroll: true });
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      return;
    }

    const curEl = document.getElementById(`timeline-task-${activeTaskId}`);
    if (!curEl) {
      const targetId = allTaskEls[0].id.replace('timeline-task-', '');
      onSelectTask(targetId);
      setSelectedKey(`task:${targetId}`);
      setSelectedFolderPath(null);
      allTaskEls[0].focus({ preventScroll: true });
      allTaskEls[0].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      return;
    }

    const curRect = curEl.getBoundingClientRect();
    const curCx = curRect.left + curRect.width / 2;
    const curCy = curRect.top + curRect.height / 2;

    // Build candidates list with DOM bounding rects
    const candidates = allTaskEls
      .filter(el => el.id !== `timeline-task-${activeTaskId}`)
      .map(el => {
        const id = el.id.replace('timeline-task-', '');
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        return { el, id, rect, cx, cy };
      });

    let chosen: { el: HTMLElement; id: string } | null = null;

    if (direction === 'down') {
      // Find tasks strictly below current task
      const below = candidates.filter(c => c.cy > curCy + 6 || c.rect.top >= curRect.top + 8);
      if (below.length > 0) {
        let bestScore = Infinity;
        for (const cand of below) {
          const dy = cand.cy - curCy; // > 0
          const dx = cand.cx - curCx;
          // Check if candidate is vertically aligned (same column / stack)
          const isDirectlyBelow = Math.abs(dx) <= Math.max(curRect.width, cand.rect.width) * 0.75;
          let score: number;
          if (isDirectlyBelow) {
            // Immediate next task below in same stack gets lowest score
            score = dy;
          } else {
            // Lower lane / another column: minimize dy with dx penalty
            score = dy * 1.5 + Math.abs(dx) * 2.2 + 1000;
          }
          if (score < bestScore) {
            bestScore = score;
            chosen = cand;
          }
        }
      }
    } else if (direction === 'up') {
      // Find tasks strictly above current task
      const above = candidates.filter(c => c.cy < curCy - 6 || c.rect.bottom <= curRect.bottom - 8);
      if (above.length > 0) {
        let bestScore = Infinity;
        for (const cand of above) {
          const dy = curCy - cand.cy; // > 0
          const dx = cand.cx - curCx;
          const isDirectlyAbove = Math.abs(dx) <= Math.max(curRect.width, cand.rect.width) * 0.75;
          let score: number;
          if (isDirectlyAbove) {
            score = dy;
          } else {
            score = dy * 1.5 + Math.abs(dx) * 2.2 + 1000;
          }
          if (score < bestScore) {
            bestScore = score;
            chosen = cand;
          }
        }
      }
    } else if (direction === 'right') {
      // Find tasks to the right of current task
      const right = candidates.filter(c => c.cx > curCx + 8 || c.rect.left >= curRect.left + 10);
      if (right.length > 0) {
        let bestScore = Infinity;
        for (const cand of right) {
          const dx = cand.cx - curCx; // > 0
          const dy = cand.cy - curCy;
          // In same horizontal lane or row?
          const isSameLane = Math.abs(dy) <= Math.max(curRect.height, cand.rect.height) * 1.8;
          let score: number;
          if (isSameLane) {
            score = dx;
          } else {
            score = dx * 1.2 + Math.abs(dy) * 3.0 + 1000;
          }
          if (score < bestScore) {
            bestScore = score;
            chosen = cand;
          }
        }
      } else {
        // Wrap to the next project lane below: pick leftmost task in lower lanes
        const below = candidates.filter(c => c.cy > curCy + 10);
        if (below.length > 0) {
          below.sort((a, b) => (a.cy - b.cy) || (a.cx - b.cx));
          chosen = below[0];
        }
      }
    } else if (direction === 'left') {
      // Find tasks to the left of current task
      const left = candidates.filter(c => c.cx < curCx - 8 || c.rect.right <= curRect.right - 10);
      if (left.length > 0) {
        let bestScore = Infinity;
        for (const cand of left) {
          const dx = curCx - cand.cx; // > 0
          const dy = cand.cy - curCy;
          const isSameLane = Math.abs(dy) <= Math.max(curRect.height, cand.rect.height) * 1.8;
          let score: number;
          if (isSameLane) {
            score = dx;
          } else {
            score = dx * 1.2 + Math.abs(dy) * 3.0 + 1000;
          }
          if (score < bestScore) {
            bestScore = score;
            chosen = cand;
          }
        }
      } else {
        // Wrap to previous project lane above: pick rightmost task in upper lanes
        const above = candidates.filter(c => c.cy < curCy - 10);
        if (above.length > 0) {
          above.sort((a, b) => (b.cy - a.cy) || (b.cx - a.cx));
          chosen = above[0];
        }
      }
    }

    if (chosen) {
      onSelectTask(chosen.id);
      setSelectedKey(`task:${chosen.id}`);
      setSelectedFolderPath(null);
      chosen.el.focus({ preventScroll: true });
      chosen.el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  };

  // Keyboard navigation: visual sequence task file selection navigation across lanes and rows
  const handleNavKey = (e: KeyboardEvent | React.KeyboardEvent) => {
    const target = e.target as HTMLElement;
    const activeEl = typeof document !== 'undefined' ? (document.activeElement as HTMLElement) : null;
    if (
      target?.tagName === 'INPUT' ||
      target?.tagName === 'TEXTAREA' ||
      target?.tagName === 'SELECT' ||
      target?.isContentEditable ||
      activeEl?.tagName === 'INPUT' ||
      activeEl?.tagName === 'TEXTAREA' ||
      activeEl?.tagName === 'SELECT' ||
      activeEl?.isContentEditable ||
      quickAddCell
    ) {
      return;
    }

    // 1. Task navigation if a task is active: 2D spatial navigation exactly as displayed
    if (activeTaskId) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        navigateSpatialTask('down');
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        navigateSpatialTask('up');
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        navigateSpatialTask('right');
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        navigateSpatialTask('left');
        return;
      }

      // SPACE: Toggle done
      if (e.key === ' ') {
        e.preventDefault();
        onToggleDone(activeTaskId);
        return;
      }

      // ENTER or F2: Inline rename task title (like Explorer)
      if (e.key === 'Enter' || e.key === 'F2') {
        e.preventDefault();
        const task = tasks.find(t => t.id === activeTaskId);
        if (task) {
          startRenaming('task', task.id, task.title);
        }
        return;
      }

      // ESCAPE: Clear selection
      if (e.key === 'Escape') {
        e.preventDefault();
        onSelectTask('');
        setSelectedKey(null);
        return;
      }
    }

    // 2. Folder navigation if folder is selected
    if (selectedFolderPath || (selectedKey && selectedKey.startsWith('folder:'))) {
      const curPath = selectedFolderPath || selectedKey?.slice(7) || '';
      const curIdx = visibleProjectTree.findIndex(p => p.fullPath === curPath);

      if (e.key === 'ArrowUp' && curIdx > 0) {
        e.preventDefault();
        const prev = visibleProjectTree[curIdx - 1];
        setSelectedFolderPath(prev.fullPath);
        setSelectedKey(`folder:${prev.fullPath}`);
        const el = document.getElementById(`timeline-project-${encodeURIComponent(prev.fullPath)}`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        return;
      }
      if (e.key === 'ArrowDown' && curIdx !== -1 && curIdx < visibleProjectTree.length - 1) {
        e.preventDefault();
        const next = visibleProjectTree[curIdx + 1];
        setSelectedFolderPath(next.fullPath);
        setSelectedKey(`folder:${next.fullPath}`);
        const el = document.getElementById(`timeline-project-${encodeURIComponent(next.fullPath)}`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (collapsedProjectPaths.has(curPath)) {
          toggleProjectCollapse(curPath);
          return;
        }
        // If expanded and has tasks, select first task in this lane
        const lane = timelineLanes[curIdx];
        if (lane && lane.tasks.length > 0) {
          const firstTask = lane.tasks[0].task;
          (window as any).__navforActivePane = 'timeline';
          onSelectTask(firstTask.id);
          setSelectedKey(`task:${firstTask.id}`);
          setSelectedFolderPath(null);
          const el = document.getElementById(`timeline-task-${firstTask.id}`);
          el?.focus({ preventScroll: true });
          el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        }
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (!collapsedProjectPaths.has(curPath)) {
          toggleProjectCollapse(curPath);
        }
        return;
      }
      if (e.key === 'Enter' || e.key === 'F2') {
        e.preventDefault();
        const parts = curPath.split('/');
        const folderName = parts[parts.length - 1];
        startRenaming('folder', curPath, folderName);
        return;
      }
    }

    // 3. If nothing selected and user presses ArrowDown or ArrowRight on timeline
    if (!activeTaskId && !selectedFolderPath && !selectedKey) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        navigateSpatialTask('down');
        return;
      }
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        navigateSpatialTask('up');
        return;
      }
    }
  };

  // Keep DOM focus on the selected task chip when Timeline is active
  useEffect(() => {
    if (activeTaskId && (window as any).__navforActivePane === 'timeline') {
      const el = document.getElementById(`timeline-task-${activeTaskId}`);
      if (el && document.activeElement !== el) {
        el.focus({ preventScroll: true });
      }
    }
  }, [activeTaskId]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement as HTMLElement;
      if (
        activeEl?.tagName === 'INPUT' ||
        activeEl?.tagName === 'TEXTAREA' ||
        activeEl?.tagName === 'SELECT' ||
        activeEl?.isContentEditable ||
        renamingItem
      ) {
        return;
      }

      // Check if Timeline is active pane
      const isTimelineActive =
        (window as any).__navforActivePane === 'timeline' ||
        Boolean(activeEl?.closest('#timeline-root')) ||
        Boolean((e.target as HTMLElement)?.closest('#timeline-root'));

      if (!isTimelineActive) {
        // If Explorer is active pane and target is in explorer, let Explorer handle
        const isInsideExplorer =
          (window as any).__navforActivePane === 'explorer' &&
          (Boolean(activeEl?.closest('#explorer-tree-root')) ||
           Boolean((e.target as HTMLElement)?.closest('#explorer-tree-root')));

        if (isInsideExplorer) {
          return;
        }
      }

      // Ignore if dialog or quick-add is active
      if (document.querySelector('[role="dialog"]') || quickAddCell) {
        return;
      }

      // Handle arrow keys, enter, space, escape, f2
      if (['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Enter', ' ', 'Escape', 'F2'].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation?.();
        handleNavKey(e);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown, true);
  }, [activeTaskId, selectedFolderPath, selectedKey, collapsedProjectPaths, quickAddCell, visibleProjectTree, tasks, slotDurationMs, timelineStartMs, renamingItem]);

  const handleNavigate = (direction: 'prev' | 'next' | 'today') => {
    if (direction === 'today') {
      setWindowStartDate(subDays(startOfDay(new Date()), 2));
    } else if (direction === 'prev') {
      setWindowStartDate(prev => subDays(prev, 7));
    } else {
      setWindowStartDate(prev => addDays(prev, 7));
    }
  };

  // Add custom column (Phase)
  const handleAddColumn = () => {
    const nextNum = customColumns.length + 1;
    const newId = `phase-${Date.now()}`;
    const newLabel = `Phase ${nextNum}`;
    saveCustomColumns([...customColumns, { id: newId, label: newLabel }]);
    setEditingColumnId(newId);
    setEditingColumnLabel(newLabel);
  };

  // Rename custom column
  const handleSaveRenameColumn = (colId: string) => {
    if (!editingColumnLabel.trim()) {
      setEditingColumnId(null);
      return;
    }
    const updated = customColumns.map(col => 
      col.id === colId ? { ...col, label: editingColumnLabel.trim() } : col
    );
    saveCustomColumns(updated);
    setEditingColumnId(null);
  };

  // Delete custom column
  const handleDeleteColumn = (colId: string) => {
    if (customColumns.length <= 1) return;
    const updated = customColumns.filter(col => col.id !== colId);
    saveCustomColumns(updated);
  };

  // Drag and drop task & folder handling
  const [dragOverProjectHeader, setDragOverProjectHeader] = useState<string | null>(null);
  const [isDragOverRootHeader, setIsDragOverRootHeader] = useState(false);

  const handleProjectDragStart = (e: React.DragEvent, folderPath: string) => {
    e.stopPropagation();
    const payload = {
      type: 'folder',
      folderPath
    };
    (window as any).__navforDraggingFolder = payload;
    try {
      e.dataTransfer.setData('application/json', JSON.stringify(payload));
      e.dataTransfer.setData('text/plain', JSON.stringify(payload));
    } catch (err) {}
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleTaskDragStart = (e: React.DragEvent, task: Task) => {
    const payload = {
      type: 'task',
      taskId: task.id,
      fromProject: task.project,
      currentProject: task.project,
      fromDeadline: task.deadline,
      fromTimelineColumn: task.timelineColumn,
      fromOrder: task.order ?? 0
    };
    (window as any).__navforDraggingTask = payload;
    try {
      e.dataTransfer.setData('application/json', JSON.stringify(payload));
      e.dataTransfer.setData('text/plain', JSON.stringify(payload));
    } catch (err) {
      console.error(err);
    }
    e.dataTransfer.effectAllowed = 'move';
  };

  // Robustly extract dragged task payload from dataTransfer or window state
  const getDraggedTaskData = (e: React.DragEvent) => {
    let data: any = null;
    try {
      const raw = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain');
      if (raw) data = JSON.parse(raw);
    } catch (err) {}
    if (!data && (window as any).__navforDraggingTask) {
      data = (window as any).__navforDraggingTask;
    }
    return data;
  };

  // Move task or folder to another project by dropping onto Project Lane title
  const handleProjectHeaderDrop = (e: React.DragEvent, targetProject: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverProjectHeader(null);

    // Check if dragging a folder/subproject
    let folderData: any = null;
    try {
      const raw = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain');
      if (raw) folderData = JSON.parse(raw);
    } catch (err) {}
    if (!folderData && (window as any).__navforDraggingFolder) {
      folderData = (window as any).__navforDraggingFolder;
    }

    if (folderData?.type === 'folder' && folderData.folderPath) {
      const sourcePath = folderData.folderPath;
      if (sourcePath !== targetProject && !targetProject.startsWith(sourcePath + '/')) {
        if (onMoveFolder) {
          onMoveFolder(sourcePath, targetProject);
        }
      }
      (window as any).__navforDraggingFolder = null;
      return;
    }

    // Otherwise check if dragging a task to this project
    const data = getDraggedTaskData(e);
    if (!data?.taskId) return;

    if (onUpdateTask) {
      onUpdateTask(data.taskId, { project: targetProject });
    } else if (onMoveTaskFolder) {
      onMoveTaskFolder(data.taskId, targetProject);
    }
    (window as any).__navforDraggingTask = null;
  };

  // Reorder / Move task by dropping onto a cell (row: project, col: time slot)
  const handleCellDrop = (
    e: React.DragEvent, 
    project: string, 
    slot: { type: 'calendar'; date: Date | null } | { type: 'custom'; columnId: string | null }
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverCell(null);
    setDragOverTask(null);

    try {
      const data = getDraggedTaskData(e);
      if (!data?.taskId) return;

      const draggedTask = activeTasks.find(t => t.id === data.taskId);
      const updates: Partial<Task> = {};
      // Row (project) update
      updates.project = project;

      // Column (time/slot) update
      if (slot.type === 'calendar') {
        if (slot.date) {
          const target = new Date(slot.date);
          target.setHours(18, 0, 0, 0);
          updates.deadline = target.getTime();
          updates.isAllDay = true;
          updates.timelineColumn = undefined;
        } else {
          // In ToDo List column: do NOT clear deadline, original deadline is preserved
          updates.timelineColumn = undefined;
        }
      } else {
        if (slot.columnId) {
          updates.timelineColumn = slot.columnId;
          if (updates.timelineStep === undefined) {
            updates.timelineStep = draggedTask?.timelineStep ?? 0;
          }
          // In custom columns: do NOT clear deadline, original deadline is preserved
        } else {
          // In ToDo List (backlog): remove from column
          updates.timelineColumn = undefined;
          updates.timelineStep = undefined;
        }
      }

      // Calculate new order to place at end of slot
      const existingInSlot = activeTasks.filter(t => {
        if (t.project !== project) return false;
        if (t.id === data.taskId) return false;
        if (slot.type === 'calendar') {
          if (!slot.date) return !t.deadline;
          return t.deadline && isSameDay(new Date(t.deadline), slot.date);
        } else {
          const tCol = getTaskCurrentColumnId(t, customColumns);
          if (!slot.columnId) return !tCol;
          return tCol === slot.columnId;
        }
      });

      const maxOrder = existingInSlot.reduce((max, t) => Math.max(max, t.order ?? 0), 0);
      updates.order = maxOrder + 10;

      if (onUpdateTask) {
        onUpdateTask(data.taskId, updates);
      } else {
        if (onMoveTaskFolder && updates.project) onMoveTaskFolder(data.taskId, updates.project);
        if (onScheduleTask && slot.type === 'calendar') onScheduleTask(data.taskId, updates.deadline);
      }

      (window as any).__navforDraggingTask = null;
    } catch (err) {
      console.error(err);
    }
  };

  // Reorder task by dropping directly before or after another task chip
  const handleTaskDropOnTask = (
    e: React.DragEvent,
    targetTask: Task,
    position: 'before' | 'after'
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverCell(null);
    setDragOverTask(null);

    try {
      const data = getDraggedTaskData(e);
      if (!data?.taskId || data.taskId === targetTask.id) return;

      const draggedTask = activeTasks.find(t => t.id === data.taskId);
      const targetColId = timelineMode === 'custom' ? getTaskCurrentColumnId(targetTask, customColumns) : undefined;
      const isTargetBacklog = timelineMode === 'calendar' ? !targetTask.deadline : !targetColId;

      const updates: Partial<Task> = {
        project: targetTask.project,
      };

      if (timelineMode === 'custom') {
        if (targetColId) {
          updates.timelineColumn = targetColId;
          updates.timelineStep = targetTask.timelineStep ?? 0;
        } else {
          updates.timelineColumn = undefined;
          updates.timelineStep = undefined;
        }
      } else {
        updates.timelineColumn = isTargetBacklog ? undefined : targetTask.timelineColumn;
      }

      // Only adjust deadline if explicitly scheduling onto a calendar date slot
      if (timelineMode === 'calendar' && targetTask.deadline) {
        updates.deadline = targetTask.deadline;
        updates.isAllDay = targetTask.isAllDay;
      }
      // If moving in custom columns or between ToDo items, do NOT touch or reset deadline!

      // Find all sibling tasks in target slot (including ToDo List / backlog)
      const siblings = activeTasks.filter(t => {
        if (t.project !== targetTask.project) return false;
        if (t.id === data.taskId) return false; // exclude dragging task
        if (timelineMode === 'calendar') {
          if (!targetTask.deadline) return !t.deadline;
          return t.deadline && isSameDay(new Date(t.deadline), new Date(targetTask.deadline));
        } else {
          const tCol = getTaskCurrentColumnId(t, customColumns);
          if (!targetColId) return !tCol;
          return tCol === targetColId;
        }
      }).sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.createdAt - b.createdAt);

      const targetIdx = siblings.findIndex(s => s.id === targetTask.id);
      const insertIdx = position === 'before' ? Math.max(0, targetIdx) : targetIdx + 1;

      // Insert dragging task placeholder into list
      const reordered = [...siblings];
      reordered.splice(insertIdx, 0, { id: data.taskId } as any);

      // Distribute fresh spaced order numbers (10, 20, 30...)
      reordered.forEach((item, index) => {
        const newOrder = (index + 1) * 10;
        if (item.id === data.taskId) {
          updates.order = newOrder;
        } else if (item.order !== newOrder) {
          if (onUpdateTask) onUpdateTask(item.id, { order: newOrder });
        }
      });

      if (onUpdateTask) {
        onUpdateTask(data.taskId, updates);
      } else {
        if (onMoveTaskFolder) onMoveTaskFolder(data.taskId, updates.project);
        if (onScheduleTask && updates.deadline) onScheduleTask(data.taskId, updates.deadline);
      }

      (window as any).__navforDraggingTask = null;
    } catch (err) {
      console.error(err);
    }
  };

  const handleQuickAddSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSubmittingQuickAddRef.current) return;
    if (!quickAddCell || !quickAddTitle.trim()) {
      setQuickAddCell(null);
      setQuickAddTitle('');
      return;
    }

    const cell = quickAddCell;
    const title = quickAddTitle.trim();
    isSubmittingQuickAddRef.current = true;

    // Immediately clear quick add so no ghost duplicate card or input flashes while creating
    setQuickAddCell(null);
    setQuickAddTitle('');

    try {
      await onAddTask({
        title,
        project: cell.project,
        deadline: cell.type === 'calendar' ? cell.dateMs : undefined,
        timelineColumn: cell.type === 'custom' ? cell.columnId : undefined,
        timelineStep: cell.type === 'custom' ? (cell.stepIdx ?? 0) : undefined,
        isAllDay: true,
        order: Date.now() % 10000
      });
    } finally {
      isSubmittingQuickAddRef.current = false;
    }
  };

  return (
    <div 
      id="timeline-root"
      onMouseDown={() => {
        (window as any).__navforActivePane = 'timeline';
      }}
      onFocus={() => {
        (window as any).__navforActivePane = 'timeline';
      }}
      className="flex-1 h-full min-h-0 flex flex-col bg-white border border-slate-200/90 rounded-xl overflow-hidden shadow-2xs"
    >
      {/* Timeline Top Control Toolbar */}
      <div className="relative z-40 flex items-center justify-between px-3 py-2 border-b border-slate-200 bg-slate-50/90 shrink-0 select-none flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
            <CalendarDays size={16} className="text-indigo-600 shrink-0" />
            <span>{isJa ? 'プロジェクト タイムライン' : 'Project Timeline'}</span>
          </div>

          <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block" />

          {/* Mode Switcher: Calendar Dates vs Custom Columns */}
          <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs">
            <button
              onClick={() => handleSetTimelineMode('calendar')}
              className={cn(
                "px-2.5 py-1 text-[11px] font-bold rounded-md transition-all flex items-center gap-1",
                timelineMode === 'calendar'
                  ? "bg-indigo-600 text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              )}
              title={isJa ? "日付基準（カレンダー日付）" : "Calendar Dates"}
            >
              <CalendarIcon size={12} />
              <span>{isJa ? "日付基準" : "Dates"}</span>
            </button>
            <button
              onClick={() => handleSetTimelineMode('custom')}
              className={cn(
                "px-2.5 py-1 text-[11px] font-bold rounded-md transition-all flex items-center gap-1",
                timelineMode === 'custom'
                  ? "bg-indigo-600 text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              )}
              title={isJa ? "抽象的期間・ステージ（1 day, 1 week, カスタム列）" : "Abstract Periods & Stages"}
            >
              <SlidersHorizontal size={12} />
              <span>{isJa ? "カスタム期間" : "Custom / Stages"}</span>
            </button>
          </div>

          {/* Calendar Controls (Only in Calendar Mode) */}
          {timelineMode === 'calendar' ? (
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs">
              <button
                onClick={() => handleNavigate('prev')}
                className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors"
                title={isJa ? '1週間前へ' : 'Previous week'}
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() => handleNavigate('today')}
                className="px-2 py-0.5 text-[11px] font-bold text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
              >
                {isJa ? '今日' : 'Today'}
              </button>
              <button
                onClick={() => handleNavigate('next')}
                className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors"
                title={isJa ? '1週間後へ' : 'Next week'}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          ) : (
            /* Custom Columns Controls (Add Column & Reset) */
            <div className="flex items-center gap-1.5">
              {/* Add Column Button */}
              <button
                onClick={handleAddColumn}
                className="px-2 py-1 text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 rounded-lg transition-colors flex items-center gap-1 shadow-2xs"
                title={isJa ? "Phase列を追加" : "Add Phase Column"}
              >
                <Plus size={13} />
                <span>{isJa ? "列を追加" : "Add Column"}</span>
              </button>

              {/* Reset Custom Phases (Names & Count) Button */}
              <button
                onClick={handleResetCustomColumns}
                className="px-2 py-1 text-[11px] font-bold bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-1 shadow-2xs"
                title={isJa ? "列名・列数を初期値（Phase 1〜5）にリセット" : "Reset phases configuration (names and count) to default (Phase 1-5)"}
              >
                <RefreshCw size={12} className="text-slate-500" />
                <span>{isJa ? "列構成リセット" : "Reset Phases"}</span>
              </button>
            </div>
          )}

          {timelineMode === 'calendar' && (
            <span className="text-[11px] font-mono text-slate-500 hidden sm:inline">
              {format(timelineDates[0], 'yyyy/MM/dd')} - {format(timelineDates[timelineDates.length - 1], 'MM/dd')}
            </span>
          )}
        </div>

        {/* View Options Right */}
        <div className="flex items-center gap-2">
          {/* Add Project Folder Button */}
          <button
            onClick={() => {
              setTargetParentFolder(null);
              setNewFolderName('');
              setIsCreateFolderOpen(true);
            }}
            className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-all flex items-center gap-1.5 shadow-2xs"
            title={isJa ? "プロジェクトフォルダを追加" : "Add Project Folder"}
          >
            <FolderPlus size={13} className="text-indigo-600 shrink-0" />
            <span>{isJa ? "フォルダ追加" : "Add Folder"}</span>
          </button>

          {/* Collapse / Expand All Project Folders Button */}
          <button
            onClick={handleToggleCollapseAllProjects}
            className={cn(
              "px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all flex items-center gap-1.5 shadow-2xs",
              isAllProjectsCollapsed
                ? "bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            )}
            title={isAllProjectsCollapsed 
              ? (isJa ? "すべてのプロジェクトフォルダを展開" : "Expand all project folders") 
              : (isJa ? "すべてのプロジェクトフォルダを折りたたむ" : "Collapse all project folders")
            }
          >
            {isAllProjectsCollapsed ? (
              <ChevronsUpDown size={13} className="text-amber-600 shrink-0" />
            ) : (
              <ChevronsDownUp size={13} className="text-slate-500 shrink-0" />
            )}
            <span>
              {isAllProjectsCollapsed 
                ? (isJa ? "全フォルダ展開" : "Expand All") 
                : (isJa ? "全フォルダ折畳" : "Collapse All")
              }
            </span>
          </button>

          {/* Reset All Column Widths Button */}
          <button
            onClick={handleResetColumnWidths}
            className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-all flex items-center gap-1.5 shadow-2xs"
            title={isJa ? "プロジェクト、ToDo、フェーズの全列幅を初期値にリセット" : "Reset all column widths to default"}
          >
            <ArrowLeftRight size={12} className="text-slate-500 shrink-0" />
            <span>{isJa ? "列幅リセット" : "Reset Widths"}</span>
          </button>

          {/* ToDo List (Unscheduled) Column Toggle */}
          <button
            onClick={() => setShowUnscheduledColumn(!showUnscheduledColumn)}
            className={cn(
              "px-2 py-1 text-[11px] font-semibold rounded-lg border transition-colors flex items-center gap-1.5",
              showUnscheduledColumn 
                ? "bg-amber-50 text-amber-800 border-amber-300 font-bold" 
                : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
            )}
            title={isJa ? 'ToDo リスト枠（日程未割当）の表示切り替え' : 'Toggle ToDo List (Unscheduled) column'}
          >
            <ListTodo size={13} className={showUnscheduledColumn ? "text-amber-600" : "text-slate-400"} />
            <span className="hidden md:inline">{isJa ? 'ToDo リスト' : 'ToDo List'}</span>
          </button>

          {/* Days Range Selector (Only in Calendar Mode) */}
          {timelineMode === 'calendar' && (
            <div className="flex bg-white border border-slate-200 rounded-lg p-0.5 text-[11px] font-semibold text-slate-600">
              {[7, 14, 21].map(days => (
                <button
                  key={days}
                  onClick={() => setDaysCount(days)}
                  className={cn(
                    "px-2 py-0.5 rounded transition-all",
                    daysCount === days ? "bg-indigo-600 text-white shadow-2xs font-bold" : "hover:text-slate-900"
                  )}
                >
                  {days}{isJa ? '日' : 'd'}
                </button>
              ))}
            </div>
          )}

          {/* Grid ON / OFF Toggle (Supported in both Dates and Custom/Stages) */}
          <button
            onClick={() => handleToggleGrid(!isGridEnabled)}
            className={cn(
              "px-2 py-1 text-[11px] font-semibold rounded-lg border transition-all flex items-center gap-1.5 shadow-2xs",
              isGridEnabled
                ? "bg-indigo-50 text-indigo-700 border-indigo-200 font-bold"
                : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
            )}
            title={isJa ? (isGridEnabled ? 'グリッドをOFFにする' : 'グリッドをONにする') : (isGridEnabled ? 'Turn Grid OFF' : 'Turn Grid ON')}
          >
            <LayoutGrid size={13} className={isGridEnabled ? "text-indigo-600" : "text-slate-400"} />
            <span className="hidden sm:inline">{isJa ? 'グリッド' : 'Grid'}</span>
            <span className={cn(
              "text-[9px] px-1 py-0.5 rounded font-mono font-bold uppercase",
              isGridEnabled ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"
            )}>
              {isGridEnabled ? 'ON' : 'OFF'}
            </span>
          </button>

          {/* Fine Grid Step Granularity Selector (Dates: 1-24h, Custom: 2-5 steps) */}
          {isGridEnabled && timelineMode === 'calendar' && (
            <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 text-[11px] font-semibold text-slate-600">
              {[1, 2, 4, 6, 12, 24].map(hours => (
                <button
                  key={hours}
                  onClick={() => handleSetGridStepHours(hours)}
                  className={cn(
                    "px-1.5 py-0.5 rounded transition-all text-[10px]",
                    gridStepHours === hours ? "bg-indigo-600 text-white shadow-2xs font-bold" : "hover:text-slate-900"
                  )}
                  title={isJa ? `${hours}時間グリッド刻み` : `${hours}h grid granularity`}
                >
                  {hours}h
                </button>
              ))}
            </div>
          )}

          {isGridEnabled && timelineMode === 'custom' && (
            <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 text-[11px] font-semibold text-slate-600">
              <span className="px-1 text-[10px] text-slate-400 font-bold">{isJa ? '分割' : 'Steps'}:</span>
              {[2, 3, 4, 5].map(subs => (
                <button
                  key={subs}
                  onClick={() => handleSetStageSubdivisions(subs)}
                  className={cn(
                    "px-1.5 py-0.5 rounded transition-all text-[10px]",
                    stageSubdivisions === subs ? "bg-indigo-600 text-white shadow-2xs font-bold" : "hover:text-slate-900"
                  )}
                  title={isJa ? `各ステージを${subs}分割` : `${subs} subdivisions per stage`}
                >
                  {subs}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Timeline Grid Container */}
      <div 
        ref={timelineGridRef}
        tabIndex={0}
        onClick={() => {
          (window as any).__navforActivePane = 'timeline';
        }}
        className="flex-1 overflow-auto custom-scrollbar relative flex flex-col outline-none focus:ring-1 focus:ring-indigo-500/20"
      >
        {/* Table/Grid Header - Permanently sticky top & max-width bounds */}
        <div className="flex border-b border-slate-200 bg-slate-100 sticky top-0 z-30 shrink-0 select-none min-w-max w-max">
          {/* Project Column Header (Permanently sticky left cell, can add folder & receive drops) */}
          <div 
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              setIsDragOverRootHeader(true);
            }}
            onDragLeave={() => setIsDragOverRootHeader(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOverRootHeader(false);
              let folderData: any = null;
              try {
                const raw = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain');
                if (raw) folderData = JSON.parse(raw);
              } catch (err) {}
              if (!folderData && (window as any).__navforDraggingFolder) {
                folderData = (window as any).__navforDraggingFolder;
              }
              if (folderData?.type === 'folder' && folderData.folderPath) {
                if (onMoveFolder) {
                  onMoveFolder(folderData.folderPath, 'General');
                }
                (window as any).__navforDraggingFolder = null;
              }
            }}
            style={{ width: `${projectColWidth}px` }}
            className={cn(
              "shrink-0 px-2 sm:px-3 py-2 border-r border-slate-200 flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-slate-600 bg-slate-100 sticky left-0 z-40 transition-colors group/projcol",
              isDragOverRootHeader && "bg-indigo-100 ring-2 ring-indigo-500 ring-inset"
            )}
            title={isJa ? "サブプロジェクトをここにドロップすると最上位プロジェクト化できます" : "Drop subproject here to make it a top-level project"}
          >
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <span className="truncate">{isJa ? 'プロジェクトレーン' : 'Project Lanes'}</span>
            </div>

            {/* Quick Add Project Folder Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setTargetParentFolder(null);
                setNewFolderName('');
                setIsCreateFolderOpen(true);
              }}
              className="p-1 mr-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-200/80 rounded transition-colors"
              title={isJa ? "プロジェクトフォルダを作成" : "Add Project Folder"}
            >
              <FolderPlus size={13} />
            </button>

            {/* Draggable resize handle on right edge */}
            <div
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleStartProjectResize(e.clientX);
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
                handleStartProjectResize(e.touches[0].clientX);
              }}
              className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize hover:bg-indigo-500/50 active:bg-indigo-600 transition-colors z-40 flex items-center justify-center group-hover/projcol:bg-slate-300/60"
              title={isJa ? "ドラッグしてプロジェクト列幅を調整" : "Drag to resize project column width"}
            >
              <div className="w-0.5 h-3.5 bg-slate-400 rounded-full" />
            </div>
          </div>

          {/* ToDo List Column Header */}
          {showUnscheduledColumn && (
            <div 
              style={{ width: `${todoColWidth}px` }}
              className="shrink-0 px-2.5 py-2 border-r border-slate-200 bg-amber-50/50 text-[11px] font-bold text-amber-800 flex items-center justify-between relative group/todocol"
            >
              <span className="flex items-center gap-1.5 font-bold truncate">
                <ListTodo size={13} className="text-amber-600 shrink-0" />
                <span className="truncate">{isJa ? 'ToDo リスト' : 'ToDo List'}</span>
              </span>

              {/* Draggable resize handle on right edge */}
              <div
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleStartTodoResize(e.clientX);
                }}
                onTouchStart={(e) => {
                  e.stopPropagation();
                  handleStartTodoResize(e.touches[0].clientX);
                }}
                className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize hover:bg-amber-500/50 active:bg-amber-600 transition-colors z-40 flex items-center justify-center group-hover/todocol:bg-amber-300/60"
                title={isJa ? "ドラッグしてToDoリスト列幅を調整" : "Drag to resize ToDo list column width"}
              >
                <div className="w-0.5 h-3.5 bg-amber-400 rounded-full" />
              </div>
            </div>
          )}

          {/* Columns Header: Calendar Dates with Fine Grid Slots vs Custom Columns */}
          {timelineMode === 'calendar' ? (
            <div className="flex flex-1 min-w-max" style={{ width: `${totalGridWidth}px` }}>
              {timelineDates.map(date => {
                const today = isToday(date);
                const dayOfWeek = format(date, 'EEE');
                const isWeekend = dayOfWeek === 'Sat' || dayOfWeek === 'Sun';
                const dayWidth = slotsPerDay * slotWidth;

                return (
                  <div
                    key={date.toISOString()}
                    style={{ width: `${dayWidth}px` }}
                    className={cn(
                      "shrink-0 border-r border-slate-300 select-none transition-colors flex flex-col justify-between",
                      today && "bg-indigo-50/80 font-bold",
                      !today && isWeekend && "bg-slate-50 text-slate-500",
                      !today && !isWeekend && "bg-slate-100 text-slate-700"
                    )}
                  >
                    <div className="px-2 py-1 flex items-center justify-between border-b border-slate-200/70">
                      <span className="text-[10px] uppercase font-bold text-slate-400 leading-none">
                        {dayOfWeek}
                      </span>
                      <span className={cn(
                        "text-xs font-mono font-bold px-1.5 py-0.5 rounded",
                        today ? "bg-indigo-600 text-white" : "text-slate-700"
                      )}>
                        {format(date, 'M/d')}
                      </span>
                    </div>

                    {/* Fine Grid Slot Markers within Day */}
                    {slotsPerDay > 1 && (
                      <div className="flex divide-x divide-slate-200/60 text-[9px] text-slate-400 font-mono">
                        {Array.from({ length: slotsPerDay }).map((_, sIdx) => (
                          <div
                            key={sIdx}
                            style={{ width: `${slotWidth}px` }}
                            className="text-center py-0.5 truncate select-none"
                            title={`${String(sIdx * gridStepHours).padStart(2, '0')}:00`}
                          >
                            {String(sIdx * gridStepHours).padStart(2, '0')}h
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* Custom Abstract Columns Header */
            <div className="flex flex-1 min-w-max" style={{ width: `${totalCustomGridWidth + 48}px` }}>
              {customColumns.map(col => {
                const isEditing = editingColumnId === col.id;
                const colWidth = getCustomColWidth(col.id);
                const stepWidth = isGridEnabled && stageSubdivisions > 1 ? colWidth / stageSubdivisions : colWidth;

                return (
                  <div
                    key={col.id}
                    style={{ width: `${colWidth}px` }}
                    className="shrink-0 border-r border-slate-200 bg-slate-100 text-slate-700 flex flex-col justify-between group relative select-none"
                  >
                    <div className="px-2 py-1.5 flex items-center justify-between">
                      {isEditing ? (
                        <div className="flex items-center gap-1 w-full">
                          <input
                            autoFocus
                            type="text"
                            value={editingColumnLabel}
                            onChange={(e) => setEditingColumnLabel(e.target.value)}
                            onKeyDown={(e) => {
                              e.stopPropagation();
                              if (e.key === 'Enter') handleSaveRenameColumn(col.id);
                              if (e.key === 'Escape') setEditingColumnId(null);
                            }}
                            onBlur={() => handleSaveRenameColumn(col.id)}
                            className="w-full bg-white border border-indigo-400 rounded px-1.5 py-0.5 text-xs font-bold text-slate-800 outline-none"
                          />
                        </div>
                      ) : (
                        <>
                          <span 
                            onDoubleClick={() => {
                              setEditingColumnId(col.id);
                              setEditingColumnLabel(col.label);
                            }}
                            className="text-xs font-bold truncate flex-1 cursor-pointer hover:text-indigo-600"
                            title={isJa ? "ダブルクリックで名前変更" : "Double-click to rename"}
                          >
                            {col.label}
                          </span>
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity mr-2">
                            <button
                              onClick={() => {
                                setEditingColumnId(col.id);
                                setEditingColumnLabel(col.label);
                              }}
                              className="p-1 hover:text-indigo-600 hover:bg-slate-200 rounded text-slate-400"
                              title={isJa ? "列名を変更" : "Rename column"}
                            >
                              <Edit2 size={11} />
                            </button>
                            {customColumns.length > 1 && (
                              <button
                                onClick={() => handleDeleteColumn(col.id)}
                                className="p-1 hover:text-red-600 hover:bg-red-50 rounded text-slate-400"
                                title={isJa ? "列を削除" : "Delete column"}
                              >
                                <Trash2 size={11} />
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    {/* Stage sub-slot grid indicators when grid is enabled */}
                    {isGridEnabled && stageSubdivisions > 1 && (
                      <div className="flex border-t border-slate-200/80 text-[9px] font-mono text-slate-400 divide-x divide-slate-200/60 bg-slate-50/70">
                        {Array.from({ length: stageSubdivisions }).map((_, sIdx) => (
                          <div
                            key={sIdx}
                            style={{ width: `${stepWidth}px` }}
                            className="text-center py-0.5 truncate select-none"
                            title={`Step ${sIdx + 1}`}
                          >
                            Step {sIdx + 1}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Draggable resize handle on right edge */}
                    <div
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleStartCustomColResize(col.id, e.clientX);
                      }}
                      onTouchStart={(e) => {
                        e.stopPropagation();
                        handleStartCustomColResize(col.id, e.touches[0].clientX);
                      }}
                      className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize hover:bg-indigo-500/50 active:bg-indigo-600 transition-colors z-30 flex items-center justify-center group-hover:bg-slate-300/60"
                      title={isJa ? `ドラッグして「${col.label}」の列幅を調整` : `Drag to resize ${col.label} column width`}
                    >
                      <div className="w-0.5 h-3.5 bg-slate-400 rounded-full" />
                    </div>
                  </div>
                );
              })}

              {/* End of columns Add Button */}
              <button
                onClick={handleAddColumn}
                className="w-12 shrink-0 border-r border-slate-200 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                title={isJa ? "新しいPhase列を追加" : "Add new Phase column"}
              >
                <Plus size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Project Rows */}
        <div className="flex-1 flex flex-col divide-y divide-slate-100 min-w-max">
          {visibleProjectTree.map(project => {
            const isCollapsed = collapsedProjectPaths.has(project.fullPath);
            const indentPx = project.level * 14;

            // Separate tasks for this project
            const projectTasks = project.tasks;

            // Total tasks in this project and all its subfolders (for accurate collapsed summary)
            const totalDescendantTasks = activeTasks.filter(t => {
              const p = t.project?.trim() || 'General';
              return p === project.fullPath || p.startsWith(project.fullPath + '/');
            }).length;

            // Unscheduled tasks (no deadline in calendar mode, no timelineColumn in current preset for custom mode)
            // Sorted: Active (A-Z), then Done (A-Z) as requested
            const unscheduledTasks = projectTasks.filter(t => {
              if (timelineMode === 'calendar') return !t.deadline;
              return !getTaskCurrentColumnId(t, customColumns);
            }).sort((a, b) => {
              const aDone = Boolean(a.isDone);
              const bDone = Boolean(b.isDone);
              if (aDone !== bDone) return aDone ? 1 : -1;
              return (a.title || '').localeCompare(b.title || '', undefined, { numeric: true, sensitivity: 'base' });
            });

            // Fine grid task placements and dynamic lane height for calendar and custom stages
            const { placed: calendarPlaced, laneHeight: calendarLaneHeight } = getPlacedTasksForProject(projectTasks);
            const { placed: customPlaced, laneHeight: customLaneHeight } = getPlacedCustomTasksForProject(projectTasks);
            const placed = calendarPlaced;

            // Calculate minimum height required for unscheduled tasks column
            const unscheduledEstimatedHeight = showUnscheduledColumn && unscheduledTasks.length > 0
              ? Math.max(56, unscheduledTasks.length * 34 + 14 + (quickAddCell?.project === project.fullPath && quickAddCell?.slotKey === 'backlog' ? 42 : 0))
              : 56;

            const gridContentHeight = timelineMode === 'calendar' ? calendarLaneHeight : customLaneHeight;
            const laneHeight = Math.max(56, gridContentHeight, unscheduledEstimatedHeight);

            return (
              <div 
                key={project.fullPath} 
                className={cn(
                  "flex group transition-colors hover:bg-slate-50/40 min-w-max w-max",
                  project.level === 0 ? "bg-white" : "bg-slate-50/20"
                )}
              >
                {/* Project Lane Title Column (Permanently Sticky Left, Draggable for Subproject Nesting / Movement) */}
                <div 
                  id={`timeline-project-${encodeURIComponent(project.fullPath)}`}
                  draggable={true}
                  onDragStart={(e) => handleProjectDragStart(e, project.fullPath)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    setDragOverProjectHeader(project.fullPath);
                  }}
                  onDragLeave={() => {
                    if (dragOverProjectHeader === project.fullPath) {
                      setDragOverProjectHeader(null);
                    }
                  }}
                  onDrop={(e) => handleProjectHeaderDrop(e, project.fullPath)}
                  style={{ width: `${projectColWidth}px`, minHeight: `${laneHeight}px`, paddingLeft: `${Math.max(4, indentPx + 4)}px` }}
                  className={cn(
                    "shrink-0 px-1.5 sm:px-2 py-2 border-r border-slate-200 flex items-center justify-between bg-white sticky left-0 z-20 select-none transition-colors cursor-grab active:cursor-grabbing group/lane self-stretch min-h-[56px]",
                    project.level === 0 ? "font-bold text-slate-800" : "font-medium text-slate-600",
                    dragOverProjectHeader === project.fullPath && "bg-indigo-50/90 ring-2 ring-indigo-500 ring-inset",
                    (selectedFolderPath === project.fullPath || selectedKey === `folder:${project.fullPath}`) && "bg-indigo-50/90 ring-2 ring-indigo-500 ring-inset"
                  )}
                  title={isJa ? "クリックで折りたたみ切替 / ドラッグで移動" : "Click to collapse/expand, drag to move"}
                >
                  <div 
                    onClick={() => {
                      (window as any).__navforActivePane = 'timeline';
                      toggleProjectCollapse(project.fullPath);
                      setSelectedKey(`folder:${project.fullPath}`);
                      setSelectedFolderPath(project.fullPath);
                    }}
                    className="flex items-center gap-1 min-w-0 flex-1 overflow-hidden cursor-pointer hover:text-indigo-600 transition-colors"
                  >
                    <GripVertical size={11} className="hidden sm:block text-slate-300 group-hover/lane:text-slate-500 shrink-0 mr-0.5 cursor-grab active:cursor-grabbing" />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleProjectCollapse(project.fullPath);
                        setSelectedKey(`folder:${project.fullPath}`);
                        setSelectedFolderPath(project.fullPath);
                      }}
                      className="p-0.5 text-slate-400 hover:text-slate-700 rounded transition-transform shrink-0"
                    >
                      {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                    </button>

                    <Folder size={13} className={cn("shrink-0 transition-colors", project.level === 0 ? "text-indigo-600" : "text-amber-500")} />

                    {renamingItem?.type === 'folder' && renamingItem.idOrPath === project.fullPath ? (
                      <form 
                        onSubmit={handleRenameSubmit} 
                        onClick={(e) => e.stopPropagation()} 
                        className="flex-1 min-w-0 mr-1"
                      >
                        <input
                          autoFocus
                          type="text"
                          value={renameInputValue}
                          onChange={(e) => setRenameInputValue(e.target.value)}
                          onBlur={handleRenameSubmit}
                          onKeyDown={(e) => {
                            e.stopPropagation();
                            if (e.key === 'Escape') setRenamingItem(null);
                          }}
                          className="w-full bg-white border border-indigo-500 rounded px-1.5 py-0.5 text-xs outline-none shadow-2xs font-mono font-normal text-slate-800 focus:ring-1 focus:ring-indigo-400"
                        />
                      </form>
                    ) : (
                      <span 
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          startRenaming('folder', project.fullPath, project.name);
                        }}
                        className="text-xs truncate font-mono tracking-tight flex-1 min-w-0" 
                        title={isJa ? `${project.fullPath} (選択してEnterまたはダブルクリックで名前変更)` : `${project.fullPath} (Select & Enter or double-click to rename)`}
                      >
                        {project.name}
                      </span>
                    )}
                  </div>

                  {/* Subfolder add, rename, and quick task add buttons */}
                  <div className="flex items-center gap-1 shrink-0 ml-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        startRenaming('folder', project.fullPath, project.name);
                      }}
                      className="hidden group-hover/lane:flex p-0.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                      title={isJa ? 'フォルダ名を変更' : 'Rename folder'}
                    >
                      <Edit2 size={11} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setTargetParentFolder(project.fullPath);
                        setNewFolderName('');
                        setIsCreateFolderOpen(true);
                      }}
                      className="hidden group-hover/lane:flex p-0.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                      title={isJa ? 'サブフォルダを追加' : 'Add subfolder'}
                    >
                      <FolderPlus size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setQuickAddCell({ 
                          project: project.fullPath, 
                          slotKey: 'backlog', 
                          type: 'backlog' 
                        });
                        setQuickAddTitle('');
                      }}
                      className="hidden sm:flex p-0.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                      title={isJa ? 'このプロジェクトにタスク追加' : 'Add task in project'}
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                </div>

                {/* Content cells (Visible only if project is not collapsed) */}
                {!isCollapsed ? (
                  <>
                    {/* Unscheduled / Backlog Cell */}
                    {showUnscheduledColumn && (
                      <div
                        onDragOver={(e) => {
                          e.preventDefault();
                          setDragOverCell({ project: project.fullPath, slotKey: 'backlog' });
                        }}
                        onDragLeave={() => setDragOverCell(null)}
                        onDrop={(e) => handleCellDrop(e, project.fullPath, { 
                          type: timelineMode === 'calendar' ? 'calendar' : 'custom', 
                          date: null, 
                          columnId: null 
                        } as any)}
                        className={cn(
                          "shrink-0 p-1.5 border-r border-slate-200/80 bg-amber-50/20 flex flex-col gap-1 min-h-[56px] transition-colors relative self-stretch",
                          dragOverCell?.project === project.fullPath && dragOverCell?.slotKey === 'backlog' && "bg-amber-100/70 border-2 border-dashed border-amber-500"
                        )}
                        style={{ width: `${todoColWidth}px`, minHeight: `${laneHeight}px` }}
                      >
                        {/* Task items in unscheduled */}
                        {unscheduledTasks.map((task) => renderTaskChip(task))}

                        {/* Quick Add Form in Unscheduled */}
                        {quickAddCell?.project === project.fullPath && quickAddCell?.slotKey === 'backlog' && (
                          <form onSubmit={handleQuickAddSubmit} className="mt-1">
                            <input
                              autoFocus
                              type="text"
                              placeholder={isJa ? "タスク名..." : "Task name..."}
                              value={quickAddTitle}
                              onChange={(e) => setQuickAddTitle(e.target.value)}
                              onKeyDown={(e) => {
                                e.stopPropagation();
                                if (e.key === 'Escape') {
                                  setQuickAddCell(null);
                                  setQuickAddTitle('');
                                }
                              }}
                              onBlur={() => {
                                if (isSubmittingQuickAddRef.current) return;
                                if (!quickAddTitle.trim()) setQuickAddCell(null);
                              }}
                              className="w-full bg-white border border-indigo-300 rounded px-1.5 py-1 text-xs outline-none focus:ring-1 focus:ring-indigo-500 shadow-2xs"
                            />
                          </form>
                        )}
                      </div>
                    )}

                    {/* Content Columns: Calendar Mode with Fine Grid vs Custom Mode */}
                    {timelineMode === 'calendar' ? (
                      /* Calendar Fine Grid Lane */
                      <div 
                        style={{ width: `${totalGridWidth}px`, minHeight: `${laneHeight}px` }}
                        className="relative flex-1 shrink-0 select-none bg-white self-stretch"
                      >
                        {/* Vertical Grid Lines & Droppable / Double-Clickable Slots */}
                        <div className="absolute inset-0 flex pointer-events-auto">
                          {timelineDates.map((date, dayIdx) => {
                            const isDateToday = isToday(date);
                            const dayWidth = slotsPerDay * slotWidth;

                            return (
                              <div 
                                key={date.toISOString()}
                                style={{ width: `${dayWidth}px` }}
                                className={cn(
                                  "flex divide-x divide-slate-100/80 border-r border-slate-300 h-full shrink-0",
                                  isDateToday && "bg-indigo-50/20"
                                )}
                              >
                                {Array.from({ length: slotsPerDay }).map((_, sIdx) => {
                                  const slotIdx = dayIdx * slotsPerDay + sIdx;
                                  const slotStartMs = timelineStartMs + slotIdx * slotDurationMs;
                                  const slotKey = `slot-${project.fullPath}-${slotIdx}`;
                                  const isDragOver = dragOverCell?.project === project.fullPath && dragOverCell?.slotKey === slotKey;

                                  return (
                                    <div
                                      key={sIdx}
                                      style={{ width: `${slotWidth}px` }}
                                      onDragOver={(e) => {
                                        e.preventDefault();
                                        setDragOverCell({ project: project.fullPath, slotKey });
                                      }}
                                      onDragLeave={() => setDragOverCell(null)}
                                      onDrop={(e) => {
                                        e.preventDefault();
                                        setDragOverCell(null);
                                        handleGridDrop(e, project.fullPath, slotStartMs);
                                      }}
                                      onDoubleClick={(e) => {
                                        e.stopPropagation();
                                        setQuickAddCell({
                                          project: project.fullPath,
                                          slotKey,
                                          type: 'calendar',
                                          dateMs: slotStartMs,
                                          slotIdx
                                        });
                                        setQuickAddTitle('');
                                      }}
                                      className={cn(
                                        "h-full transition-colors relative group/slot cursor-pointer shrink-0",
                                        isDragOver && "bg-indigo-100 border-2 border-dashed border-indigo-500",
                                        "hover:bg-indigo-50/30"
                                      )}
                                      title={isJa ? `${format(new Date(slotStartMs), 'M/d HH:mm')} - ダブルクリックでタスク追加` : `${format(new Date(slotStartMs), 'M/d HH:mm')} - Double-click to add task`}
                                    />
                                  );
                                })}
                              </div>
                            );
                          })}
                        </div>

                        {/* Placed Task Chips on Fine Grid */}
                        <div className="absolute inset-0 pointer-events-none">
                          {placed.map(({ task, startPx, widthPx, topPx }) => (
                            <div
                              key={task.id}
                              style={{
                                position: 'absolute',
                                left: `${startPx}px`,
                                top: `${topPx}px`,
                                width: `${widthPx}px`,
                                pointerEvents: 'auto'
                              }}
                            >
                              {renderTaskChip(task)}
                            </div>
                          ))}
                        </div>

                        {/* Quick Add Form in clicked grid slot */}
                        {quickAddCell?.project === project.fullPath && quickAddCell?.type === 'calendar' && (
                          <div
                            style={{
                              position: 'absolute',
                              left: `${Math.min(totalGridWidth - 220, (quickAddCell.slotIdx ?? 0) * slotWidth)}px`,
                              top: '4px',
                              width: '210px',
                              zIndex: 40
                            }}
                            className="bg-white p-1 rounded-lg shadow-xl border border-indigo-400 pointer-events-auto"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <form onSubmit={handleQuickAddSubmit}>
                              <input
                                autoFocus
                                type="text"
                                placeholder={isJa ? "タスク名を入力..." : "Task name..."}
                                value={quickAddTitle}
                                onChange={(e) => setQuickAddTitle(e.target.value)}
                                onKeyDown={(e) => {
                                  e.stopPropagation();
                                  if (e.key === 'Escape') {
                                    setQuickAddCell(null);
                                    setQuickAddTitle('');
                                  }
                                }}
                                onBlur={() => {
                                  if (isSubmittingQuickAddRef.current) return;
                                  if (!quickAddTitle.trim()) setQuickAddCell(null);
                                }}
                                className="w-full bg-white border border-indigo-300 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-indigo-500 shadow-2xs"
                              />
                            </form>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Custom Abstract Columns / Stages Grid Lane (Dates pattern without dates) */
                      <div 
                        style={{ width: `${totalCustomGridWidth + 48}px`, minHeight: `${laneHeight}px` }}
                        className="relative flex-1 shrink-0 select-none bg-white self-stretch"
                      >
                        {/* Background Phase & Step Grid Slots */}
                        <div className="absolute inset-0 flex pointer-events-auto">
                          {customColumns.map((col) => {
                            const effectiveSubs = isGridEnabled ? stageSubdivisions : 1;
                            const colWidth = getCustomColWidth(col.id);
                            const stepWidth = colWidth / effectiveSubs;

                            return (
                              <div
                                key={col.id}
                                style={{ width: `${colWidth}px` }}
                                className="flex divide-x divide-slate-100/80 border-r border-slate-300 h-full shrink-0"
                              >
                                {Array.from({ length: effectiveSubs }).map((_, sIdx) => {
                                  const slotKey = `custom-${project.fullPath}-${col.id}-${sIdx}`;
                                  const isDragOver = dragOverCell?.project === project.fullPath && dragOverCell?.slotKey === slotKey;

                                  return (
                                    <div
                                      key={sIdx}
                                      style={{ width: `${stepWidth}px` }}
                                      onDragOver={(e) => {
                                        e.preventDefault();
                                        setDragOverCell({ project: project.fullPath, slotKey });
                                      }}
                                      onDragLeave={() => setDragOverCell(null)}
                                      onDrop={(e) => {
                                        e.preventDefault();
                                        setDragOverCell(null);
                                        handleCustomGridDrop(e, project.fullPath, col.id, sIdx);
                                      }}
                                      onDoubleClick={(e) => {
                                        e.stopPropagation();
                                        setQuickAddCell({
                                          project: project.fullPath,
                                          slotKey,
                                          type: 'custom',
                                          columnId: col.id,
                                          stepIdx: sIdx
                                        });
                                        setQuickAddTitle('');
                                      }}
                                      className={cn(
                                        "h-full transition-colors relative group/slot cursor-pointer shrink-0",
                                        isDragOver && "bg-indigo-100 border-2 border-dashed border-indigo-500",
                                        "hover:bg-indigo-50/30"
                                      )}
                                      title={isJa 
                                        ? `${col.label} (Step ${sIdx + 1}) - ダブルクリックでタスク追加 / ドラッグして配置` 
                                        : `${col.label} (Step ${sIdx + 1}) - Double-click to add task / Drag to place`}
                                    />
                                  );
                                })}
                              </div>
                            );
                          })}

                          {/* End of columns Add Button Filler in Lane */}
                          <div 
                            onClick={handleAddColumn}
                            className="w-12 shrink-0 border-r border-slate-200/60 bg-slate-50/20 hover:bg-indigo-50/40 cursor-pointer flex items-center justify-center text-slate-300 hover:text-indigo-600 transition-colors h-full"
                            title={isJa ? "新しいPhase列を追加" : "Add new Phase column"}
                          >
                            <Plus size={13} />
                          </div>
                        </div>

                        {/* Placed Task Chips on Custom Stages Grid */}
                        <div className="absolute inset-0 pointer-events-none">
                          {customPlaced.map(({ task, startPx, widthPx, topPx }) => (
                            <div
                              key={task.id}
                              style={{
                                position: 'absolute',
                                left: `${startPx}px`,
                                top: `${topPx}px`,
                                width: `${widthPx}px`,
                                pointerEvents: 'auto'
                              }}
                            >
                              {renderTaskChip(task)}
                            </div>
                          ))}
                        </div>

                        {/* Quick Add Form in clicked custom grid slot */}
                        {quickAddCell?.project === project.fullPath && quickAddCell?.type === 'custom' && (() => {
                          let offsetLeft = 0;
                          const targetIdx = customColumns.findIndex(c => c.id === quickAddCell.columnId);
                          if (targetIdx !== -1) {
                            for (let i = 0; i < targetIdx; i++) {
                              offsetLeft += getCustomColWidth(customColumns[i].id);
                            }
                            const targetColWidth = getCustomColWidth(quickAddCell.columnId!);
                            const targetSubs = isGridEnabled ? stageSubdivisions : 1;
                            offsetLeft += (quickAddCell.stepIdx ?? 0) * (targetColWidth / targetSubs);
                          }

                          return (
                            <div
                              style={{
                                position: 'absolute',
                                left: `${Math.min(Math.max(0, totalCustomGridWidth - 220), offsetLeft)}px`,
                                top: '4px',
                                width: '210px',
                                zIndex: 40
                              }}
                              className="bg-white p-1 rounded-lg shadow-xl border border-indigo-400 pointer-events-auto"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <form onSubmit={handleQuickAddSubmit}>
                                <input
                                  autoFocus
                                  type="text"
                                  placeholder={isJa ? "タスク名を入力..." : "Task name..."}
                                  value={quickAddTitle}
                                  onChange={(e) => setQuickAddTitle(e.target.value)}
                                  onKeyDown={(e) => {
                                    e.stopPropagation();
                                    if (e.key === 'Escape') {
                                      setQuickAddCell(null);
                                      setQuickAddTitle('');
                                    }
                                  }}
                                  onBlur={() => {
                                    if (isSubmittingQuickAddRef.current) return;
                                    if (!quickAddTitle.trim()) setQuickAddCell(null);
                                  }}
                                  className="w-full bg-white border border-indigo-300 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-indigo-500 shadow-2xs"
                                />
                              </form>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </>
                ) : (
                  /* Collapsed Placeholder Lane */
                  <div className="flex-1 px-4 py-2 text-xs text-slate-400 italic bg-slate-50/50 flex items-center gap-2">
                    <span>
                      {totalDescendantTasks} {isJa ? '件のタスクが折りたたまれています' : 'tasks collapsed'}
                    </span>
                    <button
                      onClick={() => toggleProjectCollapse(project.fullPath)}
                      className="text-[11px] font-sans font-medium text-indigo-600 hover:underline not-italic cursor-pointer"
                    >
                      {isJa ? '展開する' : 'Expand'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Folder Creation Modal */}
      {isCreateFolderOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4"
          onClick={() => {
            setIsCreateFolderOpen(false);
            setTargetParentFolder(null);
            setNewFolderName('');
          }}
        >
          <div 
            className="bg-white rounded-xl shadow-2xl border border-slate-200 p-5 w-full max-w-sm animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-3 text-slate-800">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <FolderPlus size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold">
                  {targetParentFolder 
                    ? (isJa ? 'サブフォルダを作成' : 'New Subfolder') 
                    : (isJa ? '新規プロジェクトフォルダ' : 'New Project Folder')}
                </h3>
                {targetParentFolder && (
                  <p className="text-[11px] text-slate-500 font-mono truncate max-w-[220px]">
                    {targetParentFolder} /
                  </p>
                )}
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const name = newFolderName.trim();
                if (!name) return;
                const fullPath = targetParentFolder ? `${targetParentFolder}/${name}` : name;
                if (!customFolders.includes(fullPath)) {
                  saveCustomFolders([...customFolders, fullPath]);
                }
                // Auto expand parent and all its ancestors if collapsed
                if (targetParentFolder) {
                  setCollapsedProjectPaths(prev => {
                    const next = new Set(prev);
                    const parts = targetParentFolder.split('/');
                    let cur = '';
                    parts.forEach(p => {
                      cur = cur ? `${cur}/${p}` : p;
                      next.delete(cur);
                    });
                    return next;
                  });
                }
                setSelectedFolderPath(fullPath);
                setSelectedKey(`folder:${fullPath}`);
                setIsCreateFolderOpen(false);
                setTargetParentFolder(null);
                setNewFolderName('');
              }}
            >
              <input
                autoFocus
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder={isJa ? "フォルダ名 (例: ProjectA, UI...)" : "Folder name (e.g. ProjectA, UI...)"}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white"
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Escape') {
                    setIsCreateFolderOpen(false);
                    setTargetParentFolder(null);
                    setNewFolderName('');
                  }
                }}
              />

              <div className="flex justify-end gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateFolderOpen(false);
                    setTargetParentFolder(null);
                    setNewFolderName('');
                  }}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg transition-colors font-medium"
                >
                  {isJa ? 'キャンセル' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={!newFolderName.trim()}
                  className="px-3.5 py-1.5 text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 rounded-lg shadow-xs transition-colors"
                >
                  {isJa ? '作成' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );

  // Helper to render a compact, draggable & reorderable task chip
  function renderTaskChip(task: Task) {
    const isSelected = activeTaskId === task.id;
    const isUrgent = task.category === 'Urgent';
    const isDragTarget = dragOverTask?.taskId === task.id;
    const deadlineAlert = getTaskDeadlineAlert(task.deadline, task.isDone, isJa);

    return (
      <div
        key={task.id}
        id={`timeline-task-${task.id}`}
        tabIndex={0}
        draggable={true}
        onDragStart={(e) => handleTaskDragStart(e, task)}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const rect = e.currentTarget.getBoundingClientRect();
          const midY = rect.top + rect.height / 2;
          const pos = e.clientY < midY ? 'before' : 'after';
          setDragOverTask({ taskId: task.id, position: pos });
        }}
        onDragLeave={() => {
          if (dragOverTask?.taskId === task.id) setDragOverTask(null);
        }}
        onDrop={(e) => {
          const pos = dragOverTask?.position || 'after';
          handleTaskDropOnTask(e, task, pos);
        }}
        onFocus={() => {
          (window as any).__navforActivePane = 'timeline';
        }}
        onClick={(e) => {
          e.stopPropagation();
          (window as any).__navforActivePane = 'timeline';
          setSelectedKey(`task:${task.id}`);
          setSelectedFolderPath(null);
          onSelectTask(task.id, false);
          e.currentTarget.focus();
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          (window as any).__navforActivePane = 'timeline';
          setSelectedKey(`task:${task.id}`);
          setSelectedFolderPath(null);
          onSelectTask(task.id, true);
        }}
        className={cn(
          "group/chip relative flex items-center gap-1.5 px-2 py-1 rounded-md text-xs cursor-grab active:cursor-grabbing transition-all shadow-2xs border select-none outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
          isSelected 
            ? (task.isDone
                ? "bg-slate-800 text-slate-200 border-slate-700 shadow-xs ring-2 ring-indigo-400/60"
                : "bg-indigo-600 text-white border-indigo-700 shadow-xs font-semibold ring-2 ring-indigo-400/40")
            : (isUrgent 
                ? "bg-red-50 text-red-950 border-red-200 hover:bg-red-100 hover:border-red-300"
                : "bg-white text-slate-800 border-slate-200/90 hover:bg-slate-50 hover:border-slate-300"),
          task.isDone && !isSelected && "opacity-60 bg-slate-100 text-slate-400 border-slate-200",
          isDragTarget && dragOverTask?.position === 'before' && "border-t-2 border-t-indigo-600 shadow-md",
          isDragTarget && dragOverTask?.position === 'after' && "border-b-2 border-b-indigo-600 shadow-md"
        )}
      >
        {/* Checkbox - Keep green checkmark visible even when selected */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleDone(task.id);
          }}
          className={cn(
            "shrink-0 transition-transform active:scale-95",
            isSelected ? (task.isDone ? "text-emerald-500" : "text-white/80 hover:text-white") : "text-slate-400 hover:text-indigo-600"
          )}
          title={task.isDone ? (isJa ? "未完了に戻す" : "Mark undone") : (isJa ? "完了にする" : "Mark done")}
        >
          {task.isDone ? (
            <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
          ) : (
            <Circle size={12} className={isUrgent ? "text-red-500" : (isSelected && !task.isDone ? "text-white/60" : "text-slate-300")} />
          )}
        </button>

        {/* Priority Dot */}
        {isUrgent && !task.isDone && (
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" title="Focus" />
        )}

        {/* Task Title or Inline Rename Input */}
        {renamingItem?.type === 'task' && renamingItem.idOrPath === task.id ? (
          <form 
            onSubmit={handleRenameSubmit} 
            onClick={(e) => e.stopPropagation()} 
            className="flex-1 min-w-0 my-[-2px]"
          >
            <input
              autoFocus
              type="text"
              value={renameInputValue}
              onChange={(e) => setRenameInputValue(e.target.value)}
              onBlur={handleRenameSubmit}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Escape') setRenamingItem(null);
              }}
              className="w-full bg-white text-slate-900 border border-indigo-400 rounded px-1.5 py-0.5 text-[11px] leading-tight outline-none shadow-xs font-sans font-normal focus:ring-1 focus:ring-indigo-400"
            />
          </form>
        ) : (
          <span 
            onDoubleClick={(e) => {
              e.stopPropagation();
              startRenaming('task', task.id, task.title);
            }}
            className={cn(
              "truncate flex-1 text-[11px] leading-tight cursor-text",
              task.isDone && "line-through opacity-75"
            )}
            title={isJa ? `${task.title} (選択してEnterまたはダブルクリックで名前変更)` : `${task.title} (Select & Enter or double-click to rename)`}
          >
            {task.title}
          </span>
        )}

        {/* Approaching Deadline Highlight (Yellow clock mark, Red if overdue - icon only so title remains clear) */}
        {!task.isDone && deadlineAlert && (
          <span
            className="shrink-0 inline-flex items-center justify-center ml-0.5"
            title={deadlineAlert.tooltip}
          >
            <Clock 
              size={12} 
              className={cn(
                "shrink-0",
                isSelected
                  ? (deadlineAlert.isOverdue ? "text-red-300" : "text-amber-300")
                  : (deadlineAlert.isOverdue ? "text-red-500" : "text-amber-500")
              )} 
            />
          </span>
        )}

        {/* Star */}
        {task.isStarred && (
          <Star size={10} fill="currentColor" className={isSelected && !task.isDone ? "text-amber-300" : "text-amber-400 shrink-0"} />
        )}

        {/* Subtle Drag Handle on hover */}
        <GripVertical size={11} className={cn("shrink-0 opacity-0 group-hover/chip:opacity-60 transition-opacity", isSelected && !task.isDone ? "text-white" : "text-slate-400")} />
      </div>
    );
  }
};
