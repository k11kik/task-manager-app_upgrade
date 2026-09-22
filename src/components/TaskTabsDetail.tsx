import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  X, 
  CheckCircle2, 
  Circle, 
  Star, 
  Pin, 
  Calendar as CalendarIcon, 
  Clock, 
  ExternalLink, 
  Trash2, 
  Copy, 
  Archive, 
  FileText, 
  Folder, 
  Zap, 
  Maximize2, 
  Split, 
  Columns, 
  Rows, 
  Grid2X2, 
  Check, 
  Plus,
  ArrowRight,
  PinOff,
  Repeat
} from 'lucide-react';
import { Task, Category, RecurrenceType } from '../types';
import { cn } from '../lib/utils';
import { format } from 'date-fns';

export type SplitLayoutType = 'single' | 'split-right' | 'split-down' | 'grid-2x2';

export interface EditorPaneState {
  id: number;
  openTaskIds: string[];
  activeTaskId: string | null;
  previewTaskId: string | null;
}

export interface TaskTabsDetailProps {
  tasks: Task[];
  activeTaskId: string | null;
  openTaskIds: string[];
  lastOpenEvent?: { taskId: string; isPermanent: boolean; timestamp: number } | null;
  onSelectTask: (taskId: string, isPermanent?: boolean) => void;
  onClose: () => void;
  onUpdateTask: (taskId: string, updates: Partial<Task>) => void;
  onMoveTask: (taskId: string, category: Category) => void;
  onDeleteTask: (taskId: string) => void;
  onToggleDone: (taskId: string) => void;
  onToggleStar: (taskId: string) => void;
  onTogglePin: (taskId: string) => void;
  onDuplicateTask?: (task: Task) => void;
  deadlineThresholdDays?: number;
  language?: string;
  width: number;
  onWidthChange: (newWidth: number) => void;
  t: (key: string) => string;
}

// ---------------------------------------------------------------------------
// Single Pane Component
// ---------------------------------------------------------------------------
interface SinglePaneProps {
  pane: EditorPaneState;
  isActivePane: boolean;
  tasks: Task[];
  layout: SplitLayoutType;
  language: string;
  deadlineThresholdDays: number;
  onFocus: () => void;
  onSelectTab: (taskId: string) => void;
  onDoubleClickTab: (taskId: string) => void;
  onPinTab: (taskId: string) => void;
  onCloseTab: (taskId: string) => void;
  onCloseAllTabs: () => void;
  onSplitRight: () => void;
  onSplitDown: () => void;
  onClosePane?: () => void;
  onMoveTabToPane?: (taskId: string, targetPaneId: number) => void;
  onMoveTabBetweenPanes?: (sourcePaneId: number, taskId: string, targetPaneId: number, targetIndex?: number) => void;
  availablePaneIds?: number[];
  onUpdateTask: (taskId: string, updates: Partial<Task>) => void;
  onMoveTask: (taskId: string, category: Category) => void;
  onDeleteTask: (taskId: string) => void;
  onToggleDone: (taskId: string) => void;
  onToggleStar: (taskId: string) => void;
  onTogglePin: (taskId: string) => void;
  onDuplicateTask?: (task: Task) => void;
  t: (key: string) => string;
}

// Tracks currently active tab drag across panes
let activeDragTabInfo: { taskId: string; sourcePaneId: number } | null = null;

const SinglePane: React.FC<SinglePaneProps> = ({
  pane,
  isActivePane,
  tasks,
  layout,
  language,
  deadlineThresholdDays,
  onFocus,
  onSelectTab,
  onDoubleClickTab,
  onPinTab,
  onCloseTab,
  onCloseAllTabs,
  onSplitRight,
  onSplitDown,
  onClosePane,
  onMoveTabToPane,
  onMoveTabBetweenPanes,
  availablePaneIds = [],
  onUpdateTask,
  onMoveTask,
  onDeleteTask,
  onToggleDone,
  onToggleStar,
  onTogglePin,
  onDuplicateTask,
  t
}) => {
  const isJa = language === 'ja';

  const activeTask = useMemo(() => {
    return tasks.find(t => t.id === pane.activeTaskId) || null;
  }, [tasks, pane.activeTaskId]);

  const openTasks = useMemo(() => {
    return pane.openTaskIds
      .map(id => tasks.find(t => t.id === id))
      .filter((t): t is Task => t !== undefined);
  }, [pane.openTaskIds, tasks]);

  // Form local editing states
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [startDateVal, setStartDateVal] = useState('');
  const [startTimeVal, setStartTimeVal] = useState('09:00');
  const [deadlineDate, setDeadlineDate] = useState('');
  const [deadlineTime, setDeadlineTime] = useState('18:00');
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>('none');
  const [recurrenceInterval, setRecurrenceInterval] = useState<number>(1);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  const [isAllDay, setIsAllDay] = useState(false);
  const [urls, setUrls] = useState<string[]>([]);
  const [newUrlInput, setNewUrlInput] = useState('');
  const [isSavedNotice, setIsSavedNotice] = useState(false);
  const [isExpandedNotesOpen, setIsExpandedNotesOpen] = useState(false);

  // Drag and Drop Tab states
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dropSlot, setDropSlot] = useState<number | null>(null);
  const [isOverTabBar, setIsOverTabBar] = useState(false);
  const [isOverPane, setIsOverPane] = useState(false);

  // Helper to determine drop slot (0 <= slot <= openTasks.length)
  const calculateDropSlot = (e: React.DragEvent<HTMLElement>, tabIdx: number) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width) return tabIdx;
    const isRight = (e.clientX - rect.left) > (rect.width / 2);
    return isRight ? tabIdx + 1 : tabIdx;
  };

  // Global dragend cleanup listener
  useEffect(() => {
    const handleGlobalDragEnd = () => {
      activeDragTabInfo = null;
      setIsOverPane(false);
      setIsOverTabBar(false);
      setDropSlot(null);
      setDraggingTaskId(null);
    };
    window.addEventListener('dragend', handleGlobalDragEnd);
    return () => {
      window.removeEventListener('dragend', handleGlobalDragEnd);
    };
  }, []);

  // Sync state whenever activeTask changes
  useEffect(() => {
    if (activeTask) {
      setTitle(activeTask.title || '');
      setNotes(activeTask.notes || '');
      setUrls(activeTask.urls || []);
      setIsAllDay(activeTask.isAllDay || false);
      if (activeTask.startDate) {
        const sd = new Date(activeTask.startDate);
        setStartDateVal(format(sd, 'yyyy-MM-dd'));
        setStartTimeVal(format(sd, 'HH:mm'));
      } else {
        setStartDateVal('');
        setStartTimeVal('09:00');
      }
      if (activeTask.deadline) {
        const d = new Date(activeTask.deadline);
        setDeadlineDate(format(d, 'yyyy-MM-dd'));
        setDeadlineTime(format(d, 'HH:mm'));
      } else {
        setDeadlineDate('');
        setDeadlineTime('18:00');
      }
      if (activeTask.recurrence && activeTask.recurrence.type !== 'none') {
        setRecurrenceType(activeTask.recurrence.type);
        setRecurrenceInterval(activeTask.recurrence.interval ?? 1);
        if (activeTask.recurrence.endDate) {
          setRecurrenceEndDate(format(new Date(activeTask.recurrence.endDate), 'yyyy-MM-dd'));
        } else {
          setRecurrenceEndDate('');
        }
      } else {
        setRecurrenceType('none');
        setRecurrenceInterval(1);
        setRecurrenceEndDate('');
      }
    }
  }, [activeTask?.id, activeTask?.updatedAt]);

  const triggerSaveNotice = () => {
    setIsSavedNotice(true);
    setTimeout(() => setIsSavedNotice(false), 1500);
  };

  const saveTitle = (newTitle: string) => {
    if (!activeTask) return;
    if (!newTitle.trim() || newTitle === activeTask.title) return;
    onPinTab(activeTask.id); // Promotes to permanent on edit
    onUpdateTask(activeTask.id, { title: newTitle.trim() });
    triggerSaveNotice();
  };

  const saveNotes = (newNotes: string) => {
    if (!activeTask) return;
    if (newNotes === (activeTask.notes || '')) return;
    onPinTab(activeTask.id); // Promotes to permanent on edit
    onUpdateTask(activeTask.id, { notes: newNotes });
    triggerSaveNotice();
  };

  const handleStartDateCommit = (dateStr: string, timeStr: string, allDay: boolean) => {
    if (!activeTask) return;
    onPinTab(activeTask.id); // Promotes to permanent on edit
    if (!dateStr) {
      onUpdateTask(activeTask.id, { startDate: undefined });
      triggerSaveNotice();
      return;
    }
    const [year, month, day] = dateStr.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    if (allDay) {
      d.setHours(0, 0, 0, 0);
    } else {
      const [h, m] = timeStr.split(':').map(Number);
      d.setHours(h || 9, m || 0, 0, 0);
    }
    onUpdateTask(activeTask.id, { startDate: d.getTime() });
    triggerSaveNotice();
  };

  const handleDeadlineCommit = (dateStr: string, timeStr: string, allDay: boolean) => {
    if (!activeTask) return;
    onPinTab(activeTask.id); // Promotes to permanent on edit
    if (!dateStr) {
      onUpdateTask(activeTask.id, { deadline: undefined, isAllDay: allDay });
      triggerSaveNotice();
      return;
    }
    const [year, month, day] = dateStr.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    if (allDay) {
      d.setHours(23, 59, 59, 999);
    } else {
      const [h, m] = timeStr.split(':').map(Number);
      d.setHours(h || 18, m || 0, 0, 0);
    }
    onUpdateTask(activeTask.id, { deadline: d.getTime(), isAllDay: allDay });
    triggerSaveNotice();
  };

  const handleRecurrenceCommit = (type: RecurrenceType, intervalVal: number, endDateStr: string) => {
    if (!activeTask) return;
    onPinTab(activeTask.id); // Promotes to permanent on edit
    if (type === 'none') {
      onUpdateTask(activeTask.id, { recurrence: undefined });
      triggerSaveNotice();
      return;
    }
    let endTimestamp: number | undefined = undefined;
    if (endDateStr) {
      const [y, m, d] = endDateStr.split('-').map(Number);
      const ed = new Date(y, m - 1, d, 23, 59, 59, 999);
      endTimestamp = ed.getTime();
    }
    onUpdateTask(activeTask.id, {
      recurrence: {
        type,
        interval: Math.max(1, intervalVal),
        endDate: endTimestamp
      }
    });
    triggerSaveNotice();
  };

  const addUrl = () => {
    if (!activeTask || !newUrlInput.trim()) return;
    onPinTab(activeTask.id);
    let url = newUrlInput.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    const updated = [...urls, url];
    setUrls(updated);
    setNewUrlInput('');
    onUpdateTask(activeTask.id, { urls: updated });
    triggerSaveNotice();
  };

  const removeUrl = (index: number) => {
    if (!activeTask) return;
    onPinTab(activeTask.id);
    const updated = urls.filter((_, i) => i !== index);
    setUrls(updated);
    onUpdateTask(activeTask.id, { urls: updated });
    triggerSaveNotice();
  };

  const isUrgent = activeTask?.category === 'Urgent';

  return (
    <div 
      onClick={onFocus}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('application/json') || e.dataTransfer.types.includes('text/plain')) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          // Same pane: do NOT highlight or show "Move tab to this pane"
          if (activeDragTabInfo && activeDragTabInfo.sourcePaneId === pane.id) {
            if (isOverPane) setIsOverPane(false);
            return;
          }
          if (!isOverPane) setIsOverPane(true);
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setIsOverPane(false);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsOverPane(false);
        setDropSlot(null);
        setDraggingTaskId(null);
        activeDragTabInfo = null;
        setIsOverTabBar(false);

        try {
          const raw = e.dataTransfer.getData('application/json');
          if (raw) {
            const data = JSON.parse(raw);
            if (data.type === 'task-tab-drag' && data.taskId) {
              // Ignore drop on own pane body to avoid accidental reordering
              if (data.sourcePaneId === pane.id) return;
              onMoveTabBetweenPanes?.(data.sourcePaneId, data.taskId, pane.id);
              return;
            }
          }
        } catch (err) {
          console.error('Drop error', err);
        }
        const textId = e.dataTransfer.getData('text/plain');
        if (textId && onMoveTabBetweenPanes) {
          onMoveTabBetweenPanes(pane.id, textId, pane.id);
        }
      }}
      className={cn(
        "flex-1 h-full min-h-0 flex flex-col bg-white overflow-hidden transition-all relative border border-slate-200/80 rounded-lg",
        isActivePane && layout !== 'single' && "ring-2 ring-indigo-500/60 border-indigo-400",
        isOverPane && layout !== 'single' && activeDragTabInfo?.sourcePaneId !== pane.id && "ring-2 ring-indigo-500 bg-indigo-50/20"
      )}
    >
      {/* Visual Drop Overlay ONLY when dragging across different split panes */}
      {isOverPane && layout !== 'single' && activeDragTabInfo?.sourcePaneId !== pane.id && (
        <div className="absolute inset-0 z-50 bg-indigo-600/10 backdrop-blur-[1px] border-2 border-dashed border-indigo-500 rounded-lg flex flex-col items-center justify-center gap-2 pointer-events-none transition-all">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
            <FileText size={20} />
          </div>
          <span className="text-xs font-bold text-indigo-900 bg-white/95 px-3.5 py-1.5 rounded-full shadow-xs border border-indigo-200">
            {isJa ? 'この領域にタブを移動' : 'Move tab to this pane'}
          </span>
        </div>
      )}

      {/* Tab Bar (VS Code style) */}
      <div className={cn(
        "flex items-center justify-between border-b select-none custom-scrollbar shrink-0 h-9 transition-colors",
        isActivePane ? "bg-slate-100/95 border-slate-300" : "bg-slate-50 border-slate-200"
      )}>
        {/* Scrollable Tabs */}
        <div 
          className={cn(
            "flex items-center h-full flex-1 overflow-x-auto custom-scrollbar min-w-0 transition-colors",
            isOverTabBar && "bg-indigo-50/50"
          )}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'move';
            if (!isOverTabBar) setIsOverTabBar(true);
            if (e.target === e.currentTarget) {
              setDropSlot(openTasks.length);
            }
          }}
          onDragLeave={(e) => {
            e.stopPropagation();
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
              setIsOverTabBar(false);
              setDropSlot(null);
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsOverTabBar(false);
            setDropSlot(null);
            setDraggingTaskId(null);
            activeDragTabInfo = null;
            setIsOverPane(false);

            // Dropping on the empty tab bar space inserts at the end of the tabs!
            const targetIndex = openTasks.length;

            try {
              const raw = e.dataTransfer.getData('application/json');
              if (raw) {
                const data = JSON.parse(raw);
                if (data.type === 'task-tab-drag' && data.taskId) {
                  onMoveTabBetweenPanes?.(data.sourcePaneId, data.taskId, pane.id, targetIndex);
                  return;
                }
              }
            } catch (err) {
              console.error('Drop error', err);
            }
            const textId = e.dataTransfer.getData('text/plain');
            if (textId && onMoveTabBetweenPanes) {
              onMoveTabBetweenPanes(pane.id, textId, pane.id, targetIndex);
            }
          }}
        >
          {openTasks.map((task, idx) => {
            const isActive = task.id === pane.activeTaskId;
            const isPreview = task.id === pane.previewTaskId;
            const isBeingDragged = draggingTaskId === task.id;

            return (
              <div
                key={task.id}
                draggable
                onDragStart={(e) => {
                  activeDragTabInfo = { taskId: task.id, sourcePaneId: pane.id };
                  e.dataTransfer.setData('application/json', JSON.stringify({
                    type: 'task-tab-drag',
                    taskId: task.id,
                    sourcePaneId: pane.id
                  }));
                  e.dataTransfer.setData('text/plain', task.id);
                  e.dataTransfer.effectAllowed = 'move';
                  setDraggingTaskId(task.id);
                }}
                onDragEnd={() => {
                  activeDragTabInfo = null;
                  setDraggingTaskId(null);
                  setDropSlot(null);
                  setIsOverPane(false);
                  setIsOverTabBar(false);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.dataTransfer.dropEffect = 'move';

                  // If dragging over itself in the same pane, don't show insertion line
                  if (activeDragTabInfo?.sourcePaneId === pane.id && activeDragTabInfo?.taskId === task.id) {
                    if (dropSlot !== null) setDropSlot(null);
                    return;
                  }

                  const slot = calculateDropSlot(e, idx);
                  if (dropSlot !== slot) {
                    setDropSlot(slot);
                  }
                }}
                onDragLeave={(e) => {
                  e.stopPropagation();
                  // Only clear if actually leaving the tab element (not moving into child elements)
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    if (dropSlot === idx || dropSlot === idx + 1) {
                      setDropSlot(null);
                    }
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();

                  // Compute targetIndex directly and accurately from drop mouse position
                  const targetIndex = calculateDropSlot(e, idx);

                  setDropSlot(null);
                  setDraggingTaskId(null);
                  activeDragTabInfo = null;
                  setIsOverPane(false);
                  setIsOverTabBar(false);

                  try {
                    const raw = e.dataTransfer.getData('application/json');
                    if (raw) {
                      const data = JSON.parse(raw);
                      if (data.type === 'task-tab-drag' && data.taskId) {
                        onMoveTabBetweenPanes?.(data.sourcePaneId, data.taskId, pane.id, targetIndex);
                        return;
                      }
                    }
                  } catch (err) {
                    console.error('Drop error', err);
                  }
                  const textId = e.dataTransfer.getData('text/plain');
                  if (textId && onMoveTabBetweenPanes) {
                    onMoveTabBetweenPanes(pane.id, textId, pane.id, targetIndex);
                  }
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onFocus();
                  onSelectTab(task.id);
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  onDoubleClickTab(task.id);
                }}
                onAuxClick={(e) => {
                  // Middle click closes tab
                  if (e.button === 1) {
                    e.preventDefault();
                    e.stopPropagation();
                    onCloseTab(task.id);
                  }
                }}
                className={cn(
                  "group relative flex items-center gap-1.5 px-3 h-full border-r border-slate-200/90 text-xs cursor-grab active:cursor-grabbing select-none transition-all max-w-[200px] shrink-0",
                  isActive
                    ? "bg-white text-slate-900 border-t-2 border-t-indigo-600 font-semibold shadow-2xs"
                    : "text-slate-600 hover:bg-slate-200/70 hover:text-slate-900",
                  isPreview && "italic",
                  isBeingDragged && "opacity-40 scale-95 border-dashed border-indigo-400"
                )}
                title={isPreview 
                  ? `${task.project} > ${task.title} (${isJa ? 'プレビュー - ダブルクリックで固定 / ドラッグで移動' : 'Preview - double click to pin / drag to move'})` 
                  : `${task.project} > ${task.title} (${isJa ? 'ドラッグして領域間・タブ間を移動' : 'Drag to move tab'})`}
              >
                {/* Insertion line indicator */}
                {dropSlot === idx && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-600 z-30 pointer-events-none rounded-r shadow-xs animate-pulse" />
                )}
                {dropSlot === idx + 1 && idx === openTasks.length - 1 && (
                  <div className="absolute right-0 top-0 bottom-0 w-1 bg-indigo-600 z-30 pointer-events-none rounded-l shadow-xs animate-pulse" />
                )}

                {/* Status Dot / Indicator */}
                {task.isDone ? (
                  <CheckCircle2 size={12} className="text-emerald-500 shrink-0 not-italic" />
                ) : task.category === 'Urgent' ? (
                  <span className="w-2 h-2 rounded-full bg-red-500 shrink-0 not-italic" />
                ) : (
                  <FileText size={12} className="text-indigo-400 shrink-0 not-italic" />
                )}

                {/* Tab Title */}
                <span className="truncate min-w-0">
                  {task.title || (isJa ? '無題のタスク' : 'Untitled')}
                </span>

                {/* Pin Button if in preview mode */}
                {isPreview && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPinTab(task.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 hover:text-indigo-600 p-0.5 rounded transition-opacity"
                    title={isJa ? 'タブを固定' : 'Pin tab'}
                  >
                    <Pin size={11} />
                  </button>
                )}

                {/* Close Tab Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(task.id);
                  }}
                  className="ml-0.5 p-0.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200/80 transition-colors opacity-70 group-hover:opacity-100 not-italic"
                  title={isJa ? '閉じる (中クリックでも可)' : 'Close'}
                >
                  <X size={12} />
                </button>
              </div>
            );
          })}

          {/* Drop indicator at the end of the tabs when dragging over empty space */}
          {isOverTabBar && (dropSlot === null || dropSlot === openTasks.length) && openTasks.length > 0 && (
            <div className="h-6 px-2 mx-1 border border-dashed border-indigo-400 bg-indigo-50/70 rounded flex items-center justify-center text-[10px] text-indigo-600 font-semibold shrink-0 animate-pulse pointer-events-none">
              ＋ {isJa ? '右端に追加' : 'Insert at end'}
            </div>
          )}

          {openTasks.length === 0 && (
            <div className="px-3 text-xs text-slate-400 italic">
              {isJa ? 'タブなし (ここにドロップ可能)' : 'No tabs (drop here)'}
            </div>
          )}
        </div>

        {/* Tab Bar Action Buttons (Split Right, Split Down, Close Pane, etc.) */}
        <div className="flex items-center gap-0.5 px-1.5 shrink-0 text-slate-500">
          {/* Split Right */}
          <button
            type="button"
            onClick={onSplitRight}
            className="p-1 hover:text-slate-800 hover:bg-slate-200/80 rounded transition-colors"
            title={isJa ? 'エディタを左右に分割 (Split Right)' : 'Split editor right'}
          >
            <Columns size={14} />
          </button>

          {/* Split Down */}
          <button
            type="button"
            onClick={onSplitDown}
            className="p-1 hover:text-slate-800 hover:bg-slate-200/80 rounded transition-colors"
            title={isJa ? 'エディタを上下に分割 (Split Down)' : 'Split editor down'}
          >
            <Rows size={14} />
          </button>

          {/* Close this Pane if split */}
          {layout !== 'single' && onClosePane && (
            <button
              type="button"
              onClick={onClosePane}
              className="p-1 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
              title={isJa ? 'このエディタグループを閉じる' : 'Close this editor group'}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Pane Content Body */}
      {activeTask ? (
        <div className="flex-1 h-full min-h-0 flex flex-col overflow-hidden bg-white">
          {/* Subheader / Breadcrumb */}
          <div className="flex items-center justify-between px-3.5 py-2 border-b border-slate-100 bg-slate-50/50 shrink-0">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono min-w-0">
              <Folder size={13} className="text-indigo-500 shrink-0" />
              <span className="truncate font-semibold text-slate-700">{activeTask.project || 'General'}</span>
              {pane.previewTaskId === activeTask.id && (
                <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.2 rounded font-sans not-italic">
                  {isJa ? 'プレビュー' : 'Preview'}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {isSavedNotice && (
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 animate-fade-in flex items-center gap-1">
                  <Check size={10} />
                  {isJa ? '保存済' : 'Saved'}
                </span>
              )}

              {/* Move to another pane if split */}
              {availablePaneIds.length > 0 && onMoveTabToPane && (
                <div className="flex items-center gap-1 text-[11px] text-slate-500">
                  <span className="hidden sm:inline">{isJa ? 'ペイン移動:' : 'Move to:'}</span>
                  {availablePaneIds.map(targetId => (
                    <button
                      key={targetId}
                      type="button"
                      onClick={() => onMoveTabToPane(activeTask.id, targetId)}
                      className="px-1.5 py-0.5 text-[10px] font-bold bg-slate-200/80 hover:bg-indigo-100 hover:text-indigo-700 rounded transition-colors"
                      title={isJa ? `ペイン ${targetId + 1} へ移動` : `Move to Pane ${targetId + 1}`}
                    >
                      P{targetId + 1}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Scrollable Form */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3.5 space-y-3.5">
            {/* Title and Done checkbox */}
            <div className="flex items-start gap-2.5">
              <button
                type="button"
                onClick={() => {
                  onPinTab(activeTask.id);
                  onToggleDone(activeTask.id);
                }}
                className="mt-1 text-slate-400 hover:text-indigo-600 transition-colors shrink-0"
                title={activeTask.isDone ? (isJa ? '未完了に戻す' : 'Mark undone') : (isJa ? '完了にする' : 'Mark done')}
              >
                {activeTask.isDone ? (
                  <CheckCircle2 size={19} className="text-emerald-500" />
                ) : (
                  <Circle size={19} className={isUrgent ? "text-red-500" : "text-slate-300"} />
                )}
              </button>

              <div className="flex-1 min-w-0">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={() => saveTitle(title)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      saveTitle(title);
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  placeholder={isJa ? "タスクのタイトル..." : "Task title..."}
                  className={cn(
                    "w-full text-sm font-bold text-slate-900 bg-transparent border-0 border-b border-transparent hover:border-slate-200 focus:border-indigo-500 focus:ring-0 outline-none pb-0.5 transition-colors",
                    activeTask.isDone && "line-through text-slate-400"
                  )}
                />
              </div>
            </div>

            {/* Badges (Category / Star / Pin) */}
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5 border-b border-slate-100 pb-2.5">
              {/* Category */}
              <div className="flex items-center bg-slate-100 rounded-lg p-0.5 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => {
                    onPinTab(activeTask.id);
                    onMoveTask(activeTask.id, 'Focus');
                  }}
                  className={cn(
                    "px-2.5 py-0.5 rounded-md transition-all text-xs",
                    activeTask.category === 'Focus' ? "bg-white text-slate-800 shadow-2xs font-bold" : "text-slate-500 hover:text-slate-800"
                  )}
                >
                  ToDo
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onPinTab(activeTask.id);
                    onMoveTask(activeTask.id, 'Urgent');
                  }}
                  className={cn(
                    "px-2.5 py-0.5 rounded-md transition-all flex items-center gap-1 text-xs",
                    activeTask.category === 'Urgent' ? "bg-red-500 text-white shadow-2xs font-bold" : "text-slate-500 hover:text-red-600"
                  )}
                >
                  <Zap size={11} className={activeTask.category === 'Urgent' ? "text-white" : "text-red-500"} />
                  Focus
                </button>
              </div>

              {/* Star */}
              <button
                type="button"
                onClick={() => {
                  onPinTab(activeTask.id);
                  onToggleStar(activeTask.id);
                }}
                className={cn(
                  "p-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition-colors",
                  activeTask.isStarred 
                    ? "bg-amber-50 text-amber-700 border-amber-200" 
                    : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                )}
                title={isJa ? '重要フラグ' : 'Star'}
              >
                <Star size={12} fill={activeTask.isStarred ? 'currentColor' : 'none'} className={activeTask.isStarred ? "text-amber-500" : "text-slate-400"} />
                <span className="hidden sm:inline">{isJa ? '重要' : 'Star'}</span>
              </button>

              {/* Pin */}
              <button
                type="button"
                onClick={() => {
                  onPinTab(activeTask.id);
                  onTogglePin(activeTask.id);
                }}
                className={cn(
                  "p-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition-colors",
                  activeTask.isPinned 
                    ? "bg-indigo-50 text-indigo-700 border-indigo-200" 
                    : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                )}
                title={isJa ? 'ピン留め' : 'Pin'}
              >
                <Pin size={12} fill={activeTask.isPinned ? 'currentColor' : 'none'} className={activeTask.isPinned ? "text-indigo-600" : "text-slate-400"} />
                <span className="hidden sm:inline">{isJa ? 'ピン留め' : 'Pin'}</span>
              </button>
            </div>

            {/* When (Start Date), Deadline & Recurrence */}
            <div className="space-y-2 p-2.5 bg-slate-50/70 border border-slate-200/80 rounded-xl">
              {/* Start Date: いつ */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock size={12} className="text-indigo-500" />
                    <span>{isJa ? 'いつ (開始日)' : 'When (Start Date)'}</span>
                  </label>
                  {startDateVal && (
                    <button
                      type="button"
                      onClick={() => {
                        setStartDateVal('');
                        handleStartDateCommit('', startTimeVal, isAllDay);
                      }}
                      className="text-[10px] text-slate-400 hover:text-red-500 px-1 py-0.5 hover:bg-slate-100 rounded transition-colors"
                      title={isJa ? '開始日をクリア' : 'Clear start date'}
                    >
                      {isJa ? 'クリア' : 'Clear'}
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="date"
                    value={startDateVal}
                    onChange={(e) => {
                      setStartDateVal(e.target.value);
                      handleStartDateCommit(e.target.value, startTimeVal, isAllDay);
                    }}
                    className="flex-1 bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                  />
                  {!isAllDay && (
                    <input
                      type="time"
                      value={startTimeVal}
                      disabled={!startDateVal}
                      onChange={(e) => {
                        setStartTimeVal(e.target.value);
                        handleStartDateCommit(startDateVal, e.target.value, isAllDay);
                      }}
                      className="w-20 bg-white border border-slate-200 rounded-lg px-1.5 py-1 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500 transition-colors disabled:opacity-40"
                    />
                  )}
                </div>
              </div>

              {/* Deadline: 締切 */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                    <CalendarIcon size={12} className="text-amber-500" />
                    <span>{isJa ? '締切 / 期日' : 'Deadline'}</span>
                  </label>
                  {deadlineDate && (
                    <button
                      type="button"
                      onClick={() => {
                        setDeadlineDate('');
                        handleDeadlineCommit('', deadlineTime, isAllDay);
                      }}
                      className="text-[10px] text-slate-400 hover:text-red-500 px-1 py-0.5 hover:bg-slate-100 rounded transition-colors"
                      title={isJa ? '締切をクリア' : 'Clear deadline'}
                    >
                      {isJa ? 'クリア' : 'Clear'}
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="date"
                    value={deadlineDate}
                    onChange={(e) => {
                      setDeadlineDate(e.target.value);
                      handleDeadlineCommit(e.target.value, deadlineTime, isAllDay);
                    }}
                    className="flex-1 bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                  />
                  {!isAllDay && (
                    <input
                      type="time"
                      value={deadlineTime}
                      disabled={!deadlineDate}
                      onChange={(e) => {
                        setDeadlineTime(e.target.value);
                        handleDeadlineCommit(deadlineDate, e.target.value, isAllDay);
                      }}
                      className="w-20 bg-white border border-slate-200 rounded-lg px-1.5 py-1 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500 transition-colors disabled:opacity-40"
                    />
                  )}
                </div>
              </div>

              {/* All-day Checkbox */}
              <div className="flex items-center gap-2 pt-0.5">
                <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isAllDay}
                    onChange={(e) => {
                      setIsAllDay(e.target.checked);
                      handleDeadlineCommit(deadlineDate, deadlineTime, e.target.checked);
                      if (startDateVal) {
                        handleStartDateCommit(startDateVal, startTimeVal, e.target.checked);
                      }
                    }}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 scale-90"
                  />
                  <span>{isJa ? '終日設定' : 'All day'}</span>
                </label>
              </div>

              {/* Recurrence: 繰り返し */}
              <div className="pt-2 border-t border-slate-200/80 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                    <Repeat size={12} className="text-indigo-600" />
                    <span>{isJa ? '繰り返し' : 'Repeat'}</span>
                  </label>
                  {recurrenceType !== 'none' && (
                    <span className="text-[10px] text-indigo-600 font-semibold bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-100">
                      {isJa ? '繰り返し有効' : 'Active'}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <select
                    value={recurrenceType}
                    onChange={(e) => {
                      const newType = e.target.value as RecurrenceType;
                      setRecurrenceType(newType);
                      handleRecurrenceCommit(newType, recurrenceInterval, recurrenceEndDate);
                    }}
                    className="flex-1 bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                  >
                    <option value="none">{isJa ? 'なし' : 'None'}</option>
                    <option value="daily">{isJa ? '毎日' : 'Every day'}</option>
                    <option value="every_x_days">{isJa ? 'X日ごと' : 'Every X days'}</option>
                    <option value="weekly">{isJa ? '毎週' : 'Every week'}</option>
                    <option value="every_x_weeks">{isJa ? 'X週ごと' : 'Every X weeks'}</option>
                  </select>

                  {/* Interval number for every_x_days and every_x_weeks */}
                  {(recurrenceType === 'every_x_days' || recurrenceType === 'every_x_weeks') && (
                    <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-0.5">
                      <input
                        type="number"
                        min="1"
                        max="365"
                        value={recurrenceInterval}
                        onChange={(e) => {
                          const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                          setRecurrenceInterval(val);
                          handleRecurrenceCommit(recurrenceType, val, recurrenceEndDate);
                        }}
                        className="w-10 text-xs text-slate-800 font-bold text-center outline-none"
                      />
                      <span className="text-[10px] text-slate-500 font-medium">
                        {recurrenceType === 'every_x_days' 
                          ? (isJa ? '日ごと' : 'days') 
                          : (isJa ? '週ごと' : 'weeks')}
                      </span>
                    </div>
                  )}
                </div>

                {/* Recurrence End Date if active */}
                {recurrenceType !== 'none' && (
                  <div className="flex items-center justify-between gap-1.5 pt-1 text-[11px] text-slate-500">
                    <span className="text-[10px] shrink-0 font-medium">{isJa ? '終了日 (任意):' : 'End date:'}</span>
                    <div className="flex items-center gap-1 flex-1 max-w-[170px]">
                      <input
                        type="date"
                        value={recurrenceEndDate}
                        onChange={(e) => {
                          setRecurrenceEndDate(e.target.value);
                          handleRecurrenceCommit(recurrenceType, recurrenceInterval, e.target.value);
                        }}
                        className="flex-1 bg-white border border-slate-200 rounded-lg px-1.5 py-0.5 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                      />
                      {recurrenceEndDate && (
                        <button
                          type="button"
                          onClick={() => {
                            setRecurrenceEndDate('');
                            handleRecurrenceCommit(recurrenceType, recurrenceInterval, '');
                          }}
                          className="text-[10px] text-slate-400 hover:text-red-500 px-1 py-0.5"
                          title={isJa ? '終了日をクリア' : 'Clear'}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  {isJa ? 'ノート' : 'NOTES'}
                </label>
                <button
                  type="button"
                  onClick={() => setIsExpandedNotesOpen(true)}
                  className="flex items-center gap-1 text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-1.5 py-0.5 rounded transition-colors"
                  title={isJa ? "大画面ウィンドウで開いて編集" : "Open in large window"}
                >
                  <Maximize2 size={11} />
                  <span>{isJa ? "拡大表示" : "Expand"}</span>
                </button>
              </div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={() => saveNotes(notes)}
                placeholder={isJa ? "ノート、メモ、コンテキストを記入..." : "Notes, context, thoughts..."}
                className="w-full min-h-[120px] resize-y bg-slate-50/70 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 leading-relaxed outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans"
              />
            </div>

            {/* Reference URLs */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <ExternalLink size={12} className="text-slate-400" />
                <span>{isJa ? '参考URL / リンク' : 'URLs'}</span>
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={newUrlInput}
                  onChange={(e) => setNewUrlInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addUrl();
                    }
                  }}
                  placeholder="https://..."
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-800 outline-none focus:bg-white focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={addUrl}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
                >
                  {isJa ? '追加' : 'Add'}
                </button>
              </div>

              {urls.length > 0 && (
                <div className="space-y-1 pt-0.5">
                  {urls.map((url, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-1.5 p-1 bg-slate-50 rounded border border-slate-100 text-xs">
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate text-indigo-600 hover:underline flex items-center gap-1 min-w-0"
                      >
                        <ExternalLink size={10} className="shrink-0 text-slate-400" />
                        <span className="truncate">{url}</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => removeUrl(idx)}
                        className="text-slate-400 hover:text-red-500 p-0.5 rounded transition-colors shrink-0"
                        title={isJa ? '削除' : 'Remove'}
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bottom Actions (Duplicate, Archive, Trash) */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1">
                {onDuplicateTask && (
                  <button
                    type="button"
                    onClick={() => {
                      onPinTab(activeTask.id);
                      onDuplicateTask(activeTask);
                    }}
                    className="px-2 py-1 text-slate-600 hover:bg-slate-100 rounded-md transition-colors flex items-center gap-1 text-[11px] font-medium"
                  >
                    <Copy size={11} />
                    <span>{isJa ? '複製' : 'Copy'}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    onPinTab(activeTask.id);
                    onMoveTask(activeTask.id, 'Archive');
                  }}
                  className="px-2 py-1 text-slate-600 hover:bg-slate-100 rounded-md transition-colors flex items-center gap-1 text-[11px] font-medium"
                >
                  <Archive size={11} />
                  <span>{isJa ? 'アーカイブ' : 'Archive'}</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  onDeleteTask(activeTask.id);
                  onCloseTab(activeTask.id);
                }}
                className="px-2 py-1 text-red-600 hover:bg-red-50 rounded-md transition-colors flex items-center gap-1 text-[11px] font-medium"
              >
                <Trash2 size={11} />
                <span>{isJa ? 'ゴミ箱' : 'Trash'}</span>
              </button>
            </div>
          </div>

          {/* Expanded Notes Modal */}
          {isExpandedNotesOpen && (
            <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl h-[80vh] flex flex-col overflow-hidden animate-scale-up">
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50/80">
                  <div className="flex items-center gap-2">
                    <FileText size={16} className="text-indigo-600" />
                    <span className="font-bold text-sm text-slate-800 truncate">{activeTask.title}</span>
                  </div>
                  <button
                    onClick={() => {
                      saveNotes(notes);
                      setIsExpandedNotesOpen(false);
                    }}
                    className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="flex-1 p-5 overflow-hidden flex flex-col">
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={isJa ? "ノート、メモ、コンテキストを記入..." : "Notes..."}
                    className="w-full flex-1 resize-none bg-slate-50/50 border border-slate-200 rounded-xl p-4 text-sm text-slate-800 leading-relaxed outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans"
                    autoFocus
                  />
                </div>
                <div className="flex items-center justify-end px-5 py-3 border-t border-slate-200 bg-slate-50/50">
                  <button
                    onClick={() => {
                      saveNotes(notes);
                      setIsExpandedNotesOpen(false);
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
                  >
                    {isJa ? '閉じて保存' : 'Save & Close'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Empty State */
        <div className="flex-1 flex flex-col items-center justify-center p-4 text-center text-slate-400 bg-slate-50/40">
          <div className="w-10 h-10 bg-white rounded-xl shadow-2xs border border-slate-200/80 flex items-center justify-center text-indigo-500 mb-2">
            <FileText size={18} strokeWidth={1.5} />
          </div>
          <h4 className="text-xs font-bold text-slate-700 mb-1">
            {isJa ? 'タスクが選択されていません' : 'No task selected'}
          </h4>
          <p className="text-[11px] text-slate-400 max-w-xs leading-relaxed">
            {isJa ? 'エクスプローラー等から開くか、他の領域からタブをドラッグ＆ドロップできます' : 'Click a task to open, or drag a tab from another pane'}
          </p>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main TaskTabsDetail Component with Grid 2x2 & Horizontal/Vertical Split
// ---------------------------------------------------------------------------
export const TaskTabsDetail: React.FC<TaskTabsDetailProps> = ({
  tasks,
  activeTaskId,
  openTaskIds,
  lastOpenEvent,
  onSelectTask,
  onClose,
  onUpdateTask,
  onMoveTask,
  onDeleteTask,
  onToggleDone,
  onToggleStar,
  onTogglePin,
  onDuplicateTask,
  deadlineThresholdDays = 3,
  language = 'en',
  width,
  onWidthChange,
  t
}) => {
  const isJa = language === 'ja';

  // Overall detail pane resizer
  const isResizingWidthRef = useRef(false);

  // Layout State (single, split-right, split-down, grid-2x2)
  const [layout, setLayout] = useState<SplitLayoutType>(() => {
    try {
      const saved = localStorage.getItem('navfor_editor_layout');
      if (saved === 'split-right' || saved === 'split-down' || saved === 'grid-2x2') {
        return saved;
      }
      return 'single';
    } catch {
      return 'single';
    }
  });

  // Active Pane index (0, 1, 2, 3)
  const [activePaneId, setActivePaneId] = useState<number>(0);

  // Panes state
  const [panes, setPanes] = useState<EditorPaneState[]>(() => {
    try {
      const saved = localStorage.getItem('navfor_editor_panes');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length >= 4) {
          return parsed;
        }
      }
    } catch (e) {
      console.error(e);
    }
    // Default 4 slots
    return [
      { id: 0, openTaskIds: openTaskIds.length > 0 ? openTaskIds : (activeTaskId ? [activeTaskId] : []), activeTaskId: activeTaskId, previewTaskId: activeTaskId },
      { id: 1, openTaskIds: [], activeTaskId: null, previewTaskId: null },
      { id: 2, openTaskIds: [], activeTaskId: null, previewTaskId: null },
      { id: 3, openTaskIds: [], activeTaskId: null, previewTaskId: null },
    ];
  });

  // Split Ratios (0.15 to 0.85)
  const [splitXRatio, setSplitXRatio] = useState<number>(() => {
    try {
      const s = localStorage.getItem('navfor_split_x_ratio');
      return s ? parseFloat(s) : 0.5;
    } catch {
      return 0.5;
    }
  });

  const [splitYRatio, setSplitYRatio] = useState<number>(() => {
    try {
      const s = localStorage.getItem('navfor_split_y_ratio');
      return s ? parseFloat(s) : 0.5;
    } catch {
      return 0.5;
    }
  });

  // Persist panes and layout
  useEffect(() => {
    try {
      localStorage.setItem('navfor_editor_layout', layout);
      localStorage.setItem('navfor_editor_panes', JSON.stringify(panes));
      localStorage.setItem('navfor_split_x_ratio', String(splitXRatio));
      localStorage.setItem('navfor_split_y_ratio', String(splitYRatio));
    } catch (e) {
      console.error(e);
    }
  }, [layout, panes, splitXRatio, splitYRatio]);

  // Synchronize incoming activeTaskId & lastOpenEvent from props (e.g. from Explorer, Timeline, Focus click)
  const prevActiveTaskIdRef = useRef<string | null>(null);
  const prevEventTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!activeTaskId) return;

    const isSameTask = prevActiveTaskIdRef.current === activeTaskId;
    const isNewEvent = lastOpenEvent && lastOpenEvent.timestamp !== prevEventTimeRef.current;
    
    if (isSameTask && !isNewEvent) return;

    prevActiveTaskIdRef.current = activeTaskId;
    if (lastOpenEvent) {
      prevEventTimeRef.current = lastOpenEvent.timestamp;
    }

    const isPermanent = Boolean(lastOpenEvent?.taskId === activeTaskId && lastOpenEvent.isPermanent);

    // Apply to current active pane
    setPanes(prevPanes => {
      return prevPanes.map(p => {
        if (p.id !== activePaneId) return p;

        // If task is already open in this pane:
        if (p.openTaskIds.includes(activeTaskId)) {
          return {
            ...p,
            activeTaskId: activeTaskId,
            // If requested as permanent, pin it (clear previewTaskId if it was this task)
            previewTaskId: isPermanent && p.previewTaskId === activeTaskId ? null : p.previewTaskId
          };
        }

        // If not open:
        if (isPermanent) {
          // Open permanently: do not overwrite existing preview tab, append as permanent
          return {
            ...p,
            openTaskIds: [...p.openTaskIds, activeTaskId],
            activeTaskId: activeTaskId,
            // previewTaskId unchanged
          };
        }

        // If preview mode:
        // Check if there is currently a preview task that hasn't been edited/pinned
        if (p.previewTaskId && p.openTaskIds.includes(p.previewTaskId)) {
          // Replace the preview tab with this new task!
          const nextOpen = p.openTaskIds.map(id => id === p.previewTaskId ? activeTaskId : id);
          return {
            ...p,
            openTaskIds: nextOpen,
            activeTaskId: activeTaskId,
            previewTaskId: activeTaskId // New task is preview
          };
        }

        // Otherwise append as new preview tab
        return {
          ...p,
          openTaskIds: [...p.openTaskIds, activeTaskId],
          activeTaskId: activeTaskId,
          previewTaskId: activeTaskId
        };
      });
    });
  }, [activeTaskId, lastOpenEvent, activePaneId]);

  // Auto close detail pane if all panes have no open tabs
  useEffect(() => {
    const totalTabs = panes.reduce((acc, p) => acc + p.openTaskIds.length, 0);
    if (totalTabs === 0 && !activeTaskId) {
      onClose();
    }
  }, [panes, activeTaskId, onClose]);

  // Handle Tab Selection within a pane
  const handleSelectTabInPane = (paneId: number, taskId: string) => {
    setActivePaneId(paneId);
    setPanes(prev => prev.map(p => {
      if (p.id !== paneId) return p;
      return { ...p, activeTaskId: taskId };
    }));
  };

  // Double click tab -> Pin it (promotes to permanent)
  const handleDoubleClickTabInPane = (paneId: number, taskId: string) => {
    setPanes(prev => prev.map(p => {
      if (p.id !== paneId) return p;
      return {
        ...p,
        previewTaskId: p.previewTaskId === taskId ? null : p.previewTaskId
      };
    }));
  };

  // Pin button -> Pin it
  const handlePinTabInPane = (paneId: number, taskId: string) => {
    setPanes(prev => prev.map(p => {
      if (p.id !== paneId) return p;
      return {
        ...p,
        previewTaskId: p.previewTaskId === taskId ? null : p.previewTaskId
      };
    }));
  };

  // Close a single tab in a pane
  const handleCloseTabInPane = (paneId: number, taskId: string) => {
    setPanes(prev => prev.map(p => {
      if (p.id !== paneId) return p;
      const nextOpen = p.openTaskIds.filter(id => id !== taskId);
      let nextActive = p.activeTaskId;
      if (p.activeTaskId === taskId) {
        const closedIdx = p.openTaskIds.indexOf(taskId);
        nextActive = nextOpen[closedIdx] || nextOpen[closedIdx - 1] || null;
      }
      return {
        ...p,
        openTaskIds: nextOpen,
        activeTaskId: nextActive,
        previewTaskId: p.previewTaskId === taskId ? null : p.previewTaskId
      };
    }));
  };

  // Close all tabs in a pane
  const handleCloseAllTabsInPane = (paneId: number) => {
    setPanes(prev => prev.map(p => {
      if (p.id !== paneId) return p;
      return {
        ...p,
        openTaskIds: [],
        activeTaskId: null,
        previewTaskId: null
      };
    }));
  };

  // Move tab between panes (or reorder within same pane)
  const handleMoveTabBetweenPanes = (sourcePaneId: number, taskId: string, targetPaneId: number, targetIndex?: number) => {
    setPanes(prev => {
      const src = prev.find(p => p.id === sourcePaneId);
      if (!src) return prev;

      // Moving within the same pane (reordering tabs)
      if (sourcePaneId === targetPaneId) {
        const currentIdx = src.openTaskIds.indexOf(taskId);
        if (currentIdx === -1) return prev;
        const newOpen = src.openTaskIds.filter(id => id !== taskId);
        let insertIdx = targetIndex !== undefined ? targetIndex : newOpen.length;
        if (targetIndex !== undefined && targetIndex > currentIdx) {
          insertIdx = targetIndex - 1;
        }
        insertIdx = Math.max(0, Math.min(newOpen.length, insertIdx));
        newOpen.splice(insertIdx, 0, taskId);
        return prev.map(p => p.id === sourcePaneId ? { ...p, openTaskIds: newOpen, activeTaskId: taskId } : p);
      }

      // Moving across different panes
      const srcNextOpen = src.openTaskIds.filter(id => id !== taskId);
      const srcIdx = src.openTaskIds.indexOf(taskId);
      const srcNextActive = src.activeTaskId === taskId ? (srcNextOpen[srcIdx] || srcNextOpen[srcIdx - 1] || null) : src.activeTaskId;

      return prev.map(p => {
        if (p.id === sourcePaneId) {
          return {
            ...p,
            openTaskIds: srcNextOpen,
            activeTaskId: srcNextActive,
            previewTaskId: p.previewTaskId === taskId ? null : p.previewTaskId
          };
        }
        if (p.id === targetPaneId) {
          let tgtNextOpen = p.openTaskIds.filter(id => id !== taskId);
          let insertIdx = targetIndex !== undefined ? targetIndex : tgtNextOpen.length;
          insertIdx = Math.max(0, Math.min(tgtNextOpen.length, insertIdx));
          tgtNextOpen.splice(insertIdx, 0, taskId);
          return {
            ...p,
            openTaskIds: tgtNextOpen,
            activeTaskId: taskId,
            previewTaskId: null // Permanent when moved
          };
        }
        return p;
      });
    });
    setActivePaneId(targetPaneId);
  };

  const handleMoveTabToPane = (sourcePaneId: number, taskId: string, targetPaneId: number) => {
    handleMoveTabBetweenPanes(sourcePaneId, taskId, targetPaneId);
  };

  // Single Pane Action
  const handleSingleLayout = () => {
    setLayout('single');
    const currentTask = panes[activePaneId]?.activeTaskId || activeTaskId;
    if (currentTask && (!panes[0].activeTaskId || !panes[0].openTaskIds.includes(currentTask))) {
      setPanes(prev => prev.map(p => {
        if (p.id === 0) {
          const nextOpen = p.openTaskIds.includes(currentTask) ? p.openTaskIds : [...p.openTaskIds, currentTask];
          return { ...p, openTaskIds: nextOpen, activeTaskId: currentTask };
        }
        return p;
      }));
    }
    setActivePaneId(0);
  };

  // Split Right Action
  const handleSplitRight = (sourcePaneId?: number) => {
    const srcId = sourcePaneId !== undefined ? sourcePaneId : activePaneId;
    const srcPane = panes.find(p => p.id === srcId);
    const taskToClone = srcPane?.activeTaskId || activeTaskId;

    if (layout === 'single') {
      setLayout('split-right');
      // Pane 0 keeps its current tabs (e.g. Task-A, Task-B)
      // Newly created Pane 1 gets ONLY 1 tab with the currently selected task
      setPanes(prev => prev.map(p => {
        if (p.id === 1) {
          return {
            ...p,
            openTaskIds: taskToClone ? [taskToClone] : [],
            activeTaskId: taskToClone || null,
            previewTaskId: null
          };
        }
        return p;
      }));
      setActivePaneId(1);
    } else if (layout === 'split-down') {
      // Elevate to 2x2 grid!
      setLayout('grid-2x2');
      const targetPane = srcId === 2 ? 3 : 1;
      setPanes(prev => prev.map(p => {
        if (p.id === targetPane) {
          return {
            ...p,
            openTaskIds: taskToClone ? [taskToClone] : [],
            activeTaskId: taskToClone || null,
            previewTaskId: null
          };
        }
        return p;
      }));
      setActivePaneId(targetPane);
    } else {
      // If already split-right or in grid-2x2, set pane 1 to active task
      setLayout('split-right');
      setPanes(prev => prev.map(p => {
        if (p.id === 1) {
          return {
            ...p,
            openTaskIds: taskToClone ? [taskToClone] : [],
            activeTaskId: taskToClone || null,
            previewTaskId: null
          };
        }
        return p;
      }));
      setActivePaneId(1);
    }
  };

  // Split Down Action
  const handleSplitDown = (sourcePaneId?: number) => {
    const srcId = sourcePaneId !== undefined ? sourcePaneId : activePaneId;
    const srcPane = panes.find(p => p.id === srcId);
    const taskToClone = srcPane?.activeTaskId || activeTaskId;

    if (layout === 'single') {
      setLayout('split-down');
      // Pane 0 keeps its current tabs (e.g. Task-A, Task-B)
      // Newly created Pane 2 (bottom) gets ONLY 1 tab with the currently selected task
      setPanes(prev => prev.map(p => {
        if (p.id === 2) {
          return {
            ...p,
            openTaskIds: taskToClone ? [taskToClone] : [],
            activeTaskId: taskToClone || null,
            previewTaskId: null
          };
        }
        return p;
      }));
      setActivePaneId(2);
    } else if (layout === 'split-right') {
      // Elevate to 2x2 grid!
      setLayout('grid-2x2');
      const targetPane = srcId === 1 ? 3 : 2;
      setPanes(prev => prev.map(p => {
        if (p.id === targetPane) {
          return {
            ...p,
            openTaskIds: taskToClone ? [taskToClone] : [],
            activeTaskId: taskToClone || null,
            previewTaskId: null
          };
        }
        return p;
      }));
      setActivePaneId(targetPane);
    } else {
      // If already split-down or grid-2x2, set pane 2 to active task
      setLayout('split-down');
      setPanes(prev => prev.map(p => {
        if (p.id === 2) {
          return {
            ...p,
            openTaskIds: taskToClone ? [taskToClone] : [],
            activeTaskId: taskToClone || null,
            previewTaskId: null
          };
        }
        return p;
      }));
      setActivePaneId(2);
    }
  };

  // Grid 2x2 Action (4分割の場合はどこかの領域にTask-Aを表示したら残りはNo Task表示)
  const handleGrid2X2 = () => {
    const srcPane = panes.find(p => p.id === activePaneId);
    const taskToClone = srcPane?.activeTaskId || activeTaskId;

    setLayout('grid-2x2');
    setPanes(prev => prev.map(p => {
      if (p.id === 0) {
        // Pane 0 displays the active task (and keeps existing tabs if present)
        const nextOpen = p.openTaskIds.length > 0 ? p.openTaskIds : (taskToClone ? [taskToClone] : []);
        return {
          ...p,
          openTaskIds: nextOpen,
          activeTaskId: taskToClone || nextOpen[0] || null,
          previewTaskId: null
        };
      }
      // Remaining 3 panes show No Task
      return {
        ...p,
        openTaskIds: [],
        activeTaskId: null,
        previewTaskId: null
      };
    }));
    setActivePaneId(0);
  };

  // Close Pane Action
  const handleClosePane = (closingPaneId: number) => {
    if (layout === 'single') return;

    if (layout === 'split-right') {
      if (closingPaneId === 0 && panes[1].openTaskIds.length > 0) {
        setPanes(prev => prev.map(p => p.id === 0 ? { ...panes[1], id: 0 } : p));
      }
      setLayout('single');
      setActivePaneId(0);
    } else if (layout === 'split-down') {
      if (closingPaneId === 0 && panes[2].openTaskIds.length > 0) {
        setPanes(prev => prev.map(p => p.id === 0 ? { ...panes[2], id: 0 } : p));
      }
      setLayout('single');
      setActivePaneId(0);
    } else if (layout === 'grid-2x2') {
      // If closing one in 2x2, downgrade to split-right or split-down
      setLayout('split-right');
      setActivePaneId(0);
    }
  };

  // Determine which panes are active in current layout
  const visiblePaneIds = useMemo(() => {
    switch (layout) {
      case 'single':
        return [0];
      case 'split-right':
        return [0, 1];
      case 'split-down':
        return [0, 2];
      case 'grid-2x2':
        return [0, 1, 2, 3];
    }
  }, [layout]);

  // Overall left resize handle
  const handleResizeWidthMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizingWidthRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (ev: MouseEvent) => {
      if (!isResizingWidthRef.current) return;
      const newWidth = window.innerWidth - ev.clientX;
      const minW = 280;
      const maxW = Math.max(minW, window.innerWidth - 240);
      if (newWidth >= minW && newWidth <= maxW) {
        onWidthChange(newWidth);
      }
    };

    const handleMouseUp = () => {
      isResizingWidthRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Horizontal Splitter Resizing (between left and right panes)
  const containerRef = useRef<HTMLDivElement>(null);
  const handleSplitXMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (ev: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const relativeX = ev.clientX - rect.left;
      const ratio = Math.max(0.2, Math.min(0.8, relativeX / rect.width));
      setSplitXRatio(ratio);
    };

    const handleMouseUp = () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Vertical Splitter Resizing (between top and bottom panes)
  const handleSplitYMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (ev: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const relativeY = ev.clientY - rect.top;
      const ratio = Math.max(0.2, Math.min(0.8, relativeY / rect.height));
      setSplitYRatio(ratio);
    };

    const handleMouseUp = () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div 
      className="fixed inset-0 z-[150] w-full h-full lg:relative lg:inset-auto lg:z-20 lg:h-full lg:min-h-0 flex shrink-0 bg-white lg:border-l lg:border-slate-200/90 shadow-2xl lg:shadow-md select-text"
      style={{ width: `${width}px` }}
    >
      {/* Left resize handle for the entire Task Detail area (Desktop only) */}
      <div 
        onMouseDown={handleResizeWidthMouseDown}
        className="hidden lg:block absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-indigo-500/50 active:bg-indigo-600 transition-colors z-40"
        title={isJa ? "ドラッグして詳細エリアの幅を調整" : "Drag to resize detail pane"}
      />

      {/* Main Container */}
      <div 
        ref={containerRef}
        className="flex-1 h-full min-h-0 flex flex-col overflow-hidden bg-slate-100/60 p-1 relative"
      >
        {/* Top Global Bar: Layout Switcher + Close Full Area */}
        <div className="flex items-center justify-between px-2 py-1 bg-white border border-slate-200 rounded-md mb-1 shrink-0 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-600 flex items-center gap-1 text-[11px]">
              <FileText size={13} className="text-indigo-600" />
              {isJa ? 'タスク詳細' : 'Task Details'}
            </span>

            {/* Layout Quick Selector */}
            <div className="flex items-center bg-slate-100 rounded p-0.5 ml-2 gap-0.5">
              <button
                type="button"
                onClick={handleSingleLayout}
                className={cn(
                  "p-1 rounded transition-colors",
                  layout === 'single' ? "bg-white text-indigo-600 shadow-2xs font-bold" : "text-slate-500 hover:text-slate-800"
                )}
                title={isJa ? '単一ペイン' : 'Single Pane'}
              >
                <div className="w-3.5 h-3.5 border border-current rounded-xs" />
              </button>
              <button
                type="button"
                onClick={() => handleSplitRight()}
                className={cn(
                  "p-1 rounded transition-colors",
                  layout === 'split-right' ? "bg-white text-indigo-600 shadow-2xs font-bold" : "text-slate-500 hover:text-slate-800"
                )}
                title={isJa ? '左右分割 (2列)' : 'Split Right'}
              >
                <Columns size={14} />
              </button>
              <button
                type="button"
                onClick={() => handleSplitDown()}
                className={cn(
                  "p-1 rounded transition-colors",
                  layout === 'split-down' ? "bg-white text-indigo-600 shadow-2xs font-bold" : "text-slate-500 hover:text-slate-800"
                )}
                title={isJa ? '上下分割 (2行)' : 'Split Down'}
              >
                <Rows size={14} />
              </button>
              <button
                type="button"
                onClick={handleGrid2X2}
                className={cn(
                  "p-1 rounded transition-colors",
                  layout === 'grid-2x2' ? "bg-white text-indigo-600 shadow-2xs font-bold" : "text-slate-500 hover:text-slate-800"
                )}
                title={isJa ? '2x2 分割 (縦2 × 横2)' : 'Grid 2x2'}
              >
                <Grid2X2 size={14} />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onClose}
              className="p-1 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded transition-colors"
              title={isJa ? '詳細ペインを閉じる' : 'Close detail pane'}
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Panes Rendering based on Layout */}
        <div className="flex-1 h-full min-h-0 flex overflow-hidden relative">
          {/* 1. SINGLE PANE */}
          {layout === 'single' && (
            <SinglePane
              pane={panes[0]}
              isActivePane={true}
              tasks={tasks}
              layout={layout}
              language={language}
              deadlineThresholdDays={deadlineThresholdDays}
              onFocus={() => setActivePaneId(0)}
              onSelectTab={(id) => handleSelectTabInPane(0, id)}
              onDoubleClickTab={(id) => handleDoubleClickTabInPane(0, id)}
              onPinTab={(id) => handlePinTabInPane(0, id)}
              onCloseTab={(id) => handleCloseTabInPane(0, id)}
              onCloseAllTabs={() => handleCloseAllTabsInPane(0)}
              onSplitRight={() => handleSplitRight(0)}
              onSplitDown={() => handleSplitDown(0)}
              onMoveTabBetweenPanes={handleMoveTabBetweenPanes}
              onUpdateTask={onUpdateTask}
              onMoveTask={onMoveTask}
              onDeleteTask={onDeleteTask}
              onToggleDone={onToggleDone}
              onToggleStar={onToggleStar}
              onTogglePin={onTogglePin}
              onDuplicateTask={onDuplicateTask}
              t={t}
            />
          )}

          {/* 2. SPLIT RIGHT (Pane 0 | Pane 1) */}
          {layout === 'split-right' && (
            <div className="flex-1 h-full min-h-0 flex flex-row overflow-hidden relative">
              <div 
                style={{ width: `${splitXRatio * 100}%` }}
                className="h-full min-h-0 flex flex-col overflow-hidden"
              >
                <SinglePane
                  pane={panes[0]}
                  isActivePane={activePaneId === 0}
                  tasks={tasks}
                  layout={layout}
                  language={language}
                  deadlineThresholdDays={deadlineThresholdDays}
                  onFocus={() => setActivePaneId(0)}
                  onSelectTab={(id) => handleSelectTabInPane(0, id)}
                  onDoubleClickTab={(id) => handleDoubleClickTabInPane(0, id)}
                  onPinTab={(id) => handlePinTabInPane(0, id)}
                  onCloseTab={(id) => handleCloseTabInPane(0, id)}
                  onCloseAllTabs={() => handleCloseAllTabsInPane(0)}
                  onSplitRight={() => handleSplitRight(0)}
                  onSplitDown={() => handleSplitDown(0)}
                  onClosePane={() => handleClosePane(0)}
                  onMoveTabToPane={(id, tgt) => handleMoveTabToPane(0, id, tgt)}
                  onMoveTabBetweenPanes={handleMoveTabBetweenPanes}
                  availablePaneIds={[1]}
                  onUpdateTask={onUpdateTask}
                  onMoveTask={onMoveTask}
                  onDeleteTask={onDeleteTask}
                  onToggleDone={onToggleDone}
                  onToggleStar={onToggleStar}
                  onTogglePin={onTogglePin}
                  onDuplicateTask={onDuplicateTask}
                  t={t}
                />
              </div>

              {/* Horizontal Resizer Bar */}
              <div
                onMouseDown={handleSplitXMouseDown}
                className="w-2.5 h-full cursor-col-resize hover:bg-indigo-400/40 active:bg-indigo-600 flex items-center justify-center group shrink-0 transition-colors z-20"
                title={isJa ? 'ドラッグして左右幅を調整' : 'Drag to resize split'}
              >
                <div className="w-0.5 h-8 bg-slate-300 group-hover:bg-indigo-500 rounded" />
              </div>

              <div 
                style={{ width: `${(1 - splitXRatio) * 100}%` }}
                className="h-full min-h-0 flex flex-col overflow-hidden"
              >
                <SinglePane
                  pane={panes[1]}
                  isActivePane={activePaneId === 1}
                  tasks={tasks}
                  layout={layout}
                  language={language}
                  deadlineThresholdDays={deadlineThresholdDays}
                  onFocus={() => setActivePaneId(1)}
                  onSelectTab={(id) => handleSelectTabInPane(1, id)}
                  onDoubleClickTab={(id) => handleDoubleClickTabInPane(1, id)}
                  onPinTab={(id) => handlePinTabInPane(1, id)}
                  onCloseTab={(id) => handleCloseTabInPane(1, id)}
                  onCloseAllTabs={() => handleCloseAllTabsInPane(1)}
                  onSplitRight={() => handleSplitRight(1)}
                  onSplitDown={() => handleSplitDown(1)}
                  onClosePane={() => handleClosePane(1)}
                  onMoveTabToPane={(id, tgt) => handleMoveTabToPane(1, id, tgt)}
                  onMoveTabBetweenPanes={handleMoveTabBetweenPanes}
                  availablePaneIds={[0]}
                  onUpdateTask={onUpdateTask}
                  onMoveTask={onMoveTask}
                  onDeleteTask={onDeleteTask}
                  onToggleDone={onToggleDone}
                  onToggleStar={onToggleStar}
                  onTogglePin={onTogglePin}
                  onDuplicateTask={onDuplicateTask}
                  t={t}
                />
              </div>
            </div>
          )}

          {/* 3. SPLIT DOWN (Pane 0 / Pane 2) */}
          {layout === 'split-down' && (
            <div className="flex-1 h-full min-h-0 flex flex-col overflow-hidden relative">
              <div 
                style={{ height: `${splitYRatio * 100}%` }}
                className="w-full min-w-0 flex flex-col overflow-hidden"
              >
                <SinglePane
                  pane={panes[0]}
                  isActivePane={activePaneId === 0}
                  tasks={tasks}
                  layout={layout}
                  language={language}
                  deadlineThresholdDays={deadlineThresholdDays}
                  onFocus={() => setActivePaneId(0)}
                  onSelectTab={(id) => handleSelectTabInPane(0, id)}
                  onDoubleClickTab={(id) => handleDoubleClickTabInPane(0, id)}
                  onPinTab={(id) => handlePinTabInPane(0, id)}
                  onCloseTab={(id) => handleCloseTabInPane(0, id)}
                  onCloseAllTabs={() => handleCloseAllTabsInPane(0)}
                  onSplitRight={() => handleSplitRight(0)}
                  onSplitDown={() => handleSplitDown(0)}
                  onClosePane={() => handleClosePane(0)}
                  onMoveTabToPane={(id, tgt) => handleMoveTabToPane(0, id, tgt)}
                  onMoveTabBetweenPanes={handleMoveTabBetweenPanes}
                  availablePaneIds={[2]}
                  onUpdateTask={onUpdateTask}
                  onMoveTask={onMoveTask}
                  onDeleteTask={onDeleteTask}
                  onToggleDone={onToggleDone}
                  onToggleStar={onToggleStar}
                  onTogglePin={onTogglePin}
                  onDuplicateTask={onDuplicateTask}
                  t={t}
                />
              </div>

              {/* Vertical Resizer Bar */}
              <div
                onMouseDown={handleSplitYMouseDown}
                className="h-2.5 w-full cursor-row-resize hover:bg-indigo-400/40 active:bg-indigo-600 flex items-center justify-center group shrink-0 transition-colors z-20"
                title={isJa ? 'ドラッグして上下高さを調整' : 'Drag to resize split'}
              >
                <div className="h-0.5 w-8 bg-slate-300 group-hover:bg-indigo-500 rounded" />
              </div>

              <div 
                style={{ height: `${(1 - splitYRatio) * 100}%` }}
                className="w-full min-w-0 flex flex-col overflow-hidden"
              >
                <SinglePane
                  pane={panes[2]}
                  isActivePane={activePaneId === 2}
                  tasks={tasks}
                  layout={layout}
                  language={language}
                  deadlineThresholdDays={deadlineThresholdDays}
                  onFocus={() => setActivePaneId(2)}
                  onSelectTab={(id) => handleSelectTabInPane(2, id)}
                  onDoubleClickTab={(id) => handleDoubleClickTabInPane(2, id)}
                  onPinTab={(id) => handlePinTabInPane(2, id)}
                  onCloseTab={(id) => handleCloseTabInPane(2, id)}
                  onCloseAllTabs={() => handleCloseAllTabsInPane(2)}
                  onSplitRight={() => handleSplitRight(2)}
                  onSplitDown={() => handleSplitDown(2)}
                  onClosePane={() => handleClosePane(2)}
                  onMoveTabToPane={(id, tgt) => handleMoveTabToPane(2, id, tgt)}
                  onMoveTabBetweenPanes={handleMoveTabBetweenPanes}
                  availablePaneIds={[0]}
                  onUpdateTask={onUpdateTask}
                  onMoveTask={onMoveTask}
                  onDeleteTask={onDeleteTask}
                  onToggleDone={onToggleDone}
                  onToggleStar={onToggleStar}
                  onTogglePin={onTogglePin}
                  onDuplicateTask={onDuplicateTask}
                  t={t}
                />
              </div>
            </div>
          )}

          {/* 4. GRID 2x2 (Top: Pane 0 | Pane 1, Bottom: Pane 2 | Pane 3) */}
          {layout === 'grid-2x2' && (
            <div className="flex-1 h-full min-h-0 flex flex-col overflow-hidden relative">
              {/* Top Row (Pane 0 | Pane 1) */}
              <div 
                style={{ height: `${splitYRatio * 100}%` }}
                className="w-full min-w-0 flex flex-row overflow-hidden"
              >
                {/* Pane 0 */}
                <div 
                  style={{ width: `${splitXRatio * 100}%` }}
                  className="h-full min-h-0 flex flex-col overflow-hidden"
                >
                  <SinglePane
                    pane={panes[0]}
                    isActivePane={activePaneId === 0}
                    tasks={tasks}
                    layout={layout}
                    language={language}
                    deadlineThresholdDays={deadlineThresholdDays}
                    onFocus={() => setActivePaneId(0)}
                    onSelectTab={(id) => handleSelectTabInPane(0, id)}
                    onDoubleClickTab={(id) => handleDoubleClickTabInPane(0, id)}
                    onPinTab={(id) => handlePinTabInPane(0, id)}
                    onCloseTab={(id) => handleCloseTabInPane(0, id)}
                    onCloseAllTabs={() => handleCloseAllTabsInPane(0)}
                    onSplitRight={() => handleSplitRight(0)}
                    onSplitDown={() => handleSplitDown(0)}
                    onClosePane={() => handleClosePane(0)}
                    onMoveTabToPane={(id, tgt) => handleMoveTabToPane(0, id, tgt)}
                    onMoveTabBetweenPanes={handleMoveTabBetweenPanes}
                    availablePaneIds={[1, 2, 3]}
                    onUpdateTask={onUpdateTask}
                    onMoveTask={onMoveTask}
                    onDeleteTask={onDeleteTask}
                    onToggleDone={onToggleDone}
                    onToggleStar={onToggleStar}
                    onTogglePin={onTogglePin}
                    onDuplicateTask={onDuplicateTask}
                    t={t}
                  />
                </div>

                {/* Top Col Resizer */}
                <div
                  onMouseDown={handleSplitXMouseDown}
                  className="w-2.5 h-full cursor-col-resize hover:bg-indigo-400/40 active:bg-indigo-600 flex items-center justify-center group shrink-0 transition-colors z-20"
                  title={isJa ? '左右幅を調整' : 'Resize width'}
                >
                  <div className="w-0.5 h-8 bg-slate-300 group-hover:bg-indigo-500 rounded" />
                </div>

                {/* Pane 1 */}
                <div 
                  style={{ width: `${(1 - splitXRatio) * 100}%` }}
                  className="h-full min-h-0 flex flex-col overflow-hidden"
                >
                  <SinglePane
                    pane={panes[1]}
                    isActivePane={activePaneId === 1}
                    tasks={tasks}
                    layout={layout}
                    language={language}
                    deadlineThresholdDays={deadlineThresholdDays}
                    onFocus={() => setActivePaneId(1)}
                    onSelectTab={(id) => handleSelectTabInPane(1, id)}
                    onDoubleClickTab={(id) => handleDoubleClickTabInPane(1, id)}
                    onPinTab={(id) => handlePinTabInPane(1, id)}
                    onCloseTab={(id) => handleCloseTabInPane(1, id)}
                    onCloseAllTabs={() => handleCloseAllTabsInPane(1)}
                    onSplitRight={() => handleSplitRight(1)}
                    onSplitDown={() => handleSplitDown(1)}
                    onClosePane={() => handleClosePane(1)}
                    onMoveTabToPane={(id, tgt) => handleMoveTabToPane(1, id, tgt)}
                    onMoveTabBetweenPanes={handleMoveTabBetweenPanes}
                    availablePaneIds={[0, 2, 3]}
                    onUpdateTask={onUpdateTask}
                    onMoveTask={onMoveTask}
                    onDeleteTask={onDeleteTask}
                    onToggleDone={onToggleDone}
                    onToggleStar={onToggleStar}
                    onTogglePin={onTogglePin}
                    onDuplicateTask={onDuplicateTask}
                    t={t}
                  />
                </div>
              </div>

              {/* Middle Row Resizer */}
              <div
                onMouseDown={handleSplitYMouseDown}
                className="h-2.5 w-full cursor-row-resize hover:bg-indigo-400/40 active:bg-indigo-600 flex items-center justify-center group shrink-0 transition-colors z-20"
                title={isJa ? '上下高さを調整' : 'Resize height'}
              >
                <div className="h-0.5 w-12 bg-slate-300 group-hover:bg-indigo-500 rounded" />
              </div>

              {/* Bottom Row (Pane 2 | Pane 3) */}
              <div 
                style={{ height: `${(1 - splitYRatio) * 100}%` }}
                className="w-full min-w-0 flex flex-row overflow-hidden"
              >
                {/* Pane 2 */}
                <div 
                  style={{ width: `${splitXRatio * 100}%` }}
                  className="h-full min-h-0 flex flex-col overflow-hidden"
                >
                  <SinglePane
                    pane={panes[2]}
                    isActivePane={activePaneId === 2}
                    tasks={tasks}
                    layout={layout}
                    language={language}
                    deadlineThresholdDays={deadlineThresholdDays}
                    onFocus={() => setActivePaneId(2)}
                    onSelectTab={(id) => handleSelectTabInPane(2, id)}
                    onDoubleClickTab={(id) => handleDoubleClickTabInPane(2, id)}
                    onPinTab={(id) => handlePinTabInPane(2, id)}
                    onCloseTab={(id) => handleCloseTabInPane(2, id)}
                    onCloseAllTabs={() => handleCloseAllTabsInPane(2)}
                    onSplitRight={() => handleSplitRight(2)}
                    onSplitDown={() => handleSplitDown(2)}
                    onClosePane={() => handleClosePane(2)}
                    onMoveTabToPane={(id, tgt) => handleMoveTabToPane(2, id, tgt)}
                    onMoveTabBetweenPanes={handleMoveTabBetweenPanes}
                    availablePaneIds={[0, 1, 3]}
                    onUpdateTask={onUpdateTask}
                    onMoveTask={onMoveTask}
                    onDeleteTask={onDeleteTask}
                    onToggleDone={onToggleDone}
                    onToggleStar={onToggleStar}
                    onTogglePin={onTogglePin}
                    onDuplicateTask={onDuplicateTask}
                    t={t}
                  />
                </div>

                {/* Bottom Col Resizer */}
                <div
                  onMouseDown={handleSplitXMouseDown}
                  className="w-2.5 h-full cursor-col-resize hover:bg-indigo-400/40 active:bg-indigo-600 flex items-center justify-center group shrink-0 transition-colors z-20"
                  title={isJa ? '左右幅を調整' : 'Resize width'}
                >
                  <div className="w-0.5 h-8 bg-slate-300 group-hover:bg-indigo-500 rounded" />
                </div>

                {/* Pane 3 */}
                <div 
                  style={{ width: `${(1 - splitXRatio) * 100}%` }}
                  className="h-full min-h-0 flex flex-col overflow-hidden"
                >
                  <SinglePane
                    pane={panes[3]}
                    isActivePane={activePaneId === 3}
                    tasks={tasks}
                    layout={layout}
                    language={language}
                    deadlineThresholdDays={deadlineThresholdDays}
                    onFocus={() => setActivePaneId(3)}
                    onSelectTab={(id) => handleSelectTabInPane(3, id)}
                    onDoubleClickTab={(id) => handleDoubleClickTabInPane(3, id)}
                    onPinTab={(id) => handlePinTabInPane(3, id)}
                    onCloseTab={(id) => handleCloseTabInPane(3, id)}
                    onCloseAllTabs={() => handleCloseAllTabsInPane(3)}
                    onSplitRight={() => handleSplitRight(3)}
                    onSplitDown={() => handleSplitDown(3)}
                    onClosePane={() => handleClosePane(3)}
                    onMoveTabToPane={(id, tgt) => handleMoveTabToPane(3, id, tgt)}
                    onMoveTabBetweenPanes={handleMoveTabBetweenPanes}
                    availablePaneIds={[0, 1, 2]}
                    onUpdateTask={onUpdateTask}
                    onMoveTask={onMoveTask}
                    onDeleteTask={onDeleteTask}
                    onToggleDone={onToggleDone}
                    onToggleStar={onToggleStar}
                    onTogglePin={onTogglePin}
                    onDuplicateTask={onDuplicateTask}
                    t={t}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
