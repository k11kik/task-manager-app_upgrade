import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  CheckCircle2, 
  Circle, 
  Star, 
  Pin, 
  Calendar as CalendarIcon, 
  Clock, 
  Copy, 
  Archive, 
  Trash2, 
  ExternalLink, 
  Plus, 
  Save, 
  Sparkles,
  Layers,
  Folder,
  Zap,
  Maximize2,
  FileText,
  Repeat
} from 'lucide-react';
import { Task, Category, RecurrenceType, TaskRecurrence } from '../types';
import { cn, tr } from '../lib/utils';
import { format } from 'date-fns';

interface TaskDetailPaneProps {
  task: Task | null;
  onClose: () => void;
  onUpdateTask: (taskId: string, updates: Partial<Task>) => void;
  onMoveTask: (taskId: string, category: Category) => void;
  onDeleteTask: (taskId: string) => void;
  onToggleDone: (taskId: string) => void;
  onToggleStar: (taskId: string) => void;
  onTogglePin: (taskId: string) => void;
  onDuplicateTask: (task: Task) => void;
  deadlineThresholdDays?: number;
  language?: string;
  width: number;
  onWidthChange: (newWidth: number) => void;
  t: (key: string) => string;
}

export const TaskDetailPane: React.FC<TaskDetailPaneProps> = ({
  task,
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
  const L = (ja: string, en: string, fr: string) => tr(language, ja, en, fr);

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

  // Close expanded notes modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isExpandedNotesOpen) {
        saveNotes(notes);
        setIsExpandedNotesOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isExpandedNotesOpen, notes]);

  // Resize handler for right panel
  const isResizingRef = useRef(false);

  useEffect(() => {
    if (task) {
      setTitle(task.title || '');
      setNotes(task.notes || '');
      setUrls(task.urls || []);
      setIsAllDay(task.isAllDay || false);
      if (task.startDate) {
        const sd = new Date(task.startDate);
        setStartDateVal(format(sd, 'yyyy-MM-dd'));
        setStartTimeVal(format(sd, 'HH:mm'));
      } else {
        setStartDateVal('');
        setStartTimeVal('09:00');
      }
      if (task.deadline) {
        const d = new Date(task.deadline);
        setDeadlineDate(format(d, 'yyyy-MM-dd'));
        setDeadlineTime(format(d, 'HH:mm'));
      } else {
        setDeadlineDate('');
        setDeadlineTime('18:00');
      }
      if (task.recurrence && task.recurrence.type !== 'none') {
        setRecurrenceType(task.recurrence.type);
        setRecurrenceInterval(task.recurrence.interval ?? 1);
        if (task.recurrence.endDate) {
          setRecurrenceEndDate(format(new Date(task.recurrence.endDate), 'yyyy-MM-dd'));
        } else {
          setRecurrenceEndDate('');
        }
      } else {
        setRecurrenceType('none');
        setRecurrenceInterval(1);
        setRecurrenceEndDate('');
      }
    }
  }, [task?.id, task?.updatedAt]);

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (ev: MouseEvent) => {
      if (!isResizingRef.current) return;
      // Right-side pane: width grows as mouse moves to the left
      const newWidth = window.innerWidth - ev.clientX;
      if (newWidth >= 280 && newWidth <= 680) {
        onWidthChange(newWidth);
      }
    };

    const handleMouseUp = () => {
      isResizingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  if (!task) return null;

  const triggerSaveNotice = () => {
    setIsSavedNotice(true);
    setTimeout(() => setIsSavedNotice(false), 1500);
  };

  const saveTitle = (newTitle: string) => {
    if (!newTitle.trim() || newTitle === task.title) return;
    onUpdateTask(task.id, { title: newTitle.trim() });
    triggerSaveNotice();
  };

  const saveNotes = (newNotes: string) => {
    if (newNotes === (task.notes || '')) return;
    onUpdateTask(task.id, { notes: newNotes });
    triggerSaveNotice();
  };

  const handleStartDateCommit = (dateStr: string, timeStr: string, allDay: boolean) => {
    if (!dateStr) {
      onUpdateTask(task.id, { startDate: undefined });
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
    onUpdateTask(task.id, { startDate: d.getTime() });
    triggerSaveNotice();
  };

  const handleDeadlineCommit = (dateStr: string, timeStr: string, allDay: boolean) => {
    if (!dateStr) {
      onUpdateTask(task.id, { deadline: undefined, isAllDay: allDay });
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
    onUpdateTask(task.id, { deadline: d.getTime(), isAllDay: allDay });
    triggerSaveNotice();
  };

  const handleRecurrenceCommit = (type: RecurrenceType, intervalVal: number, endDateStr: string) => {
    if (type === 'none') {
      onUpdateTask(task.id, { recurrence: undefined });
      triggerSaveNotice();
      return;
    }
    let endTimestamp: number | undefined = undefined;
    if (endDateStr) {
      const [y, m, d] = endDateStr.split('-').map(Number);
      const ed = new Date(y, m - 1, d, 23, 59, 59, 999);
      endTimestamp = ed.getTime();
    }
    const recurrenceRule: TaskRecurrence = {
      type,
      interval: Math.max(1, intervalVal),
      ...(endTimestamp !== undefined ? { endDate: endTimestamp } : {})
    };
    onUpdateTask(task.id, {
      recurrence: recurrenceRule
    });
    triggerSaveNotice();
  };

  const addUrl = () => {
    if (!newUrlInput.trim()) return;
    let url = newUrlInput.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    const updated = [...urls, url];
    setUrls(updated);
    setNewUrlInput('');
    onUpdateTask(task.id, { urls: updated });
    triggerSaveNotice();
  };

  const removeUrl = (index: number) => {
    const updated = urls.filter((_, i) => i !== index);
    setUrls(updated);
    onUpdateTask(task.id, { urls: updated });
    triggerSaveNotice();
  };

  const isUrgent = task.category === 'Urgent';

  return (
    <div 
      className="fixed inset-0 z-[150] w-full h-full lg:relative lg:inset-auto lg:z-20 lg:h-full lg:min-h-0 flex shrink-0 bg-white lg:border-l lg:border-slate-200/90 shadow-2xl lg:shadow-lg select-text lg:w-[var(--detail-pane-width)]"
      style={{ '--detail-pane-width': `${width}px` } as React.CSSProperties}
    >
      {/* Left resize handle (Desktop only) */}
      <div 
        onMouseDown={handleResizeMouseDown}
        className="hidden lg:block absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-indigo-500/40 active:bg-indigo-600 transition-colors z-30"
        title={L("ドラッグして幅を調整", "Drag to resize detail pane", "Glisser pour redimensionner")}
      />

      {/* Pane Content Container */}
      <div className="flex-1 h-full min-h-0 flex flex-col overflow-hidden bg-white">
        {/* Header toolbar */}
        <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 border-b border-slate-200 bg-slate-50/90 shrink-0 sticky top-0 z-30">
          {/* Breadcrumb project path */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500 min-w-0 font-mono">
            <Folder size={14} className="text-indigo-600 shrink-0" />
            <span className="truncate font-semibold text-slate-700">{task.project || 'General'}</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isSavedNotice && (
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 animate-fade-in">
                {L('保存済', 'Saved', 'Enregistré')}
              </span>
            )}
            
            {/* Close button with high visibility on mobile */}
            <button
              onClick={onClose}
              className="px-2.5 py-1 sm:p-1.5 text-slate-600 hover:text-slate-900 bg-slate-200/80 hover:bg-slate-300 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold shadow-2xs"
              title={L('閉じる', 'Close detail pane', 'Fermer le panneau')}
            >
              <X size={16} className="text-slate-700 shrink-0" />
              <span className="sm:hidden">{L('閉じる', 'Close', 'Fermer')}</span>
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
          {/* Title and Done checkbox */}
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => onToggleDone(task.id)}
              className="mt-1 text-slate-400 hover:text-indigo-600 transition-colors shrink-0"
              title={task.isDone ? L('未完了に戻す', 'Mark undone', 'Remettre en attente') : L('完了にする', 'Mark done', 'Marquer comme terminé')}
            >
              {task.isDone ? (
                <CheckCircle2 size={20} className="text-emerald-500" />
              ) : (
                <Circle size={20} className={isUrgent ? "text-red-500" : "text-slate-300"} />
              )}
            </button>

            <div className="grid flex-1 min-w-0">
              <div
                aria-hidden="true"
                className={cn(
                  "invisible col-start-1 row-start-1 w-full text-base font-bold leading-snug whitespace-pre-wrap break-all [overflow-wrap:anywhere] p-0 pb-0.5 border-0 border-b border-transparent pointer-events-none select-none",
                  task.isDone && "line-through"
                )}
              >
                {(title || L("タスクのタイトル...", "Task title...", "Titre de la tâche...")) + '\u200b'}
              </div>
              <textarea
                rows={1}
                value={title}
                onChange={(e) => setTitle(e.target.value.replace(/\r?\n/g, ' '))}
                onBlur={() => saveTitle(title)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    saveTitle(title);
                    (e.target as HTMLTextAreaElement).blur();
                  }
                }}
                placeholder={L("タスクのタイトル...", "Task title...", "Titre de la tâche...")}
                className={cn(
                  "col-start-1 row-start-1 w-full h-full resize-none overflow-hidden text-base font-bold leading-snug whitespace-pre-wrap break-all [overflow-wrap:anywhere] text-slate-900 bg-transparent border-0 border-b border-transparent hover:border-slate-200 focus:border-indigo-500 focus:ring-0 outline-none p-0 pb-0.5 transition-colors",
                  task.isDone && "line-through text-slate-400"
                )}
              />
            </div>
          </div>

          {/* Quick Action Badges (Category / Star / Pin) */}
          <div className="flex flex-wrap items-center gap-2 pt-1 border-b border-slate-100 pb-3">
            {/* Status switcher: 'Focus' and 'ToDo' */}
            <div className="flex items-center bg-slate-100 rounded-lg p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => onMoveTask(task.id, 'Focus')}
                className={cn(
                  "px-3 py-1 rounded-md transition-all",
                  task.category === 'Focus' ? "bg-white text-slate-800 shadow-2xs font-bold" : "text-slate-500 hover:text-slate-800"
                )}
              >
                ToDo
              </button>
              <button
                type="button"
                onClick={() => onMoveTask(task.id, 'Urgent')}
                className={cn(
                  "px-3 py-1 rounded-md transition-all flex items-center gap-1",
                  task.category === 'Urgent' ? "bg-red-500 text-white shadow-2xs font-bold" : "text-slate-500 hover:text-red-600"
                )}
              >
                <Zap size={12} className={task.category === 'Urgent' ? "text-white" : "text-red-500"} />
                Focus
              </button>
            </div>

            {/* Star toggle */}
            <button
              type="button"
              onClick={() => onToggleStar(task.id)}
              className={cn(
                "p-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition-colors",
                task.isStarred 
                  ? "bg-amber-50 text-amber-700 border-amber-200" 
                  : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
              )}
              title={L('重要フラグ', 'Star', 'Favori')}
            >
              <Star size={13} fill={task.isStarred ? 'currentColor' : 'none'} className={task.isStarred ? "text-amber-500" : "text-slate-400"} />
              <span className="hidden sm:inline">{L('重要', 'Star', 'Favori')}</span>
            </button>

            {/* Pin toggle */}
            <button
              type="button"
              onClick={() => onTogglePin(task.id)}
              className={cn(
                "p-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition-colors",
                task.isPinned 
                  ? "bg-indigo-50 text-indigo-700 border-indigo-200" 
                  : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
              )}
              title={L('ピン留め', 'Pin', 'Épingler')}
            >
              <Pin size={13} fill={task.isPinned ? 'currentColor' : 'none'} className={task.isPinned ? "text-indigo-600" : "text-slate-400"} />
              <span className="hidden sm:inline">{L('ピン留め', 'Pin', 'Épingler')}</span>
            </button>
          </div>

          {/* When (Start Date), Deadline & Recurrence */}
          <div className="space-y-2.5 p-3 bg-slate-50/70 border border-slate-200/80 rounded-xl">
            {/* Start Date: いつ */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock size={13} className="text-indigo-500" />
                  <span>{L('いつ (開始日)', 'When (Start Date)', 'Quand (Date de début)')}</span>
                </label>
                {startDateVal && (
                  <button
                    type="button"
                    onClick={() => {
                      setStartDateVal('');
                      handleStartDateCommit('', startTimeVal, isAllDay);
                    }}
                    className="text-xs text-slate-400 hover:text-red-500 px-1 py-0.5 hover:bg-slate-100 rounded transition-colors"
                    title={L('開始日をクリア', 'Clear start date', 'Effacer la date de début')}
                  >
                    {L('クリア', 'Clear', 'Effacer')}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={startDateVal}
                  onChange={(e) => {
                    setStartDateVal(e.target.value);
                    handleStartDateCommit(e.target.value, startTimeVal, isAllDay);
                  }}
                  className="flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
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
                    className="w-24 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500 transition-colors disabled:opacity-40"
                  />
                )}
              </div>
            </div>

            {/* Deadline: 締切 */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                  <CalendarIcon size={13} className="text-amber-500" />
                  <span>{L('締切 / 期日', 'Deadline', 'Date limite')}</span>
                </label>
                {deadlineDate && (
                  <button
                    type="button"
                    onClick={() => {
                      setDeadlineDate('');
                      handleDeadlineCommit('', deadlineTime, isAllDay);
                    }}
                    className="text-xs text-slate-400 hover:text-red-500 px-1 py-0.5 hover:bg-slate-100 rounded transition-colors"
                    title={L('締切をクリア', 'Clear deadline', 'Effacer la date limite')}
                  >
                    {L('クリア', 'Clear', 'Effacer')}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={deadlineDate}
                  onChange={(e) => {
                    setDeadlineDate(e.target.value);
                    handleDeadlineCommit(e.target.value, deadlineTime, isAllDay);
                  }}
                  className="flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
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
                    className="w-24 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500 transition-colors disabled:opacity-40"
                  />
                )}
              </div>
            </div>

            {/* All-day Checkbox */}
            <div className="flex items-center gap-2 pt-0.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 cursor-pointer select-none">
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
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span>{L('終日設定', 'All day', 'Toute la journée')}</span>
              </label>
            </div>

            {/* Recurrence: 繰り返し */}
            <div className="pt-2 border-t border-slate-200/80 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                  <Repeat size={13} className="text-indigo-600" />
                  <span>{L('繰り返し', 'Repeat', 'Répéter')}</span>
                </label>
                {recurrenceType !== 'none' && (
                  <span className="text-[10px] text-indigo-600 font-semibold bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-100">
                    {L('繰り返し有効', 'Active', 'Actif')}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={recurrenceType}
                  onChange={(e) => {
                    const newType = e.target.value as RecurrenceType;
                    setRecurrenceType(newType);
                    handleRecurrenceCommit(newType, recurrenceInterval, recurrenceEndDate);
                  }}
                  className="flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                >
                  <option value="none">{L('なし', 'None', 'Aucune')}</option>
                  <option value="daily">{L('毎日', 'Every day', 'Tous les jours')}</option>
                  <option value="every_x_days">{L('X日ごと', 'Every X days', 'Tous les X jours')}</option>
                  <option value="weekly">{L('毎週', 'Every week', 'Toutes les semaines')}</option>
                  <option value="every_x_weeks">{L('X週ごと', 'Every X weeks', 'Toutes les X semaines')}</option>
                </select>

                {(recurrenceType === 'every_x_days' || recurrenceType === 'every_x_weeks') && (
                  <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-1">
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
                    <span className="text-xs text-slate-500 font-medium">
                      {recurrenceType === 'every_x_days' 
                        ? L('日ごと', 'days', 'jours') 
                        : L('週ごと', 'weeks', 'semaines')}
                    </span>
                  </div>
                )}
              </div>

              {recurrenceType !== 'none' && (
                <div className="flex items-center justify-between gap-2 pt-1 text-xs text-slate-500">
                  <span className="text-xs shrink-0 font-medium">{L('終了日 (任意):', 'End date:', 'Date de fin :')}</span>
                  <div className="flex items-center gap-1 flex-1 max-w-[180px]">
                    <input
                      type="date"
                      value={recurrenceEndDate}
                      onChange={(e) => {
                        setRecurrenceEndDate(e.target.value);
                        handleRecurrenceCommit(recurrenceType, recurrenceInterval, e.target.value);
                      }}
                      className="flex-1 bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                    />
                    {recurrenceEndDate && (
                      <button
                        type="button"
                        onClick={() => {
                          setRecurrenceEndDate('');
                          handleRecurrenceCommit(recurrenceType, recurrenceInterval, '');
                        }}
                        className="text-xs text-slate-400 hover:text-red-500 px-1 py-0.5"
                        title={L('終了日をクリア', 'Clear', 'Effacer')}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Notes (Resizable vertically + expandable to full window modal) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                {L('ノート', 'NOTES', 'NOTES')}
              </label>
              <button
                type="button"
                onClick={() => setIsExpandedNotesOpen(true)}
                className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2 py-0.5 rounded transition-colors"
                title={L("大画面ウィンドウで開いて編集", "Open in large window", "Ouvrir en grand écran")}
              >
                <Maximize2 size={12} />
                <span>{L("拡大表示", "Expand", "Agrandir")}</span>
              </button>
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => saveNotes(notes)}
              placeholder={L("ノート、メモ、コンテキストを記入...", "Notes, context, thoughts...", "Notes, contexte, idées...")}
              className="w-full min-h-[160px] resize-y bg-slate-50/70 border border-slate-200 rounded-lg p-3 text-xs text-slate-800 leading-relaxed outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans"
              style={{ resize: 'vertical' }}
            />
          </div>

          {/* Reference URLs */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
              <ExternalLink size={13} className="text-slate-400" />
              <span>{L('参考URL / ドキュメント', 'Reference URLs', 'URLs de référence')}</span>
            </label>
            <div className="flex items-center gap-2">
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
                className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:bg-white focus:ring-1 focus:ring-indigo-500 transition-colors"
              />
              <button
                type="button"
                onClick={addUrl}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
              >
                {L('追加', 'Add', 'Ajouter')}
              </button>
            </div>

            {urls.length > 0 && (
              <div className="space-y-1 pt-1">
                {urls.map((url, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-2 p-1.5 bg-slate-50 rounded-md border border-slate-100 text-xs">
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:underline truncate flex-1 font-mono text-[11px]"
                    >
                      {url}
                    </a>
                    <button
                      type="button"
                      onClick={() => removeUrl(idx)}
                      className="text-slate-400 hover:text-red-500 p-0.5 rounded transition-colors shrink-0"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Metadata & Actions */}
          <div className="pt-4 border-t border-slate-100 space-y-3">
            <div className="text-[10px] text-slate-400 flex flex-col gap-0.5 font-mono">
              <div>{L('作成:', 'Created:', 'Créé :')} {format(new Date(task.createdAt), 'yyyy/MM/dd HH:mm')}</div>
              <div>{L('更新:', 'Updated:', 'Mis à jour :')} {format(new Date(task.updatedAt), 'yyyy/MM/dd HH:mm')}</div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={() => onDuplicateTask(task)}
                className="px-2.5 py-1.5 text-xs text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1"
              >
                <Copy size={12} />
                <span>{L('複製', 'Duplicate', 'Dupliquer')}</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onMoveTask(task.id, 'Archive')}
                  className="px-2.5 py-1.5 text-xs text-slate-600 hover:text-indigo-600 bg-slate-100 hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-1"
                >
                  <Archive size={12} />
                  <span>{L('アーカイブ', 'Archive', 'Archiver')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteTask(task.id)}
                  className="px-2.5 py-1.5 text-xs text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors flex items-center gap-1"
                >
                  <Trash2 size={12} />
                  <span>{L('ゴミ箱', 'Trash', 'Corbeille')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Expanded Notes Window Modal (Closes on click outside or Escape) */}
      {isExpandedNotesOpen && createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center py-16 sm:py-20 px-4 sm:px-8 animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-labelledby="notes-modal-title"
        >
          {/* Backdrop overlay (click outside to save & close) */}
          <div 
            onClick={() => {
              saveNotes(notes);
              setIsExpandedNotesOpen(false);
            }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
            title={L("クリックして閉じる", "Click outside to close", "Cliquer à l'extérieur pour fermer")}
          />

          {/* Window Container - Floating with ample margin from top bar */}
          <div 
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-3xl h-full max-h-[640px] bg-white rounded-2xl shadow-2xl flex flex-col z-10 border border-slate-200 overflow-hidden my-auto"
          >
            {/* Window Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50/80 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg shrink-0">
                  <FileText size={16} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span id="notes-modal-title" className="text-xs font-black uppercase tracking-wider text-indigo-600">
                      {L('ノート編集', 'Notes', 'Notes')}
                    </span>
                    <span className="text-slate-300 text-xs">•</span>
                    <span className="text-xs font-semibold text-slate-500 truncate max-w-sm">
                      {task.title}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
                  {notes.length} {L('文字', 'chars', 'car.')}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    saveNotes(notes);
                    setIsExpandedNotesOpen(false);
                  }}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/80 rounded-lg transition-colors"
                  title={L("閉じる (Esc)", "Close (Esc)", "Fermer (Échap)")}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Large Text Area */}
            <div className="flex-1 p-5 bg-white flex flex-col min-h-0">
              <textarea
                autoFocus
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={L("詳細なノート、手順、議事録、コンテキストを広々と記入...", "Write detailed notes, documentation, context, subtasks...", "Rédigez des notes détaillées, le contexte, des sous-tâches...")}
                className="w-full flex-1 p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm sm:text-base text-slate-800 leading-relaxed outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all font-sans resize-none overflow-y-auto custom-scrollbar"
              />
            </div>

            {/* Window Footer */}
            <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-t border-slate-200 text-xs shrink-0">
              <span className="text-slate-400 text-[11px]">
                {L("外側をクリックするかEscキーを押すと自動保存して閉じます", "Click outside or press Esc to auto-save and close", "Cliquez à l'extérieur ou appuyez sur Échap pour enregistrer et fermer")}
              </span>
              <button
                type="button"
                onClick={() => {
                  saveNotes(notes);
                  setIsExpandedNotesOpen(false);
                }}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs shadow-sm transition-all flex items-center gap-1.5"
              >
                <X size={13} />
                <span>{L("閉じる", "Close", "Fermer")}</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
