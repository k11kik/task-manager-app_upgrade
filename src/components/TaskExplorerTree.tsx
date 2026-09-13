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
  Pin, 
  PinOff,
  Zap, 
  Trash2,
  FolderMinus,
  MoveDown
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
  onTogglePin?: (taskId: string) => void;
  onMoveTask: (taskId: string, category: Category) => void;
  onMoveTaskFolder: (taskId: string, newProject: string) => void;
  activeSection: string;
  width: number;
  onWidthChange: (width: number) => void;
  urgentLimit?: number;
  onOpenDailyPick?: () => void;
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
  onTogglePin,
  onMoveTask,
  onMoveTaskFolder,
  activeSection,
  width,
  onWidthChange,
  urgentLimit = 3,
  onOpenDailyPick,
  deadlineThresholdDays = 3,
  t
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Per-workspace collapsed folders state
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(`navfor_collapsed_${activeSection}`);
      return saved ? new Set<string>(JSON.parse(saved)) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });

  // Re-sync collapsed folders when activeSection changes
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`navfor_collapsed_${activeSection}`);
      setCollapsedFolders(saved ? new Set<string>(JSON.parse(saved)) : new Set<string>());
    } catch {
      setCollapsedFolders(new Set<string>());
    }
  }, [activeSection]);

  // Per-workspace custom empty folders
  const [customFolders, setCustomFolders] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`navfor_folders_${activeSection}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Re-sync customFolders when activeSection changes (ensures workspace isolation)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`navfor_folders_${activeSection}`);
      setCustomFolders(saved ? JSON.parse(saved) : []);
    } catch {
      setCustomFolders([]);
    }
  }, [activeSection]);

  // Sections collapse state (Focus section, Pinned section)
  const [isFocusSectionCollapsed, setIsFocusSectionCollapsed] = useState(false);
  const [isPinnedSectionCollapsed, setIsPinnedSectionCollapsed] = useState(false);

  // Drag over states
  const [isFocusDragOver, setIsFocusDragOver] = useState(false);
  const [dragOverFolderPath, setDragOverFolderPath] = useState<string | null>(null);

  // Inline creation state
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
      const newWidth = Math.max(240, Math.min(600, startWidth.current + delta));
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
      localStorage.setItem(`navfor_collapsed_${activeSection}`, JSON.stringify(Array.from(newSet)));
    } catch (e) {
      console.error(e);
    }
  };

  const saveCustomFolders = (folders: string[]) => {
    setCustomFolders(folders);
    try {
      localStorage.setItem(`navfor_folders_${activeSection}`, JSON.stringify(folders));
    } catch (err) {
      console.error(err);
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

    // Ensure custom empty folders for THIS activeSection are in the tree
    customFolders.forEach(folderPath => {
      if (!folderPath) return;
      const parts = folderPath.split('/').map(p => p.trim()).filter(Boolean);
      getOrCreateFolder(parts);
    });

    // Distribute tasks into folder tree
    // Only show active tasks (Urgent & Focus) in the explorer
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

  // Handle creating new folder or task
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
        saveCustomFolders(next);
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

  // Remove an empty custom folder
  const handleDeleteCustomFolder = (folderPath: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = customFolders.filter(f => f !== folderPath && !f.startsWith(folderPath + '/'));
    saveCustomFolders(next);
  };

  // Urgent (Focus) tasks list
  const urgentTasks = useMemo(() => {
    return tasks
      .filter(t => t.category === 'Urgent')
      .filter(t => {
        if (isFilterActiveOnly && t.isDone) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          return t.title.toLowerCase().includes(q) || t.project.toLowerCase().includes(q);
        }
        return true;
      })
      .sort((a, b) => {
        if (a.isDone !== b.isDone) return a.isDone ? 1 : -1;
        if (a.deadline && b.deadline) return a.deadline - b.deadline;
        if (a.deadline) return -1;
        if (b.deadline) return 1;
        return (b.updatedAt || 0) - (a.updatedAt || 0);
      });
  }, [tasks, isFilterActiveOnly, searchQuery]);

  // Pinned tasks list
  const pinnedTasks = useMemo(() => {
    return tasks
      .filter(t => t.isPinned && (t.category === 'Urgent' || t.category === 'Focus'))
      .filter(t => {
        if (isFilterActiveOnly && t.isDone) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          return t.title.toLowerCase().includes(q) || t.project.toLowerCase().includes(q);
        }
        return true;
      })
      .sort((a, b) => {
        if (a.isDone !== b.isDone) return a.isDone ? 1 : -1;
        return (b.updatedAt || 0) - (a.updatedAt || 0);
      });
  }, [tasks, isFilterActiveOnly, searchQuery]);

  // Recursive counts helper
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

  // Drag and Drop handlers for tasks and folders
  const handleTaskDragStart = (e: React.DragEvent, task: Task) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({
      type: 'task',
      taskId: task.id,
      currentCategory: task.category,
      currentProject: task.project
    }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleFocusDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsFocusDragOver(false);
    try {
      const dataStr = e.dataTransfer.getData('text/plain');
      if (!dataStr) return;
      const data = JSON.parse(dataStr);
      if (data.type === 'task' && data.taskId) {
        onMoveTask(data.taskId, 'Urgent');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleFolderDrop = (e: React.DragEvent, targetFolderPath: string) => {
    e.preventDefault();
    setDragOverFolderPath(null);
    try {
      const dataStr = e.dataTransfer.getData('text/plain');
      if (!dataStr) return;
      const data = JSON.parse(dataStr);
      if (data.type === 'task' && data.taskId) {
        if (data.currentProject !== targetFolderPath) {
          onMoveTaskFolder(data.taskId, targetFolderPath);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Render a folder node and its children
  const renderFolder = (node: FolderNode, depth = 0) => {
    const isCollapsed = collapsedFolders.has(node.fullPath);
    const hasChildren = node.subfolders.size > 0 || node.tasks.length > 0;
    const counts = countFolderTasks(node);
    const isCreatingHere = creatingInFolder?.path === node.fullPath;
    const isDragOver = dragOverFolderPath === node.fullPath;

    return (
      <div 
        key={node.fullPath} 
        className="select-none"
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = 'move';
          if (dragOverFolderPath !== node.fullPath) {
            setDragOverFolderPath(node.fullPath);
          }
        }}
        onDragLeave={(e) => {
          e.stopPropagation();
          if (dragOverFolderPath === node.fullPath) {
            setDragOverFolderPath(null);
          }
        }}
        onDrop={(e) => handleFolderDrop(e, node.fullPath)}
      >
        {/* Folder row */}
        <div
          className={cn(
            "group relative flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all",
            isDragOver 
              ? "bg-indigo-100 border-2 border-dashed border-indigo-500 text-indigo-900 shadow-sm"
              : "hover:bg-slate-200/60 text-slate-700",
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
              title="このフォルダにタスクを追加"
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
              title="サブフォルダを追加"
            >
              <FolderPlus size={12} />
            </button>
            {/* Delete folder button if empty */}
            {counts.total === 0 && node.subfolders.size === 0 && (
              <button
                onClick={(e) => handleDeleteCustomFolder(node.fullPath, e)}
                className="p-1 rounded hover:bg-red-100 text-slate-400 hover:text-red-500 transition-colors"
                title="空フォルダを削除"
              >
                <Trash2 size={11} />
              </button>
            )}
          </div>
        </div>

        {/* Folder Content (Subfolders and Tasks) */}
        {!isCollapsed && (
          <div className="flex flex-col">
            {/* Inline creation input for this folder */}
            {isCreatingHere && (
              <form 
                onSubmit={handleCreateSubmit}
                className="flex items-center gap-1.5 py-1 px-2 my-0.5 bg-indigo-50/80 border border-indigo-200 rounded-md"
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
                if (a.isDone !== b.isDone) return a.isDone ? 1 : -1;
                if (a.category !== b.category) return a.category === 'Urgent' ? -1 : 1;
                if (a.isStarred !== b.isStarred) return a.isStarred ? -1 : 1;
                if (a.deadline && b.deadline) return a.deadline - b.deadline;
                if (a.deadline) return -1;
                if (b.deadline) return 1;
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
    const isUrgent = task.category === 'Urgent';

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
        draggable={true}
        onDragStart={(e) => handleTaskDragStart(e, task)}
        onClick={() => onSelectTask(task.id)}
        style={{ paddingLeft: `${depth * 14 + 6}px` }}
        className={cn(
          "group relative flex items-center gap-1.5 py-1 px-2 rounded-md text-xs cursor-pointer transition-all select-none",
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
          title={task.isDone ? '未完了にする' : '完了にする'}
        >
          {task.isDone ? (
            <CheckCircle2 size={13} className="text-emerald-500" />
          ) : (
            <Circle size={13} className={cn("hover:text-indigo-500", isUrgent ? "text-red-400" : "text-slate-300")} />
          )}
        </button>

        {/* Urgent dot */}
        {isUrgent && !task.isDone && (
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0 shadow-xs" title="Focus / Urgent" />
        )}

        {/* Task Title */}
        <span className="truncate flex-1 text-[11.5px] leading-tight font-normal">
          {task.title}
        </span>

        {/* Focus Move / Toggle Icon (Zap) */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onMoveTask(task.id, isUrgent ? 'Focus' : 'Urgent');
          }}
          className={cn(
            "shrink-0 p-0.5 rounded transition-all",
            isUrgent
              ? "text-red-500 hover:text-red-700 hover:bg-red-50"
              : "text-slate-300 hover:text-amber-500 hover:bg-slate-100 opacity-0 group-hover:opacity-100"
          )}
          title={isUrgent ? "フォーカスを解除 (ToDoに戻す)" : "フォーカスに追加 (最優先スロットへ)"}
        >
          <Zap size={11} fill={isUrgent ? "currentColor" : "none"} />
        </button>

        {/* Star icon */}
        {task.isStarred ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleStar(task.id);
            }}
            className="text-amber-400 hover:text-amber-500 shrink-0"
            title="スター解除"
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
            title="スターを付ける"
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
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 bg-white/70 shrink-0">
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
      <div className="p-2 border-b border-slate-200/70 bg-white/40 space-y-1.5 shrink-0">
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

      {/* Scrollable Container containing: 1. FOCUS (Urgent), 2. PINNED, 3. EXPLORER TREE */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar flex flex-col">
        
        {/* --- 1. FOCUS SECTION (Pinned at top of explorer, drop target) --- */}
        <div 
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            setIsFocusDragOver(true);
          }}
          onDragLeave={() => setIsFocusDragOver(false)}
          onDrop={handleFocusDrop}
          className={cn(
            "border-b border-red-100/80 bg-red-50/30 transition-all",
            isFocusDragOver && "bg-red-100/80 border-red-400 ring-2 ring-red-400 ring-inset"
          )}
        >
          {/* Focus Section Header */}
          <div 
            onClick={() => setIsFocusSectionCollapsed(!isFocusSectionCollapsed)}
            className="flex items-center justify-between px-2.5 py-1.5 bg-red-100/40 hover:bg-red-100/70 cursor-pointer text-red-900 transition-colors"
          >
            <div className="flex items-center gap-1.5">
              <span className="text-red-500">
                {isFocusSectionCollapsed ? <ChevronRight size={12} strokeWidth={2.5} /> : <ChevronDown size={12} strokeWidth={2.5} />}
              </span>
              <span className="w-2 h-2 rounded-full bg-red-500 shadow-xs" />
              <span className="text-[10px] font-black uppercase tracking-wider text-red-800">
                FOCUS ({t('Urgent')})
              </span>
            </div>

            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              <span className={cn(
                "text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border",
                urgentTasks.filter(t => !t.isDone).length >= urgentLimit
                  ? "bg-red-500 text-white border-red-600"
                  : "bg-white text-red-600 border-red-200"
              )}>
                {urgentTasks.filter(t => !t.isDone).length}/{urgentLimit}
              </span>
              {onOpenDailyPick && (
                <button
                  onClick={onOpenDailyPick}
                  className="text-[9px] font-bold text-red-600 hover:underline px-1 py-0.5"
                  title="未完了タスクからFocusを抽出"
                >
                  {t('Extract')}
                </button>
              )}
            </div>
          </div>

          {/* Focus Task List (Compact format) */}
          {!isFocusSectionCollapsed && (
            <div className="p-1 space-y-0.5">
              {urgentTasks.map(task => {
                const isSelected = activeTaskId === task.id;
                const isOpen = openTaskIds.includes(task.id);
                return (
                  <div
                    key={task.id}
                    draggable={true}
                    onDragStart={(e) => handleTaskDragStart(e, task)}
                    onClick={() => onSelectTask(task.id)}
                    className={cn(
                      "group relative flex items-center gap-1.5 py-1 px-2 rounded-md text-xs cursor-pointer transition-all",
                      isSelected 
                        ? "bg-red-100 text-red-950 font-medium shadow-xs" 
                        : isOpen 
                          ? "bg-white text-slate-800 shadow-2xs hover:bg-red-50/50" 
                          : "text-slate-700 hover:bg-white/80 hover:shadow-2xs",
                      task.isDone && "opacity-50 line-through text-slate-400"
                    )}
                  >
                    {/* Checkbox */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleDone(task.id);
                      }}
                      className="text-red-400 hover:text-emerald-600 transition-colors shrink-0"
                    >
                      {task.isDone ? (
                        <CheckCircle2 size={13} className="text-emerald-500" />
                      ) : (
                        <Circle size={13} className="text-red-400 hover:text-emerald-500" />
                      )}
                    </button>

                    {/* Title */}
                    <span className="truncate flex-1 text-[11.5px] leading-tight font-medium text-slate-800">
                      {task.title}
                    </span>

                    {/* Unfocus button (Move back to normal ToDo) */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onMoveTask(task.id, 'Focus');
                      }}
                      className="text-red-400 hover:text-slate-600 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      title="フォーカスから外す (通常ToDoへ)"
                    >
                      <Zap size={11} fill="currentColor" />
                    </button>

                    {/* Star */}
                    {task.isStarred ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleStar(task.id);
                        }}
                        className="text-amber-400 hover:text-amber-500 shrink-0"
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
                        className="text-slate-300 hover:text-amber-400 shrink-0 opacity-0 group-hover:opacity-100"
                      >
                        <Star size={11} />
                      </button>
                    )}

                    {/* Project pill */}
                    <span className="text-[9px] text-slate-400 max-w-[60px] truncate shrink-0 font-mono">
                      {task.project.split('/').pop()}
                    </span>

                    {isSelected && (
                      <div className="absolute right-0 top-1 bottom-1 w-1 bg-red-500 rounded-l" />
                    )}
                  </div>
                );
              })}

              {urgentTasks.length === 0 && (
                <div className="py-2.5 px-3 text-center text-[10px] text-red-500/70 border border-dashed border-red-200 rounded-md bg-white/40">
                  下のツリーからタスクをドラッグ＆ドロップ、または⚡をクリックしてFocusに追加
                </div>
              )}
            </div>
          )}
        </div>

        {/* --- 2. PINNED SECTION (Displayed below Focus area) --- */}
        {pinnedTasks.length > 0 && (
          <div className="border-b border-indigo-100/80 bg-indigo-50/30 transition-all">
            {/* Pinned Section Header */}
            <div 
              onClick={() => setIsPinnedSectionCollapsed(!isPinnedSectionCollapsed)}
              className="flex items-center justify-between px-2.5 py-1.5 bg-indigo-100/40 hover:bg-indigo-100/70 cursor-pointer text-indigo-900 transition-colors"
            >
              <div className="flex items-center gap-1.5">
                <span className="text-indigo-500">
                  {isPinnedSectionCollapsed ? <ChevronRight size={12} strokeWidth={2.5} /> : <ChevronDown size={12} strokeWidth={2.5} />}
                </span>
                <Pin size={11} className="text-indigo-600 rotate-45" />
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-800">
                  PINNED ({pinnedTasks.length})
                </span>
              </div>
            </div>

            {/* Pinned Task List (Compact format) */}
            {!isPinnedSectionCollapsed && (
              <div className="p-1 space-y-0.5">
                {pinnedTasks.map(task => {
                  const isSelected = activeTaskId === task.id;
                  const isOpen = openTaskIds.includes(task.id);
                  return (
                    <div
                      key={task.id}
                      draggable={true}
                      onDragStart={(e) => handleTaskDragStart(e, task)}
                      onClick={() => onSelectTask(task.id)}
                      className={cn(
                        "group relative flex items-center gap-1.5 py-1 px-2 rounded-md text-xs cursor-pointer transition-all",
                        isSelected 
                          ? "bg-indigo-100 text-indigo-950 font-medium shadow-xs" 
                          : isOpen 
                            ? "bg-white text-slate-800 shadow-2xs hover:bg-indigo-50/50" 
                            : "text-slate-700 hover:bg-white/80 hover:shadow-2xs",
                        task.isDone && "opacity-50 line-through text-slate-400"
                      )}
                    >
                      {/* Checkbox */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleDone(task.id);
                        }}
                        className="text-indigo-400 hover:text-emerald-600 transition-colors shrink-0"
                      >
                        {task.isDone ? (
                          <CheckCircle2 size={13} className="text-emerald-500" />
                        ) : (
                          <Circle size={13} className="text-indigo-300 hover:text-emerald-500" />
                        )}
                      </button>

                      {/* Title */}
                      <span className="truncate flex-1 text-[11.5px] leading-tight font-medium text-slate-800">
                        {task.title}
                      </span>

                      {/* Unpin button */}
                      {onTogglePin && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onTogglePin(task.id);
                          }}
                          className="text-indigo-500 hover:text-slate-600 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                          title="ピン留めを解除"
                        >
                          <PinOff size={11} />
                        </button>
                      )}

                      {/* Star */}
                      {task.isStarred && (
                        <Star size={11} fill="currentColor" className="text-amber-400 shrink-0" />
                      )}

                      {/* Project pill */}
                      <span className="text-[9px] text-slate-400 max-w-[60px] truncate shrink-0 font-mono">
                        {task.project.split('/').pop()}
                      </span>

                      {isSelected && (
                        <div className="absolute right-0 top-1 bottom-1 w-1 bg-indigo-600 rounded-l" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* --- 3. EXPLORER PROJECT TREE SECTION --- */}
        <div className="flex-1 p-1 space-y-0.5 min-h-[200px]">
          <div className="px-2 py-1 flex items-center justify-between text-[9px] font-black uppercase tracking-wider text-slate-400">
            <span>{activeSection} PROJECTS & TASKS</span>
            <span className="font-mono lowercase text-[8px] text-slate-400">d&d to move folder</span>
          </div>

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
                placeholder={creatingInFolder.type === 'folder' ? 'プロジェクト名 (例: ERG/Phase1)...' : 'タスク名...'}
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

          {/* Folders & Tasks Tree */}
          {rootFolderList.map(node => renderFolder(node, 0))}

          {/* Empty state if no projects / tasks */}
          {rootFolderList.length === 0 && (
            <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400">
              <FolderPlus size={32} strokeWidth={1.5} className="mb-2 opacity-40 text-slate-400" />
              <p className="text-xs font-semibold text-slate-600 mb-1">フォルダ・タスクがありません</p>
              <p className="text-[10px] text-slate-400 leading-relaxed mb-3">
                上の「+」ボタンから現在のワークスペース（{activeSection}）に新規フォルダやタスクを作成できます。
              </p>
              <button
                onClick={() => {
                  setCreatingInFolder({ path: '', type: 'folder' });
                  setInlineInputValue('ProjectA');
                }}
                className="px-3 py-1 bg-indigo-600 text-white rounded text-[11px] font-bold hover:bg-indigo-700 transition-all shadow-xs"
              >
                + 最初のプロジェクトを作成
              </button>
            </div>
          )}
        </div>
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
