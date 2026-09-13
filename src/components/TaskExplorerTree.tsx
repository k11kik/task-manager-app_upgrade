import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Folder, 
  FolderOpen, 
  ChevronRight, 
  ChevronDown, 
  FileText, 
  Plus, 
  Star, 
  Clock, 
  AlertTriangle, 
  AlertCircle, 
  CheckCircle2, 
  Circle, 
  X, 
  Search, 
  FolderPlus, 
  FilePlus, 
  Filter,
  Layers,
  Sparkles,
  Pin
} from 'lucide-react';
import { Task, Category } from '../types';
import { cn } from '../lib/utils';
import { format } from 'date-fns';

export interface FolderNode {
  name: string;
  fullPath: string;
  subfolders: Map<string, FolderNode>;
  tasks: Task[];
}

interface TaskExplorerTreeProps {
  tasks: Task[];
  activeTaskId: string | null;
  openTaskIds: string[];
  onSelectTask: (taskId: string) => void;
  onAddTask: (taskData: { title: string; project: string; deadline?: number; isAllDay?: boolean; notes?: string }) => Promise<void>;
  onToggleDone: (taskId: string) => void;
  onToggleStar: (taskId: string) => void;
  activeSection: string;
  width: number;
  onWidthChange: (width: number) => void;
  deadlineThresholdDays?: number;
  t: (key: string) => string;
}

export const TaskExplorerTree: React.FC<TaskExplorerTreeProps> = ({
  tasks,
  activeTaskId,
  openTaskIds,
  onSelectTask,
  onAddTask,
  onToggleDone,
  onToggleStar,
  activeSection,
  width,
  onWidthChange,
  deadlineThresholdDays = 3,
  t
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('navfor_collapsed_folders');
      return saved ? new Set<string>(JSON.parse(saved)) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });
  
  // Custom user-created empty folders
  const [customFolders, setCustomFolders] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`navfor_folders_${activeSection}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // State for creating a new task or folder in an inline input
  const [creatingInFolder, setCreatingInFolder] = useState<{ path: string; type: 'task' | 'folder' } | null>(null);
  const [inlineInputValue, setInlineInputValue] = useState('');
  const [isFilterActiveOnly, setIsFilterActiveOnly] = useState(false);

  // Drag resizing logic
  const isResizing = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(width);

  const handleMouseDown = (e: React.MouseEvent) => {
    isResizing.current = true;
    startX.current = e.clientX;
    startWidth.current = width;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizing.current) return;
      const delta = moveEvent.clientX - startX.current;
      const newWidth = Math.max(220, Math.min(580, startWidth.current + delta));
      onWidthChange(newWidth);
    };

    const handleMouseUp = () => {
      isResizing.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleDoubleClickResizer = () => {
    onWidthChange(320);
  };

  const saveCollapsed = (newSet: Set<string>) => {
    setCollapsedFolders(newSet);
    try {
      localStorage.setItem('navfor_collapsed_folders', JSON.stringify(Array.from(newSet)));
    } catch (e) {
      console.error(e);
    }
  };

  const toggleFolder = (path: string) => {
    const next = new Set<string>(collapsedFolders);
    if (next.has(path)) {
      next.delete(path);
    } else {
      next.add(path);
    }
    saveCollapsed(next);
  };

  const expandAll = () => {
    saveCollapsed(new Set<string>());
  };

  const collapseAll = (rootNodes: FolderNode[]) => {
    const allPaths = new Set<string>();
    const collect = (node: FolderNode) => {
      if (node.fullPath) allPaths.add(node.fullPath);
      for (const sub of node.subfolders.values()) {
        collect(sub);
      }
    };
    rootNodes.forEach(collect);
    saveCollapsed(allPaths);
  };

  // Build the hierarchical tree of folders and tasks
  const treeRoot = useMemo(() => {
    const root: FolderNode = {
      name: 'root',
      fullPath: '',
      subfolders: new Map(),
      tasks: []
    };

    // Helper to get or create folder along path
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

    // Ensure custom empty folders are in the tree
    customFolders.forEach(folderPath => {
      if (!folderPath) return;
      const parts = folderPath.split('/').map(p => p.trim()).filter(Boolean);
      getOrCreateFolder(parts);
    });

    // Distribute tasks into folder tree
    // Only show active tasks (Urgent & Focus by default, not Trash unless specified)
    const activeTasks = tasks.filter(t => t.category === 'Urgent' || t.category === 'Focus');

    activeTasks.forEach(task => {
      if (isFilterActiveOnly && task.isDone) return;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = task.title.toLowerCase().includes(q);
        const matchesProject = task.project.toLowerCase().includes(q);
        const matchesNotes = task.notes?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesProject && !matchesNotes) return;
      }

      const projectRaw = task.project || 'General';
      const parts = projectRaw.split(/[\/\\]/).map(p => p.trim()).filter(Boolean);
      const folder = getOrCreateFolder(parts.length > 0 ? parts : ['General']);
      folder.tasks.push(task);
    });

    return root;
  }, [tasks, customFolders, searchQuery, isFilterActiveOnly]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!creatingInFolder || !inlineInputValue.trim()) {
      setCreatingInFolder(null);
      setInlineInputValue('');
      return;
    }

    const { path, type } = creatingInFolder;
    const value = inlineInputValue.trim();

    if (type === 'folder') {
      const newFolderPath = path ? `${path}/${value}` : value;
      if (!customFolders.includes(newFolderPath)) {
        const next = [...customFolders, newFolderPath];
        setCustomFolders(next);
        try {
          localStorage.setItem(`navfor_folders_${activeSection}`, JSON.stringify(next));
        } catch (err) {
          console.error(err);
        }
      }
      // Ensure parent folders are expanded
      if (path && collapsedFolders.has(path)) {
        const next = new Set<string>(collapsedFolders);
        next.delete(path);
        saveCollapsed(next);
      }
    } else {
      // Create task inside this folder
      const targetProject = path || 'General';
      await onAddTask({
        title: value,
        project: targetProject
      });
      // Expand folder
      if (path && collapsedFolders.has(path)) {
        const next = new Set<string>(collapsedFolders);
        next.delete(path);
        saveCollapsed(next);
      }
    }

    setCreatingInFolder(null);
    setInlineInputValue('');
  };

  // Helper to count total tasks under a folder (recursive)
  const countFolderTasks = (node: FolderNode): { total: number; done: number; urgent: number } => {
    let total = node.tasks.length;
    let done = node.tasks.filter(t => t.isDone).length;
    let urgent = node.tasks.filter(t => t.category === 'Urgent' && !t.isDone).length;

    for (const sub of node.subfolders.values()) {
      const subCounts = countFolderTasks(sub);
      total += subCounts.total;
      done += subCounts.done;
      urgent += subCounts.urgent;
    }
    return { total, done, urgent };
  };

  // Render a folder node and its children
  const renderFolder = (node: FolderNode, depth = 0) => {
    const isCollapsed = collapsedFolders.has(node.fullPath);
    const hasChildren = node.subfolders.size > 0 || node.tasks.length > 0;
    const isRootFolder = depth === 0;
    const counts = countFolderTasks(node);

    const isCreatingHere = creatingInFolder?.path === node.fullPath;

    return (
      <div key={node.fullPath} className="select-none">
        {/* Folder row */}
        <div
          className={cn(
            "group relative flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-semibold cursor-pointer transition-colors",
            "hover:bg-slate-200/60 text-slate-700",
            depth === 0 ? "font-bold text-slate-800 tracking-tight" : "text-slate-600 font-medium"
          )}
          style={{ paddingLeft: `${Math.max(6, depth * 14 + 6)}px` }}
          onClick={() => toggleFolder(node.fullPath)}
        >
          {/* Collapse Chevron */}
          <span className="w-3.5 h-3.5 flex items-center justify-center text-slate-400 group-hover:text-slate-600 transition-transform">
            {hasChildren || isCreatingHere ? (
              isCollapsed ? <ChevronRight size={12} strokeWidth={2.5} /> : <ChevronDown size={12} strokeWidth={2.5} />
            ) : (
              <span className="w-1 h-1 rounded-full bg-slate-300" />
            )}
          </span>

          {/* Folder Icon */}
          <span className={cn("transition-colors", isCollapsed ? "text-amber-500/90" : "text-indigo-500")}>
            {isCollapsed ? <Folder size={14} /> : <FolderOpen size={14} />}
          </span>

          {/* Folder Name */}
          <span className="truncate flex-1 text-[12px]">{node.name}</span>

          {/* Task Count Badge */}
          {counts.total > 0 && (
            <span className="text-[10px] font-mono text-slate-400 group-hover:hidden flex items-center gap-1">
              {counts.urgent > 0 && (
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" title={`${counts.urgent} urgent`} />
              )}
              <span>{counts.total - counts.done}/{counts.total}</span>
            </span>
          )}

          {/* Quick action buttons on hover */}
          <div className="hidden group-hover:flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => {
                setCreatingInFolder({ path: node.fullPath, type: 'task' });
                setInlineInputValue('');
                if (isCollapsed) toggleFolder(node.fullPath);
              }}
              className="p-1 rounded hover:bg-slate-300/60 text-slate-500 hover:text-indigo-600 transition-colors"
              title="Add task in this folder"
            >
              <Plus size={12} strokeWidth={2.5} />
            </button>
            <button
              onClick={() => {
                setCreatingInFolder({ path: node.fullPath, type: 'folder' });
                setInlineInputValue('');
                if (isCollapsed) toggleFolder(node.fullPath);
              }}
              className="p-1 rounded hover:bg-slate-300/60 text-slate-500 hover:text-amber-600 transition-colors"
              title="Add subfolder"
            >
              <FolderPlus size={12} />
            </button>
          </div>
        </div>

        {/* Folder Content (Subfolders and Tasks) */}
        {!isCollapsed && (
          <div className="flex flex-col">
            {/* Inline creation input for this folder */}
            {isCreatingHere && (
              <form 
                onSubmit={handleCreateSubmit}
                className="flex items-center gap-1.5 py-1 px-2 my-0.5 bg-indigo-50/70 border border-indigo-200 rounded-md"
                style={{ marginLeft: `${(depth + 1) * 14 + 6}px` }}
              >
                {creatingInFolder.type === 'folder' ? (
                  <Folder size={13} className="text-amber-500 shrink-0" />
                ) : (
                  <FileText size={13} className="text-indigo-500 shrink-0" />
                )}
                <input
                  autoFocus
                  type="text"
                  placeholder={creatingInFolder.type === 'folder' ? 'サブプロジェクト名...' : '新しいタスク名...'}
                  value={inlineInputValue}
                  onChange={(e) => setInlineInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setCreatingInFolder(null);
                      setInlineInputValue('');
                    }
                  }}
                  className="w-full bg-white border border-indigo-200 rounded px-1.5 py-0.5 text-xs outline-none focus:ring-1 focus:ring-indigo-500 font-normal"
                />
                <button 
                  type="submit" 
                  disabled={!inlineInputValue.trim()}
                  className="px-1.5 py-0.5 bg-indigo-600 text-white rounded text-[10px] font-bold disabled:opacity-40"
                >
                  追加
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCreatingInFolder(null);
                    setInlineInputValue('');
                  }}
                  className="p-0.5 text-slate-400 hover:text-slate-600"
                >
                  <X size={12} />
                </button>
              </form>
            )}

            {/* Subfolders */}
            {Array.from(node.subfolders.values())
              .sort((a, b) => a.name.localeCompare(b.name))
              .map(sub => renderFolder(sub, depth + 1))}

            {/* Tasks in this folder */}
            {node.tasks
              .sort((a, b) => {
                // Done tasks sink to bottom
                if (a.isDone !== b.isDone) return a.isDone ? 1 : -1;
                // Urgent first
                if (a.category !== b.category) return a.category === 'Urgent' ? -1 : 1;
                // Starred next
                if (a.isStarred !== b.isStarred) return a.isStarred ? -1 : 1;
                // Earliest deadline next
                if (a.deadline && b.deadline) return a.deadline - b.deadline;
                if (a.deadline) return -1;
                if (b.deadline) return 1;
                // Recency
                return (b.updatedAt || 0) - (a.updatedAt || 0);
              })
              .map(task => renderTaskItem(task, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // Render a task file item in the tree
  const renderTaskItem = (task: Task, depth: number) => {
    const isSelected = activeTaskId === task.id;
    const isOpenInTabs = openTaskIds.includes(task.id);
    const now = Date.now();

    // Deadline indicators
    let deadlineStatus: 'expired' | 'approaching' | 'normal' | null = null;
    let deadlineText = '';
    if (task.deadline) {
      const diffMs = task.deadline - now;
      const diffDays = Math.ceil(diffMs / 86400000);
      if (diffMs < 0) {
        deadlineStatus = 'expired';
        deadlineText = '期限切';
      } else if (diffMs <= deadlineThresholdDays * 86400000) {
        deadlineStatus = 'approaching';
        deadlineText = diffDays <= 0 ? '本日' : `${diffDays}日後`;
      } else {
        deadlineStatus = 'normal';
        deadlineText = format(task.deadline, 'M/d');
      }
    }

    return (
      <div
        key={task.id}
        onClick={() => onSelectTask(task.id)}
        style={{ paddingLeft: `${depth * 14 + 6}px` }}
        className={cn(
          "group relative flex items-center gap-1.5 py-1 px-2 rounded-md text-xs cursor-pointer transition-colors select-none",
          isSelected 
            ? "bg-indigo-100/90 text-indigo-950 font-medium shadow-xs" 
            : isOpenInTabs 
              ? "bg-slate-100/80 text-slate-800 hover:bg-slate-200/70"
              : "text-slate-600 hover:bg-slate-200/50 hover:text-slate-900",
          task.isDone && "opacity-50 line-through text-slate-400"
        )}
      >
        {/* Done / Checkbox status */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleDone(task.id);
          }}
          className="text-slate-400 hover:text-indigo-600 transition-colors shrink-0"
          title={task.isDone ? 'Mark undone' : 'Mark done'}
        >
          {task.isDone ? (
            <CheckCircle2 size={13} className="text-emerald-500" />
          ) : (
            <Circle size={13} className={cn("hover:text-indigo-500", task.category === 'Urgent' ? "text-red-400" : "text-slate-300")} />
          )}
        </button>

        {/* Urgent indicator dot */}
        {task.category === 'Urgent' && !task.isDone && (
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" title="Focus / Urgent" />
        )}

        {/* Task Title */}
        <span className="truncate flex-1 text-[11.5px] leading-tight font-normal">
          {task.title}
        </span>

        {/* Star icon */}
        {task.isStarred ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleStar(task.id);
            }}
            className="text-amber-400 hover:text-amber-500 shrink-0"
            title="Starred"
          >
            <Star size={11} fill="currentColor" />
          </button>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleStar(task.id);
            }}
            className="text-slate-300 hover:text-amber-400 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            title="Star task"
          >
            <Star size={11} />
          </button>
        )}

        {/* Deadline Badge */}
        {task.deadline && !task.isDone && (
          <span
            className={cn(
              "text-[9px] px-1 py-0.2 rounded font-mono font-bold shrink-0 leading-none",
              deadlineStatus === 'expired' && "bg-red-100 text-red-700 border border-red-200",
              deadlineStatus === 'approaching' && "bg-amber-100 text-amber-800 border border-amber-200",
              deadlineStatus === 'normal' && "text-slate-400 font-normal"
            )}
            title={format(task.deadline, 'yyyy/MM/dd HH:mm')}
          >
            {deadlineText}
          </span>
        )}

        {/* Active Indicator Bar on right */}
        {isSelected && (
          <div className="absolute right-0 top-1 bottom-1 w-1 bg-indigo-600 rounded-l" />
        )}
      </div>
    );
  };

  const rootFolderList = useMemo(() => {
    return (Array.from(treeRoot.subfolders.values()) as FolderNode[]).sort((a, b) => a.name.localeCompare(b.name));
  }, [treeRoot]);

  return (
    <aside 
      style={{ width: `${width}px` }}
      className="relative flex flex-col h-full bg-slate-50/90 border-r border-slate-200/90 select-none shrink-0 overflow-hidden"
    >
      {/* VS Code-style Header / Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 bg-white/60">
        <div className="flex items-center gap-1.5 min-w-0">
          <Layers size={14} className="text-indigo-600 shrink-0" />
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 truncate">
            Explorer
          </span>
          <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
            {activeSection}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              setCreatingInFolder({ path: '', type: 'task' });
              setInlineInputValue('');
            }}
            className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-200/60 rounded transition-colors"
            title="新規タスク作成 (ルート)"
          >
            <FilePlus size={14} />
          </button>
          <button
            onClick={() => {
              setCreatingInFolder({ path: '', type: 'folder' });
              setInlineInputValue('');
            }}
            className="p-1 text-slate-400 hover:text-amber-600 hover:bg-slate-200/60 rounded transition-colors"
            title="新規プロジェクト / フォルダ作成"
          >
            <FolderPlus size={14} />
          </button>
          <button
            onClick={expandAll}
            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded transition-colors text-[10px] font-bold"
            title="すべて展開"
          >
            <ChevronDown size={14} />
          </button>
          <button
            onClick={() => collapseAll(rootFolderList)}
            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded transition-colors text-[10px] font-bold"
            title="すべて折りたたむ"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="p-2 border-b border-slate-200/70 bg-white/40 space-y-1.5">
        <div className="relative flex items-center">
          <Search size={12} className="absolute left-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="タスク・フォルダを検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-100/80 border border-slate-200 rounded-md pl-7 pr-7 py-1 text-[11px] text-slate-700 outline-none focus:bg-white focus:ring-1 focus:ring-indigo-500"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-2 text-slate-400 hover:text-slate-600"
            >
              <X size={11} />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between px-1 text-[10px]">
          <button
            onClick={() => setIsFilterActiveOnly(!isFilterActiveOnly)}
            className={cn(
              "flex items-center gap-1 font-semibold transition-colors",
              isFilterActiveOnly ? "text-indigo-600" : "text-slate-400 hover:text-slate-600"
            )}
          >
            <Filter size={10} />
            <span>{isFilterActiveOnly ? '未完了のみ表示中' : '全タスク表示'}</span>
          </button>

          <span className="text-slate-400 font-mono">
            {tasks.filter(t => t.category === 'Urgent' || t.category === 'Focus').length} tasks
          </span>
        </div>
      </div>

      {/* Tree Content Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-1 custom-scrollbar space-y-0.5">
        {/* Root level creation input if active */}
        {creatingInFolder?.path === '' && (
          <form 
            onSubmit={handleCreateSubmit}
            className="flex items-center gap-1.5 py-1 px-2 my-1 bg-indigo-50 border border-indigo-200 rounded-md shadow-xs"
          >
            {creatingInFolder.type === 'folder' ? (
              <Folder size={14} className="text-amber-500 shrink-0" />
            ) : (
              <FileText size={14} className="text-indigo-500 shrink-0" />
            )}
            <input
              autoFocus
              type="text"
              placeholder={creatingInFolder.type === 'folder' ? 'プロジェクト名 (例: ERG/Sub1)...' : 'タスク名...'}
              value={inlineInputValue}
              onChange={(e) => setInlineInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setCreatingInFolder(null);
                  setInlineInputValue('');
                }
              }}
              className="w-full bg-white border border-indigo-200 rounded px-1.5 py-0.5 text-xs outline-none focus:ring-1 focus:ring-indigo-500 font-normal"
            />
            <button 
              type="submit" 
              disabled={!inlineInputValue.trim()}
              className="px-2 py-0.5 bg-indigo-600 text-white rounded text-[11px] font-bold disabled:opacity-40"
            >
              追加
            </button>
            <button
              type="button"
              onClick={() => {
                setCreatingInFolder(null);
                setInlineInputValue('');
              }}
              className="p-0.5 text-slate-400 hover:text-slate-600"
            >
              <X size={12} />
            </button>
          </form>
        )}

        {/* Folders & Tasks */}
        {rootFolderList.map(node => renderFolder(node, 0))}

        {/* Empty state if no projects / tasks */}
        {rootFolderList.length === 0 && (
          <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400">
            <FolderPlus size={32} strokeWidth={1.5} className="mb-2 opacity-40 text-slate-400" />
            <p className="text-xs font-semibold text-slate-600 mb-1">プロジェクトがありません</p>
            <p className="text-[10px] text-slate-400 leading-relaxed mb-3">
              上の「+」ボタンから新しいプロジェクトやタスクを作成できます。
            </p>
            <button
              onClick={() => {
                setCreatingInFolder({ path: '', type: 'folder' });
                setInlineInputValue('ERG');
              }}
              className="px-3 py-1 bg-indigo-600 text-white rounded text-[11px] font-bold hover:bg-indigo-700 transition-all shadow-xs"
            >
              + ERG プロジェクトを作成
            </button>
          </div>
        )}
      </div>

      {/* Resizer Handle for Width Dragging */}
      <div
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClickResizer}
        className="absolute top-0 right-0 bottom-0 w-1.5 hover:w-2 hover:bg-indigo-400 active:bg-indigo-600 cursor-col-resize transition-all z-20 group"
        title="ドラッグして幅を調整 (ダブルクリックで初期化)"
      >
        <div className="w-full h-full opacity-0 group-hover:opacity-100 bg-indigo-400/50" />
      </div>
    </aside>
  );
};
