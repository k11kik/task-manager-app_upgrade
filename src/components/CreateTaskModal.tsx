import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Plus,
  Folder,
  FolderPlus,
  CheckCircle2,
  Circle,
  Zap,
  Star,
  Pin,
  Clock,
  Calendar as CalendarIcon,
  Repeat,
  ExternalLink,
  AlertCircle,
  ChevronDown,
  Maximize2,
  Minimize2,
  FileText,
  Check
} from 'lucide-react';
import { format } from 'date-fns';
import { Task, Category, RecurrenceType, TaskRecurrence, FolderMeta } from '../types';
import { cn, tr } from '../lib/utils';
import { getParentFolderDeadline } from '../lib/folderDeadlineUtils';

export interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateTask: (taskData: {
    title: string;
    project: string;
    category?: Category;
    isDone?: boolean;
    isStarred?: boolean;
    isPinned?: boolean;
    startDate?: number;
    deadline?: number;
    isAllDay?: boolean;
    recurrence?: TaskRecurrence;
    notes?: string;
    urls?: string[];
  }) => Promise<void>;
  tasks: Task[];
  folderMetas: Record<string, FolderMeta>;
  activeSection: string;
  initialProject?: string;
  urgentCount: number;
  urgentLimit: number;
  language?: string;
  onShowMessage?: (msg: { text: string; type: 'error' | 'info' }) => void;
}

export const CreateTaskModal: React.FC<CreateTaskModalProps> = ({
  isOpen,
  onClose,
  onCreateTask,
  tasks,
  folderMetas,
  activeSection,
  initialProject = 'General',
  urgentCount,
  urgentLimit,
  language = 'en',
  onShowMessage
}) => {
  const L = (ja: string, en: string, fr: string) => tr(language, ja, en, fr);

  // Task form states (mirroring TaskTabsDetail)
  const [title, setTitle] = useState('');
  const [projectInput, setProjectInput] = useState(initialProject || 'General');
  const [isFolderDropdownOpen, setIsFolderDropdownOpen] = useState(false);
  const [filterByTypedFolder, setFilterByTypedFolder] = useState(false);
  const [highlightedFolderIdx, setHighlightedFolderIdx] = useState<number>(-1);

  const [isDone, setIsDone] = useState(false);
  const [category, setCategory] = useState<Category>('Focus'); // 'Focus' = ToDo, 'Urgent' = Focus
  const [isStarred, setIsStarred] = useState(false);
  const [isPinned, setIsPinned] = useState(false);

  const [startDateVal, setStartDateVal] = useState('');
  const [startTimeVal, setStartTimeVal] = useState('09:00');
  const [deadlineDate, setDeadlineDate] = useState('');
  const [deadlineTime, setDeadlineTime] = useState('18:00');
  const [isAllDay, setIsAllDay] = useState(true);

  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>('none');
  const [recurrenceInterval, setRecurrenceInterval] = useState<number>(1);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');

  const [notes, setNotes] = useState('');
  const [isNotesExpanded, setIsNotesExpanded] = useState(false);

  const [urls, setUrls] = useState<string[]>([]);
  const [newUrlInput, setNewUrlInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const titleInputRef = useRef<HTMLTextAreaElement>(null);
  const folderComboboxRef = useRef<HTMLDivElement>(null);

  // Reset form state when modal opens
  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setProjectInput(initialProject || 'General');
      setIsFolderDropdownOpen(false);
      setFilterByTypedFolder(false);
      setHighlightedFolderIdx(-1);
      setIsDone(false);
      setCategory('Focus');
      setIsStarred(false);
      setIsPinned(false);
      setStartDateVal('');
      setStartTimeVal('09:00');
      setDeadlineDate('');
      setDeadlineTime('18:00');
      setIsAllDay(true);
      setRecurrenceType('none');
      setRecurrenceInterval(1);
      setRecurrenceEndDate('');
      setNotes('');
      setIsNotesExpanded(false);
      setUrls([]);
      setNewUrlInput('');
      setIsSubmitting(false);
      setErrorText(null);
      setTimeout(() => {
        titleInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, initialProject]);

  // Close folder suggestions dropdown when clicking outside
  useEffect(() => {
    if (!isFolderDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (folderComboboxRef.current && !folderComboboxRef.current.contains(e.target as Node)) {
        setIsFolderDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isFolderDropdownOpen]);

  // Gather all existing folder paths (including ancestor paths) in activeSection
  const existingFolders = useMemo(() => {
    const folderSet = new Set<string>(['General']);

    const addPathAndAncestors = (rawPath: string) => {
      const cleaned = rawPath
        .split('/')
        .map(s => s.trim())
        .filter(Boolean);
      let current = '';
      for (const seg of cleaned) {
        current = current ? `${current}/${seg}` : seg;
        folderSet.add(current);
      }
    };

    // 1. From tasks in activeSection
    tasks.forEach(t => {
      if (t.category === 'Trash') return;
      if (t.section && t.section !== activeSection) return;
      if (t.project) {
        addPathAndAncestors(t.project);
      }
    });

    // 2. From customFolders in localStorage for activeSection
    try {
      const saved = localStorage.getItem(`navfor_folders_${activeSection}`);
      if (saved) {
        const parsed: string[] = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          parsed.forEach(p => {
            if (typeof p === 'string' && p.trim()) {
              addPathAndAncestors(p);
            }
          });
        }
      }
    } catch {}

    // 3. From folderMetas in activeSection
    Object.values(folderMetas || {}).forEach(meta => {
      if (!meta || !meta.path) return;
      if (meta.category === 'Trash') return;
      if (meta.section && meta.section !== activeSection) return;
      addPathAndAncestors(meta.path);
    });

    return Array.from(folderSet).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );
  }, [tasks, folderMetas, activeSection, isOpen]);

  // Normalized project path from input
  const normalizedProject = useMemo(() => {
    const cleaned = projectInput
      .split('/')
      .map(s => s.trim())
      .filter(Boolean)
      .join('/');
    return cleaned || 'General';
  }, [projectInput]);

  const isExactFolderMatch = useMemo(() => {
    return existingFolders.some(f => f.toLowerCase() === normalizedProject.toLowerCase());
  }, [existingFolders, normalizedProject]);

  // Filtered folder candidates based on input
  const filteredFolders = useMemo(() => {
    if (!filterByTypedFolder || !projectInput.trim()) {
      return existingFolders;
    }
    const q = projectInput.trim().toLowerCase();
    return existingFolders.filter(f => f.toLowerCase().includes(q));
  }, [existingFolders, projectInput, filterByTypedFolder]);

  // Parent folder deadline limit check
  const parentDeadlineLimit = useMemo(() => {
    if (!normalizedProject) return undefined;
    return getParentFolderDeadline(normalizedProject, folderMetas || {}, true);
  }, [normalizedProject, folderMetas]);

  const computeTimestamp = (dateStr: string, timeStr: string, allDay: boolean, isEndOfDay: boolean): number | undefined => {
    if (!dateStr) return undefined;
    const [year, month, day] = dateStr.split('-').map(Number);
    if (!year || !month || !day) return undefined;
    const d = new Date(year, month - 1, day);
    if (allDay) {
      if (isEndOfDay) {
        d.setHours(23, 59, 59, 999);
      } else {
        d.setHours(0, 0, 0, 0);
      }
    } else {
      const [h, m] = (timeStr || (isEndOfDay ? '18:00' : '09:00')).split(':').map(Number);
      d.setHours(h || 0, m || 0, 0, 0);
    }
    return d.getTime();
  };

  const addUrl = () => {
    if (!newUrlInput.trim()) return;
    let url = newUrlInput.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    setUrls(prev => [...prev, url]);
    setNewUrlInput('');
  };

  const removeUrl = (index: number) => {
    setUrls(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSubmitting) return;

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setErrorText(L('タスクのタイトルを入力してください', 'Please enter a task title', 'Veuillez saisir un titre de tâche'));
      titleInputRef.current?.focus();
      return;
    }

    const startTs = computeTimestamp(startDateVal, startTimeVal, isAllDay, false);
    const deadlineTs = computeTimestamp(deadlineDate, deadlineTime, isAllDay, true);

    if (deadlineTs !== undefined && parentDeadlineLimit !== undefined && deadlineTs > parentDeadlineLimit) {
      const msg = L(
        '親フォルダの締切以降は設定できません',
        "Cannot set deadline after parent folder's deadline",
        "Impossible de définir une date limite après celle du dossier parent"
      );
      setErrorText(msg);
      onShowMessage?.({ text: msg, type: 'error' });
      return;
    }

    if (category === 'Urgent' && urgentCount >= urgentLimit) {
      const msg = L(
        `Focusの上限 (${urgentLimit}件) に達しています。既存のFocusタスクを完了するかToDoに戻してください。`,
        `Focus capacity full (${urgentLimit} tasks). Complete or move an existing Focus task first.`,
        `Capacité Focus atteinte (${urgentLimit} tâches).`
      );
      setErrorText(msg);
      onShowMessage?.({ text: msg, type: 'error' });
      return;
    }

    let finalUrls = [...urls];
    if (newUrlInput.trim()) {
      let pendingUrl = newUrlInput.trim();
      if (!pendingUrl.startsWith('http://') && !pendingUrl.startsWith('https://')) {
        pendingUrl = 'https://' + pendingUrl;
      }
      finalUrls.push(pendingUrl);
    }

    let recurrenceRule: TaskRecurrence | undefined = undefined;
    if (recurrenceType !== 'none') {
      let endTimestamp: number | undefined = undefined;
      if (recurrenceEndDate) {
        const [y, m, d] = recurrenceEndDate.split('-').map(Number);
        if (y && m && d) {
          endTimestamp = new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
        }
      }
      recurrenceRule = {
        type: recurrenceType,
        interval: Math.max(1, recurrenceInterval),
        ...(endTimestamp !== undefined ? { endDate: endTimestamp } : {})
      };
    }

    // Match exact existing folder casing if case-insensitive match exists, otherwise use normalizedProject
    const matchedExisting = existingFolders.find(
      f => f.toLowerCase() === normalizedProject.toLowerCase()
    );
    const targetProject = matchedExisting || normalizedProject;

    setIsSubmitting(true);
    setErrorText(null);
    try {
      await onCreateTask({
        title: trimmedTitle,
        project: targetProject,
        category,
        isDone,
        isStarred,
        isPinned,
        startDate: startTs,
        deadline: deadlineTs,
        isAllDay,
        recurrence: recurrenceRule,
        notes,
        urls: finalUrls
      });
      onClose();
    } catch (err) {
      console.error('Failed to create task:', err);
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={L('新規タスク作成', 'Create New Task', 'Créer une nouvelle tâche')}
      onClick={onClose}
      className="fixed inset-0 z-[9990] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && !isFolderDropdownOpen) {
            e.stopPropagation();
            onClose();
          }
        }}
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden select-text"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Plus size={16} />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-800 leading-tight">
                {L('新規タスクを追加', 'Add New Task', 'Ajouter une tâche')}
              </h3>
              <p className="text-[10px] text-slate-500 leading-tight">
                {L(
                  `ワークスペース: ${activeSection}`,
                  `Workspace: ${activeSection}`,
                  `Espace : ${activeSection}`
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 rounded-lg transition-colors"
            title={L('閉じる (Esc)', 'Close (Esc)', 'Fermer (Échap)')}
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable Body (Task Detail features) */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3.5">
          {errorText && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
              <AlertCircle size={14} className="shrink-0" />
              <span>{errorText}</span>
            </div>
          )}

          {/* 1. Project Folder Selector / Input with Autocomplete & New Folder Creation */}
          <div className="space-y-1" ref={folderComboboxRef}>
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <Folder size={12} className="text-amber-500" />
                <span>{L('プロジェクトフォルダ', 'Project Folder', 'Dossier du projet')}</span>
              </label>
              {!isExactFolderMatch && normalizedProject && (
                <span className="text-[10px] font-semibold text-indigo-600 flex items-center gap-1">
                  <FolderPlus size={11} />
                  {L('新規フォルダ作成', 'Will create new folder', 'Nouveau dossier')}
                </span>
              )}
            </div>

            <div className="relative">
              <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg focus-within:bg-white focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
                <span className="pl-2.5 pr-1.5 text-amber-500 shrink-0">
                  <Folder size={14} />
                </span>
                <input
                  type="text"
                  value={projectInput}
                  onFocus={() => {
                    setIsFolderDropdownOpen(true);
                  }}
                  onChange={(e) => {
                    setProjectInput(e.target.value);
                    setFilterByTypedFolder(true);
                    setIsFolderDropdownOpen(true);
                    setHighlightedFolderIdx(-1);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setIsFolderDropdownOpen(true);
                      setHighlightedFolderIdx(prev =>
                        filteredFolders.length > 0 ? (prev + 1) % filteredFolders.length : -1
                      );
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setIsFolderDropdownOpen(true);
                      setHighlightedFolderIdx(prev =>
                        filteredFolders.length > 0
                          ? (prev <= 0 ? filteredFolders.length - 1 : prev - 1)
                          : -1
                      );
                    } else if (e.key === 'Enter' && isFolderDropdownOpen && highlightedFolderIdx >= 0 && highlightedFolderIdx < filteredFolders.length) {
                      e.preventDefault();
                      setProjectInput(filteredFolders[highlightedFolderIdx]);
                      setFilterByTypedFolder(false);
                      setIsFolderDropdownOpen(false);
                    } else if (e.key === 'Escape' && isFolderDropdownOpen) {
                      e.stopPropagation();
                      setIsFolderDropdownOpen(false);
                    }
                  }}
                  placeholder={L(
                    'フォルダ名またはパスを入力 (例: Marketing/Design)...',
                    'Type or select folder path (e.g. Marketing/Design)...',
                    'Saisir ou choisir un dossier (ex: Marketing/Design)...'
                  )}
                  className="flex-1 bg-transparent py-1.5 pr-1 text-xs font-mono font-semibold text-slate-800 outline-none min-w-0"
                />
                {projectInput && (
                  <button
                    type="button"
                    onClick={() => {
                      setProjectInput('');
                      setFilterByTypedFolder(false);
                      setIsFolderDropdownOpen(true);
                    }}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors shrink-0"
                    title={L('クリア', 'Clear', 'Effacer')}
                  >
                    <X size={12} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setFilterByTypedFolder(false);
                    setIsFolderDropdownOpen(prev => !prev);
                  }}
                  className="px-2 py-1.5 text-slate-400 hover:text-slate-700 border-l border-slate-200 transition-colors shrink-0"
                  title={L('既存フォルダ一覧を表示', 'Show existing folders', 'Afficher les dossiers existants')}
                >
                  <ChevronDown size={13} className={cn("transition-transform", isFolderDropdownOpen && "rotate-180")} />
                </button>
              </div>

              {/* Autocomplete Candidates Dropdown */}
              {isFolderDropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto custom-scrollbar py-1 text-xs">
                  {!isExactFolderMatch && normalizedProject && (
                    <button
                      type="button"
                      onClick={() => {
                        setProjectInput(normalizedProject);
                        setFilterByTypedFolder(false);
                        setIsFolderDropdownOpen(false);
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-indigo-50/80 flex items-center justify-between gap-2 text-indigo-700 bg-indigo-50/40 border-b border-slate-100"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <FolderPlus size={13} className="text-indigo-600 shrink-0" />
                        <span className="font-mono font-bold truncate">{normalizedProject}</span>
                      </div>
                      <span className="text-[10px] font-semibold text-indigo-600 shrink-0">
                        {L('＋ 新規作成', '+ Create new', '+ Créer')}
                      </span>
                    </button>
                  )}

                  {filteredFolders.length > 0 ? (
                    filteredFolders.map((folderPath, idx) => {
                      const isCurrent = folderPath.toLowerCase() === normalizedProject.toLowerCase();
                      const isHighlighted = idx === highlightedFolderIdx;
                      return (
                        <button
                          key={folderPath}
                          type="button"
                          onClick={() => {
                            setProjectInput(folderPath);
                            setFilterByTypedFolder(false);
                            setIsFolderDropdownOpen(false);
                          }}
                          className={cn(
                            "w-full px-3 py-1.5 text-left flex items-center justify-between gap-2 transition-colors",
                            isHighlighted
                              ? "bg-indigo-50 text-indigo-700"
                              : isCurrent
                              ? "bg-slate-100/80 text-slate-900 font-bold"
                              : "text-slate-700 hover:bg-slate-50"
                          )}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Folder size={12} className="text-amber-500 shrink-0" />
                            <span className="font-mono truncate">{folderPath}</span>
                          </div>
                          {isCurrent && <Check size={12} className="text-indigo-600 shrink-0" />}
                        </button>
                      );
                    })
                  ) : (
                    <div className="px-3 py-2 text-[11px] text-slate-400 italic">
                      {L(
                        '一致する既存フォルダがありません（入力したパスで新規作成されます）',
                        'No matching folders (will create new folder path)',
                        'Aucun dossier correspondant (sera créé)'
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 2. Title and Done checkbox */}
          <div className="flex items-start gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => setIsDone(prev => !prev)}
              className="mt-1 text-slate-400 hover:text-indigo-600 transition-colors shrink-0"
              title={isDone ? L('未完了に戻す', 'Mark undone', 'Remettre en attente') : L('完了にする', 'Mark done', 'Marquer comme terminé')}
            >
              {isDone ? (
                <CheckCircle2 size={19} className="text-emerald-500" />
              ) : (
                <Circle size={19} className={category === 'Urgent' ? "text-red-500" : "text-slate-300"} />
              )}
            </button>

            <div className="grid flex-1 min-w-0">
              <div
                aria-hidden="true"
                className={cn(
                  "invisible col-start-1 row-start-1 w-full text-sm font-bold leading-snug whitespace-pre-wrap break-all [overflow-wrap:anywhere] p-0 pb-1 border-0 border-b border-transparent pointer-events-none select-none",
                  isDone && "line-through"
                )}
              >
                {(title || L("タスクのタイトルを入力...", "Task title...", "Titre de la tâche...")) + '\u200b'}
              </div>
              <textarea
                ref={titleInputRef}
                rows={1}
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value.replace(/\r?\n/g, ' '));
                  if (errorText) setErrorText(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleSubmit();
                  } else if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                  }
                }}
                placeholder={L("タスクのタイトルを入力...", "Task title...", "Titre de la tâche...")}
                className={cn(
                  "col-start-1 row-start-1 w-full h-full resize-none overflow-hidden text-sm font-bold leading-snug whitespace-pre-wrap break-all [overflow-wrap:anywhere] text-slate-900 bg-transparent border-0 border-b border-slate-200 focus:border-indigo-500 focus:ring-0 outline-none p-0 pb-1 transition-colors",
                  isDone && "line-through text-slate-400"
                )}
              />
            </div>
          </div>

          {/* 3. Category (ToDo / Focus), Star, Pin */}
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5 border-b border-slate-100 pb-2.5">
            {/* Category Switcher */}
            <div className="flex items-center bg-slate-100 rounded-lg p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setCategory('Focus')}
                className={cn(
                  "px-2.5 py-1 rounded-md transition-all text-xs",
                  category === 'Focus' ? "bg-white text-slate-800 shadow-2xs font-bold" : "text-slate-500 hover:text-slate-800"
                )}
              >
                ToDo
              </button>
              <button
                type="button"
                onClick={() => {
                  if (urgentCount >= urgentLimit) {
                    const msg = L(
                      `Focusの上限 (${urgentLimit}件) に達しています。`,
                      `Focus limit (${urgentLimit}) reached.`,
                      `Limite Focus (${urgentLimit}) atteinte.`
                    );
                    setErrorText(msg);
                    return;
                  }
                  setErrorText(null);
                  setCategory('Urgent');
                }}
                className={cn(
                  "px-2.5 py-1 rounded-md transition-all flex items-center gap-1 text-xs",
                  category === 'Urgent' ? "bg-red-500 text-white shadow-2xs font-bold" : "text-slate-500 hover:text-red-600"
                )}
              >
                <Zap size={11} className={category === 'Urgent' ? "text-white" : "text-red-500"} />
                <span>Focus</span>
                <span className={cn("text-[10px] font-mono", category === 'Urgent' ? "text-red-100" : "text-slate-400")}>
                  ({urgentCount}/{urgentLimit})
                </span>
              </button>
            </div>

            {/* Star */}
            <button
              type="button"
              onClick={() => setIsStarred(prev => !prev)}
              className={cn(
                "p-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition-colors",
                isStarred
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
              )}
              title={L('重要フラグ', 'Star', 'Favori')}
            >
              <Star size={12} fill={isStarred ? 'currentColor' : 'none'} className={isStarred ? "text-amber-500" : "text-slate-400"} />
              <span>{L('重要', 'Star', 'Favori')}</span>
            </button>

            {/* Pin */}
            <button
              type="button"
              onClick={() => setIsPinned(prev => !prev)}
              className={cn(
                "p-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition-colors",
                isPinned
                  ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                  : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
              )}
              title={L('ピン留め', 'Pin', 'Épingler')}
            >
              <Pin size={12} fill={isPinned ? 'currentColor' : 'none'} className={isPinned ? "text-indigo-600" : "text-slate-400"} />
              <span>{L('ピン留め', 'Pin', 'Épingler')}</span>
            </button>
          </div>

          {/* 4. When (Start Date), Deadline & Recurrence */}
          <div className="space-y-2.5 p-3 bg-slate-50/70 border border-slate-200/80 rounded-xl">
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
                    onClick={() => setStartDateVal('')}
                    className="text-[10px] text-slate-400 hover:text-red-500 px-1 py-0.5 hover:bg-slate-100 rounded transition-colors"
                  >
                    {L('クリア', 'Clear', 'Effacer')}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={startDateVal}
                  onChange={(e) => setStartDateVal(e.target.value)}
                  className="flex-1 bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
                {!isAllDay && (
                  <input
                    type="time"
                    value={startTimeVal}
                    disabled={!startDateVal}
                    onChange={(e) => setStartTimeVal(e.target.value)}
                    className="w-22 bg-white border border-slate-200 rounded-lg px-1.5 py-1 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500 transition-colors disabled:opacity-40"
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
                    onClick={() => setDeadlineDate('')}
                    className="text-[10px] text-slate-400 hover:text-red-500 px-1 py-0.5 hover:bg-slate-100 rounded transition-colors"
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
                  onChange={(e) => setDeadlineDate(e.target.value)}
                  className="flex-1 bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
                {!isAllDay && (
                  <input
                    type="time"
                    value={deadlineTime}
                    disabled={!deadlineDate}
                    onChange={(e) => setDeadlineTime(e.target.value)}
                    className="w-22 bg-white border border-slate-200 rounded-lg px-1.5 py-1 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500 transition-colors disabled:opacity-40"
                  />
                )}
              </div>

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
                  onChange={(e) => setIsAllDay(e.target.checked)}
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
                  <span className="text-[10px] text-indigo-600 font-semibold">
                    {L('繰り返し有効', 'Active', 'Actif')}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <select
                  value={recurrenceType}
                  onChange={(e) => setRecurrenceType(e.target.value as RecurrenceType)}
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
                      onChange={(e) => setRecurrenceInterval(Math.max(1, parseInt(e.target.value, 10) || 1))}
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
                  <div className="flex items-center gap-1 flex-1 max-w-[170px]">
                    <input
                      type="date"
                      value={recurrenceEndDate}
                      onChange={(e) => setRecurrenceEndDate(e.target.value)}
                      className="flex-1 bg-white border border-slate-200 rounded-lg px-1.5 py-0.5 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                    />
                    {recurrenceEndDate && (
                      <button
                        type="button"
                        onClick={() => setRecurrenceEndDate('')}
                        className="text-[10px] text-slate-400 hover:text-red-500 px-1 py-0.5"
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

          {/* 5. Notes */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <FileText size={12} className="text-slate-400" />
                <span>{L('ノート', 'Notes', 'Notes')}</span>
              </label>
              <button
                type="button"
                onClick={() => setIsNotesExpanded(prev => !prev)}
                className="flex items-center gap-1 text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-1.5 py-0.5 rounded transition-colors"
              >
                {isNotesExpanded ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
                <span>{isNotesExpanded ? L('縮小', 'Collapse', 'Réduire') : L('拡大', 'Expand', 'Agrandir')}</span>
              </button>
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={L("ノート、メモ、コンテキストを記入...", "Notes, context, thoughts...", "Notes, contexte, idées...")}
              className={cn(
                "w-full resize-y bg-slate-50/70 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 leading-relaxed outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans",
                isNotesExpanded ? "min-h-[200px]" : "min-h-[88px]"
              )}
            />
          </div>

          {/* 6. Reference URLs */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <ExternalLink size={12} className="text-slate-400" />
              <span>{L('参考URL / リンク', 'URLs', 'URLs')}</span>
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
                className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:bg-white focus:ring-1 focus:ring-indigo-500 transition-colors"
              />
              <button
                type="button"
                onClick={addUrl}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
              >
                {L('追加', 'Add', 'Ajouter')}
              </button>
            </div>

            {urls.length > 0 && (
              <div className="space-y-1 pt-0.5">
                {urls.map((url, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-1.5 p-1.5 bg-slate-50 rounded-md border border-slate-100 text-xs">
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate text-indigo-600 hover:underline flex items-center gap-1 min-w-0"
                    >
                      <ExternalLink size={10} className="shrink-0 text-slate-400" />
                      <span className="truncate font-mono text-[11px]">{url}</span>
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

          {/* Modal Footer Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              {L('キャンセル', 'Cancel', 'Annuler')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Plus size={14} />
              <span>{L('タスクを追加', 'Add Task', 'Ajouter la tâche')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
