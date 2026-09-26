import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Folder, 
  Star, 
  Pin, 
  Calendar as CalendarIcon, 
  Clock, 
  ExternalLink, 
  Trash2, 
  Archive, 
  Maximize2, 
  Check, 
  Plus, 
  ArrowRight, 
  Repeat, 
  X, 
  CheckCircle2, 
  FileText,
  AlertCircle
} from 'lucide-react';
import { Task, RecurrenceType, TaskRecurrence, FolderMeta } from '../types';
import { cn, tr } from '../lib/utils';
import { format } from 'date-fns';
import { getParentFolderDeadline } from '../lib/folderDeadlineUtils';

export interface FolderDetailPaneProps {
  folderPath: string;
  folderMeta: FolderMeta;
  folderMetas: Record<string, FolderMeta>;
  tasks: Task[];
  onUpdateFolderMeta?: (folderPath: string, updates: Partial<FolderMeta>) => void;
  onArchiveFolder?: (folderPath: string) => void;
  onTrashFolder?: (folderPath: string) => void;
  onToggleFolderStar?: (folderPath: string) => void;
  onToggleFolderPin?: (folderPath: string) => void;
  onSelectTab: (id: string) => void;
  onPinTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onOpenTaskInNewTab?: (taskId: string, isPermanent?: boolean) => void;
  availablePaneIds?: number[];
  onMoveTabToPane?: (id: string, targetPaneId: number) => void;
  onShowMessage?: (msg: { text: string; type: 'error' | 'info' }) => void;
  isPreview?: boolean;
  language?: string;
  t: (key: string) => string;
}

export const FolderDetailPane: React.FC<FolderDetailPaneProps> = ({
  folderPath,
  folderMeta,
  folderMetas,
  tasks,
  onUpdateFolderMeta,
  onArchiveFolder,
  onTrashFolder,
  onToggleFolderStar,
  onToggleFolderPin,
  onSelectTab,
  onPinTab,
  onCloseTab,
  onOpenTaskInNewTab,
  availablePaneIds = [],
  onMoveTabToPane,
  onShowMessage,
  isPreview = false,
  language = 'en',
  t
}) => {
  const isJa = language === 'ja';
  const L = (ja: string, en: string, fr: string) => tr(language, ja, en, fr);
  const folderName = folderPath.split('/').pop() || folderPath;
  const tabId = 'folder:' + folderPath;

  const handleOpenContainedTask = (taskId: string, isPermanent = false) => {
    if (onOpenTaskInNewTab) {
      onOpenTaskInNewTab(taskId, isPermanent);
    } else {
      onPinTab(tabId);
      onSelectTab(taskId);
    }
  };

  // Local form state
  const [title, setTitle] = useState(folderMeta?.title || folderName);
  const [notes, setNotes] = useState(folderMeta?.notes || '');
  const [startDateVal, setStartDateVal] = useState('');
  const [startTimeVal, setStartTimeVal] = useState('09:00');
  const [deadlineDate, setDeadlineDate] = useState('');
  const [deadlineTime, setDeadlineTime] = useState('18:00');
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>('none');
  const [recurrenceInterval, setRecurrenceInterval] = useState<number>(1);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  const [isAllDay, setIsAllDay] = useState(folderMeta?.isAllDay ?? true);
  const [urls, setUrls] = useState<string[]>(folderMeta?.urls || []);
  const [newUrlInput, setNewUrlInput] = useState('');
  const [isSavedNotice, setIsSavedNotice] = useState(false);
  const [isExpandedNotesOpen, setIsExpandedNotesOpen] = useState(false);

  // Sync state whenever folderPath or folderMeta changes
  useEffect(() => {
    setTitle(folderMeta?.title || folderName);
    setNotes(folderMeta?.notes || '');
    setUrls(folderMeta?.urls || []);
    setIsAllDay(folderMeta?.isAllDay ?? true);

    if (folderMeta?.startDate) {
      const sd = new Date(folderMeta.startDate);
      setStartDateVal(format(sd, 'yyyy-MM-dd'));
      setStartTimeVal(format(sd, 'HH:mm'));
    } else {
      setStartDateVal('');
      setStartTimeVal('09:00');
    }

    if (folderMeta?.deadline) {
      const d = new Date(folderMeta.deadline);
      setDeadlineDate(format(d, 'yyyy-MM-dd'));
      setDeadlineTime(format(d, 'HH:mm'));
    } else {
      setDeadlineDate('');
      setDeadlineTime('18:00');
    }

    if (folderMeta?.recurrence && folderMeta.recurrence.type !== 'none') {
      setRecurrenceType(folderMeta.recurrence.type);
      setRecurrenceInterval(folderMeta.recurrence.interval ?? 1);
      if (folderMeta.recurrence.endDate) {
        setRecurrenceEndDate(format(new Date(folderMeta.recurrence.endDate), 'yyyy-MM-dd'));
      } else {
        setRecurrenceEndDate('');
      }
    } else {
      setRecurrenceType('none');
      setRecurrenceInterval(1);
      setRecurrenceEndDate('');
    }
  }, [folderPath, folderMeta?.updatedAt, folderName]);

  const triggerSaveNotice = () => {
    setIsSavedNotice(true);
    setTimeout(() => setIsSavedNotice(false), 1500);
  };

  const saveTitle = (newTitle: string) => {
    const trimmed = newTitle.trim();
    if (!trimmed || trimmed === (folderMeta?.title || folderName)) return;
    onPinTab(tabId);
    onUpdateFolderMeta?.(folderPath, { title: trimmed });
    triggerSaveNotice();
  };

  const saveNotes = (newNotes: string) => {
    if (newNotes === (folderMeta?.notes || '')) return;
    onPinTab(tabId);
    onUpdateFolderMeta?.(folderPath, { notes: newNotes });
    triggerSaveNotice();
  };

  const handleStartDateCommit = (dateStr: string, timeStr: string, allDay: boolean) => {
    onPinTab(tabId);
    if (!dateStr) {
      onUpdateFolderMeta?.(folderPath, { startDate: undefined });
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
    onUpdateFolderMeta?.(folderPath, { startDate: d.getTime() });
    triggerSaveNotice();
  };

  const parentDeadlineLimit = getParentFolderDeadline(folderPath, folderMetas || {}, false);

  const handleDeadlineCommit = (dateStr: string, timeStr: string, allDay: boolean) => {
    onPinTab(tabId);
    if (!dateStr) {
      onUpdateFolderMeta?.(folderPath, { deadline: undefined, isAllDay: allDay });
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

    // Check parent deadline limit
    if (parentDeadlineLimit !== undefined && d.getTime() > parentDeadlineLimit) {
      onShowMessage?.({
        text: L('親フォルダの締切以降は設定できません', "Cannot set deadline after parent folder's deadline", "Impossible de définir une date limite après celle du dossier parent"),
        type: 'error'
      });
      // Revert back
      if (folderMeta?.deadline) {
        const prevD = new Date(folderMeta.deadline);
        setDeadlineDate(format(prevD, 'yyyy-MM-dd'));
        setDeadlineTime(format(prevD, 'HH:mm'));
      } else {
        setDeadlineDate('');
        setDeadlineTime('18:00');
      }
      return;
    }

    onUpdateFolderMeta?.(folderPath, { deadline: d.getTime(), isAllDay: allDay });
    triggerSaveNotice();
  };

  const handleRecurrenceCommit = (type: RecurrenceType, intervalVal: number, endDateStr: string) => {
    onPinTab(tabId);
    if (type === 'none') {
      onUpdateFolderMeta?.(folderPath, { recurrence: undefined });
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
    onUpdateFolderMeta?.(folderPath, { recurrence: recurrenceRule });
    triggerSaveNotice();
  };

  const addUrl = () => {
    if (!newUrlInput.trim()) return;
    onPinTab(tabId);
    let url = newUrlInput.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    const updated = [...urls, url];
    setUrls(updated);
    setNewUrlInput('');
    onUpdateFolderMeta?.(folderPath, { urls: updated });
    triggerSaveNotice();
  };

  const removeUrl = (index: number) => {
    onPinTab(tabId);
    const updated = urls.filter((_, i) => i !== index);
    setUrls(updated);
    onUpdateFolderMeta?.(folderPath, { urls: updated });
    triggerSaveNotice();
  };

  // Contained tasks in this folder
  const containedTasks = tasks.filter(t => 
    (t.project === folderPath || t.project.startsWith(folderPath + '/')) &&
    t.category !== 'Archive' &&
    t.category !== 'Trash'
  );

  return (
    <div className="flex-1 h-full min-h-0 flex flex-col overflow-hidden bg-white">
      {/* Subheader / Breadcrumb */}
      <div className="flex items-center justify-between px-3.5 py-2 border-b border-slate-100 bg-amber-50/30 shrink-0">
        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono min-w-0">
          <Folder size={13} className="text-amber-500 shrink-0" />
          <span className="truncate font-semibold text-slate-700">{folderPath}</span>
          <span className="text-[10px] bg-amber-100/70 text-amber-800 border border-amber-200/80 px-1.5 py-0.2 rounded font-sans font-semibold">
            {containedTasks.length} {L('タスク', 'tasks', 'tâches')}
          </span>
          {isPreview && (
            <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.2 rounded font-sans not-italic">
              {L('プレビュー', 'Preview', 'Aperçu')}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isSavedNotice && (
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 animate-fade-in flex items-center gap-1">
              <Check size={10} />
              {L('保存済', 'Saved', 'Enregistré')}
            </span>
          )}

          {/* Move to another pane if split */}
          {availablePaneIds.length > 0 && onMoveTabToPane && (
            <div className="flex items-center gap-1 text-[11px] text-slate-500">
              <span className="hidden sm:inline">{L('ペイン移動:', 'Move to:', 'Déplacer :')}</span>
              {availablePaneIds.map(targetId => (
                <button
                  key={targetId}
                  type="button"
                  onClick={() => onMoveTabToPane(tabId, targetId)}
                  className="px-1.5 py-0.5 text-[10px] font-bold bg-slate-200/80 hover:bg-indigo-100 hover:text-indigo-700 rounded transition-colors"
                  title={L(`ペイン ${targetId + 1} へ移動`, `Move to Pane ${targetId + 1}`, `Déplacer vers le panneau ${targetId + 1}`)}
                >
                  P{targetId + 1}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Scrollable Form Body */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3.5 space-y-3.5">
        {/* Title Input Row */}
        <div className="flex items-start gap-2.5">
          <div className="mt-1 text-amber-500 shrink-0">
            <Folder size={19} />
          </div>

          <div className="grid flex-1 min-w-0">
            <div
              aria-hidden="true"
              className="invisible col-start-1 row-start-1 w-full text-sm font-bold leading-snug whitespace-pre-wrap break-all [overflow-wrap:anywhere] p-0 pb-0.5 border-0 border-b border-transparent pointer-events-none select-none"
            >
              {(title || L("フォルダのタイトル...", "Folder title...", "Titre du dossier...")) + '\u200b'}
            </div>
            <textarea
              rows={1}
              value={title}
              onChange={(e) => {
                const nextVal = e.target.value.replace(/\r?\n/g, ' ');
                setTitle(nextVal);
                if (nextVal !== (folderMeta?.title || folderName)) {
                  onPinTab(tabId);
                }
              }}
              onBlur={() => saveTitle(title)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  saveTitle(title);
                  (e.target as HTMLTextAreaElement).blur();
                }
              }}
              placeholder={L("フォルダのタイトル...", "Folder title...", "Titre du dossier...")}
              className="col-start-1 row-start-1 w-full h-full resize-none overflow-hidden text-sm font-bold leading-snug whitespace-pre-wrap break-all [overflow-wrap:anywhere] text-slate-900 bg-transparent border-0 border-b border-transparent hover:border-slate-200 focus:border-indigo-500 focus:ring-0 outline-none p-0 pb-0.5 transition-colors"
            />
          </div>
        </div>

        {/* Badges (Star / Pin) - Notice NO ToDo/Focus buttons per user request */}
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5 border-b border-slate-100 pb-2.5">
          {/* Star Button */}
          <button
            type="button"
            onClick={() => {
              onPinTab(tabId);
              if (onToggleFolderStar) {
                onToggleFolderStar(folderPath);
              } else {
                onUpdateFolderMeta?.(folderPath, { isStarred: !folderMeta?.isStarred });
              }
            }}
            className={cn(
              "p-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition-colors",
              folderMeta?.isStarred 
                ? "bg-amber-50 text-amber-700 border-amber-200" 
                : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
            )}
            title={L('フォルダに重要フラグをつける', 'Star folder', 'Marquer le dossier en favori')}
          >
            <Star 
              size={12} 
              fill={folderMeta?.isStarred ? 'currentColor' : 'none'} 
              className={folderMeta?.isStarred ? "text-amber-500" : "text-slate-400"} 
            />
            <span className="hidden sm:inline">{L('重要', 'Star', 'Favori')}</span>
          </button>

          {/* Pin Button */}
          <button
            type="button"
            onClick={() => {
              onPinTab(tabId);
              if (onToggleFolderPin) {
                onToggleFolderPin(folderPath);
              } else {
                onUpdateFolderMeta?.(folderPath, { isPinned: !folderMeta?.isPinned });
              }
            }}
            className={cn(
              "p-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition-colors",
              folderMeta?.isPinned 
                ? "bg-indigo-50 text-indigo-700 border-indigo-200" 
                : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
            )}
            title={L('フォルダをピン留め', 'Pin folder', 'Épingler le dossier')}
          >
            <Pin 
              size={12} 
              fill={folderMeta?.isPinned ? 'currentColor' : 'none'} 
              className={folderMeta?.isPinned ? "text-indigo-600" : "text-slate-400"} 
            />
            <span className="hidden sm:inline">{L('ピン留め', 'Pin', 'Épingler')}</span>
          </button>

          {/* Folder Path Badge */}
          <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-1 rounded-lg border border-slate-200/80">
            {folderPath}
          </span>
        </div>

        {/* When (Start Date), Deadline & Recurrence Block */}
        <div className="space-y-2 p-2.5 bg-slate-50/70 border border-slate-200/80 rounded-xl">
          {/* Start Date: いつ */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <Clock size={12} className="text-indigo-500" />
                <span>{L('いつ (開始日)', 'When (Start Date)', 'Quand (Date de début)')}</span>
              </label>
              {startDateVal && (
                <button
                  type="button"
                  onClick={() => {
                    setStartDateVal('');
                    handleStartDateCommit('', startTimeVal, isAllDay);
                  }}
                  className="text-[10px] text-slate-400 hover:text-red-500 px-1 py-0.5 hover:bg-slate-100 rounded transition-colors"
                  title={L('開始日をクリア', 'Clear start date', 'Effacer la date de début')}
                >
                  {L('クリア', 'Clear', 'Effacer')}
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
                <span>{L('締切 / 期日', 'Deadline', 'Date limite')}</span>
              </label>
              {deadlineDate && (
                <button
                  type="button"
                  onClick={() => {
                    setDeadlineDate('');
                    handleDeadlineCommit('', deadlineTime, isAllDay);
                  }}
                  className="text-[10px] text-slate-400 hover:text-red-500 px-1 py-0.5 hover:bg-slate-100 rounded transition-colors"
                  title={L('締切をクリア', 'Clear deadline', 'Effacer la date limite')}
                >
                  {L('クリア', 'Clear', 'Effacer')}
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={deadlineDate}
                max={parentDeadlineLimit ? format(new Date(parentDeadlineLimit), 'yyyy-MM-dd') : undefined}
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

            {/* Parent deadline notice if applicable */}
            {parentDeadlineLimit !== undefined && (
              <div className="flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 border border-amber-200/80 px-2 py-1 rounded-md">
                <AlertCircle size={11} className="shrink-0" />
                <span>
                  {L(
                    `※ 親フォルダの締切 (${format(new Date(parentDeadlineLimit), 'yyyy/MM/dd HH:mm')}) 以前に設定する必要があります`,
                    `* Must be on or before parent folder deadline (${format(new Date(parentDeadlineLimit), 'yyyy/MM/dd HH:mm')})`,
                    `* Doit être au plus tard à la date limite du dossier parent (${format(new Date(parentDeadlineLimit), 'yyyy/MM/dd HH:mm')})`
                  )}
                </span>
              </div>
            )}
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
              <span>{L('終日設定', 'All day', 'Toute la journée')}</span>
            </label>
          </div>

          {/* Recurrence: 繰り返し */}
          <div className="pt-2 border-t border-slate-200/80 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <Repeat size={12} className="text-indigo-600" />
                <span>{L('繰り返し', 'Repeat', 'Répéter')}</span>
              </label>
              {recurrenceType !== 'none' && (
                <span className="text-[10px] text-indigo-600 font-semibold bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-100">
                  {L('繰り返し有効', 'Active', 'Actif')}
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
                <option value="none">{L('なし', 'None', 'Aucune')}</option>
                <option value="daily">{L('毎日', 'Every day', 'Tous les jours')}</option>
                <option value="every_x_days">{L('X日ごと', 'Every X days', 'Tous les X jours')}</option>
                <option value="weekly">{L('毎週', 'Every week', 'Toutes les semaines')}</option>
                <option value="every_x_weeks">{L('X週ごと', 'Every X weeks', 'Toutes les X semaines')}</option>
              </select>

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
                      ? L('日ごと', 'days', 'jours') 
                      : L('週ごと', 'weeks', 'semaines')}
                  </span>
                </div>
              )}
            </div>

            {recurrenceType !== 'none' && (
              <div className="flex items-center justify-between gap-1.5 pt-1 text-[11px] text-slate-500">
                <span className="text-[10px] shrink-0 font-medium">{L('終了日 (任意):', 'End date:', 'Date de fin :')}</span>
                <input
                  type="date"
                  value={recurrenceEndDate}
                  onChange={(e) => {
                    setRecurrenceEndDate(e.target.value);
                    handleRecurrenceCommit(recurrenceType, recurrenceInterval, e.target.value);
                  }}
                  className="bg-white border border-slate-200 rounded-md px-1.5 py-0.5 text-xs text-slate-800 outline-none"
                />
              </div>
            )}
          </div>
        </div>

        {/* Notes (メモ・ノート) */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
              <span>{L('ノート・メモ', 'Notes', 'Notes')}</span>
            </label>
            <button
              type="button"
              onClick={() => setIsExpandedNotesOpen(true)}
              className="p-1 hover:bg-slate-100 text-slate-400 hover:text-indigo-600 rounded transition-colors"
              title={L('拡大表示', 'Maximize', 'Agrandir')}
            >
              <Maximize2 size={12} />
            </button>
          </div>
          <textarea
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
              if (e.target.value !== (folderMeta?.notes || '')) {
                onPinTab(tabId);
              }
            }}
            onBlur={() => saveNotes(notes)}
            placeholder={L("このフォルダに関するノートやメモ...", "Folder notes...", "Notes du dossier...")}
            rows={4}
            className="w-full bg-slate-50/70 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 leading-relaxed outline-none focus:bg-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-sans resize-y custom-scrollbar"
          />
        </div>

        {/* URLs (参考URL) */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
            <ExternalLink size={12} className="text-indigo-500" />
            <span>{L('参考URL / ドキュメント', 'Reference URLs', 'URLs de référence')}</span>
          </label>

          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={newUrlInput}
              onChange={(e) => {
                setNewUrlInput(e.target.value);
                if (e.target.value.trim()) {
                  onPinTab(tabId);
                }
              }}
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
              {L('追加', 'Add', 'Ajouter')}
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
                    title={L('削除', 'Remove', 'Supprimer')}
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Contained Tasks List (内包タスク) */}
        <div className="space-y-1.5 pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
              <FileText size={12} className="text-indigo-500" />
              <span>{L('内包タスク', 'Contained Tasks', 'Tâches contenues')}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 bg-slate-100 rounded-full text-slate-600">
                {containedTasks.length}
              </span>
            </label>
          </div>
          {containedTasks.length > 0 ? (
            <div className="max-h-40 overflow-y-auto custom-scrollbar divide-y divide-slate-100 border border-slate-200/80 rounded-lg bg-slate-50/50">
              {containedTasks.map(task => (
                <div
                  key={task.id}
                  onClick={() => handleOpenContainedTask(task.id, false)}
                  onDoubleClick={() => handleOpenContainedTask(task.id, true)}
                  title={L('クリックで別タブにプレビュー表示 / ダブルクリックで固定', 'Click to preview in a new tab / Double-click to pin', 'Cliquer pour prévisualiser dans un onglet / Double-cliquer pour épingler')}
                  className="flex items-center justify-between px-2.5 py-1.5 hover:bg-indigo-50/70 cursor-pointer text-xs transition-colors group"
                >
                  <div className="flex items-start gap-1.5 min-w-0 flex-1 pr-2">
                    {task.isDone ? (
                      <CheckCircle2 size={13} className="text-emerald-500 shrink-0 mt-0.5" />
                    ) : task.category === 'Urgent' ? (
                      <span className="w-2 h-2 rounded-full bg-red-500 shrink-0 mt-1" />
                    ) : (
                      <FileText size={13} className="text-slate-400 shrink-0 mt-0.5" />
                    )}
                    <span className={cn("break-all [overflow-wrap:anywhere] whitespace-normal leading-snug font-medium", task.isDone && "line-through text-slate-400")}>
                      {task.title}
                    </span>
                  </div>
                  <ArrowRight size={12} className="text-slate-300 group-hover:text-indigo-600 shrink-0 transition-colors" />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-slate-400 italic px-1">
              {L('このフォルダにアクティブなタスクはありません', 'No active tasks in this folder', 'Aucune tâche active dans ce dossier')}
            </p>
          )}
        </div>

        {/* Bottom Actions: Archive Folder and Trash Folder */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={() => {
              onPinTab(tabId);
              onArchiveFolder?.(folderPath);
            }}
            className="px-2 py-1 text-slate-600 hover:bg-slate-100 rounded-md transition-colors flex items-center gap-1 text-[11px] font-medium"
            title={L('このフォルダと中身のタスク全体をアーカイブします', 'Archive folder and all contents', 'Archiver le dossier et tout son contenu')}
          >
            <Archive size={11} />
            <span>{L('フォルダをアーカイブ', 'Archive Folder', 'Archiver le dossier')}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onTrashFolder?.(folderPath);
              onCloseTab(tabId);
            }}
            className="px-2 py-1 text-red-600 hover:bg-red-50 rounded-md transition-colors flex items-center gap-1 text-[11px] font-medium"
            title={L('このフォルダと中身のタスク全体をゴミ箱へ移動します', 'Move folder and all contents to trash', 'Mettre le dossier et tout son contenu à la corbeille')}
          >
            <Trash2 size={11} />
            <span>{L('フォルダをゴミ箱へ', 'Trash Folder', 'Mettre le dossier à la corbeille')}</span>
          </button>
        </div>
      </div>

      {/* Expanded Notes Modal */}
      {isExpandedNotesOpen && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => {
            saveNotes(notes);
            setIsExpandedNotesOpen(false);
          }}
          className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center px-4 sm:px-8 py-16 sm:py-20"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl h-full max-h-[640px] flex flex-col overflow-hidden animate-scale-up my-auto"
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50/80 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <Folder size={16} className="text-amber-500 shrink-0" />
                <span className="font-bold text-sm text-slate-800 truncate">{folderPath} - {title}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  saveNotes(notes);
                  setIsExpandedNotesOpen(false);
                }}
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors shrink-0"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 p-5 overflow-hidden flex flex-col min-h-0">
              <textarea
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value);
                  if (e.target.value !== (folderMeta?.notes || '')) {
                    onPinTab(tabId);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.stopPropagation();
                    saveNotes(notes);
                    setIsExpandedNotesOpen(false);
                  }
                }}
                placeholder={L("フォルダのノート、メモ、コンテキストを記入...", "Folder notes...", "Notes du dossier...")}
                className="w-full flex-1 resize-none bg-slate-50/50 border border-slate-200 rounded-xl p-4 text-sm text-slate-800 leading-relaxed outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans overflow-y-auto custom-scrollbar"
                autoFocus
              />
            </div>
            <div className="flex items-center justify-end px-5 py-3 border-t border-slate-200 bg-slate-50/50 shrink-0">
              <button
                type="button"
                onClick={() => {
                  saveNotes(notes);
                  setIsExpandedNotesOpen(false);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
              >
                {L('閉じて保存', 'Save & Close', 'Enregistrer et fermer')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
