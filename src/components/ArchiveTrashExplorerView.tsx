import React, { useState, useMemo } from 'react';
import { 
  Folder, 
  ChevronRight, 
  ChevronDown, 
  RotateCcw, 
  Trash2, 
  Star, 
  Pin, 
  AlertTriangle, 
  CheckCircle2, 
  Circle, 
  ChevronsDownUp, 
  ChevronsUpDown, 
  Clock, 
  Search, 
  FileText,
  Calendar as CalendarIcon,
  ExternalLink,
  Zap
} from 'lucide-react';
import { Task, Category } from '../types';
import { cn, tr } from '../lib/utils';
import { differenceInDays, format } from 'date-fns';

interface FolderNode {
  name: string;
  fullPath: string;
  subfolders: Map<string, FolderNode>;
  tasks: Task[];
}

interface ArchiveTrashExplorerViewProps {
  mode: 'archive' | 'trash';
  tasks: Task[];
  onRestore: (taskId: string, targetCategory?: Category) => void;
  onPermanentDelete: (taskId: string) => void;
  onMoveToTrash?: (taskId: string) => void;
  onSelectTask: (task: Task) => void;
  onToggleStar?: (taskId: string) => void;
  onTogglePin?: (taskId: string) => void;
  trashCleanupThresholdDays?: number;
  archiveThresholdDays?: number;
  activeTaskId?: string | null;
  onEmptyTrash?: () => void;
  onCleanupArchive?: () => void;
  language?: string;
  t: (key: string) => string;
}

export const ArchiveTrashExplorerView: React.FC<ArchiveTrashExplorerViewProps> = ({
  mode,
  tasks,
  onRestore,
  onPermanentDelete,
  onMoveToTrash,
  onSelectTask,
  onToggleStar,
  onTogglePin,
  trashCleanupThresholdDays = 30,
  archiveThresholdDays = 30,
  activeTaskId,
  onEmptyTrash,
  onCleanupArchive,
  language = 'en',
  t
}) => {
  const L = (ja: string, en: string, fr: string) => tr(language, ja, en, fr);
  const isTrash = mode === 'trash';

  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [timeFilter, setTimeFilter] = useState<'all' | '1w' | '2w' | '1m' | '3m'>('all');

  const now = Date.now();

  // Helper to calculate days left before auto-purge in Trash
  const getTrashPurgeInfo = (task: Task) => {
    if (trashCleanupThresholdDays === 99999) {
      return { isNearing: false, daysLeft: null, isExpired: false };
    }
    const inactiveDays = differenceInDays(now, task.updatedAt || task.createdAt);
    const daysLeft = trashCleanupThresholdDays - inactiveDays;
    const isNearing = daysLeft <= 3;
    const isExpired = daysLeft <= 0;
    return { isNearing, daysLeft: Math.max(0, daysLeft), isExpired };
  };

  // Helper to calculate archive days
  const getArchiveInfo = (task: Task) => {
    if (archiveThresholdDays === 99999) {
      return { isNearing: false, daysLeft: null };
    }
    const inactiveDays = differenceInDays(now, task.updatedAt || task.createdAt);
    const daysLeft = archiveThresholdDays - inactiveDays;
    return { isNearing: daysLeft <= 3, daysLeft: Math.max(0, daysLeft) };
  };

  // Filter tasks based on search and timeFilter
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      // Time filter
      if (timeFilter !== 'all') {
        const age = now - (task.updatedAt || task.createdAt);
        const dayMs = 86400000;
        if (timeFilter === '1w' && age < 7 * dayMs) return false;
        if (timeFilter === '2w' && age < 14 * dayMs) return false;
        if (timeFilter === '1m' && age < 30 * dayMs) return false;
        if (timeFilter === '3m' && age < 90 * dayMs) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = task.title.toLowerCase().includes(q);
        const matchProject = task.project.toLowerCase().includes(q);
        const matchNotes = task.notes?.toLowerCase().includes(q);
        if (!matchTitle && !matchProject && !matchNotes) return false;
      }

      return true;
    });
  }, [tasks, timeFilter, searchQuery, now]);

  // Count items nearing purge
  const nearingPurgeCount = useMemo(() => {
    if (!isTrash) return 0;
    return filteredTasks.filter(t => getTrashPurgeInfo(t).isNearing).length;
  }, [filteredTasks, isTrash, trashCleanupThresholdDays]);

  // Build hierarchical folder tree
  const rootNode = useMemo(() => {
    const root: FolderNode = {
      name: 'root',
      fullPath: '',
      subfolders: new Map(),
      tasks: []
    };

    const getOrCreateFolder = (pathParts: string[]): FolderNode => {
      let current = root;
      let accPath = '';
      for (const part of pathParts) {
        accPath = accPath ? `${accPath}/${part}` : part;
        if (!current.subfolders.has(part)) {
          current.subfolders.set(part, {
            name: part,
            fullPath: accPath,
            subfolders: new Map(),
            tasks: []
          });
        }
        current = current.subfolders.get(part)!;
      }
      return current;
    };

    filteredTasks.forEach(task => {
      const projectRaw = task.project || 'General';
      const parts = projectRaw.split(/[\/\\]/).map(p => p.trim()).filter(Boolean);
      const folder = getOrCreateFolder(parts.length > 0 ? parts : ['General']);
      folder.tasks.push(task);
    });

    return root;
  }, [filteredTasks]);

  const toggleCollapse = (path: string) => {
    setCollapsedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const collapseAll = () => {
    const allPaths = new Set<string>();
    const collect = (node: FolderNode) => {
      if (node.fullPath) allPaths.add(node.fullPath);
      for (const sub of node.subfolders.values()) collect(sub);
    };
    collect(rootNode);
    setCollapsedPaths(allPaths);
  };

  const expandAll = () => {
    setCollapsedPaths(new Set());
  };

  // Count all tasks in folder (including subfolders)
  const countFolderTasks = (node: FolderNode): { total: number; nearing: number } => {
    let total = node.tasks.length;
    let nearing = isTrash ? node.tasks.filter(t => getTrashPurgeInfo(t).isNearing).length : 0;
    for (const sub of node.subfolders.values()) {
      const c = countFolderTasks(sub);
      total += c.total;
      nearing += c.nearing;
    }
    return { total, nearing };
  };

  // Render a task item row (Explorer style)
  const renderTaskRow = (task: Task, depth: number) => {
    const trashInfo = isTrash ? getTrashPurgeInfo(task) : null;
    const isNearingPurge = isTrash && trashInfo?.isNearing;
    const isSelected = activeTaskId === task.id;

    return (
      <div
        key={task.id}
        onClick={() => onSelectTask(task)}
        className={cn(
          "group relative flex items-center justify-between gap-2.5 px-3 py-2 rounded-lg text-xs cursor-pointer transition-all border select-none mb-1",
          isSelected
            ? "bg-indigo-50 border-indigo-300 ring-2 ring-indigo-500/50 text-indigo-950 font-medium"
            : isNearingPurge 
              ? "bg-red-50/70 hover:bg-red-100/70 border-red-200/80 text-red-950 font-medium" 
              : "bg-white hover:bg-slate-50 border-slate-200/70 text-slate-700"
        )}
        style={{ marginLeft: `${Math.max(0, depth * 14)}px` }}
      >
        {/* Left side: Icon, Status, Title */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* Status Icon */}
          <div className="shrink-0">
            {isTrash ? (
              <Trash2 size={13} className={isNearingPurge ? "text-red-500 animate-pulse" : "text-slate-400"} />
            ) : task.isDone ? (
              <CheckCircle2 size={13} className="text-emerald-500" />
            ) : (
              <Circle size={13} className="text-slate-400" />
            )}
          </div>

          {/* Task Title */}
          <span className={cn(
            "truncate text-[12px] leading-tight",
            task.isDone && !isTrash && "line-through text-slate-400",
            isNearingPurge && "text-red-900 font-semibold"
          )}>
            {task.title}
          </span>

          {/* Notes indicator icon */}
          {task.notes && task.notes.trim() && (
            <span className="text-slate-300 group-hover:text-slate-500 shrink-0" title={L("メモあり", "Has notes", "Contient des notes")}>
              <FileText size={11} />
            </span>
          )}

          {/* Task Deadline if exists */}
          {task.deadline && (
            <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded flex items-center gap-1 shrink-0">
              <CalendarIcon size={10} />
              <span>{format(new Date(task.deadline), 'MM/dd')}</span>
            </span>
          )}
        </div>

        {/* Middle: Nearing Purge Indicator / Remaining days */}
        <div className="flex items-center gap-1.5 shrink-0">
          {isTrash && trashInfo && (
            trashInfo.isNearing ? (
              <span 
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-red-500 text-white shadow-xs animate-pulse tracking-tight"
                title={L(`間もなく自動クリーンアップにより完全消去されます (残り ${trashInfo.daysLeft} 日)`, `Scheduled for permanent delete soon (${trashInfo.daysLeft}d left)`, `Suppression définitive imminente (${trashInfo.daysLeft}j restants)`)}
              >
                <AlertTriangle size={10} strokeWidth={2.5} />
                <span>
                  {trashInfo.daysLeft === 0
                    ? L('⚠️ 間もなく完全削除', '⚠️ Purging today', '⚠️ Suppression auj.')
                    : L(`⚠️ あと${trashInfo.daysLeft}日で完全削除`, `⚠️ Deleting in ${trashInfo.daysLeft}d`, `⚠️ Suppression dans ${trashInfo.daysLeft}j`)}
                </span>
              </span>
            ) : trashInfo.daysLeft !== null ? (
              <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full font-mono">
                {L(`残り${trashInfo.daysLeft}日`, `${trashInfo.daysLeft}d left`, `${trashInfo.daysLeft}j restants`)}
              </span>
            ) : null
          )}

          {/* Archive date/time */}
          {!isTrash && task.updatedAt && (
            <span className="text-[10px] text-slate-400 hidden sm:inline-block font-mono">
              {format(new Date(task.updatedAt), 'yyyy/MM/dd')}
            </span>
          )}
        </div>

        {/* Right side Action Buttons */}
        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          {/* Restore Button */}
          <button
            type="button"
            onClick={() => onRestore(task.id, isTrash ? 'Backlog' as any : 'Focus')}
            className="p-1 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded transition-colors"
            title={isTrash ? L("ToDoリストへ復元", "Restore to ToDo List", "Restaurer vers la liste ToDo") : L("アクティブタスクへ復元", "Restore to Active Tasks", "Restaurer vers les tâches actives")}
          >
            <RotateCcw size={13} />
          </button>

          {/* Permanent Delete (Trash mode) or Move to Trash (Archive mode) */}
          {isTrash ? (
            <button
              type="button"
              onClick={() => onPermanentDelete(task.id)}
              className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded transition-colors"
              title={L("完全に消去 (復元不可)", "Delete permanently", "Supprimer définitivement")}
            >
              <Trash2 size={13} />
            </button>
          ) : (
            onMoveToTrash && (
              <button
                type="button"
                onClick={() => onMoveToTrash(task.id)}
                className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded transition-colors"
                title={L("ゴミ箱へ移動", "Move to Trash", "Mettre à la corbeille")}
              >
                <Trash2 size={13} />
              </button>
            )
          )}

          {/* Star toggle (Archive only) */}
          {!isTrash && onToggleStar && (
            <button
              type="button"
              onClick={() => onToggleStar(task.id)}
              className="p-1 hover:bg-amber-50 text-slate-300 hover:text-amber-500 rounded transition-colors"
              title={task.isStarred ? L("スター解除", "Unstar", "Retirer des favoris") : L("スター", "Star", "Favori")}
            >
              <Star size={13} className={task.isStarred ? "text-amber-500 fill-amber-500" : ""} />
            </button>
          )}

          {/* Pin toggle (Archive only) */}
          {!isTrash && onTogglePin && (
            <button
              type="button"
              onClick={() => onTogglePin(task.id)}
              className="p-1 hover:bg-indigo-50 text-slate-300 hover:text-indigo-600 rounded transition-colors"
              title={task.isPinned ? L("ピン留め解除", "Unpin", "Désépingler") : L("ピン留め", "Pin", "Épingler")}
            >
              <Pin size={13} className={task.isPinned ? "text-indigo-600 fill-indigo-600 rotate-45" : ""} />
            </button>
          )}
        </div>
      </div>
    );
  };

  // Recursive render folder node
  const renderFolder = (node: FolderNode, depth = 0) => {
    const isCollapsed = collapsedPaths.has(node.fullPath);
    const { total, nearing } = countFolderTasks(node);

    if (total === 0) return null;

    return (
      <div key={node.fullPath || 'root'} className="space-y-1">
        {/* Folder Header */}
        <div
          onClick={() => toggleCollapse(node.fullPath)}
          className={cn(
            "group sticky top-0 z-10 flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer transition-all select-none border-b",
            isTrash 
              ? "bg-red-50/95 backdrop-blur-md border-red-100 hover:bg-red-100/80 text-red-900" 
              : "bg-slate-100/95 backdrop-blur-md border-slate-200 hover:bg-slate-200/80 text-slate-800"
          )}
          style={{ marginLeft: `${Math.max(0, depth * 12)}px` }}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-slate-400 group-hover:text-slate-700 transition-transform">
              {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
            </span>
            <Folder size={14} className={isTrash ? "text-red-400" : "text-amber-500"} />
            <span className="text-xs font-bold truncate">
              {node.name}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              ({total})
            </span>
            {isTrash && nearing > 0 && (
              <span className="ml-1 px-1.5 py-0.2 text-[9px] font-black bg-red-100 text-red-700 border border-red-200 rounded-full flex items-center gap-0.5">
                <AlertTriangle size={9} />
                <span>{L(`廃棄間近 ${nearing}`, `${nearing} near purge`, `${nearing} bientôt supprimé(s)`)}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
              {isCollapsed ? L("クリックで展開", "Click to expand", "Cliquer pour développer") : L("クリックで折畳", "Click to collapse", "Cliquer pour réduire")}
            </span>
          </div>
        </div>

        {/* Folder Contents (Tasks & Subfolders) */}
        {!isCollapsed && (
          <div className="pt-0.5 pb-1">
            {/* Subfolders */}
            {(Array.from(node.subfolders.values()) as FolderNode[])
              .sort((a, b) => a.name.localeCompare(b.name))
              .map(subNode => renderFolder(subNode, depth + 1))}

            {/* Tasks in this folder */}
            {node.tasks.map(task => renderTaskRow(task, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const rootFolderList: FolderNode[] = (Array.from(rootNode.subfolders.values()) as FolderNode[]).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="flex flex-col h-full overflow-hidden bg-transparent">
      {/* Explorer Top Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-3 border-b border-slate-200/80 gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-2 rounded-xl flex items-center justify-center shadow-sm",
            isTrash ? "bg-red-100 text-red-600" : "bg-indigo-100 text-indigo-600"
          )}>
            {isTrash ? <Trash2 size={20} /> : <FileText size={20} />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-800 text-base">
                {isTrash ? t('Trash') : t('Archive')}
              </h3>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                {filteredTasks.length} {L('件', 'items', 'éléments')}
              </span>
              {isTrash && nearingPurgeCount > 0 && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200 flex items-center gap-1 animate-pulse">
                  <AlertTriangle size={11} />
                  <span>{L(`廃棄間近: ${nearingPurgeCount}件`, `${nearingPurgeCount} purging soon`, `${nearingPurgeCount} bientôt supprimé(s)`)}</span>
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              {isTrash 
                ? (trashCleanupThresholdDays === 99999 
                    ? L('ゴミ箱内のタスクは無期限に保持されます', 'Trash is permanently kept', 'Les éléments de la corbeille sont conservés indéfiniment') 
                    : L(`${trashCleanupThresholdDays}日後に自動で完全に消去されます`, `Permanently deleted after ${trashCleanupThresholdDays} days`, `Supprimé définitivement après ${trashCleanupThresholdDays} jours`))
                : (archiveThresholdDays === 99999
                    ? L('アーカイブされたタスク一覧', 'Archived tasks list', 'Liste des tâches archivées')
                    : L(`${archiveThresholdDays}日非アクティブでゴミ箱へ移動します`, `Moved to trash after ${archiveThresholdDays} days`, `Déplacé dans la corbeille après ${archiveThresholdDays} jours`))
              }
            </p>
          </div>
        </div>

        {/* Toolbar Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search box */}
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={L("タスクやプロジェクトを検索...", "Search tasks...", "Rechercher des tâches...")}
              className="pl-8 pr-3 py-1 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400 w-36 sm:w-48 text-slate-700 shadow-2xs"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Time Filter Select */}
          <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 text-[11px]">
            <button
              onClick={() => setTimeFilter('all')}
              className={cn("px-2 py-0.5 rounded font-medium transition-colors", timeFilter === 'all' ? "bg-slate-100 text-slate-800 font-bold" : "text-slate-500 hover:text-slate-800")}
            >
              {L('すべて', 'All', 'Tout')}
            </button>
            <button
              onClick={() => setTimeFilter('1w')}
              className={cn("px-2 py-0.5 rounded font-medium transition-colors", timeFilter === '1w' ? "bg-slate-100 text-slate-800 font-bold" : "text-slate-500 hover:text-slate-800")}
            >
              {L('1週以上', '>1w', '>1s')}
            </button>
            <button
              onClick={() => setTimeFilter('1m')}
              className={cn("px-2 py-0.5 rounded font-medium transition-colors", timeFilter === '1m' ? "bg-slate-100 text-slate-800 font-bold" : "text-slate-500 hover:text-slate-800")}
            >
              {L('1ヶ月以上', '>1m', '>1m')}
            </button>
          </div>

          {/* Expand/Collapse All */}
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5">
            <button
              onClick={expandAll}
              className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-800 transition-colors"
              title={L("すべてのフォルダを展開", "Expand all", "Tout développer")}
            >
              <ChevronsUpDown size={13} />
            </button>
            <button
              onClick={collapseAll}
              className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-800 transition-colors"
              title={L("すべてのフォルダを折りたたむ", "Collapse all", "Tout réduire")}
            >
              <ChevronsDownUp size={13} />
            </button>
          </div>

          {/* Batch clean actions */}
          {isTrash && onEmptyTrash && filteredTasks.length > 0 && (
            <button
              onClick={onEmptyTrash}
              className="px-3 py-1 bg-red-50 hover:bg-red-600 text-red-600 hover:text-white border border-red-200 rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5"
              title={L("ゴミ箱を完全に空にする", "Empty Trash", "Vider la corbeille")}
            >
              <Zap size={12} />
              <span>{t('EmptyTrash')}</span>
            </button>
          )}

          {!isTrash && onCleanupArchive && filteredTasks.length > 0 && (
            <button
              onClick={onCleanupArchive}
              className="px-3 py-1 bg-slate-50 hover:bg-red-50 text-slate-600 hover:text-red-600 border border-slate-200 hover:border-red-200 rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5"
              title={L("古いアーカイブをゴミ箱へ移動", "Move old archived to trash", "Déplacer les anciennes archives dans la corbeille")}
            >
              <Trash2 size={12} />
              <span>{L("一括クリーンアップ", "Cleanup", "Nettoyage")}</span>
            </button>
          )}
        </div>
      </div>

      {/* Explorer Tree List Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 pb-16 space-y-3 min-h-0">
        {filteredTasks.length === 0 ? (
          <div className="py-24 flex flex-col items-center justify-center text-slate-300 opacity-60">
            {isTrash ? <Trash2 size={48} strokeWidth={1} /> : <FileText size={48} strokeWidth={1} />}
            <span className="text-xs font-bold mt-3 uppercase tracking-wider text-slate-400">
              {searchQuery 
                ? L('一致するタスクがありません', 'No matching tasks found', 'Aucune tâche correspondante')
                : (isTrash ? t('TrashEmpty') : t('ArchiveEmpty'))
              }
            </span>
          </div>
        ) : (
          rootFolderList.map(folderNode => renderFolder(folderNode, 0))
        )}
      </div>
    </div>
  );
};
