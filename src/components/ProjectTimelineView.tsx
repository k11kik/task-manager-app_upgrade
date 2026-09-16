import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Clock, 
  Folder, 
  FolderOpen, 
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
import { format, addDays, subDays, startOfDay, isSameDay, isToday } from 'date-fns';

export interface CustomTimelineColumn {
  id: string;
  label: string;
}

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

  // Calendar Timeline view window state (start date, number of days visible)
  const [windowStartDate, setWindowStartDate] = useState<Date>(() => subDays(startOfDay(new Date()), 2));
  const [daysCount, setDaysCount] = useState<number>(14); // 7, 14, 21, 30
  const [showUnscheduledColumn, setShowUnscheduledColumn] = useState(true);
  const [collapsedProjectPaths, setCollapsedProjectPaths] = useState<Set<string>>(new Set());

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

  // Group tasks by project and subproject paths
  const projectTree = useMemo(() => {
    const projectMap = new Map<string, { fullPath: string; name: string; level: number; tasks: Task[] }>();

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

    return Array.from(projectMap.values()).sort((a, b) => a.fullPath.localeCompare(b.fullPath));
  }, [activeTasks]);

  const toggleProjectCollapse = (path: string) => {
    setCollapsedProjectPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

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
          const aIdx = a.timelineColumn ? customColumns.findIndex(c => c.id === a.timelineColumn) : -1;
          const bIdx = b.timelineColumn ? customColumns.findIndex(c => c.id === b.timelineColumn) : -1;
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
          // In custom columns: do NOT clear deadline, original deadline is preserved
        } else {
          // In ToDo List (backlog): clear column, preserve original deadline
          updates.timelineColumn = undefined;
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
          if (!slot.columnId) return !t.timelineColumn;
          return t.timelineColumn === slot.columnId;
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

      const isTargetBacklog = timelineMode === 'calendar' ? !targetTask.deadline : !targetTask.timelineColumn;

      const updates: Partial<Task> = {
        project: targetTask.project,
        timelineColumn: isTargetBacklog ? undefined : targetTask.timelineColumn,
      };

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
          if (!targetTask.timelineColumn) return !t.timelineColumn;
          return t.timelineColumn === targetTask.timelineColumn;
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
    await onAddTask({
      title: quickAddTitle.trim(),
      project,
      deadline: type === 'calendar' ? dateMs : undefined,
      timelineColumn: type === 'custom' ? columnId : undefined,
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
              <div className="relative">
                <button
                  onClick={() => setIsPresetOpen(!isPresetOpen)}
                  className="px-2.5 py-1 text-[11px] font-semibold bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700 flex items-center gap-1 shadow-2xs"
                >
                  <Sparkles size={12} className="text-amber-500" />
                  <span>{isJa ? 'プリセット' : 'Presets'}</span>
                  <ChevronDown size={11} className="text-slate-400" />
                </button>

                {isPresetOpen && (
                  <div className="absolute left-0 mt-1 w-52 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-30 text-xs">
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
      <div className="flex-1 overflow-auto custom-scrollbar relative flex flex-col">
        {/* Table/Grid Header */}
        <div className="flex border-b border-slate-200 bg-slate-100/95 sticky top-0 z-20 shrink-0 select-none">
          {/* Project Column Header (Can receive drops to make folder top-level) */}
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
              "shrink-0 px-2 sm:px-3 py-2 border-r border-slate-200 flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-slate-600 bg-slate-100 sm:sticky sm:left-0 z-30 transition-colors relative group/projcol",
              isDragOverRootHeader && "bg-indigo-100 ring-2 ring-indigo-500 ring-inset"
            )}
            title={isJa ? "サブプロジェクトをここにドロップすると最上位プロジェクト化できます" : "Drop subproject here to make it a top-level project"}
          >
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <span className="truncate">{isJa ? 'プロジェクト / レーン' : 'Projects / Lanes'}</span>
              <span className="text-[10px] text-slate-400 font-mono">({projectTree.length})</span>
            </div>

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
          {projectTree.map(project => {
            const isCollapsed = collapsedProjectPaths.has(project.fullPath);
            const indentPx = project.level * 14;

            // Separate tasks for this project
            const projectTasks = project.tasks;

            // Unscheduled tasks (no deadline in calendar mode, no timelineColumn in custom mode)
            const unscheduledTasks = projectTasks.filter(t => {
              if (timelineMode === 'calendar') return !t.deadline;
              return !t.timelineColumn;
            }).sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.createdAt - b.createdAt);

            return (
              <div 
                key={project.fullPath} 
                className={cn(
                  "flex group transition-colors hover:bg-slate-50/40",
                  project.level === 0 ? "bg-white" : "bg-slate-50/20"
                )}
              >
                {/* Project Lane Title Column (Sticky Left, Draggable for Subproject Nesting / Movement) */}
                <div 
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
                    "shrink-0 px-1.5 sm:px-2 py-2 border-r border-slate-200 flex items-center justify-between bg-white sm:sticky sm:left-0 sm:z-10 select-none transition-colors cursor-grab active:cursor-grabbing group/lane",
                    project.level === 0 ? "font-bold text-slate-800" : "font-medium text-slate-600",
                    dragOverProjectHeader === project.fullPath && "bg-indigo-50/90 ring-2 ring-indigo-500 ring-inset"
                  )}
                  title={isJa ? "ドラッグして他のプロジェクトに移動・サブプロジェクト化" : "Drag to move or nest under another project"}
                >
                  <div className="flex items-center gap-1 min-w-0 flex-1 overflow-hidden">
                    <GripVertical size={11} className="hidden sm:block text-slate-300 group-hover/lane:text-slate-500 shrink-0 mr-0.5" />
                    <button
                      onClick={() => toggleProjectCollapse(project.fullPath)}
                      className="p-0.5 text-slate-400 hover:text-slate-700 rounded transition-transform shrink-0"
                    >
                      {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                    </button>

                    <Folder size={13} className={cn("shrink-0", project.level === 0 ? "text-indigo-600" : "text-amber-500")} />

                    <span className="text-xs truncate font-mono tracking-tight flex-1 min-w-0" title={project.fullPath}>
                      {project.name}
                    </span>
                  </div>

                  {/* Task counter & add quick button */}
                  <div className="flex items-center gap-1 shrink-0 ml-1">
                    <span className="text-[10px] font-mono text-slate-400 px-1 py-0.5 bg-slate-100 rounded">
                      {project.tasks.length}
                    </span>
                    <button
                      onClick={() => {
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
                        {unscheduledTasks.map((task) => renderTaskChip(task, projectTaskSequenceMap.get(task.id) || 1))}

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
                              {cellTasks.map((task) => renderTaskChip(task, projectTaskSequenceMap.get(task.id) || 1))}

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

                          // Find tasks matching this custom column
                          const cellTasks = projectTasks.filter(t => t.timelineColumn === col.id)
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
                              {cellTasks.map((task) => renderTaskChip(task, projectTaskSequenceMap.get(task.id) || 1))}

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
                  <div className="flex-1 px-4 py-2 text-xs text-slate-400 italic bg-slate-50/50">
                    {project.tasks.length} {isJa ? '件のタスクが折りたたまれています' : 'tasks collapsed'}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  // Helper to render a compact, draggable & reorderable task chip
  function renderTaskChip(task: Task, sequenceNum: number) {
    const isSelected = activeTaskId === task.id;
    const isUrgent = task.category === 'Urgent';
    const isDragTarget = dragOverTask?.taskId === task.id;

    return (
      <div
        key={task.id}
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
        onClick={() => onSelectTask(task.id)}
        className={cn(
          "group/chip relative flex items-center gap-1.5 px-2 py-1 rounded-md text-xs cursor-grab active:cursor-grabbing transition-all shadow-2xs border select-none",
          isSelected 
            ? "bg-indigo-600 text-white border-indigo-700 shadow-xs font-semibold ring-2 ring-indigo-400/40" 
            : isUrgent 
              ? "bg-red-50 text-red-950 border-red-200 hover:bg-red-100 hover:border-red-300"
              : "bg-white text-slate-800 border-slate-200/90 hover:bg-slate-50 hover:border-slate-300",
          task.isDone && "opacity-50 line-through bg-slate-100 text-slate-400 border-slate-200",
          isDragTarget && dragOverTask?.position === 'before' && "border-t-2 border-t-indigo-600 shadow-md",
          isDragTarget && dragOverTask?.position === 'after' && "border-b-2 border-b-indigo-600 shadow-md"
        )}
      >
        {/* Sequence rank number (#1, #2...) for chronological execution order */}
        <span 
          className={cn(
            "text-[9px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0 transition-colors shadow-2xs",
            isSelected 
              ? "bg-indigo-700 text-indigo-100 border border-indigo-500/40" 
              : task.isDone
                ? "bg-slate-200/80 text-slate-500 font-medium"
                : isUrgent
                  ? "bg-red-200 text-red-900 border border-red-300 font-black"
                  : "bg-indigo-50 text-indigo-700 border border-indigo-200 group-hover/chip:bg-indigo-600 group-hover/chip:text-white group-hover/chip:border-transparent font-black"
          )}
          title={isJa ? `実行順: #${sequenceNum}` : `Execution Order: #${sequenceNum}`}
        >
          #{sequenceNum}
        </span>

        {/* Checkbox */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleDone(task.id);
          }}
          className={cn(
            "shrink-0 transition-colors",
            isSelected ? "text-white/80 hover:text-white" : "text-slate-400 hover:text-indigo-600"
          )}
        >
          {task.isDone ? (
            <CheckCircle2 size={12} className={isSelected ? "text-white" : "text-emerald-500"} />
          ) : (
            <Circle size={12} className={isUrgent ? "text-red-500" : "text-slate-300"} />
          )}
        </button>

        {/* Priority Dot */}
        {isUrgent && !task.isDone && (
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" title="Focus" />
        )}

        {/* Task Title */}
        <span className="truncate flex-1 text-[11px] leading-tight">
          {task.title}
        </span>

        {/* Star */}
        {task.isStarred && (
          <Star size={10} fill="currentColor" className={isSelected ? "text-amber-300" : "text-amber-400 shrink-0"} />
        )}

        {/* Subtle Drag Handle on hover */}
        <GripVertical size={11} className={cn("shrink-0 opacity-0 group-hover/chip:opacity-60 transition-opacity", isSelected ? "text-white" : "text-slate-400")} />
      </div>
    );
  }
};
