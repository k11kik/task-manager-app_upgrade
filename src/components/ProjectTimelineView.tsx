import React, { useState, useMemo, useRef, useEffect } from 'react';
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
  Sparkles,
  ListTodo,
  RotateCcw
} from 'lucide-react';
import { Task, Category } from '../types';
import { cn } from '../lib/utils';
import { format, addDays, subDays, startOfDay, isSameDay, isToday, isTomorrow, differenceInCalendarDays } from 'date-fns';

export interface CustomTimelineColumn {
  id: string;
  label: string;
}

export type TimelineNavItem = 
  | { type: 'folder'; path: string; name: string; level: number; projectIndex: number; colIndex: number; slotKey: string }
  | { type: 'task'; taskId: string; task: Task; projectPath: string; projectIndex: number; colIndex: number; slotKey: string };

const DEFAULT_CUSTOM_COLUMNS: CustomTimelineColumn[] = [
  { id: 'day-1', label: 'Day 1' },
  { id: 'day-2', label: 'Day 2' },
  { id: 'day-3', label: 'Day 3' },
  { id: 'day-4', label: 'Day 4' },
  { id: 'day-5', label: 'Day 5' },
  { id: 'day-6', label: 'Day 6' },
  { id: 'day-7', label: 'Day 7' }
];

const PRESETS: Record<string, { labelJa: string; labelEn: string; cols: CustomTimelineColumn[] }> = {
  stages3: {
    labelJa: '作業順 (Initial, Mid, Final)',
    labelEn: 'Order (Initial, Mid, Final)',
    cols: [
      { id: 'order-initial', label: 'Initial' },
      { id: 'order-mid', label: 'Mid' },
      { id: 'order-final', label: 'Final' }
    ]
  },
  days7: {
    labelJa: '1日単位 (Day 1 - 7)',
    labelEn: '1 Day (Day 1 - 7)',
    cols: [
      { id: 'day-1', label: 'Day 1' },
      { id: 'day-2', label: 'Day 2' },
      { id: 'day-3', label: 'Day 3' },
      { id: 'day-4', label: 'Day 4' },
      { id: 'day-5', label: 'Day 5' },
      { id: 'day-6', label: 'Day 6' },
      { id: 'day-7', label: 'Day 7' }
    ]
  },
  days14: {
    labelJa: '1日単位 (Day 1 - 14)',
    labelEn: '1 Day (Day 1 - 14)',
    cols: Array.from({ length: 14 }, (_, i) => ({ id: `day-${i + 1}`, label: `Day ${i + 1}` }))
  },
  weeks4: {
    labelJa: '1週単位 (Week 1 - 4)',
    labelEn: '1 Week (Week 1 - 4)',
    cols: [
      { id: 'week-1', label: 'Week 1' },
      { id: 'week-2', label: 'Week 2' },
      { id: 'week-3', label: 'Week 3' },
      { id: 'week-4', label: 'Week 4' }
    ]
  },
  phases: {
    labelJa: 'フェーズ (Planning, Ready, In Progress, Waiting, Review, Ongoing)',
    labelEn: 'Phases (Planning, Ready, In Progress, Waiting, Review, Ongoing)',
    cols: [
      { id: 'phase-plan', label: 'Planning' },
      { id: 'phase-ready', label: 'Ready' },
      { id: 'phase-dev', label: 'In Progress' },
      { id: 'phase-waiting', label: 'Waiting' },
      { id: 'phase-review', label: 'Review' },
      { id: 'phase-ongoing', label: 'Ongoing' }
    ]
  }
};

export const detectPresetKey = (cols: CustomTimelineColumn[]): string => {
  for (const [key, preset] of Object.entries(PRESETS)) {
    if (preset.cols.length === cols.length && preset.cols.every((c, i) => c.id === cols[i]?.id)) {
      return key;
    }
  }
  return 'custom';
};

export const getTaskCurrentColumnId = (task: Task, cols: CustomTimelineColumn[]): string | undefined => {
  const currentPreset = detectPresetKey(cols);
  // 1. Check if task has a column assigned specifically for this preset
  if (currentPreset !== 'custom' && task.timelinePresetColumns?.[currentPreset]) {
    const presetColId = task.timelinePresetColumns[currentPreset];
    if (cols.some(c => c.id === presetColId)) {
      return presetColId;
    }
  }
  // 2. Check general timelineColumn if it matches a column in the current custom columns
  if (task.timelineColumn && cols.some(c => c.id === task.timelineColumn)) {
    return task.timelineColumn;
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
  onSelectTask: (taskId: string) => void;
  onUpdateTask?: (taskId: string, updates: Partial<Task>) => void;
  onScheduleTask?: (taskId: string, deadline?: number) => void;
  onMoveTaskFolder?: (taskId: string, newProject: string) => void;
  onMoveFolder?: (sourceFolderPath: string, targetFolderPath: string) => void;
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

  // Custom Columns State
  const [customColumns, setCustomColumns] = useState<CustomTimelineColumn[]>(() => {
    try {
      const saved = localStorage.getItem(`navfor_custom_timeline_cols_${activeSection}`);
      if (saved) return JSON.parse(saved);
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

  // Column renaming state
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
  const [editingColumnLabel, setEditingColumnLabel] = useState('');

  // Preset dropdown toggle
  const [isPresetOpen, setIsPresetOpen] = useState(false);
  const presetDropdownRef = useRef<HTMLDivElement>(null);

  // Close Presets dropdown when clicking outside
  useEffect(() => {
    if (!isPresetOpen) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (presetDropdownRef.current && !presetDropdownRef.current.contains(e.target as Node)) {
        setIsPresetOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isPresetOpen]);

  // Calendar Timeline view window state (start date, number of days visible)
  const [windowStartDate, setWindowStartDate] = useState<Date>(() => subDays(startOfDay(new Date()), 2));
  const [daysCount, setDaysCount] = useState<number>(14); // 7, 14, 21, 30
  const [showUnscheduledColumn, setShowUnscheduledColumn] = useState(true);
  const [collapsedProjectPaths, setCollapsedProjectPaths] = useState<Set<string>>(new Set());

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

  // Sync selectedKey and selectedFolderPath when activeTaskId is selected from outside
  useEffect(() => {
    if (activeTaskId) {
      setSelectedKey(`task:${activeTaskId}`);
      setSelectedFolderPath(null);
    }
  }, [activeTaskId]);

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

  const handleResetColumnWidths = () => {
    const defaultProj = typeof window !== 'undefined' && window.innerWidth < 640 ? 210 : 256;
    setProjectColWidth(defaultProj);
    try {
      localStorage.removeItem('navfor_timeline_project_col_width');
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
  const [quickAddCell, setQuickAddCell] = useState<{ 
    project: string; 
    slotKey: string; 
    type: 'calendar' | 'custom' | 'backlog';
    dateMs?: number;
    columnId?: string;
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

  // Active tasks for this section (Urgent + Focus)
  const activeTasks = useMemo(() => {
    return tasks.filter(t => t.category === 'Urgent' || t.category === 'Focus');
  }, [tasks]);

  // Group tasks by project and subproject paths (including custom empty folders)
  const projectTree = useMemo(() => {
    const projectMap = new Map<string, { fullPath: string; name: string; level: number; tasks: Task[] }>();

    // 1. Include custom empty folders
    customFolders.forEach(folderPath => {
      if (!folderPath) return;
      const parts = folderPath.split(/[\/\\]/).map(p => p.trim()).filter(Boolean);
      let acc = '';
      parts.forEach((part, idx) => {
        acc = acc ? `${acc}/${part}` : part;
        if (!projectMap.has(acc)) {
          projectMap.set(acc, {
            fullPath: acc,
            name: part,
            level: idx,
            tasks: []
          });
        }
      });
    });

    // 2. Include all folders and distribute tasks
    activeTasks.forEach(task => {
      const proj = task.project?.trim() || 'General';
      const parts = proj.split(/[\/\\]/).map(p => p.trim()).filter(Boolean);
      
      let acc = '';
      parts.forEach((part, idx) => {
        acc = acc ? `${acc}/${part}` : part;
        if (!projectMap.has(acc)) {
          projectMap.set(acc, {
            fullPath: acc,
            name: part,
            level: idx,
            tasks: []
          });
        }
      });

      const entry = projectMap.get(proj);
      if (entry) {
        entry.tasks.push(task);
      }
    });

    // Ensure 'General' always exists if empty
    if (projectMap.size === 0) {
      projectMap.set('General', {
        fullPath: 'General',
        name: 'General',
        level: 0,
        tasks: []
      });
    }

    return Array.from(projectMap.values()).sort((a, b) => a.fullPath.localeCompare(b.fullPath, undefined, { numeric: true, sensitivity: 'base' }));
  }, [activeTasks, customFolders]);

  const toggleProjectCollapse = (path: string) => {
    setCollapsedProjectPaths(prev => {
      const next = new Set(prev);
      const isCurrentlyCollapsed = next.has(path);
      if (isCurrentlyCollapsed) {
        // Expanding parent: remove from collapsed set
        next.delete(path);
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

  // Flat list of visible navigable items (folders and tasks) in visual display order
  const visibleTimelineItems = useMemo<TimelineNavItem[]>(() => {
    const items: TimelineNavItem[] = [];
    const seenTaskIds = new Set<string>();

    visibleProjectTree.forEach((project, projectIndex) => {
      // 1. Folder item
      items.push({
        type: 'folder',
        path: project.fullPath,
        name: project.name,
        level: project.level,
        projectIndex,
        colIndex: 0,
        slotKey: '__folder__'
      });

      // 2. If project is not collapsed, add its visible tasks in visual left-to-right order
      if (!collapsedProjectPaths.has(project.fullPath)) {
        const projectTasks = project.tasks;

        // Unscheduled / ToDo List tasks
        if (showUnscheduledColumn) {
          const unscheduled = projectTasks.filter(t => {
            if (timelineMode === 'calendar') return !t.deadline;
            return !getTaskCurrentColumnId(t, customColumns);
          }).sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.createdAt - b.createdAt);

          unscheduled.forEach(t => {
            if (!seenTaskIds.has(t.id)) {
              seenTaskIds.add(t.id);
              items.push({
                type: 'task',
                taskId: t.id,
                task: t,
                projectPath: project.fullPath,
                projectIndex,
                colIndex: 1,
                slotKey: '__backlog__'
              });
            }
          });
        }

        // Timeline columns tasks
        if (timelineMode === 'calendar') {
          timelineDates.forEach((date, dIdx) => {
            const dateTasks = projectTasks.filter(t => {
              if (!t.deadline) return false;
              return isSameDay(new Date(t.deadline), date);
            }).sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.createdAt - b.createdAt);

            dateTasks.forEach(t => {
              if (!seenTaskIds.has(t.id)) {
                seenTaskIds.add(t.id);
                items.push({
                  type: 'task',
                  taskId: t.id,
                  task: t,
                  projectPath: project.fullPath,
                  projectIndex,
                  colIndex: 2 + dIdx,
                  slotKey: format(date, 'yyyy-MM-dd')
                });
              }
            });
          });
        } else {
          customColumns.forEach((col, cIdx) => {
            const colTasks = projectTasks.filter(t => {
              return getTaskCurrentColumnId(t, customColumns) === col.id;
            }).sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.createdAt - b.createdAt);

            colTasks.forEach(t => {
              if (!seenTaskIds.has(t.id)) {
                seenTaskIds.add(t.id);
                items.push({
                  type: 'task',
                  taskId: t.id,
                  task: t,
                  projectPath: project.fullPath,
                  projectIndex,
                  colIndex: 2 + cIdx,
                  slotKey: col.id
                });
              }
            });
          });
        }
      }
    });

    return items;
  }, [visibleProjectTree, collapsedProjectPaths, showUnscheduledColumn, timelineMode, timelineDates, customColumns]);

  const selectNavItem = (item: TimelineNavItem) => {
    if (item.type === 'task') {
      setSelectedKey(`task:${item.taskId}`);
      setSelectedFolderPath(null);
      onSelectTask(item.taskId);
      const el = document.getElementById(`timeline-task-${item.taskId}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    } else {
      setSelectedKey(`folder:${item.path}`);
      setSelectedFolderPath(item.path);
      const el = document.getElementById(`timeline-project-${encodeURIComponent(item.path)}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  };

  const handleNavKey = (e: KeyboardEvent | React.KeyboardEvent) => {
    if (visibleTimelineItems.length === 0) return;

    let currentIndex = -1;
    if (selectedKey) {
      if (selectedKey.startsWith('task:')) {
        const id = selectedKey.slice(5);
        currentIndex = visibleTimelineItems.findIndex(it => it.type === 'task' && it.taskId === id);
      } else if (selectedKey.startsWith('folder:')) {
        const p = selectedKey.slice(7);
        currentIndex = visibleTimelineItems.findIndex(it => it.type === 'folder' && it.path === p);
      }
    }
    if (currentIndex === -1 && activeTaskId) {
      currentIndex = visibleTimelineItems.findIndex(it => it.type === 'task' && it.taskId === activeTaskId);
    }
    if (currentIndex === -1 && selectedFolderPath) {
      currentIndex = visibleTimelineItems.findIndex(it => it.type === 'folder' && it.path === selectedFolderPath);
    }

    if (currentIndex === -1) {
      e.preventDefault();
      selectNavItem(visibleTimelineItems[0]);
      return;
    }

    const currentItem = visibleTimelineItems[currentIndex];

    // RIGHT ARROW: Horizontal progression through items (Files <-> Folders <-> Cross-projects)
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (currentItem.type === 'folder' && collapsedProjectPaths.has(currentItem.path)) {
        // Expand collapsed folder
        toggleProjectCollapse(currentItem.path);
      } else {
        // Move to next sequential item in timeline (seamless cross-column and cross-project)
        const nextIdx = (currentIndex + 1) % visibleTimelineItems.length;
        selectNavItem(visibleTimelineItems[nextIdx]);
      }
    } 
    // LEFT ARROW: Horizontal progression backwards (Files <-> Folders <-> Cross-projects)
    else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (currentItem.type === 'folder' && !collapsedProjectPaths.has(currentItem.path)) {
        // Collapse expanded folder
        toggleProjectCollapse(currentItem.path);
      } else {
        // Move to previous sequential item in timeline
        const prevIdx = (currentIndex - 1 + visibleTimelineItems.length) % visibleTimelineItems.length;
        selectNavItem(visibleTimelineItems[prevIdx]);
      }
    } 
    // DOWN ARROW: Vertical progression across project lanes
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (currentItem.type === 'folder') {
        // Jump to next project folder header below
        const allFolders = visibleTimelineItems.filter(it => it.type === 'folder') as Array<Extract<TimelineNavItem, { type: 'folder' }>>;
        const fIdx = allFolders.findIndex(f => f.path === currentItem.path);
        if (fIdx !== -1 && fIdx < allFolders.length - 1) {
          selectNavItem(allFolders[fIdx + 1]);
        } else if (allFolders.length > 0) {
          selectNavItem(allFolders[0]); // Wrap to first folder
        }
      } else {
        // Current item is a task:
        // 1. Check if there is another task in the same cell below
        const sameCellTasks = visibleTimelineItems.filter(
          it => it.type === 'task' && it.projectIndex === currentItem.projectIndex && it.slotKey === currentItem.slotKey
        ) as Array<Extract<TimelineNavItem, { type: 'task' }>>;
        const idxInCell = sameCellTasks.findIndex(it => it.taskId === currentItem.taskId);

        if (idxInCell !== -1 && idxInCell < sameCellTasks.length - 1) {
          selectNavItem(sameCellTasks[idxInCell + 1]);
        } else {
          // Move down to the next project lane below
          const nextRowTasks = visibleTimelineItems.filter(
            it => it.type === 'task' && it.projectIndex === currentItem.projectIndex + 1
          ) as Array<Extract<TimelineNavItem, { type: 'task' }>>;

          if (nextRowTasks.length > 0) {
            // Find task in matching column slot or closest column
            const match = nextRowTasks.find(it => it.slotKey === currentItem.slotKey) ||
              nextRowTasks.reduce((prev, curr) => 
                Math.abs(curr.colIndex - currentItem.colIndex) < Math.abs(prev.colIndex - currentItem.colIndex) ? curr : prev
              );
            selectNavItem(match);
          } else {
            // If next lane has no tasks or is collapsed, find next folder
            const nextFolder = visibleTimelineItems.find(
              it => it.type === 'folder' && it.projectIndex === currentItem.projectIndex + 1
            );
            if (nextFolder) {
              selectNavItem(nextFolder);
            } else {
              // Wrap to top project row
              const firstRowTasks = visibleTimelineItems.filter(
                it => it.type === 'task' && it.projectIndex === 0
              ) as Array<Extract<TimelineNavItem, { type: 'task' }>>;
              if (firstRowTasks.length > 0) {
                const match = firstRowTasks.find(it => it.slotKey === currentItem.slotKey) || firstRowTasks[0];
                selectNavItem(match);
              } else {
                selectNavItem(visibleTimelineItems[0]);
              }
            }
          }
        }
      }
    } 
    // UP ARROW: Vertical progression across project lanes
    else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (currentItem.type === 'folder') {
        // Jump to previous project folder header above
        const allFolders = visibleTimelineItems.filter(it => it.type === 'folder') as Array<Extract<TimelineNavItem, { type: 'folder' }>>;
        const fIdx = allFolders.findIndex(f => f.path === currentItem.path);
        if (fIdx > 0) {
          selectNavItem(allFolders[fIdx - 1]);
        } else if (allFolders.length > 0) {
          selectNavItem(allFolders[allFolders.length - 1]); // Wrap to last folder
        }
      } else {
        // Current item is a task:
        // 1. Check if there is another task in the same cell above
        const sameCellTasks = visibleTimelineItems.filter(
          it => it.type === 'task' && it.projectIndex === currentItem.projectIndex && it.slotKey === currentItem.slotKey
        ) as Array<Extract<TimelineNavItem, { type: 'task' }>>;
        const idxInCell = sameCellTasks.findIndex(it => it.taskId === currentItem.taskId);

        if (idxInCell > 0) {
          selectNavItem(sameCellTasks[idxInCell - 1]);
        } else {
          // Move up to the previous project lane above
          if (currentItem.projectIndex > 0) {
            const prevRowTasks = visibleTimelineItems.filter(
              it => it.type === 'task' && it.projectIndex === currentItem.projectIndex - 1
            ) as Array<Extract<TimelineNavItem, { type: 'task' }>>;

            if (prevRowTasks.length > 0) {
              const match = prevRowTasks.find(it => it.slotKey === currentItem.slotKey) ||
                prevRowTasks.reduce((prev, curr) => 
                  Math.abs(curr.colIndex - currentItem.colIndex) < Math.abs(prev.colIndex - currentItem.colIndex) ? curr : prev
                );
              selectNavItem(match);
            } else {
              const prevFolder = visibleTimelineItems.find(
                it => it.type === 'folder' && it.projectIndex === currentItem.projectIndex - 1
              );
              if (prevFolder) {
                selectNavItem(prevFolder);
              } else {
                selectNavItem(visibleTimelineItems[0]);
              }
            }
          } else {
            // At top-most project: move to this project's folder header
            const curFolder = visibleTimelineItems.find(
              it => it.type === 'folder' && it.projectIndex === currentItem.projectIndex
            );
            if (curFolder) {
              selectNavItem(curFolder);
            } else {
              selectNavItem(visibleTimelineItems[visibleTimelineItems.length - 1]);
            }
          }
        }
      }
    } 
    // ENTER or SPACE: action trigger
    else if (e.key === 'Enter' || e.key === ' ') {
      if (currentItem.type === 'folder') {
        e.preventDefault();
        toggleProjectCollapse(currentItem.path);
      } else if (currentItem.type === 'task' && e.key === ' ') {
        e.preventDefault();
        onToggleDone(currentItem.taskId);
      }
    }
  };

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in form controls
      const activeEl = document.activeElement as HTMLElement;
      if (
        activeEl?.tagName === 'INPUT' ||
        activeEl?.tagName === 'TEXTAREA' ||
        activeEl?.tagName === 'SELECT' ||
        activeEl?.isContentEditable
      ) {
        return;
      }

      // Ignore if event target is inside Explorer aside
      if (activeEl?.closest('aside') || (e.target as HTMLElement)?.closest('aside')) {
        return;
      }

      // Ignore if dialog, preset dropdown, or quick-add is active
      if (document.querySelector('[role="dialog"]') || isPresetOpen || quickAddCell) {
        return;
      }

      // Only handle if activeTaskId or selectedFolderPath is present
      if (!activeTaskId && !selectedFolderPath) {
        return;
      }

      if (['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Enter', ' '].includes(e.key)) {
        handleNavKey(e);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [visibleTimelineItems, activeTaskId, selectedFolderPath, collapsedProjectPaths, isPresetOpen, quickAddCell]);

  const handleNavigate = (direction: 'prev' | 'next' | 'today') => {
    if (direction === 'today') {
      setWindowStartDate(subDays(startOfDay(new Date()), 2));
    } else if (direction === 'prev') {
      setWindowStartDate(prev => subDays(prev, 7));
    } else {
      setWindowStartDate(prev => addDays(prev, 7));
    }
  };

  // Add custom column
  const handleAddColumn = () => {
    const newId = `col-${Date.now()}`;
    const newLabel = `${isJa ? '列' : 'Column'} ${customColumns.length + 1}`;
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

  // Apply preset
  const handleApplyPreset = (key: string) => {
    const preset = PRESETS[key];
    if (preset) {
      saveCustomColumns(preset.cols);
    }
    setIsPresetOpen(false);
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
        const currentPreset = detectPresetKey(customColumns);
        const newPresetCols: Record<string, string> = { ...(draggedTask?.timelinePresetColumns || {}) };

        // If task has an existing timelineColumn from another preset, preserve it
        if (draggedTask?.timelineColumn) {
          for (const [pKey, pVal] of Object.entries(PRESETS)) {
            if (pVal.cols.some(c => c.id === draggedTask.timelineColumn)) {
              if (!newPresetCols[pKey]) newPresetCols[pKey] = draggedTask.timelineColumn;
            }
          }
        }

        if (slot.columnId) {
          if (currentPreset !== 'custom') {
            newPresetCols[currentPreset] = slot.columnId;
          }
          updates.timelinePresetColumns = newPresetCols;
          updates.timelineColumn = slot.columnId;
          // In custom columns: do NOT clear deadline, original deadline is preserved
        } else {
          // In ToDo List (backlog): clear column for this preset, preserve other presets
          if (currentPreset !== 'custom') {
            delete newPresetCols[currentPreset];
          }
          updates.timelinePresetColumns = newPresetCols;
          if (draggedTask?.timelineColumn && customColumns.some(c => c.id === draggedTask.timelineColumn)) {
            updates.timelineColumn = undefined;
          }
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
        const currentPreset = detectPresetKey(customColumns);
        const newPresetCols: Record<string, string> = { ...(draggedTask?.timelinePresetColumns || {}) };

        if (draggedTask?.timelineColumn) {
          for (const [pKey, pVal] of Object.entries(PRESETS)) {
            if (pVal.cols.some(c => c.id === draggedTask.timelineColumn)) {
              if (!newPresetCols[pKey]) newPresetCols[pKey] = draggedTask.timelineColumn;
            }
          }
        }

        if (targetColId) {
          if (currentPreset !== 'custom') {
            newPresetCols[currentPreset] = targetColId;
          }
          updates.timelinePresetColumns = newPresetCols;
          updates.timelineColumn = targetColId;
        } else {
          if (currentPreset !== 'custom') {
            delete newPresetCols[currentPreset];
          }
          updates.timelinePresetColumns = newPresetCols;
          if (draggedTask?.timelineColumn && customColumns.some(c => c.id === draggedTask.timelineColumn)) {
            updates.timelineColumn = undefined;
          }
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

  const handleQuickAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAddCell || !quickAddTitle.trim()) {
      setQuickAddCell(null);
      setQuickAddTitle('');
      return;
    }

    const { project, type, dateMs, columnId } = quickAddCell;
    const currentPreset = detectPresetKey(customColumns);
    const presetCols: Record<string, string> = {};
    if (columnId && currentPreset !== 'custom') {
      presetCols[currentPreset] = columnId;
    }

    await onAddTask({
      title: quickAddTitle.trim(),
      project,
      deadline: type === 'calendar' ? dateMs : undefined,
      timelineColumn: type === 'custom' ? columnId : undefined,
      timelinePresetColumns: Object.keys(presetCols).length > 0 ? presetCols : undefined,
      isAllDay: true,
      order: Date.now() % 10000
    });

    setQuickAddCell(null);
    setQuickAddTitle('');
  };

  return (
    <div className="flex-1 h-full min-h-0 flex flex-col bg-white border border-slate-200/90 rounded-xl overflow-hidden shadow-2xs">
      {/* Timeline Top Control Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 bg-slate-50/90 shrink-0 select-none flex-wrap gap-2">
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
            /* Custom Columns Controls (Presets & Add Column) */
            <div className="flex items-center gap-1.5">
              {/* Presets Dropdown */}
              <div className="relative" ref={presetDropdownRef}>
                <button
                  onClick={() => setIsPresetOpen(!isPresetOpen)}
                  className="px-2.5 py-1 text-[11px] font-semibold bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700 flex items-center gap-1 shadow-2xs"
                >
                  <Sparkles size={12} className="text-amber-500" />
                  <span>{isJa ? 'プリセット' : 'Presets'}</span>
                  <ChevronDown size={11} className="text-slate-400" />
                </button>

                {isPresetOpen && (
                  <div className="absolute left-0 mt-1 w-64 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-30 text-xs">
                    {Object.entries(PRESETS).map(([key, preset]) => (
                      <button
                        key={key}
                        onClick={() => handleApplyPreset(key)}
                        className="w-full text-left px-3 py-1.5 hover:bg-indigo-50 hover:text-indigo-600 transition-colors flex items-center justify-between"
                      >
                        <span>{isJa ? preset.labelJa : preset.labelEn}</span>
                        <span className="text-[10px] text-slate-400 font-mono">({preset.cols.length})</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Add Column Button */}
              <button
                onClick={handleAddColumn}
                className="px-2 py-1 text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 rounded-lg transition-colors flex items-center gap-1"
                title={isJa ? "縦列を追加" : "Add Column"}
              >
                <Plus size={13} />
                <span>{isJa ? "列を追加" : "Add Column"}</span>
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

          {/* Reset Column Widths Button */}
          <button
            onClick={handleResetColumnWidths}
            className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-all flex items-center gap-1.5 shadow-2xs"
            title={isJa ? "列幅を初期設定にリセット" : "Reset column widths to default"}
          >
            <RotateCcw size={12} className="text-slate-500 shrink-0" />
            <span>{isJa ? "リセット" : "Reset"}</span>
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
        </div>
      </div>

      {/* Timeline Grid Container */}
      <div 
        ref={timelineGridRef}
        tabIndex={0}
        onKeyDown={handleNavKey}
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
              "shrink-0 px-2 sm:px-3 py-2 border-r border-slate-200 flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-slate-600 bg-slate-100 sticky left-0 z-40 transition-colors relative group/projcol",
              isDragOverRootHeader && "bg-indigo-100 ring-2 ring-indigo-500 ring-inset"
            )}
            title={isJa ? "サブプロジェクトをここにドロップすると最上位プロジェクト化できます" : "Drop subproject here to make it a top-level project"}
          >
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <span className="truncate">{isJa ? 'プロジェクト / レーン' : 'Projects / Lanes'}</span>
              <span className="text-[10px] text-slate-400 font-mono">({projectTree.length})</span>
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
            <div className="w-36 sm:w-44 shrink-0 px-2.5 py-2 border-r border-slate-200 bg-amber-50/50 text-[11px] font-bold text-amber-800 flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-bold">
                <ListTodo size={13} className="text-amber-600" />
                {isJa ? 'ToDo リスト' : 'ToDo List'}
              </span>
            </div>
          )}

          {/* Columns Header: Calendar Dates vs Custom Columns */}
          {timelineMode === 'calendar' ? (
            <div className="flex flex-1 min-w-max">
              {timelineDates.map(date => {
                const today = isToday(date);
                const dayOfWeek = format(date, 'EEE');
                const isWeekend = dayOfWeek === 'Sat' || dayOfWeek === 'Sun';

                return (
                  <div
                    key={date.toISOString()}
                    className={cn(
                      "w-28 sm:w-32 lg:w-36 shrink-0 px-2 py-1.5 border-r border-slate-200 text-center select-none transition-colors",
                      today && "bg-indigo-50/80 font-bold",
                      !today && isWeekend && "bg-slate-50 text-slate-500",
                      !today && !isWeekend && "bg-slate-100 text-slate-700"
                    )}
                  >
                    <div className="text-[10px] uppercase font-bold text-slate-400 leading-none">
                      {dayOfWeek}
                    </div>
                    <div className={cn(
                      "text-xs font-mono font-bold mt-0.5 inline-block px-1.5 py-0.5 rounded",
                      today ? "bg-indigo-600 text-white" : "text-slate-700"
                    )}>
                      {format(date, 'M/d')}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Custom Abstract Columns Header */
            <div className="flex flex-1 min-w-max">
              {customColumns.map(col => {
                const isEditing = editingColumnId === col.id;

                return (
                  <div
                    key={col.id}
                    className="w-32 sm:w-36 lg:w-40 shrink-0 px-2 py-1.5 border-r border-slate-200 bg-slate-100 text-slate-700 flex items-center justify-between group relative"
                  >
                    {isEditing ? (
                      <div className="flex items-center gap-1 w-full">
                        <input
                          autoFocus
                          type="text"
                          value={editingColumnLabel}
                          onChange={(e) => setEditingColumnLabel(e.target.value)}
                          onKeyDown={(e) => {
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
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
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
                );
              })}

              {/* End of columns Add Button */}
              <button
                onClick={handleAddColumn}
                className="w-12 shrink-0 border-r border-slate-200 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                title={isJa ? "新しい列を追加" : "Add new column"}
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
            const unscheduledTasks = projectTasks.filter(t => {
              if (timelineMode === 'calendar') return !t.deadline;
              return !getTaskCurrentColumnId(t, customColumns);
            }).sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.createdAt - b.createdAt);

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
                  style={{ width: `${projectColWidth}px`, paddingLeft: `${Math.max(4, indentPx + 4)}px` }}
                  className={cn(
                    "shrink-0 px-1.5 sm:px-2 py-2 border-r border-slate-200 flex items-center justify-between bg-white sticky left-0 z-20 select-none transition-colors cursor-grab active:cursor-grabbing group/lane",
                    project.level === 0 ? "font-bold text-slate-800" : "font-medium text-slate-600",
                    dragOverProjectHeader === project.fullPath && "bg-indigo-50/90 ring-2 ring-indigo-500 ring-inset",
                    (selectedFolderPath === project.fullPath || selectedKey === `folder:${project.fullPath}`) && "bg-indigo-50/90 ring-2 ring-indigo-500 ring-inset"
                  )}
                  title={isJa ? "クリックで折りたたみ切替 / ドラッグで移動" : "Click to collapse/expand, drag to move"}
                >
                  <div 
                    onClick={() => {
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

                    <span className="text-xs truncate font-mono tracking-tight flex-1 min-w-0" title={project.fullPath}>
                      {project.name}
                    </span>
                  </div>

                  {/* Task counter, subfolder add, and quick task add buttons */}
                  <div className="flex items-center gap-1 shrink-0 ml-1">
                    <span className="text-[10px] font-mono text-slate-400 px-1 py-0.5 bg-slate-100 rounded">
                      {project.tasks.length}
                    </span>
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
                          "w-36 sm:w-44 shrink-0 p-1.5 border-r border-slate-200/80 bg-amber-50/20 flex flex-col gap-1 min-h-[56px] transition-colors relative",
                          dragOverCell?.project === project.fullPath && dragOverCell?.slotKey === 'backlog' && "bg-amber-100/70 border-2 border-dashed border-amber-500"
                        )}
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
                              onBlur={() => {
                                if (!quickAddTitle.trim()) setQuickAddCell(null);
                              }}
                              className="w-full bg-white border border-indigo-300 rounded px-1.5 py-1 text-xs outline-none focus:ring-1 focus:ring-indigo-500 shadow-2xs"
                            />
                          </form>
                        )}
                      </div>
                    )}

                    {/* Content Columns: Calendar Mode vs Custom Mode */}
                    {timelineMode === 'calendar' ? (
                      /* Calendar Date Cells */
                      <div className="flex flex-1 min-w-max">
                        {timelineDates.map(date => {
                          const isDateToday = isToday(date);
                          const dateKey = String(date.getTime());
                          const isDragOver = dragOverCell?.project === project.fullPath && dragOverCell?.slotKey === dateKey;
                          
                          // Find tasks matching this date
                          const cellTasks = projectTasks.filter(t => t.deadline && isSameDay(new Date(t.deadline), date))
                            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.createdAt - b.createdAt);

                          return (
                            <div
                              key={date.toISOString()}
                              onDragOver={(e) => {
                                e.preventDefault();
                                setDragOverCell({ project: project.fullPath, slotKey: dateKey });
                              }}
                              onDragLeave={() => setDragOverCell(null)}
                              onDrop={(e) => handleCellDrop(e, project.fullPath, { type: 'calendar', date })}
                              onDoubleClick={() => {
                                setQuickAddCell({ 
                                  project: project.fullPath, 
                                  slotKey: dateKey, 
                                  type: 'calendar', 
                                  dateMs: date.getTime() 
                                });
                                setQuickAddTitle('');
                              }}
                              className={cn(
                                "w-28 sm:w-32 lg:w-36 shrink-0 p-1.5 border-r border-slate-100 flex flex-col gap-1 min-h-[56px] transition-colors relative group/cell",
                                isDateToday && "bg-indigo-50/30",
                                isDragOver && "bg-indigo-100 border-2 border-dashed border-indigo-500"
                              )}
                            >
                              {/* Render Task Chips sorted in chronological sequence */}
                              {cellTasks.map((task) => renderTaskChip(task))}

                              {/* Quick Add input in date cell */}
                              {quickAddCell?.project === project.fullPath && quickAddCell?.slotKey === dateKey ? (
                                <form onSubmit={handleQuickAddSubmit} className="mt-1">
                                  <input
                                    autoFocus
                                    type="text"
                                    placeholder={isJa ? "タスク名..." : "Task name..."}
                                    value={quickAddTitle}
                                    onChange={(e) => setQuickAddTitle(e.target.value)}
                                    onBlur={() => {
                                      if (!quickAddTitle.trim()) setQuickAddCell(null);
                                    }}
                                    className="w-full bg-white border border-indigo-300 rounded px-1.5 py-1 text-xs outline-none focus:ring-1 focus:ring-indigo-500 shadow-2xs"
                                  />
                                </form>
                              ) : (
                                <button
                                  onClick={() => {
                                    setQuickAddCell({ 
                                      project: project.fullPath, 
                                      slotKey: dateKey, 
                                      type: 'calendar', 
                                      dateMs: date.getTime() 
                                    });
                                    setQuickAddTitle('');
                                  }}
                                  className="w-full py-0.5 rounded text-[10px] text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 transition-colors opacity-0 group-hover/cell:opacity-100 mt-auto flex items-center justify-center gap-0.5"
                                  title={isJa ? 'この日時にタスク作成' : 'Add task on this date'}
                                >
                                  <Plus size={11} />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      /* Custom Abstract Columns Cells */
                      <div className="flex flex-1 min-w-max">
                        {customColumns.map(col => {
                          const colKey = col.id;
                          const isDragOver = dragOverCell?.project === project.fullPath && dragOverCell?.slotKey === colKey;

                          // Find tasks matching this custom column using per-preset resolver
                          const cellTasks = projectTasks.filter(t => getTaskCurrentColumnId(t, customColumns) === col.id)
                            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.createdAt - b.createdAt);

                          return (
                            <div
                              key={col.id}
                              onDragOver={(e) => {
                                e.preventDefault();
                                setDragOverCell({ project: project.fullPath, slotKey: colKey });
                              }}
                              onDragLeave={() => setDragOverCell(null)}
                              onDrop={(e) => handleCellDrop(e, project.fullPath, { type: 'custom', columnId: col.id })}
                              onDoubleClick={() => {
                                setQuickAddCell({ 
                                  project: project.fullPath, 
                                  slotKey: colKey, 
                                  type: 'custom', 
                                  columnId: col.id 
                                });
                                setQuickAddTitle('');
                              }}
                              className={cn(
                                "w-32 sm:w-36 lg:w-40 shrink-0 p-1.5 border-r border-slate-100 flex flex-col gap-1 min-h-[56px] transition-colors relative group/cell",
                                isDragOver && "bg-indigo-100 border-2 border-dashed border-indigo-500"
                              )}
                            >
                              {/* Render Task Chips sorted in sequence */}
                              {cellTasks.map((task) => renderTaskChip(task))}

                              {/* Quick Add input in custom cell */}
                              {quickAddCell?.project === project.fullPath && quickAddCell?.slotKey === colKey ? (
                                <form onSubmit={handleQuickAddSubmit} className="mt-1">
                                  <input
                                    autoFocus
                                    type="text"
                                    placeholder={isJa ? "タスク名..." : "Task name..."}
                                    value={quickAddTitle}
                                    onChange={(e) => setQuickAddTitle(e.target.value)}
                                    onBlur={() => {
                                      if (!quickAddTitle.trim()) setQuickAddCell(null);
                                    }}
                                    className="w-full bg-white border border-indigo-300 rounded px-1.5 py-1 text-xs outline-none focus:ring-1 focus:ring-indigo-500 shadow-2xs"
                                  />
                                </form>
                              ) : (
                                <button
                                  onClick={() => {
                                    setQuickAddCell({ 
                                      project: project.fullPath, 
                                      slotKey: colKey, 
                                      type: 'custom', 
                                      columnId: col.id 
                                    });
                                    setQuickAddTitle('');
                                  }}
                                  className="w-full py-0.5 rounded text-[10px] text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 transition-colors opacity-0 group-hover/cell:opacity-100 mt-auto flex items-center justify-center gap-0.5"
                                  title={isJa ? 'この列にタスク作成' : 'Add task in this column'}
                                >
                                  <Plus size={11} />
                                </button>
                              )}
                            </div>
                          );
                        })}

                        {/* Filler space matching header Add button */}
                        <div className="w-12 shrink-0 border-r border-slate-100 bg-slate-50/20" />
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
                // Auto expand parent if collapsed
                if (targetParentFolder && collapsedProjectPaths.has(targetParentFolder)) {
                  setCollapsedProjectPaths(prev => {
                    const next = new Set(prev);
                    next.delete(targetParentFolder);
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
        onClick={() => {
          setSelectedKey(`task:${task.id}`);
          setSelectedFolderPath(null);
          onSelectTask(task.id);
        }}
        className={cn(
          "group/chip relative flex items-center gap-1.5 px-2 py-1 rounded-md text-xs cursor-grab active:cursor-grabbing transition-all shadow-2xs border select-none",
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

        {/* Task Title */}
        <span className={cn(
          "truncate flex-1 text-[11px] leading-tight",
          task.isDone && "line-through opacity-75"
        )}>
          {task.title}
        </span>

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
