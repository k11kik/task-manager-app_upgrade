import React, { useState, useEffect, useRef } from 'react';
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
  Zap
} from 'lucide-react';
import { Task, Category } from '../types';
import { cn } from '../lib/utils';
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

  // Form local editing states
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [deadlineDate, setDeadlineDate] = useState('');
  const [deadlineTime, setDeadlineTime] = useState('18:00');
  const [isAllDay, setIsAllDay] = useState(false);
  const [urls, setUrls] = useState<string[]>([]);
  const [newUrlInput, setNewUrlInput] = useState('');
  const [isSavedNotice, setIsSavedNotice] = useState(false);

  // Resize handler for right panel
  const isResizingRef = useRef(false);

  useEffect(() => {
    if (task) {
      setTitle(task.title || '');
      setNotes(task.notes || '');
      setUrls(task.urls || []);
      setIsAllDay(task.isAllDay || false);
      if (task.deadline) {
        const d = new Date(task.deadline);
        setDeadlineDate(format(d, 'yyyy-MM-dd'));
        setDeadlineTime(format(d, 'HH:mm'));
      } else {
        setDeadlineDate('');
        setDeadlineTime('18:00');
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
      className="h-full min-h-0 flex shrink-0 relative bg-white border-l border-slate-200/90 z-20 shadow-lg select-text"
      style={{ width: `${width}px` }}
    >
      {/* Left resize handle */}
      <div 
        onMouseDown={handleResizeMouseDown}
        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-indigo-500/40 active:bg-indigo-600 transition-colors z-30"
        title={isJa ? "ドラッグして幅を調整" : "Drag to resize detail pane"}
      />

      {/* Pane Content Container */}
      <div className="flex-1 h-full min-h-0 flex flex-col overflow-hidden bg-white">
        {/* Header toolbar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50/80 shrink-0">
          {/* Breadcrumb project path */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500 min-w-0 font-mono">
            <Folder size={13} className="text-indigo-600 shrink-0" />
            <span className="truncate font-semibold text-slate-700">{task.project || 'General'}</span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isSavedNotice && (
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 animate-fade-in">
                {isJa ? '保存済' : 'Saved'}
              </span>
            )}
            
            {/* Close button */}
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-md transition-colors"
              title={isJa ? '閉じる' : 'Close detail pane'}
            >
              <X size={16} />
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
              title={task.isDone ? (isJa ? '未完了に戻す' : 'Mark undone') : (isJa ? '完了にする' : 'Mark done')}
            >
              {task.isDone ? (
                <CheckCircle2 size={20} className="text-emerald-500" />
              ) : (
                <Circle size={20} className={isUrgent ? "text-red-500" : "text-slate-300"} />
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
                  "w-full text-base font-bold text-slate-900 bg-transparent border-0 border-b border-transparent hover:border-slate-200 focus:border-indigo-500 focus:ring-0 outline-none pb-0.5 transition-colors",
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
              title={isJa ? '重要フラグ' : 'Star'}
            >
              <Star size={13} fill={task.isStarred ? 'currentColor' : 'none'} className={task.isStarred ? "text-amber-500" : "text-slate-400"} />
              <span className="hidden sm:inline">{isJa ? '重要' : 'Star'}</span>
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
              title={isJa ? 'ピン留め' : 'Pin'}
            >
              <Pin size={13} fill={task.isPinned ? 'currentColor' : 'none'} className={task.isPinned ? "text-indigo-600" : "text-slate-400"} />
              <span className="hidden sm:inline">{isJa ? 'ピン留め' : 'Pin'}</span>
            </button>
          </div>

          {/* Deadline Setting */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
              <CalendarIcon size={13} className="text-slate-400" />
              <span>{isJa ? '締切 / 期日' : 'Deadline'}</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={deadlineDate}
                onChange={(e) => {
                  setDeadlineDate(e.target.value);
                  handleDeadlineCommit(e.target.value, deadlineTime, isAllDay);
                }}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:bg-white focus:ring-1 focus:ring-indigo-500 transition-colors"
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
                  className="w-24 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800 outline-none focus:bg-white focus:ring-1 focus:ring-indigo-500 transition-colors disabled:opacity-40"
                />
              )}
              {deadlineDate && (
                <button
                  type="button"
                  onClick={() => {
                    setDeadlineDate('');
                    handleDeadlineCommit('', deadlineTime, isAllDay);
                  }}
                  className="text-xs text-slate-400 hover:text-red-500 px-1.5 py-1 hover:bg-slate-100 rounded transition-colors"
                  title={isJa ? '締切をクリア' : 'Clear deadline'}
                >
                  {isJa ? 'クリア' : 'Clear'}
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 pt-0.5">
              <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isAllDay}
                  onChange={(e) => {
                    setIsAllDay(e.target.checked);
                    handleDeadlineCommit(deadlineDate, deadlineTime, e.target.checked);
                  }}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span>{isJa ? '終日タスク' : 'All day'}</span>
              </label>
            </div>
          </div>

          {/* Memo / Context / Subtasks (Resizable vertically!) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                {isJa ? 'メモ・コンテキスト・サブタスク' : 'Notes & Subtasks'}
              </label>
              <span className="text-[10px] text-slate-400">
                {isJa ? 'フォーカスを外すと自動保存' : 'Auto-saves on blur'}
              </span>
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => saveNotes(notes)}
              placeholder={isJa ? "詳細なメモ、コンテキスト、サブタスクを箇条書きで記入..." : "Context, subtasks, notes..."}
              className="w-full min-h-[160px] resize-y bg-slate-50/70 border border-slate-200 rounded-lg p-3 text-xs text-slate-800 leading-relaxed outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans"
              style={{ resize: 'vertical' }}
            />
          </div>

          {/* Reference URLs */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
              <ExternalLink size={13} className="text-slate-400" />
              <span>{isJa ? '参考URL / ドキュメント' : 'Reference URLs'}</span>
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
                {isJa ? '追加' : 'Add'}
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
              <div>{isJa ? '作成:' : 'Created:'} {format(new Date(task.createdAt), 'yyyy/MM/dd HH:mm')}</div>
              <div>{isJa ? '更新:' : 'Updated:'} {format(new Date(task.updatedAt), 'yyyy/MM/dd HH:mm')}</div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={() => onDuplicateTask(task)}
                className="px-2.5 py-1.5 text-xs text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1"
              >
                <Copy size={12} />
                <span>{isJa ? '複製' : 'Duplicate'}</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onMoveTask(task.id, 'Archive')}
                  className="px-2.5 py-1.5 text-xs text-slate-600 hover:text-indigo-600 bg-slate-100 hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-1"
                >
                  <Archive size={12} />
                  <span>{isJa ? 'アーカイブ' : 'Archive'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteTask(task.id)}
                  className="px-2.5 py-1.5 text-xs text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors flex items-center gap-1"
                >
                  <Trash2 size={12} />
                  <span>{isJa ? 'ゴミ箱' : 'Trash'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
