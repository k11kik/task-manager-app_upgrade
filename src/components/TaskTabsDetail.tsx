import React, { useState, useEffect, useMemo } from 'react';
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
  Save
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
  // Current active task
  const activeTask = useMemo(() => {
    return tasks.find(t => t.id === activeTaskId) || null;
  }, [tasks, activeTaskId]);

  // Local draft state for active task editing
  const [draftTitle, setDraftTitle] = useState('');
  const [draftProject, setDraftProject] = useState('');
  const [draftNotes, setDraftNotes] = useState('');
  const [draftUrls, setDraftUrls] = useState<string[]>([]);
  const [draftDeadline, setDraftDeadline] = useState('');
  const [draftIsAllDay, setDraftIsAllDay] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [savedIndicator, setSavedIndicator] = useState(false);

  // Sync draft when activeTask changes
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

  // Save changes to task
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

  // Open tasks mapped
  const openTasks = useMemo(() => {
    return openTaskIds
      .map(id => tasks.find(t => t.id === id))
      .filter((t): t is Task => t !== undefined);
  }, [openTaskIds, tasks]);

  // Breadcrumb segments from project path
  const breadcrumbSegments = useMemo(() => {
    if (!activeTask) return [];
    const parts = (activeTask.project || 'General').split(/[\/\\]/).map(p => p.trim()).filter(Boolean);
    return parts;
  }, [activeTask?.project]);

  return (
    <div className={cn(
      "flex flex-col flex-1 h-full min-h-0 bg-white border border-slate-200/90 rounded-xl overflow-hidden shadow-xs transition-all",
      isMaximized && "fixed inset-4 z-50 rounded-2xl shadow-2xl"
    )}>
      {/* VS Code-style Tab Bar */}
      <div className="flex items-center justify-between bg-slate-100/90 border-b border-slate-200 overflow-x-auto select-none custom-scrollbar shrink-0 h-9">
        <div className="flex items-center h-full flex-1 overflow-x-auto">
          {openTasks.map(task => {
            const isActive = task.id === activeTaskId;
            return (
              <div
                key={task.id}
                onClick={() => onSelectTab(task.id)}
                className={cn(
                  "group relative flex items-center gap-2 px-3 h-full border-r border-slate-200 text-xs font-medium cursor-pointer transition-colors max-w-[200px] shrink-0",
                  isActive
                    ? "bg-white text-slate-900 border-t-2 border-t-indigo-600 font-semibold shadow-xs"
                    : "text-slate-500 hover:bg-slate-200/60 hover:text-slate-800"
                )}
                title={`${task.project} > ${task.title}`}
              >
                {/* Status Dot / Icon */}
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

                {/* Star indicator on tab */}
                {task.isStarred && (
                  <Star size={10} fill="currentColor" className="text-amber-400 shrink-0" />
                )}

                {/* Close Tab Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(task.id);
                  }}
                  className="p-0.5 rounded hover:bg-slate-300/80 text-slate-400 hover:text-slate-700 opacity-60 group-hover:opacity-100 transition-opacity ml-1 shrink-0"
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

        {/* Tab Bar Actions */}
        <div className="flex items-center gap-1 px-2 shrink-0">
          {savedIndicator && (
            <span className="text-[10px] text-emerald-600 font-medium animate-pulse flex items-center gap-1">
              <Save size={10} /> 保存済
            </span>
          )}
          {openTasks.length > 0 && (
            <button
              onClick={onCloseAllTabs}
              className="px-2 py-0.5 text-[10px] text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded transition-colors"
              title="すべてのタブを閉じる"
            >
              すべて閉じる
            </button>
          )}
          <button
            onClick={() => setIsMaximized(!isMaximized)}
            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded transition-colors"
            title={isMaximized ? "縮小" : "最大化"}
          >
            {isMaximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
        </div>
      </div>

      {/* Detail Content Area */}
      {activeTask ? (
        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 flex flex-col gap-5">
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
                placeholder="プロジェクト/サブプロジェクト"
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
                <CheckCircle2 size={24} className="text-emerald-500" />
              ) : (
                <Circle size={24} className="hover:text-indigo-500" />
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
                  "w-full text-lg font-bold text-slate-900 border-0 border-b border-transparent hover:border-slate-200 focus:border-indigo-500 outline-none bg-transparent transition-all resize-none leading-snug py-0.5",
                  activeTask.isDone && "line-through text-slate-400"
                )}
              />
            </div>

            {/* Quick action buttons on title row */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => onToggleStar(activeTask.id)}
                className={cn(
                  "p-2 rounded-lg transition-colors border",
                  activeTask.isStarred
                    ? "bg-amber-50 border-amber-200 text-amber-500"
                    : "border-slate-200 text-slate-400 hover:bg-slate-50"
                )}
                title="スター切り替え"
              >
                <Star size={16} fill={activeTask.isStarred ? "currentColor" : "none"} />
              </button>

              <button
                onClick={() => onTogglePin(activeTask.id)}
                className={cn(
                  "p-2 rounded-lg transition-colors border",
                  activeTask.isPinned
                    ? "bg-indigo-50 border-indigo-200 text-indigo-600"
                    : "border-slate-200 text-slate-400 hover:bg-slate-50"
                )}
                title="ピン留め"
              >
                <Pin size={16} className={activeTask.isPinned ? "rotate-45" : ""} />
              </button>
            </div>
          </div>

          {/* Priority / Category Selector & Deadline Strip */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/70 p-4 rounded-xl border border-slate-100">
            {/* Category / Slot Switcher */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <Tag size={11} />
                ステータス / スロット
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onMoveTask(activeTask.id, 'Urgent')}
                  className={cn(
                    "flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 border",
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
                    "flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 border",
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
            <div className="space-y-1.5">
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
              <div className="flex items-center gap-2">
                <input
                  type={draftIsAllDay ? "date" : "datetime-local"}
                  value={draftDeadline}
                  onChange={(e) => handleDeadlineChange(e.target.value)}
                  className="flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    const nextAllDay = !draftIsAllDay;
                    setDraftIsAllDay(nextAllDay);
                    handleDeadlineChange(draftDeadline, nextAllDay);
                  }}
                  className={cn(
                    "px-2 py-1.5 rounded-lg border text-[10px] font-bold transition-all shrink-0",
                    draftIsAllDay
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                  )}
                >
                  {draftIsAllDay ? "終日" : "時刻指定"}
                </button>
              </div>
            </div>
          </div>

          {/* Notes / Memos Area */}
          <div className="flex-1 flex flex-col gap-1.5 min-h-[140px]">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <FileText size={13} className="text-indigo-500" />
                メモ・コンテキスト・サブタスク
              </label>
              <span className="text-[10px] text-slate-400">Ctrl+Enter またはフォーカスを外すと保存</span>
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
              className="w-full flex-1 min-h-[120px] bg-slate-50/50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 leading-relaxed outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all font-mono"
            />
          </div>

          {/* Reference URLs */}
          <div className="space-y-2">
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
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:bg-white focus:ring-1 focus:ring-indigo-500"
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
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Footer Metadata & Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-4 text-[10px]">
              <span>作成: {format(activeTask.createdAt, 'yyyy/MM/dd HH:mm')}</span>
              <span>更新: {activeTask.updatedAt ? format(activeTask.updatedAt, 'yyyy/MM/dd HH:mm') : '-'}</span>
            </div>

            <div className="flex items-center gap-2">
              {onDuplicateTask && (
                <button
                  type="button"
                  onClick={() => onDuplicateTask(activeTask)}
                  className="px-2.5 py-1 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-medium"
                >
                  <Copy size={12} />
                  複製
                </button>
              )}
              <button
                type="button"
                onClick={() => onMoveTask(activeTask.id, 'Archive')}
                className="px-2.5 py-1 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-medium"
              >
                <Archive size={12} />
                アーカイブ
              </button>
              <button
                type="button"
                onClick={() => onDeleteTask(activeTask.id)}
                className="px-2.5 py-1 text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-medium"
              >
                <Trash2 size={12} />
                ゴミ箱へ
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Empty State when no task tab is active */
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 bg-slate-50/40">
          <div className="w-14 h-14 bg-white rounded-2xl shadow-sm border border-slate-200/80 flex items-center justify-center text-indigo-500 mb-3">
            <FileText size={26} strokeWidth={1.5} />
          </div>
          <h3 className="text-sm font-bold text-slate-700 mb-1">
            タスクが選択されていません
          </h3>
          <p className="text-xs text-slate-400 max-w-sm leading-relaxed mb-4">
            左側のエクスプローラーツリーからプロジェクトやタスクをクリックすると、VS Codeのようにタブで詳細を開いて確認・編集できます。
          </p>
          <div className="flex items-center gap-2 text-[11px] text-slate-500 bg-white px-3 py-1.5 rounded-lg border border-slate-200">
            <Zap size={12} className="text-amber-500" />
            <span>複数タスクを同時にタブで開いて切り替え可能</span>
          </div>
        </div>
      )}
    </div>
  );
};
