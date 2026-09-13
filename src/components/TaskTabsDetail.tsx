import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  X, 
  CheckCircle2, 
  Circle, 
  Star, 
  Pin, 
  Calendar, 
  Clock, 
  ExternalLink, 
  Link as LinkIcon, 
  Trash2, 
  Copy, 
  Archive, 
  AlertCircle, 
  AlertTriangle, 
  FileText, 
  ChevronRight, 
  Layers, 
  Zap, 
  Maximize2, 
  Minimize2,
  Folder,
  Tag,
  Save,
  Columns2,
  Split,
  ArrowRightLeft,
  MoveRight,
  MoveLeft
} from 'lucide-react';
import { Task, Category } from '../types';
import { cn } from '../lib/utils';
import { format } from 'date-fns';

interface TaskTabsDetailProps {
  tasks: Task[];
  openTaskIds: string[];
  activeTaskId: string | null;
  onSelectTab: (taskId: string) => void;
  onCloseTab: (taskId: string) => void;
  onCloseAllTabs: () => void;
  onUpdateTask: (taskId: string, updates: Partial<Task>) => void;
  onMoveTask: (taskId: string, category: Category) => void;
  onDeleteTask: (taskId: string) => void;
  onToggleDone: (taskId: string) => void;
  onToggleStar: (taskId: string) => void;
  onTogglePin: (taskId: string) => void;
  onDuplicateTask?: (task: Task) => void;
  deadlineThresholdDays?: number;
  t: (key: string) => string;
}

// Single Pane Editor View Component
interface SinglePaneViewProps {
  paneIndex: 0 | 1;
  isActivePane: boolean;
  isSplit: boolean;
  openTaskIds: string[];
  activeTaskId: string | null;
  tasks: Task[];
  onFocusPane: () => void;
  onSelectTab: (taskId: string) => void;
  onCloseTab: (taskId: string) => void;
  onCloseAllTabs: () => void;
  onMoveTabToOtherPane?: (taskId: string) => void;
  onToggleSplit: () => void;
  onCloseSplit?: () => void;
  onUpdateTask: (taskId: string, updates: Partial<Task>) => void;
  onMoveTask: (taskId: string, category: Category) => void;
  onDeleteTask: (taskId: string) => void;
  onToggleDone: (taskId: string) => void;
  onToggleStar: (taskId: string) => void;
  onTogglePin: (taskId: string) => void;
  onDuplicateTask?: (task: Task) => void;
  deadlineThresholdDays?: number;
  t: (key: string) => string;
}

const SinglePaneView: React.FC<SinglePaneViewProps> = ({
  paneIndex,
  isActivePane,
  isSplit,
  openTaskIds,
  activeTaskId,
  tasks,
  onFocusPane,
  onSelectTab,
  onCloseTab,
  onCloseAllTabs,
  onMoveTabToOtherPane,
  onToggleSplit,
  onCloseSplit,
  onUpdateTask,
  onMoveTask,
  onDeleteTask,
  onToggleDone,
  onToggleStar,
  onTogglePin,
  onDuplicateTask,
  deadlineThresholdDays = 3,
  t
}) => {
  const activeTask = useMemo(() => {
    return tasks.find(t => t.id === activeTaskId) || null;
  }, [tasks, activeTaskId]);

  const [draftTitle, setDraftTitle] = useState('');
  const [draftProject, setDraftProject] = useState('');
  const [draftNotes, setDraftNotes] = useState('');
  const [draftUrls, setDraftUrls] = useState<string[]>([]);
  const [draftDeadline, setDraftDeadline] = useState('');
  const [draftIsAllDay, setDraftIsAllDay] = useState(false);
  const [savedIndicator, setSavedIndicator] = useState(false);

  // Sync drafts when activeTask changes
  useEffect(() => {
    if (activeTask) {
      setDraftTitle(activeTask.title);
      setDraftProject(activeTask.project);
      setDraftNotes(activeTask.notes || '');
      setDraftUrls(activeTask.urls && activeTask.urls.length > 0 ? activeTask.urls : ['']);
      setDraftIsAllDay(activeTask.isAllDay || false);
      if (activeTask.deadline) {
        setDraftDeadline(format(activeTask.deadline, activeTask.isAllDay ? "yyyy-MM-dd" : "yyyy-MM-dd'T'HH:mm"));
      } else {
        setDraftDeadline('');
      }
    }
  }, [activeTask?.id]);

  const handleSaveField = (updates: Partial<Task>) => {
    if (!activeTask) return;
    onUpdateTask(activeTask.id, updates);
    setSavedIndicator(true);
    setTimeout(() => setSavedIndicator(false), 2000);
  };

  const handleDeadlineChange = (val: string, allDay = draftIsAllDay) => {
    setDraftDeadline(val);
    if (!val) {
      handleSaveField({ deadline: null as any, isAllDay: allDay });
      return;
    }
    try {
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        if (allDay) {
          d.setHours(23, 59, 59, 999);
        }
        handleSaveField({ deadline: d.getTime(), isAllDay: allDay });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUrlChange = (index: number, val: string) => {
    const next = [...draftUrls];
    next[index] = val;
    setDraftUrls(next);
    handleSaveField({ urls: next.filter(u => u.trim() !== '') });
  };

  const handleAddUrl = () => {
    setDraftUrls([...draftUrls, '']);
  };

  const handleRemoveUrl = (index: number) => {
    const next = draftUrls.filter((_, i) => i !== index);
    setDraftUrls(next.length === 0 ? [''] : next);
    handleSaveField({ urls: next.filter(u => u.trim() !== '') });
  };

  const openTasks = useMemo(() => {
    return openTaskIds
      .map(id => tasks.find(t => t.id === id))
      .filter((t): t is Task => t !== undefined);
  }, [openTaskIds, tasks]);

  const breadcrumbSegments = useMemo(() => {
    if (!activeTask) return [];
    return (activeTask.project || 'General').split(/[\/\\]/).map(p => p.trim()).filter(Boolean);
  }, [activeTask?.project]);

  return (
    <div 
      onClick={onFocusPane}
      className={cn(
        "flex flex-col flex-1 h-full min-h-0 bg-white border border-slate-200/90 rounded-xl overflow-hidden shadow-2xs transition-all relative",
        isActivePane && isSplit && "ring-2 ring-indigo-500/50 border-indigo-300"
      )}
    >
      {/* VS Code Tab Bar */}
      <div className={cn(
        "flex items-center justify-between border-b overflow-x-auto select-none custom-scrollbar shrink-0 h-9 transition-colors",
        isActivePane ? "bg-slate-100/95 border-slate-300" : "bg-slate-50 border-slate-200"
      )}>
        <div className="flex items-center h-full flex-1 overflow-x-auto min-w-0">
          {openTasks.map(task => {
            const isActive = task.id === activeTaskId;
            return (
              <div
                key={task.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onFocusPane();
                  onSelectTab(task.id);
                }}
                className={cn(
                  "group relative flex items-center gap-1.5 px-3 h-full border-r border-slate-200 text-xs font-medium cursor-pointer transition-colors max-w-[180px] shrink-0",
                  isActive
                    ? "bg-white text-slate-900 border-t-2 border-t-indigo-600 font-semibold shadow-xs"
                    : "text-slate-500 hover:bg-slate-200/60 hover:text-slate-800"
                )}
                title={`${task.project} > ${task.title}`}
              >
                {/* Status Dot */}
                {task.isDone ? (
                  <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
                ) : task.category === 'Urgent' ? (
                  <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                ) : (
                  <FileText size={12} className="text-indigo-400 shrink-0" />
                )}

                {/* Tab Title */}
                <span className={cn("truncate text-[11px]", task.isDone && "line-through opacity-60")}>
                  {task.title}
                </span>

                {/* Star indicator */}
                {task.isStarred && (
                  <Star size={10} fill="currentColor" className="text-amber-400 shrink-0" />
                )}

                {/* Move to other pane button (if split) */}
                {isSplit && onMoveTabToOtherPane && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onMoveTabToOtherPane(task.id);
                    }}
                    className="p-0.5 rounded hover:bg-indigo-100 text-slate-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    title={paneIndex === 0 ? "右のペインへ移動" : "左のペインへ移動"}
                  >
                    {paneIndex === 0 ? <MoveRight size={10} /> : <MoveLeft size={10} />}
                  </button>
                )}

                {/* Close Tab Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(task.id);
                  }}
                  className="p-0.5 rounded hover:bg-slate-300/80 text-slate-400 hover:text-slate-700 opacity-60 group-hover:opacity-100 transition-opacity ml-0.5 shrink-0"
                  title="タブを閉じる"
                >
                  <X size={11} />
                </button>
              </div>
            );
          })}

          {openTasks.length === 0 && (
            <div className="px-3 text-xs text-slate-400 italic">
              開いているタブはありません
            </div>
          )}
        </div>

        {/* Tab Bar Actions (Right side of tab bar) */}
        <div className="flex items-center gap-1 px-2 shrink-0">
          {savedIndicator && (
            <span className="text-[10px] text-emerald-600 font-medium animate-pulse flex items-center gap-1">
              <Save size={10} /> 保存済
            </span>
          )}

          {/* Split Editor Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleSplit();
            }}
            className={cn(
              "p-1 rounded transition-colors flex items-center gap-1 text-[10px] font-semibold",
              isSplit 
                ? "bg-indigo-100 text-indigo-700 hover:bg-indigo-200" 
                : "text-slate-500 hover:bg-slate-200 hover:text-slate-800"
            )}
            title={isSplit ? "分割を解除" : "エディタを左右に分割 (Split Editor)"}
          >
            <Columns2 size={13} />
            <span className="hidden xl:inline">{isSplit ? '分割解除' : '分割'}</span>
          </button>

          {/* Close split pane button (for secondary pane) */}
          {isSplit && paneIndex === 1 && onCloseSplit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCloseSplit();
              }}
              className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
              title="このエディタペインを閉じる"
            >
              <X size={13} />
            </button>
          )}

          {openTasks.length > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCloseAllTabs();
              }}
              className="px-1.5 py-0.5 text-[10px] text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded transition-colors"
              title="このペインの全タブを閉じる"
            >
              すべて閉じる
            </button>
          )}
        </div>
      </div>

      {/* Detail Content Area */}
      {activeTask ? (
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 lg:p-5 flex flex-col gap-4">
          {/* Breadcrumb / Project Hierarchy path */}
          <div className="flex items-center flex-wrap gap-1.5 text-xs text-slate-400 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
            <Folder size={13} className="text-amber-500" />
            <span className="font-semibold text-slate-500">{activeTask.section || 'General'}</span>
            {breadcrumbSegments.map((segment, idx) => (
              <React.Fragment key={idx}>
                <ChevronRight size={11} className="text-slate-300" />
                <span className={cn("font-medium", idx === breadcrumbSegments.length - 1 ? "text-indigo-600 font-semibold" : "text-slate-600")}>
                  {segment}
                </span>
              </React.Fragment>
            ))}

            {/* Quick change project/folder */}
            <div className="ml-auto flex items-center gap-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">Path:</span>
              <input
                type="text"
                value={draftProject}
                onChange={(e) => setDraftProject(e.target.value)}
                onBlur={() => {
                  if (draftProject.trim() && draftProject !== activeTask.project) {
                    handleSaveField({ project: draftProject.trim() });
                  }
                }}
                className="bg-white border border-slate-200 rounded px-1.5 py-0.5 text-[11px] font-mono text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="プロジェクト/サブフォルダ"
              />
            </div>
          </div>

          {/* Main Title & Status Bar */}
          <div className="flex items-start gap-3">
            <button
              onClick={() => onToggleDone(activeTask.id)}
              className="mt-1 text-slate-400 hover:text-emerald-600 transition-colors shrink-0"
              title={activeTask.isDone ? "未完了に戻す" : "完了にする"}
            >
              {activeTask.isDone ? (
                <CheckCircle2 size={22} className="text-emerald-500" />
              ) : (
                <Circle size={22} className="hover:text-indigo-500 text-slate-300" />
              )}
            </button>

            <div className="flex-1 min-w-0">
              <textarea
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                onBlur={() => {
                  if (draftTitle.trim() && draftTitle !== activeTask.title) {
                    handleSaveField({ title: draftTitle.trim() });
                  }
                }}
                rows={1}
                placeholder="タスクのタイトル..."
                className={cn(
                  "w-full text-base lg:text-lg font-bold text-slate-900 border-0 border-b border-transparent hover:border-slate-200 focus:border-indigo-500 outline-none bg-transparent transition-all resize-none leading-snug py-0.5",
                  activeTask.isDone && "line-through text-slate-400"
                )}
              />
            </div>

            {/* Quick action buttons on title row */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => onToggleStar(activeTask.id)}
                className={cn(
                  "p-1.5 rounded-lg transition-colors border",
                  activeTask.isStarred
                    ? "bg-amber-50 border-amber-200 text-amber-500"
                    : "border-slate-200 text-slate-400 hover:bg-slate-50"
                )}
                title="スター切り替え"
              >
                <Star size={15} fill={activeTask.isStarred ? "currentColor" : "none"} />
              </button>

              <button
                onClick={() => onTogglePin(activeTask.id)}
                className={cn(
                  "p-1.5 rounded-lg transition-colors border",
                  activeTask.isPinned
                    ? "bg-indigo-50 border-indigo-200 text-indigo-600"
                    : "border-slate-200 text-slate-400 hover:bg-slate-50"
                )}
                title="ピン留め"
              >
                <Pin size={15} className={activeTask.isPinned ? "rotate-45" : ""} />
              </button>
            </div>
          </div>

          {/* Priority / Category Selector & Deadline Strip */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50/70 p-3 rounded-xl border border-slate-100">
            {/* Category / Slot Switcher */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <Tag size={11} />
                ステータス / スロット
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onMoveTask(activeTask.id, 'Urgent')}
                  className={cn(
                    "flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 border",
                    activeTask.category === 'Urgent'
                      ? "bg-red-500 text-white border-red-600 shadow-xs"
                      : "bg-white text-slate-600 border-slate-200 hover:border-red-300"
                  )}
                >
                  <span className={cn("w-2 h-2 rounded-full", activeTask.category === 'Urgent' ? "bg-white" : "bg-red-500")} />
                  Focus (Urgent)
                </button>
                <button
                  type="button"
                  onClick={() => onMoveTask(activeTask.id, 'Focus')}
                  className={cn(
                    "flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 border",
                    activeTask.category === 'Focus'
                      ? "bg-indigo-600 text-white border-indigo-700 shadow-xs"
                      : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"
                  )}
                >
                  <span className={cn("w-2 h-2 rounded-full", activeTask.category === 'Focus' ? "bg-white" : "bg-indigo-500")} />
                  ToDo (Backlog)
                </button>
              </div>
            </div>

            {/* Deadline settings */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <Clock size={11} />
                  締切 (Deadline)
                </label>
                {draftDeadline && (
                  <button
                    type="button"
                    onClick={() => handleDeadlineChange('')}
                    className="text-[10px] font-bold text-red-500 hover:underline"
                  >
                    クリア
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type={draftIsAllDay ? "date" : "datetime-local"}
                  value={draftDeadline}
                  onChange={(e) => handleDeadlineChange(e.target.value)}
                  className="flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    const nextAllDay = !draftIsAllDay;
                    setDraftIsAllDay(nextAllDay);
                    handleDeadlineChange(draftDeadline, nextAllDay);
                  }}
                  className={cn(
                    "px-2 py-1 rounded-lg border text-[10px] font-bold transition-all shrink-0",
                    draftIsAllDay
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                  )}
                >
                  {draftIsAllDay ? "終日" : "時刻"}
                </button>
              </div>
            </div>
          </div>

          {/* Notes / Memos Area */}
          <div className="flex-1 flex flex-col gap-1 min-h-[120px]">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <FileText size={13} className="text-indigo-500" />
                メモ・コンテキスト・サブタスク
              </label>
              <span className="text-[10px] text-slate-400">フォーカスを外すと自動保存</span>
            </div>
            <textarea
              value={draftNotes}
              onChange={(e) => setDraftNotes(e.target.value)}
              onBlur={() => {
                if (draftNotes !== (activeTask.notes || '')) {
                  handleSaveField({ notes: draftNotes });
                }
              }}
              placeholder="タスクに関する背景、チェックリスト、次のアクションなどのメモ..."
              className="w-full flex-1 min-h-[100px] bg-slate-50/50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 leading-relaxed outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all font-mono"
            />
          </div>

          {/* Reference URLs */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <LinkIcon size={13} className="text-indigo-500" />
                参考URL / ドキュメント
              </label>
              <button
                type="button"
                onClick={handleAddUrl}
                className="text-[11px] font-bold text-indigo-600 hover:underline"
              >
                + リンク追加
              </button>
            </div>

            <div className="space-y-1.5">
              {draftUrls.map((url, i) => (
                <div key={i} className="flex items-center gap-1.5 group">
                  <div className="relative flex-1">
                    <input
                      type="url"
                      placeholder="https://..."
                      value={url}
                      onChange={(e) => handleUrlChange(i, e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-700 outline-none focus:bg-white focus:ring-1 focus:ring-indigo-500"
                    />
                    {url.trim() && (
                      <a
                        href={url.startsWith('http') ? url : `https://${url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-indigo-500 hover:text-indigo-700"
                        title="リンクを開く"
                      >
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                  {(draftUrls.length > 1 || url.trim()) && (
                    <button
                      type="button"
                      onClick={() => handleRemoveUrl(i)}
                      className="p-1 text-slate-300 hover:text-red-500 transition-colors"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Footer Metadata & Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-3 text-[10px]">
              <span>作成: {format(activeTask.createdAt, 'MM/dd HH:mm')}</span>
              <span>更新: {activeTask.updatedAt ? format(activeTask.updatedAt, 'MM/dd HH:mm') : '-'}</span>
            </div>

            <div className="flex items-center gap-1.5">
              {onDuplicateTask && (
                <button
                  type="button"
                  onClick={() => onDuplicateTask(activeTask)}
                  className="px-2 py-1 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-medium"
                >
                  <Copy size={11} />
                  複製
                </button>
              )}
              <button
                type="button"
                onClick={() => onMoveTask(activeTask.id, 'Archive')}
                className="px-2 py-1 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-medium"
              >
                <Archive size={11} />
                アーカイブ
              </button>
              <button
                type="button"
                onClick={() => onDeleteTask(activeTask.id)}
                className="px-2 py-1 text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-medium"
              >
                <Trash2 size={11} />
                ゴミ箱へ
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Empty State */
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-400 bg-slate-50/40">
          <div className="w-12 h-12 bg-white rounded-2xl shadow-sm border border-slate-200/80 flex items-center justify-center text-indigo-500 mb-2">
            <FileText size={22} strokeWidth={1.5} />
          </div>
          <h3 className="text-xs font-bold text-slate-700 mb-1">
            タスクが選択されていません
          </h3>
          <p className="text-[11px] text-slate-400 max-w-xs leading-relaxed mb-3">
            左側のエクスプローラーやFocusエリアからタスクをクリックして開きます。
          </p>
          {isSplit && (
            <span className="text-[10px] text-indigo-500 bg-indigo-50 px-2 py-1 rounded border border-indigo-100">
              ペイン {paneIndex + 1} (アクティブ: {isActivePane ? 'Yes' : 'No'})
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export const TaskTabsDetail: React.FC<TaskTabsDetailProps> = ({
  tasks,
  openTaskIds,
  activeTaskId,
  onSelectTab,
  onCloseTab,
  onCloseAllTabs,
  onUpdateTask,
  onMoveTask,
  onDeleteTask,
  onToggleDone,
  onToggleStar,
  onTogglePin,
  onDuplicateTask,
  deadlineThresholdDays = 3,
  t
}) => {
  // Split Editor State
  const [isSplit, setIsSplit] = useState<boolean>(() => {
    try {
      return localStorage.getItem('navfor_editor_split') === 'true';
    } catch {
      return false;
    }
  });

  const [activePaneIndex, setActivePaneIndex] = useState<0 | 1>(0);

  // Secondary Pane Tabs & Active state
  const [pane1OpenTaskIds, setPane1OpenTaskIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('navfor_pane1_tabs');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [pane1ActiveTaskId, setPane1ActiveTaskId] = useState<string | null>(null);

  // Save Split state
  const handleToggleSplit = () => {
    const nextSplit = !isSplit;
    setIsSplit(nextSplit);
    try {
      localStorage.setItem('navfor_editor_split', String(nextSplit));
    } catch (e) {
      console.error(e);
    }
    // If splitting and pane 1 has no tabs, clone active task to pane 1 or select one
    if (nextSplit && pane1OpenTaskIds.length === 0 && activeTaskId) {
      setPane1OpenTaskIds([activeTaskId]);
      setPane1ActiveTaskId(activeTaskId);
    }
  };

  const handleCloseSplit = () => {
    setIsSplit(false);
    setActivePaneIndex(0);
    try {
      localStorage.setItem('navfor_editor_split', 'false');
    } catch (e) {
      console.error(e);
    }
  };

  // When activeTaskId from props changes (e.g. from Explorer tree or Focus click)
  useEffect(() => {
    if (!activeTaskId) return;

    if (isSplit && activePaneIndex === 1) {
      // Open in secondary pane
      if (!pane1OpenTaskIds.includes(activeTaskId)) {
        const next = [...pane1OpenTaskIds, activeTaskId];
        setPane1OpenTaskIds(next);
        try {
          localStorage.setItem('navfor_pane1_tabs', JSON.stringify(next));
        } catch (e) {
          console.error(e);
        }
      }
      setPane1ActiveTaskId(activeTaskId);
    }
    // If activePaneIndex === 0, the prop change is naturally handled by onSelectTab & openTaskIds in App.tsx
  }, [activeTaskId, isSplit, activePaneIndex]);

  // Secondary pane tab handlers
  const handleSelectPane1Tab = (taskId: string) => {
    setActivePaneIndex(1);
    setPane1ActiveTaskId(taskId);
  };

  const handleClosePane1Tab = (taskId: string) => {
    const next = pane1OpenTaskIds.filter(id => id !== taskId);
    setPane1OpenTaskIds(next);
    try {
      localStorage.setItem('navfor_pane1_tabs', JSON.stringify(next));
    } catch (e) {
      console.error(e);
    }
    if (pane1ActiveTaskId === taskId) {
      setPane1ActiveTaskId(next.length > 0 ? next[next.length - 1] : null);
    }
  };

  const handleCloseAllPane1Tabs = () => {
    setPane1OpenTaskIds([]);
    setPane1ActiveTaskId(null);
    try {
      localStorage.setItem('navfor_pane1_tabs', JSON.stringify([]));
    } catch (e) {
      console.error(e);
    }
  };

  // Move tab from Pane 0 -> Pane 1
  const handleMoveTabToPane1 = (taskId: string) => {
    if (!pane1OpenTaskIds.includes(taskId)) {
      const next = [...pane1OpenTaskIds, taskId];
      setPane1OpenTaskIds(next);
      try {
        localStorage.setItem('navfor_pane1_tabs', JSON.stringify(next));
      } catch (e) {
        console.error(e);
      }
    }
    setPane1ActiveTaskId(taskId);
    setActivePaneIndex(1);
    onCloseTab(taskId);
  };

  // Move tab from Pane 1 -> Pane 0
  const handleMoveTabToPane0 = (taskId: string) => {
    if (!openTaskIds.includes(taskId)) {
      onSelectTab(taskId);
    }
    setActivePaneIndex(0);
    handleClosePane1Tab(taskId);
  };

  return (
    <div className="flex-1 h-full min-h-0 flex flex-row gap-2 overflow-hidden">
      {/* Pane 0 (Primary / Left) */}
      <SinglePaneView
        paneIndex={0}
        isActivePane={activePaneIndex === 0}
        isSplit={isSplit}
        openTaskIds={openTaskIds}
        activeTaskId={activeTaskId}
        tasks={tasks}
        onFocusPane={() => setActivePaneIndex(0)}
        onSelectTab={onSelectTab}
        onCloseTab={onCloseTab}
        onCloseAllTabs={onCloseAllTabs}
        onMoveTabToOtherPane={isSplit ? handleMoveTabToPane1 : undefined}
        onToggleSplit={handleToggleSplit}
        onCloseSplit={undefined}
        onUpdateTask={onUpdateTask}
        onMoveTask={onMoveTask}
        onDeleteTask={(id) => {
          onDeleteTask(id);
          handleClosePane1Tab(id);
        }}
        onToggleDone={onToggleDone}
        onToggleStar={onToggleStar}
        onTogglePin={onTogglePin}
        onDuplicateTask={onDuplicateTask}
        deadlineThresholdDays={deadlineThresholdDays}
        t={t}
      />

      {/* Pane 1 (Secondary / Right) when isSplit is true */}
      {isSplit && (
        <SinglePaneView
          paneIndex={1}
          isActivePane={activePaneIndex === 1}
          isSplit={isSplit}
          openTaskIds={pane1OpenTaskIds}
          activeTaskId={pane1ActiveTaskId}
          tasks={tasks}
          onFocusPane={() => setActivePaneIndex(1)}
          onSelectTab={handleSelectPane1Tab}
          onCloseTab={handleClosePane1Tab}
          onCloseAllTabs={handleCloseAllPane1Tabs}
          onMoveTabToOtherPane={handleMoveTabToPane0}
          onToggleSplit={handleToggleSplit}
          onCloseSplit={handleCloseSplit}
          onUpdateTask={onUpdateTask}
          onMoveTask={onMoveTask}
          onDeleteTask={(id) => {
            onDeleteTask(id);
            handleClosePane1Tab(id);
          }}
          onToggleDone={onToggleDone}
          onToggleStar={onToggleStar}
          onTogglePin={onTogglePin}
          onDuplicateTask={onDuplicateTask}
          deadlineThresholdDays={deadlineThresholdDays}
          t={t}
        />
      )}
    </div>
  );
};
