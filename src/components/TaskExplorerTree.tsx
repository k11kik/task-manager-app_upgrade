import React, { useState, useMemo, useRef, useEffect } from 'react';
import { flushSync } from 'react-dom';
import { 
  Folder, 
  FolderOpen, 
  ChevronRight, 
  ChevronDown, 
  FileText, 
  Plus, 
  Star, 
  Clock, 
  CheckCircle2, 
  Circle, 
  X, 
  Search, 
  FolderPlus, 
  FilePlus, 
  Filter, 
  Layers, 
  Pin, 
  Zap, 
  Trash2,
  MoreHorizontal,
  Edit2,
  CornerDownRight,
  Sparkles,
  Copy,
  PanelLeftClose
} from 'lucide-react';
import { Task, Category } from '../types';
import { cn } from '../lib/utils';
import { format, isToday, isTomorrow, differenceInCalendarDays } from 'date-fns';

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
  onSelectTask: (taskId: string, isPermanent?: boolean) => void;
  onAddTask: (taskData: { title: string; project: string; deadline?: number; isAllDay?: boolean; notes?: string }) => Promise<void>;
  onToggleDone: (taskId: string) => void;
  onToggleStar: (taskId: string) => void;
  onTogglePin?: (taskId: string) => void;
  onMoveTask: (taskId: string, category: Category) => void;
  onMoveTaskFolder: (taskId: string, newProject: string) => void;
  onMoveFolder?: (sourceFolderPath: string, targetFolderPath: string) => void;
  onRenameFolder?: (oldFolderPath: string, newFolderPath: string) => void;
  onDeleteFolder?: (folderPath: string) => void;
  onRenameTask?: (taskId: string, newTitle: string) => void;
  onDeleteTask?: (taskId: string) => void;
  onDuplicateTask?: (task: Task, targetProject?: string) => void;
  onToggleCollapse?: () => void;
  activeSection: string;
  width: number;
  onWidthChange: (width: number) => void;
  urgentLimit?: number;
  onOpenDailyPick?: () => void;
  deadlineThresholdDays?: number;
  language?: string;
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
  onMoveFolder,
  onRenameFolder,
  onDeleteFolder,
  onRenameTask,
  onDeleteTask,
  onDuplicateTask,
  onToggleCollapse,
  activeSection,
  width,
  onWidthChange,
  urgentLimit = 3,
  onOpenDailyPick,
  deadlineThresholdDays = 3,
  language = 'en',
  t
}) => {
  const isJa = language === 'ja';
  const copiedTaskIdRef = useRef<string | null>(null);
  const lastPasteTimeRef = useRef<number>(0);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isFilterActiveOnly, setIsFilterActiveOnly] = useState(false);

  // Selected item key for keyboard navigation ('folder:PATH' or 'task:ID')
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

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
    const syncFolders = () => {
      try {
        const saved = localStorage.getItem(`navfor_folders_${activeSection}`);
        setCustomFolders(saved ? JSON.parse(saved) : []);
      } catch {
        setCustomFolders([]);
      }
    };
    syncFolders();
    window.addEventListener('navfor_folders_updated', syncFolders);
    return () => window.removeEventListener('navfor_folders_updated', syncFolders);
  }, [activeSection]);

  // Sections collapse state (Focus section, Pinned section)
  const [isFocusSectionCollapsed, setIsFocusSectionCollapsed] = useState(false);
  const [isPinnedSectionCollapsed, setIsPinnedSectionCollapsed] = useState(false);

  // Drag over states
  const [isFocusDragOver, setIsFocusDragOver] = useState(false);
  const [dragOverFolderPath, setDragOverFolderPath] = useState<string | null>(null);

  // Inline creation state: type is 'task' | 'folder'
  const [creatingInFolder, setCreatingInFolder] = useState<{ path: string; type: 'task' | 'folder' } | null>(null);
  const [inlineInputValue, setInlineInputValue] = useState('');

  // Inline rename state with optional parentPath to distinguish duplicates (e.g. Focus vs Project folder)
  const [renamingItem, setRenamingItem] = useState<{ 
    type: 'folder' | 'task'; 
    idOrPath: string; 
    parentPath?: string; 
    initialValue: string 
  } | null>(null);
  const [renameInputValue, setRenameInputValue] = useState('');

  // 3-dots dropdown menu state
  const [activeMenu, setActiveMenu] = useState<{ type: 'folder' | 'task'; idOrPath: string; x: number; y: number } | null>(null);

  // Close 3-dots menu on window click
  useEffect(() => {
    const handleOutsideClick = () => setActiveMenu(null);
    if (activeMenu) {
      window.addEventListener('click', handleOutsideClick);
      return () => window.removeEventListener('click', handleOutsideClick);
    }
  }, [activeMenu]);

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
      const newWidth = Math.max(220, Math.min(600, startWidth.current + delta));
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
    onWidthChange(310);
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
      window.dispatchEvent(new Event('navfor_folders_updated'));
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

    // Include custom folders
    customFolders.forEach(folderPath => {
      if (!folderPath) return;
      const parts = folderPath.split('/').map(p => p.trim()).filter(Boolean);
      getOrCreateFolder(parts);
    });

    // Distribute tasks
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

  const rootFolderList = useMemo(() => {
    const list = Array.from(treeRoot.subfolders.values()) as FolderNode[];
    // Alphabetical order for root folders
    return list.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
  }, [treeRoot]);

  // Urgent (Focus) tasks list (alphabetical)
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
      .sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' }));
  }, [tasks, isFilterActiveOnly, searchQuery]);

  // Pinned tasks list: EXCLUDE DONE tasks as explicitly requested, sorted alphabetically
  const pinnedTasks = useMemo(() => {
    return tasks
      .filter(t => t.isPinned && !t.isDone && (t.category === 'Urgent' || t.category === 'Focus'))
      .filter(t => {
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          return t.title.toLowerCase().includes(q) || t.project.toLowerCase().includes(q);
        }
        return true;
      })
      .sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' }));
  }, [tasks, searchQuery]);

  // Ref for keyboard focus retention
  const treeRef = useRef<HTMLElement>(null);
  const isSubmittingCreateRef = useRef(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [selectedFolderPaths, setSelectedFolderPaths] = useState<Set<string>>(new Set());
  const [lastSelectedKey, setLastSelectedKey] = useState<string | null>(null);

  // Helper to generate a unique key for every visible item (preventing Focus silos)
  const getItemKey = (item: { type: 'folder'; path: string } | { type: 'task'; task: Task; parentPath: string }): string => {
    if (item.type === 'folder') return `folder:${item.path}`;
    return `task:${item.parentPath}:${item.task.id}`;
  };

  // Flatten currently visible items for VS Code keyboard navigation
  // Flatten currently visible items in the Project Tree for keyboard navigation
  // Note: Focus and Pinned sections are kept independent so arrow navigation in project tree never jumps into Focus
  const visibleItems = useMemo(() => {
    const list: Array<
      | { type: 'folder'; path: string; node?: FolderNode; parentPath: string }
      | { type: 'task'; task: Task; parentPath: string }
    > = [];

    // Project Folders and Tasks
    const traverse = (node: FolderNode, parentPath: string) => {
      // Subfolders first (sorted alphabetically)
      const subs = Array.from(node.subfolders.values()).sort((a, b) => 
        a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
      );
      subs.forEach(sub => {
        list.push({ type: 'folder', path: sub.fullPath, node: sub, parentPath });
        if (!collapsedFolders.has(sub.fullPath)) {
          traverse(sub, sub.fullPath);
        }
      });
      // Tasks: sorted alphabetically by title as requested
      const sortedNodeTasks = [...node.tasks].sort((a, b) => 
        a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' })
      );
      sortedNodeTasks.forEach(task => {
        list.push({ type: 'task', task, parentPath: node.fullPath });
      });
    };

    rootFolderList.forEach(rootSub => {
      list.push({ type: 'folder', path: rootSub.fullPath, node: rootSub, parentPath: '' });
      if (!collapsedFolders.has(rootSub.fullPath)) {
        traverse(rootSub, rootSub.fullPath);
      }
    });

    return list;
  }, [rootFolderList, collapsedFolders]);

  // Track previous activeTaskId to only react when active task genuinely switches
  const prevActiveTaskIdRef = useRef<string | undefined>(activeTaskId);

  // Sync selectedKey with activeTaskId without clobbering folder selection
  useEffect(() => {
    const hasActiveTaskChanged = activeTaskId !== prevActiveTaskIdRef.current;
    prevActiveTaskIdRef.current = activeTaskId;

    if (!activeTaskId) return;

    // Only sync if activeTaskId genuinely changed (e.g. user clicked a task in Timeline or opened a tab)
    if (hasActiveTaskChanged) {
      const isTimelineActive = (window as any).__navforActivePane === 'timeline';
      const hasFolderSelected = selectedFolderPaths.size > 0 || (selectedKey?.startsWith('folder:') ?? false);

      // If user clicked in timeline or if explorer didn't have a folder selected, sync to the task
      if (isTimelineActive || !hasFolderSelected) {
        const match = visibleItems.find(it => it.type === 'task' && it.task.id === activeTaskId);
        const nextKey = match && match.type === 'task' ? getItemKey(match) : `task:${activeTaskId}`;
        setSelectedKey(nextKey);
        setSelectedTaskIds(new Set([activeTaskId]));
        setSelectedFolderPaths(new Set());
      }
    }
  }, [activeTaskId, visibleItems, selectedKey, selectedFolderPaths]);

  // Helper to find index in visibleItems whether target is exact key, folder path, or task ID
  const findItemIndex = (targetKey: string | null): number => {
    if (targetKey) {
      // 1. Exact match by getItemKey
      const exactIdx = visibleItems.findIndex(it => getItemKey(it) === targetKey);
      if (exactIdx !== -1) return exactIdx;

      // 2. If it's a task key (task:parentPath:taskId or task:taskId)
      if (targetKey.startsWith('task:')) {
        const parts = targetKey.split(':');
        const taskId = parts[parts.length - 1];
        if (parts.length >= 3) {
          const parentPath = parts[1];
          const pIdx = visibleItems.findIndex(it => it.type === 'task' && it.task.id === taskId && it.parentPath === parentPath);
          if (pIdx !== -1) return pIdx;
        }
        const tIdx = visibleItems.findIndex(it => it.type === 'task' && it.task.id === taskId);
        if (tIdx !== -1) return tIdx;
      }

      // 3. If folder key (folder:path)
      if (targetKey.startsWith('folder:')) {
        const folderPath = targetKey.replace('folder:', '');
        const fIdx = visibleItems.findIndex(it => it.type === 'folder' && it.path === folderPath);
        if (fIdx !== -1) return fIdx;
      }
    }

    // 4. Fallback to selectedFolderPaths if selectedKey was out of sync
    if (selectedFolderPaths.size > 0) {
      const folderPath = Array.from(selectedFolderPaths)[0];
      const fIdx = visibleItems.findIndex(it => it.type === 'folder' && it.path === folderPath);
      if (fIdx !== -1) return fIdx;
    }

    // 5. Fallback to selectedTaskIds
    if (selectedTaskIds.size > 0) {
      const taskId = Array.from(selectedTaskIds)[0];
      const tIdx = visibleItems.findIndex(it => it.type === 'task' && it.task.id === taskId);
      if (tIdx !== -1) return tIdx;
    }

    // 6. Fallback: ancestor folder if item was hidden by collapsing
    if (selectedKey) {
      if (selectedKey.startsWith('task:')) {
        const parts = selectedKey.split(':');
        if (parts.length >= 3) {
          const folderPath = parts[1];
          const fIdx = visibleItems.findIndex(it => it.type === 'folder' && it.path === folderPath);
          if (fIdx !== -1) return fIdx;
        }
      } else if (selectedKey.startsWith('folder:')) {
        const path = selectedKey.replace('folder:', '');
        const parts = path.split('/');
        while (parts.length > 1) {
          parts.pop();
          const ancestorPath = parts.join('/');
          const fIdx = visibleItems.findIndex(it => it.type === 'folder' && it.path === ancestorPath);
          if (fIdx !== -1) return fIdx;
        }
      }
    }

    // 7. Fallback to activeTaskId
    if (activeTaskId) {
      const tIdx = visibleItems.findIndex(it => it.type === 'task' && it.task.id === activeTaskId);
      if (tIdx !== -1) return tIdx;
    }

    return -1;
  };

  // Range select between two keys across visibleItems
  const rangeSelectItems = (startKey: string, endKey: string) => {
    const startIdx = findItemIndex(startKey);
    const endIdx = findItemIndex(endKey);
    if (startIdx === -1 || endIdx === -1) return;

    const [low, high] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
    const newTasks = new Set<string>();
    const newFolders = new Set<string>();

    for (let i = low; i <= high; i++) {
      const item = visibleItems[i];
      if (item.type === 'task') {
        newTasks.add(item.task.id);
      } else {
        newFolders.add(item.path);
      }
    }
    setSelectedTaskIds(newTasks);
    setSelectedFolderPaths(newFolders);
  };

  // Keyboard navigation handler (ArrowUp, ArrowDown, ArrowRight, ArrowLeft, Enter, F2)
  const handleTreeKeyDown = (e: React.KeyboardEvent | KeyboardEvent) => {
    if (renamingItem || creatingInFolder) return; // Let input handle keys
    if ((window as any).__navforActivePane === 'timeline') return; // Timeline is active pane

    // 1. If currently selected item is inside FOCUS section, navigate independently within urgentTasks
    if (selectedKey?.startsWith('task:__focus__:')) {
      if (urgentTasks.length === 0) return;
      const parts = selectedKey.split(':');
      const currentId = parts[parts.length - 1];
      const curIdx = urgentTasks.findIndex(t => t.id === currentId);

      let nextIdx = curIdx;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        nextIdx = curIdx === -1 ? 0 : Math.min(curIdx + 1, urgentTasks.length - 1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        nextIdx = curIdx === -1 ? 0 : Math.max(curIdx - 1, 0);
      }

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const nextTask = urgentTasks[nextIdx];
        const nextKey = `task:__focus__:${nextTask.id}`;
        setSelectedKey(nextKey);
        setLastSelectedKey(nextKey);
        setSelectedTaskIds(new Set([nextTask.id]));
        setSelectedFolderPaths(new Set());
        onSelectTask(nextTask.id);
        requestAnimationFrame(() => {
          const el = document.getElementById(`explorer-item-${encodeURIComponent(nextKey)}`);
          el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
        return;
      }
    }

    // 2. If currently selected item is inside PINNED section, navigate independently within pinnedTasks
    if (selectedKey?.startsWith('task:__pinned__:')) {
      if (pinnedTasks.length === 0) return;
      const parts = selectedKey.split(':');
      const currentId = parts[parts.length - 1];
      const curIdx = pinnedTasks.findIndex(t => t.id === currentId);

      let nextIdx = curIdx;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        nextIdx = curIdx === -1 ? 0 : Math.min(curIdx + 1, pinnedTasks.length - 1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        nextIdx = curIdx === -1 ? 0 : Math.max(curIdx - 1, 0);
      }

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const nextTask = pinnedTasks[nextIdx];
        const nextKey = `task:__pinned__:${nextTask.id}`;
        setSelectedKey(nextKey);
        setLastSelectedKey(nextKey);
        setSelectedTaskIds(new Set([nextTask.id]));
        setSelectedFolderPaths(new Set());
        onSelectTask(nextTask.id);
        requestAnimationFrame(() => {
          const el = document.getElementById(`explorer-item-${encodeURIComponent(nextKey)}`);
          el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
        return;
      }
    }

    // 3. Project Tree navigation (ArrowDown / ArrowUp strictly within visibleItems)
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (visibleItems.length === 0) return;

      let idx = findItemIndex(selectedKey);
      if (idx === -1) {
        idx = 0;
      } else if (idx < visibleItems.length - 1) {
        idx = idx + 1;
      }

      const next = visibleItems[idx];
      const key = getItemKey(next);
      setSelectedKey(key);

      if (e.shiftKey) {
        if (lastSelectedKey) {
          rangeSelectItems(lastSelectedKey, key);
        } else {
          setLastSelectedKey(key);
          rangeSelectItems(key, key);
        }
      } else {
        setLastSelectedKey(key);
        if (next.type === 'task') {
          onSelectTask(next.task.id);
          setSelectedTaskIds(new Set([next.task.id]));
          setSelectedFolderPaths(new Set());
        } else {
          setSelectedFolderPaths(new Set([next.path]));
          setSelectedTaskIds(new Set());
        }
      }

      // Scroll smoothly into view
      requestAnimationFrame(() => {
        const el = document.getElementById(`explorer-item-${encodeURIComponent(key)}`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (visibleItems.length === 0) return;

      let idx = findItemIndex(selectedKey);
      if (idx === -1) {
        idx = 0;
      } else if (idx > 0) {
        idx = idx - 1;
      }

      const prev = visibleItems[idx];
      const key = getItemKey(prev);
      setSelectedKey(key);

      if (e.shiftKey) {
        if (lastSelectedKey) {
          rangeSelectItems(lastSelectedKey, key);
        } else {
          setLastSelectedKey(key);
          rangeSelectItems(key, key);
        }
      } else {
        setLastSelectedKey(key);
        if (prev.type === 'task') {
          onSelectTask(prev.task.id);
          setSelectedTaskIds(new Set([prev.task.id]));
          setSelectedFolderPaths(new Set());
        } else {
          setSelectedFolderPaths(new Set([prev.path]));
          setSelectedTaskIds(new Set());
        }
      }

      // Scroll smoothly into view
      requestAnimationFrame(() => {
        const el = document.getElementById(`explorer-item-${encodeURIComponent(key)}`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    } else if (e.key === 'ArrowRight') {
      // If folder and collapsed, expand it
      if (selectedKey?.startsWith('folder:')) {
        const path = selectedKey.replace('folder:', '');
        if (collapsedFolders.has(path)) {
          e.preventDefault();
          const next = new Set<string>(collapsedFolders);
          next.delete(path);
          saveCollapsed(next);
        }
      }
    } else if (e.key === 'ArrowLeft') {
      // If folder and expanded, collapse it; if collapsed or task, jump to parent folder
      if (selectedKey?.startsWith('folder:')) {
        const path = selectedKey.replace('folder:', '');
        if (!collapsedFolders.has(path)) {
          e.preventDefault();
          const next = new Set<string>(collapsedFolders);
          next.add(path);
          saveCollapsed(next);
        } else {
          // Jump to parent folder
          const parts = path.split('/');
          if (parts.length > 1) {
            parts.pop();
            const parentKey = `folder:${parts.join('/')}`;
            setSelectedKey(parentKey);
            setLastSelectedKey(parentKey);
          }
        }
      } else if (selectedKey?.startsWith('task:')) {
        const parts = selectedKey.split(':');
        const taskId = parts[parts.length - 1];
        const task = tasks.find(t => t.id === taskId);
        if (task && task.project) {
          e.preventDefault();
          const parentKey = `folder:${task.project}`;
          setSelectedKey(parentKey);
          setLastSelectedKey(parentKey);
        }
      }
    } else if (e.key === 'Enter' || e.key === 'F2') {
      // Trigger inline rename! Works for normal files, folders, and Focus tasks!
      if (selectedKey?.startsWith('task:')) {
        const parts = selectedKey.split(':');
        const taskId = parts[parts.length - 1];
        const parentPath = parts.length >= 3 ? parts[1] : undefined;
        const task = tasks.find(t => t.id === taskId);
        if (task) {
          e.preventDefault();
          startRenaming('task', task.id, task.title, parentPath);
        }
      } else if (selectedKey?.startsWith('folder:')) {
        const path = selectedKey.replace('folder:', '');
        const parts = path.split('/');
        const folderName = parts[parts.length - 1];
        e.preventDefault();
        startRenaming('folder', path, folderName);
      } else if (selectedTaskIds.size === 1) {
        const taskId = Array.from(selectedTaskIds)[0];
        const task = tasks.find(t => t.id === taskId);
        if (task) {
          e.preventDefault();
          startRenaming('task', task.id, task.title);
        }
      } else if (activeTaskId) {
        const task = tasks.find(t => t.id === activeTaskId);
        if (task) {
          e.preventDefault();
          startRenaming('task', task.id, task.title);
        }
      }
    }
  };

  // Global window key listener for arrow navigation, Enter/F2, and Ctrl+C / Ctrl+V when Explorer is focused
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input / textarea / contenteditable
      const target = e.target as HTMLElement | null;
      const activeEl = document.activeElement as HTMLElement | null;
      if (
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl?.tagName || '') ||
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName || '') ||
        activeEl?.isContentEditable ||
        target?.isContentEditable ||
        renamingItem ||
        creatingInFolder
      ) {
        return;
      }

      // Do NOT handle if user is inside Timeline or timeline is active pane
      const isInsideTimeline =
        (window as any).__navforActivePane === 'timeline' ||
        Boolean(activeEl?.closest('#timeline-root')) ||
        Boolean((e.target as HTMLElement)?.closest('#timeline-root'));

      if (isInsideTimeline) {
        return;
      }

      const isExplorerFocused = 
        (window as any).__navforActivePane !== 'timeline' && (
          Boolean(activeEl?.closest('#explorer-tree-root')) ||
          Boolean((e.target as HTMLElement)?.closest('#explorer-tree-root')) ||
          (window as any).__navforActivePane === 'explorer'
        );

      // Arrow navigation & Enter/F2 for Explorer tree
      if (isExplorerFocused) {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'F2'].includes(e.key)) {
          e.preventDefault();
          e.stopPropagation();
          handleTreeKeyDown(e);
          return;
        }
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
        if (selectedKey?.startsWith('task:')) {
          const parts = selectedKey.split(':');
          const taskId = parts[parts.length - 1];
          copiedTaskIdRef.current = taskId;
        } else if (activeTaskId) {
          copiedTaskIdRef.current = activeTaskId;
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) {
        const now = Date.now();
        if (now - lastPasteTimeRef.current < 500) return; // Prevent double invocation
        if (copiedTaskIdRef.current && onDuplicateTask) {
          const taskToCopy = tasks.find(t => t.id === copiedTaskIdRef.current);
          if (taskToCopy) {
            e.preventDefault();
            lastPasteTimeRef.current = now;
            const targetFolder = getTargetFolderForNewItem() || taskToCopy.project;
            onDuplicateTask(taskToCopy, targetFolder);
          }
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [selectedKey, activeTaskId, tasks, onDuplicateTask, renamingItem, creatingInFolder, visibleItems, lastSelectedKey, collapsedFolders]);

  // Helper to determine where new item should be created from header button (VS Code-style context aware)
  const getTargetFolderForNewItem = (): string => {
    // 1. If Explorer has an active folder selected, THAT ALWAYS TAKES TOP PRECEDENCE!
    if (selectedFolderPaths.size > 0) {
      const folderPath = Array.from(selectedFolderPaths)[0];
      if (typeof folderPath === 'string' && folderPath) {
        return folderPath;
      }
    }
    if (selectedKey?.startsWith('folder:')) {
      return selectedKey.replace('folder:', '');
    }

    // 2. If Explorer has an active task selected in the tree
    if (selectedTaskIds.size > 0) {
      const taskId = (Array.from(selectedTaskIds)[0] as string) || '';
      const task = tasks.find(t => t.id === taskId);
      if (task?.project) return task.project;
    }
    if (selectedKey?.startsWith('task:')) {
      const parts = selectedKey.split(':');
      const taskId = parts[parts.length - 1];
      const parentPath = parts.length >= 3 ? parts[1] : undefined;
      if (parentPath && parentPath !== '__focus__' && parentPath !== '__pinned__') {
        return parentPath;
      }
      const task = tasks.find(t => t.id === taskId);
      if (task?.project) return task.project;
    }

    // 3. Fallback: Only if Explorer has nothing selected at all
    if (activeTaskId && (window as any).__navforActivePane === 'timeline') {
      const task = tasks.find(t => t.id === activeTaskId);
      if (task?.project) return task.project;
    }
    return '';
  };

  // Handle creating new folder or task
  const handleCreateSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSubmittingCreateRef.current) return;
    if (!creatingInFolder || !inlineInputValue.trim()) {
      setCreatingInFolder(null);
      setInlineInputValue('');
      return;
    }

    const { path, type } = creatingInFolder;
    const value = inlineInputValue.trim();

    // Immediately clear inline creation input synchronously using flushSync so no ghost file flashes
    isSubmittingCreateRef.current = true;
    flushSync(() => {
      setCreatingInFolder(null);
      setInlineInputValue('');
    });

    try {
      if (type === 'folder') {
        const newFolderPath = path ? `${path}/${value}` : value;
        if (!customFolders.includes(newFolderPath)) {
          const next = [...customFolders, newFolderPath];
          saveCustomFolders(next);
        }
        if (path && collapsedFolders.has(path)) {
          const next = new Set<string>(collapsedFolders);
          next.delete(path);
          saveCollapsed(next);
        }
        setSelectedKey(`folder:${newFolderPath}`);
      } else {
        const targetProject = path || 'General';
        await onAddTask({
          title: value,
          project: targetProject
        });
        if (path && collapsedFolders.has(path)) {
          const next = new Set<string>(collapsedFolders);
          next.delete(path);
          saveCollapsed(next);
        }
      }
    } finally {
      isSubmittingCreateRef.current = false;
      setTimeout(() => treeRef.current?.focus(), 50);
    }
  };

  // Inline rename handlers
  const startRenaming = (type: 'folder' | 'task', idOrPath: string, initialValue: string, parentPath?: string) => {
    setRenamingItem({ type, idOrPath, parentPath, initialValue });
    setRenameInputValue(initialValue);
    setActiveMenu(null);
  };

  const handleRenameSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!renamingItem) return;

    const val = renameInputValue.trim();
    const currentItem = renamingItem;
    let targetKeyAfterRename = '';
    let targetFolderAfterRename = '';
    let targetTaskIdAfterRename = '';

    if (val && val !== currentItem.initialValue) {
      if (currentItem.type === 'task') {
        if (onRenameTask) {
          onRenameTask(currentItem.idOrPath, val);
        }
        targetTaskIdAfterRename = currentItem.idOrPath;
        targetKeyAfterRename = currentItem.parentPath
          ? `task:${currentItem.parentPath}:${currentItem.idOrPath}`
          : `task:${currentItem.idOrPath}`;
      } else {
        // Folder rename
        if (onRenameFolder) {
          const oldPath = currentItem.idOrPath;
          const parts = oldPath.split('/');
          parts[parts.length - 1] = val;
          const newPath = parts.join('/');
          onRenameFolder(oldPath, newPath);
          // Also update customFolders
          const updatedCustom = customFolders.map(f => {
            if (f === oldPath) return newPath;
            if (f.startsWith(oldPath + '/')) return f.replace(oldPath, newPath);
            return f;
          });
          saveCustomFolders(updatedCustom);
          targetFolderAfterRename = newPath;
          targetKeyAfterRename = `folder:${newPath}`;
        }
      }
    } else {
      // Unchanged value, preserve existing target key
      if (currentItem.type === 'task') {
        targetTaskIdAfterRename = currentItem.idOrPath;
        targetKeyAfterRename = currentItem.parentPath
          ? `task:${currentItem.parentPath}:${currentItem.idOrPath}`
          : `task:${currentItem.idOrPath}`;
      } else {
        targetFolderAfterRename = currentItem.idOrPath;
        targetKeyAfterRename = `folder:${currentItem.idOrPath}`;
      }
    }

    setRenamingItem(null);
    setRenameInputValue('');

    // Restore selection to the renamed/unchanged item
    if (targetKeyAfterRename) {
      setSelectedKey(targetKeyAfterRename);
      setLastSelectedKey(targetKeyAfterRename);
      if (targetTaskIdAfterRename) {
        setSelectedTaskIds(new Set([targetTaskIdAfterRename]));
        setSelectedFolderPaths(new Set());
        onSelectTask(targetTaskIdAfterRename);
      } else if (targetFolderAfterRename) {
        setSelectedFolderPaths(new Set([targetFolderAfterRename]));
        setSelectedTaskIds(new Set());
      }
    }

    (window as any).__navforActivePane = 'explorer';
    setTimeout(() => treeRef.current?.focus(), 50);
  };

  // Folder deletion
  const handleDeleteFolderAction = (folderPath: string) => {
    if (!window.confirm(isJa ? `フォルダ「${folderPath}」および中の項目を削除しますか？` : `Delete folder "${folderPath}" and its items?`)) {
      return;
    }
    if (onDeleteFolder) {
      onDeleteFolder(folderPath);
    }
    const next = customFolders.filter(f => f !== folderPath && !f.startsWith(folderPath + '/'));
    saveCustomFolders(next);
    setActiveMenu(null);
  };

  // Task deletion
  const handleDeleteTaskAction = (taskId: string) => {
    if (onDeleteTask) {
      onDeleteTask(taskId);
    } else {
      onMoveTask(taskId, 'Trash');
    }
    setActiveMenu(null);
  };

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

  // Drag handlers
  const handleTaskDragStart = (e: React.DragEvent, task: Task) => {
    let ids = [task.id];
    if (selectedTaskIds.has(task.id) && selectedTaskIds.size > 1) {
      ids = Array.from(selectedTaskIds);
    }
    const payload = {
      type: 'task',
      taskId: task.id,
      taskIds: ids,
      currentCategory: task.category,
      currentProject: task.project,
      fromProject: task.project,
      fromDeadline: task.deadline,
      fromTimelineColumn: task.timelineColumn,
      fromOrder: task.order ?? 0
    };
    (window as any).__navforDraggingTask = payload;
    try {
      e.dataTransfer.setData('application/json', JSON.stringify(payload));
      e.dataTransfer.setData('text/plain', JSON.stringify(payload));
    } catch (err) {
      console.error(err);
    }
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleFolderDragStart = (e: React.DragEvent, folderPath: string) => {
    e.stopPropagation();
    const payload = {
      type: 'folder',
      folderPath
    };
    (window as any).__navforDraggingFolder = payload;
    try {
      e.dataTransfer.setData('application/json', JSON.stringify(payload));
      e.dataTransfer.setData('text/plain', JSON.stringify(payload));
    } catch (err) {}
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleFocusDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsFocusDragOver(false);
    try {
      const dataStr = e.dataTransfer.getData('text/plain');
      if (!dataStr) return;
      const data = JSON.parse(dataStr);
      if (data.type === 'task') {
        const ids: string[] = data.taskIds?.length ? data.taskIds : (data.taskId ? [data.taskId] : []);
        ids.forEach(id => onMoveTask(id, 'Urgent'));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleFolderDrop = (e: React.DragEvent, targetFolderPath: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolderPath(null);
    try {
      let data: any = null;
      const raw = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain');
      if (raw) data = JSON.parse(raw);
      if (!data && (window as any).__navforDraggingTask) {
        data = (window as any).__navforDraggingTask;
      }
      if (!data && (window as any).__navforDraggingFolder) {
        data = (window as any).__navforDraggingFolder;
      }

      if (data?.type === 'task') {
        const ids: string[] = data.taskIds?.length ? data.taskIds : (data.taskId ? [data.taskId] : []);
        ids.forEach(id => onMoveTaskFolder(id, targetFolderPath));
        (window as any).__navforDraggingTask = null;
      } else if (data?.type === 'folder' && data.folderPath) {
        if (data.folderPath !== targetFolderPath && !targetFolderPath.startsWith(data.folderPath + '/')) {
          onMoveFolder(data.folderPath, targetFolderPath);
        }
        (window as any).__navforDraggingFolder = null;
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Deadline formatting helper for language
  const formatDeadlineBadge = (deadline: number) => {
    const now = Date.now();
    const isOverdue = deadline < now;
    const targetDate = new Date(deadline);
    const daysDiff = differenceInCalendarDays(targetDate, new Date());

    if (isOverdue) {
      return { status: 'expired', label: isJa ? '期限切' : 'Overdue' };
    }
    if (isToday(targetDate)) {
      return { status: 'approaching', label: isJa ? '本日' : 'Today' };
    }
    if (isTomorrow(targetDate)) {
      return { status: 'approaching', label: isJa ? '明日' : 'Tomorrow' };
    }
    if (daysDiff <= (deadlineThresholdDays || 3)) {
      return { status: 'approaching', label: isJa ? `${daysDiff}日後` : `In ${daysDiff}d` };
    }
    return { status: 'normal', label: format(targetDate, 'M/d') };
  };

  // Render a folder node and its children
  const renderFolder = (node: FolderNode, depth = 0) => {
    const isCollapsed = collapsedFolders.has(node.fullPath);
    const counts = countFolderTasks(node);
    const isCreatingHere = creatingInFolder?.path === node.fullPath;
    const isRenamingHere = renamingItem?.type === 'folder' && renamingItem.idOrPath === node.fullPath;
    const isDragOver = dragOverFolderPath === node.fullPath;
    const isFolderSelected = selectedKey === `folder:${node.fullPath}` || selectedFolderPaths.has(node.fullPath);

    const folderItemKey = `folder:${node.fullPath}`;

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
          id={`explorer-item-${encodeURIComponent(folderItemKey)}`}
          draggable={true}
          tabIndex={0}
          onDragStart={(e) => handleFolderDragStart(e, node.fullPath)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === 'F2') {
              e.preventDefault();
              e.stopPropagation();
              startRenaming('folder', node.fullPath, node.name);
            }
          }}
          onClick={(e) => {
            e.stopPropagation();
            (window as any).__navforActivePane = 'explorer';
            treeRef.current?.focus();
            if (e.ctrlKey || e.metaKey) {
              setSelectedFolderPaths(prev => {
                const next = new Set(prev);
                if (next.has(node.fullPath)) next.delete(node.fullPath);
                else next.add(node.fullPath);
                return next;
              });
              setSelectedKey(folderItemKey);
              setLastSelectedKey(folderItemKey);
            } else if (e.shiftKey && lastSelectedKey) {
              rangeSelectItems(lastSelectedKey, folderItemKey);
              setSelectedKey(folderItemKey);
            } else {
              setSelectedFolderPaths(new Set([node.fullPath]));
              setSelectedTaskIds(new Set());
              setSelectedKey(folderItemKey);
              setLastSelectedKey(folderItemKey);
              toggleFolder(node.fullPath);
            }
          }}
          className={cn(
            "group relative flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all",
            isDragOver 
              ? "bg-indigo-100/90 border border-indigo-500 shadow-xs" 
              : isFolderSelected 
                ? "bg-indigo-100/90 text-indigo-950 font-bold ring-1 ring-indigo-400/40 shadow-2xs" 
                : "text-slate-700 hover:bg-slate-200/50"
          )}
          style={{ paddingLeft: `${Math.max(6, depth * 14 + 6)}px` }}
        >
          {/* Chevron */}
          <span 
            className="text-slate-400 hover:text-slate-700 p-0.5 rounded transition-transform"
            onClick={(e) => {
              e.stopPropagation();
              toggleFolder(node.fullPath);
            }}
          >
            {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
          </span>

          {/* Folder icon */}
          <span className="text-amber-500 shrink-0">
            {isCollapsed ? <Folder size={14} /> : <FolderOpen size={14} />}
          </span>

          {/* Folder name or inline rename input */}
          {isRenamingHere ? (
            <form onSubmit={handleRenameSubmit} onClick={(e) => e.stopPropagation()} className="flex-1 min-w-0">
              <input
                autoFocus
                type="text"
                value={renameInputValue}
                onChange={(e) => setRenameInputValue(e.target.value)}
                onBlur={handleRenameSubmit}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Escape') setRenamingItem(null);
                }}
                className="w-full bg-white border border-indigo-400 rounded px-1 py-0.5 text-xs outline-none shadow-2xs font-mono"
              />
            </form>
          ) : (
            <span 
              onDoubleClick={(e) => {
                e.stopPropagation();
                startRenaming('folder', node.fullPath, node.name);
              }}
              className="truncate flex-1 font-mono tracking-tight text-[11.5px]"
            >
              {node.name}
            </span>
          )}

          {/* Task count badges */}
          {!isRenamingHere && counts.urgent > 0 && (
            <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
              <span className="text-[9px] font-mono px-1 py-0.2 bg-red-100 text-red-700 font-bold rounded-full">
                {counts.urgent}
              </span>
            </div>
          )}

          {/* Action buttons (hover) */}
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
            {/* Quick Add Task in this folder */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (collapsedFolders.has(node.fullPath)) {
                  const next = new Set<string>(collapsedFolders);
                  next.delete(node.fullPath);
                  saveCollapsed(next);
                }
                setCreatingInFolder({ path: node.fullPath, type: 'task' });
                setInlineInputValue('');
              }}
              className="p-0.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-300/40 rounded transition-colors"
              title={isJa ? "このフォルダにタスク作成" : "New task in folder"}
            >
              <FilePlus size={12} />
            </button>
            {/* Quick Add Subfolder in this folder */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (collapsedFolders.has(node.fullPath)) {
                  const next = new Set<string>(collapsedFolders);
                  next.delete(node.fullPath);
                  saveCollapsed(next);
                }
                setCreatingInFolder({ path: node.fullPath, type: 'folder' });
                setInlineInputValue('');
              }}
              className="p-0.5 text-slate-400 hover:text-amber-600 hover:bg-slate-300/40 rounded transition-colors"
              title={isJa ? "このフォルダにサブフォルダ作成" : "New subfolder in folder"}
            >
              <FolderPlus size={12} />
            </button>
            {/* 3-dots Menu Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const rect = e.currentTarget.getBoundingClientRect();
                setActiveMenu({
                  type: 'folder',
                  idOrPath: node.fullPath,
                  x: rect.right,
                  y: rect.bottom
                });
              }}
              className="p-0.5 text-slate-400 hover:text-slate-700 hover:bg-slate-300/40 rounded transition-colors"
              title={isJa ? "操作オプション" : "Folder options"}
            >
              <MoreHorizontal size={13} />
            </button>
          </div>
        </div>

        {/* Inline Create Input inside this folder */}
        {isCreatingHere && (
          <div 
            className="px-2 py-1 flex items-center gap-1.5"
            style={{ paddingLeft: `${(depth + 1) * 14 + 6}px` }}
          >
            <span className="text-slate-400">
              {creatingInFolder.type === 'folder' ? <Folder size={13} className="text-amber-500" /> : <FileText size={13} className="text-indigo-600" />}
            </span>
            <form onSubmit={handleCreateSubmit} className="flex-1 flex items-center gap-1">
              <input
                autoFocus
                type="text"
                placeholder={
                  creatingInFolder.type === 'folder' 
                    ? (isJa ? "フォルダ名..." : "Folder name...") 
                    : (isJa ? "タスク名..." : "Task name...")
                }
                value={inlineInputValue}
                onChange={(e) => setInlineInputValue(e.target.value)}
                onBlur={() => {
                  if (isSubmittingCreateRef.current) return;
                  // Auto cancel if empty on blur as requested!
                  if (!inlineInputValue.trim()) {
                    setCreatingInFolder(null);
                    setInlineInputValue('');
                  } else {
                    handleCreateSubmit();
                  }
                }}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Escape') {
                    setCreatingInFolder(null);
                    setInlineInputValue('');
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCreateSubmit();
                  }
                }}
                className="w-full bg-white border border-indigo-400 rounded px-1.5 py-0.5 text-xs outline-none ring-1 ring-indigo-400/30 shadow-2xs font-sans"
              />
            </form>
          </div>
        )}

        {/* Children (subfolders and tasks) - both sorted alphabetically */}
        {!isCollapsed && (
          <div className="flex flex-col">
            {/* Subfolders */}
            {Array.from(node.subfolders.values())
              .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
              .map(subNode => renderFolder(subNode, depth + 1))}

            {/* Tasks in this folder */}
            {[...node.tasks]
              .sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' }))
              .map(task => renderTaskItem(task, depth + 1, node.fullPath))}
          </div>
        )}
      </div>
    );
  };

  // Render a task file item in tree
  const renderTaskItem = (task: Task, depth = 1, parentPath = '') => {
    const itemKey = parentPath ? `task:${parentPath}:${task.id}` : `task:${task.id}`;
    const isMultiSelected = selectedTaskIds.has(task.id);
    const isFocusItem = parentPath === '__focus__';
    const isPinnedItem = parentPath === '__pinned__';
    const isTreeItem = !isFocusItem && !isPinnedItem;
    const isExactSelected = selectedKey === itemKey;
    const isKeyTaskMatch = selectedKey?.startsWith('task:') && selectedKey.endsWith(`:${task.id}`) && isTreeItem && !selectedKey.includes(':__focus__:') && !selectedKey.includes(':__pinned__:');

    const isSelected = isFocusItem
      ? selectedKey === `task:__focus__:${task.id}`
      : isPinnedItem
        ? selectedKey === `task:__pinned__:${task.id}`
        : (isExactSelected || isKeyTaskMatch || (isMultiSelected && !selectedKey?.includes(':__focus__:') && !selectedKey?.includes(':__pinned__:')));
    const isUrgent = task.category === 'Urgent';
    const isRenamingHere = renamingItem?.type === 'task' && renamingItem.idOrPath === task.id && (!renamingItem.parentPath || renamingItem.parentPath === parentPath);

    const deadlineInfo = task.deadline && !task.isDone ? formatDeadlineBadge(task.deadline) : null;

    return (
      <div
        key={itemKey}
        id={`explorer-item-${encodeURIComponent(itemKey)}`}
        draggable={true}
        tabIndex={0}
        onDragStart={(e) => handleTaskDragStart(e, task)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === 'F2') {
            e.preventDefault();
            e.stopPropagation();
            startRenaming('task', task.id, task.title, parentPath);
          }
        }}
        onClick={(e) => {
          e.stopPropagation();
          (window as any).__navforActivePane = 'explorer';
          treeRef.current?.focus();
          if (e.ctrlKey || e.metaKey) {
            setSelectedTaskIds(prev => {
              const next = new Set(prev);
              if (next.has(task.id)) next.delete(task.id);
              else next.add(task.id);
              return next;
            });
            setSelectedKey(itemKey);
            setLastSelectedKey(itemKey);
            onSelectTask(task.id);
          } else if (e.shiftKey && lastSelectedKey) {
            rangeSelectItems(lastSelectedKey, itemKey);
            setSelectedKey(itemKey);
            onSelectTask(task.id);
          } else {
            setSelectedTaskIds(new Set([task.id]));
            setSelectedFolderPaths(new Set());
            setSelectedKey(itemKey);
            setLastSelectedKey(itemKey);
            onSelectTask(task.id, false);
          }
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          (window as any).__navforActivePane = 'explorer';
          treeRef.current?.focus();
          setSelectedKey(itemKey);
          setLastSelectedKey(itemKey);
          onSelectTask(task.id, true);
        }}
        className={cn(
          "group relative flex items-center gap-1.5 px-2 py-1 rounded-md text-xs cursor-pointer transition-all select-none outline-none",
          isSelected 
            ? "bg-indigo-100/90 text-indigo-950 font-semibold shadow-2xs ring-1 ring-indigo-400/40" 
            : isUrgent 
              ? "text-slate-800 hover:bg-red-50/60" 
              : "text-slate-700 hover:bg-slate-200/50",
          task.isDone && "opacity-50 line-through text-slate-400"
        )}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
      >
        {/* Done / Toggle Checkbox */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleDone(task.id);
          }}
          className="text-slate-400 hover:text-indigo-600 transition-colors shrink-0"
          title={task.isDone ? (isJa ? "未完了に戻す" : "Mark undone") : (isJa ? "完了にする" : "Mark done")}
        >
          {task.isDone ? (
            <CheckCircle2 size={12} className="text-emerald-500" />
          ) : (
            <Circle size={12} className={isUrgent ? "text-red-500" : "text-slate-300"} />
          )}
        </button>

        {/* Priority dot */}
        {isUrgent && !task.isDone && (
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0 shadow-xs" title="Focus" />
        )}

        {/* Task title or inline rename input */}
        {isRenamingHere ? (
          <form onSubmit={handleRenameSubmit} onClick={(e) => e.stopPropagation()} className="flex-1 min-w-0">
            <input
              autoFocus
              type="text"
              value={renameInputValue}
              onChange={(e) => setRenameInputValue(e.target.value)}
              onBlur={handleRenameSubmit}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Escape') setRenamingItem(null);
              }}
              className="w-full bg-white border border-indigo-400 rounded px-1 py-0.5 text-xs outline-none shadow-2xs font-sans"
            />
          </form>
        ) : (
          <span 
            onDoubleClick={(e) => {
              e.stopPropagation();
              startRenaming('task', task.id, task.title, parentPath);
            }}
            className="truncate flex-1 text-[11.5px] leading-tight font-normal"
          >
            {task.title}
          </span>
        )}

        {/* Focus Move / Toggle Icon (Zap) */}
        {!isRenamingHere && (
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
            title={isUrgent ? (isJa ? "フォーカスを解除 (ToDoへ)" : "Remove from Focus") : (isJa ? "フォーカスに追加" : "Move to Focus")}
          >
            <Zap size={11} fill={isUrgent ? "currentColor" : "none"} />
          </button>
        )}

        {/* Star icon */}
        {!isRenamingHere && (task.isStarred ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleStar(task.id);
            }}
            className="text-amber-400 hover:text-amber-500 shrink-0"
            title={isJa ? "重要フラグ解除" : "Unstar"}
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
            title={isJa ? "重要フラグを付ける" : "Star"}
          >
            <Star size={11} />
          </button>
        ))}

        {/* Deadline Badge */}
        {!isRenamingHere && deadlineInfo && (
          <span
            className={cn(
              "text-[9px] px-1 py-0.2 rounded font-mono font-bold shrink-0 leading-none",
              deadlineInfo.status === 'expired' && "bg-red-100 text-red-700 border border-red-200",
              deadlineInfo.status === 'approaching' && "bg-amber-100 text-amber-800 border border-amber-200",
              deadlineInfo.status === 'normal' && "text-slate-400 font-normal"
            )}
          >
            {deadlineInfo.label}
          </span>
        )}

        {/* 3-dots Menu Button */}
        {!isRenamingHere && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              const rect = e.currentTarget.getBoundingClientRect();
              setActiveMenu({
                type: 'task',
                idOrPath: task.id,
                x: rect.right,
                y: rect.bottom
              });
            }}
            className="p-0.5 text-slate-400 hover:text-slate-700 hover:bg-slate-300/40 rounded transition-colors opacity-0 group-hover:opacity-100 shrink-0 ml-0.5"
            title={isJa ? "タスクオプション" : "Task options"}
          >
            <MoreHorizontal size={12} />
          </button>
        )}

        {/* Active Indicator Bar on right */}
        {isSelected && (
          <div className="absolute right-0 top-1 bottom-1 w-1 bg-indigo-600 rounded-l" />
        )}
      </div>
    );
  };

  return (
    <aside 
      id="explorer-tree-root"
      ref={treeRef}
      style={{ width: `${width}px` }}
      onClick={() => {
        (window as any).__navforActivePane = 'explorer';
      }}
      tabIndex={0}
      className="relative flex flex-col h-full w-full lg:w-auto max-lg:!w-full bg-slate-50/90 border-r border-slate-200/90 select-none shrink-0 overflow-hidden outline-none focus:ring-1 focus:ring-indigo-400/30"
    >
      {/* VS Code-style Header / Toolbar */}
      <div 
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
        }}
        onDrop={(e) => handleFolderDrop(e, 'General')}
        className="flex items-center justify-between px-3 py-2 border-b border-slate-200 bg-white/70 shrink-0"
        title={isJa ? "サブフォルダをここにドロップすると最上位フォルダ化できます" : "Drop subfolder here to make it a root folder"}
      >
        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex items-center gap-1.5 min-w-0 hover:bg-slate-200/60 p-1 -ml-1 rounded transition-colors group cursor-pointer text-left"
          title={isJa ? "Explorerを折りたたむ (タイムラインを拡大)" : "Collapse Explorer (Expand timeline)"}
        >
          <Layers size={14} className="text-indigo-600 shrink-0 group-hover:scale-105 transition-transform" />
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 truncate group-hover:text-indigo-600 transition-colors">
            Explorer
          </span>
          <PanelLeftClose size={12} className="text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity ml-0.5" />
        </button>

        {/* Header Action Toolbar */}
        <div className="flex items-center gap-1">
          {/* Search Toggle Button */}
          <button
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            className={cn(
              "p-1 rounded transition-colors",
              isSearchOpen || searchQuery ? "text-indigo-600 bg-indigo-50" : "text-slate-400 hover:text-slate-700 hover:bg-slate-200/60"
            )}
            title={isJa ? "検索" : "Search"}
          >
            <Search size={14} />
          </button>

          {/* Filter Toggle Button */}
          <button
            onClick={() => setIsFilterActiveOnly(!isFilterActiveOnly)}
            className={cn(
              "p-1 rounded transition-colors",
              isFilterActiveOnly ? "text-indigo-600 bg-indigo-50" : "text-slate-400 hover:text-slate-700 hover:bg-slate-200/60"
            )}
            title={isFilterActiveOnly ? (isJa ? "未完了のみ表示中 (クリックで全表示)" : "Active only") : (isJa ? "全表示中 (クリックで未完了のみ)" : "All tasks")}
          >
            <Filter size={14} />
          </button>

          {/* Add Task Button (Targets selected folder or root) */}
          <button
            onClick={() => {
              const target = getTargetFolderForNewItem();
              if (target && collapsedFolders.has(target)) {
                const next = new Set<string>(collapsedFolders);
                next.delete(target);
                saveCollapsed(next);
              }
              setCreatingInFolder({ path: target, type: 'task' });
              setInlineInputValue('');
            }}
            className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-200/60 rounded transition-colors"
            title={isJa ? "新規タスク作成" : "New task"}
          >
            <FilePlus size={14} />
          </button>

          {/* Add Folder Button (Targets selected folder or root) */}
          <button
            onClick={() => {
              const target = getTargetFolderForNewItem();
              if (target && collapsedFolders.has(target)) {
                const next = new Set<string>(collapsedFolders);
                next.delete(target);
                saveCollapsed(next);
              }
              setCreatingInFolder({ path: target, type: 'folder' });
              setInlineInputValue('');
            }}
            className="p-1 text-slate-400 hover:text-amber-600 hover:bg-slate-200/60 rounded transition-colors"
            title={isJa ? "新規フォルダ作成" : "New folder"}
          >
            <FolderPlus size={14} />
          </button>

          {/* Expand All */}
          <button
            onClick={expandAll}
            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded transition-colors"
            title={isJa ? "すべて展開" : "Expand all"}
          >
            <ChevronDown size={14} />
          </button>

          {/* Collapse All */}
          <button
            onClick={() => collapseAll(rootFolderList)}
            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded transition-colors"
            title={isJa ? "すべて折りたたむ" : "Collapse all"}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Search Input Bar (Visible when search is open or query is not empty) */}
      {isSearchOpen && (
        <div className="p-2 border-b border-slate-200/70 bg-white/60 shrink-0">
          <div className="relative flex items-center">
            <Search size={12} className="absolute left-2.5 text-slate-400" />
            <input
              autoFocus
              type="text"
              placeholder={isJa ? "タスク・フォルダを検索..." : "Search tasks and folders..."}
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
        </div>
      )}

      {/* --- STICKY FOCUS (URGENT) SECTION AT TOP (Never scrolls away!) --- */}
      <div 
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          setIsFocusDragOver(true);
        }}
        onDragLeave={() => setIsFocusDragOver(false)}
        onDrop={handleFocusDrop}
        className={cn(
          "shrink-0 z-10 border-b border-red-100/80 bg-red-50/40 transition-all",
          isFocusDragOver && "bg-red-100/90 border-red-400 ring-2 ring-red-400 ring-inset"
        )}
      >
        {/* Focus Section Header */}
        <div 
          onClick={() => setIsFocusSectionCollapsed(!isFocusSectionCollapsed)}
          className="flex items-center justify-between px-2.5 py-1.5 bg-red-100/50 hover:bg-red-100/80 cursor-pointer text-red-900 transition-colors select-none"
        >
          <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider">
            {isFocusSectionCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
            <Zap size={12} className="text-red-500 fill-red-500" />
            <span>FOCUS</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 bg-white/80 rounded-full border border-red-200 text-red-700 font-bold ml-1">
              {urgentTasks.length}/{urgentLimit}
            </span>
          </div>
        </div>

        {/* Focus Task List (Compact) */}
        {!isFocusSectionCollapsed && (
          <div className="max-h-48 overflow-y-auto custom-scrollbar p-1 space-y-0.5">
            {urgentTasks.length === 0 ? (
              <div className="px-3 py-2 text-center text-[10px] text-red-500/70 italic">
                {isJa ? "⚡ タスクをドラッグまたは⚡をクリックして追加" : "⚡ Drag tasks here or click ⚡ to focus"}
              </div>
            ) : (
              urgentTasks.map(task => renderTaskItem(task, 0.5, '__focus__'))
            )}
          </div>
        )}
      </div>

      {/* --- PINNED SECTION (Excludes Done tasks) --- */}
      {pinnedTasks.length > 0 && (
        <div className="shrink-0 border-b border-indigo-100/70 bg-indigo-50/20">
          <div 
            onClick={() => setIsPinnedSectionCollapsed(!isPinnedSectionCollapsed)}
            className="flex items-center justify-between px-2.5 py-1 bg-indigo-100/40 hover:bg-indigo-100/60 cursor-pointer text-indigo-900 transition-colors select-none"
          >
            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider">
              {isPinnedSectionCollapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
              <Pin size={11} className="text-indigo-600 fill-indigo-600" />
              <span>PINNED</span>
              <span className="text-[9px] font-mono px-1 py-0.2 bg-white rounded-full text-indigo-700 font-bold ml-0.5">
                {pinnedTasks.length}
              </span>
            </div>
          </div>

          {!isPinnedSectionCollapsed && (
            <div className="max-h-36 overflow-y-auto custom-scrollbar p-1 space-y-0.5">
              {pinnedTasks.map(task => renderTaskItem(task, 0.5, '__pinned__'))}
            </div>
          )}
        </div>
      )}

      {/* --- SCROLLABLE PROJECT / FOLDER TREE AREA --- */}
      <div 
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
        }}
        onDrop={(e) => handleFolderDrop(e, 'General')}
        className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar p-1 flex flex-col"
      >
        {/* Inline Create Input at Root level */}
        {creatingInFolder?.path === '' && (
          <div className="px-2 py-1 flex items-center gap-1.5">
            <span className="text-slate-400">
              {creatingInFolder.type === 'folder' ? <Folder size={13} className="text-amber-500" /> : <FileText size={13} className="text-indigo-600" />}
            </span>
            <form onSubmit={handleCreateSubmit} className="flex-1 flex items-center gap-1">
              <input
                autoFocus
                type="text"
                placeholder={
                  creatingInFolder.type === 'folder' 
                    ? (isJa ? "フォルダ名..." : "Folder name...") 
                    : (isJa ? "タスク名..." : "Task name...")
                }
                value={inlineInputValue}
                onChange={(e) => setInlineInputValue(e.target.value)}
                onBlur={() => {
                  if (isSubmittingCreateRef.current) return;
                  if (!inlineInputValue.trim()) {
                    setCreatingInFolder(null);
                    setInlineInputValue('');
                  } else {
                    handleCreateSubmit();
                  }
                }}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Escape') {
                    setCreatingInFolder(null);
                    setInlineInputValue('');
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCreateSubmit();
                  }
                }}
                className="w-full bg-white border border-indigo-400 rounded px-1.5 py-0.5 text-xs outline-none ring-1 ring-indigo-400/30 shadow-2xs font-sans"
              />
            </form>
          </div>
        )}

        {/* Render all folders in the workspace */}
        {rootFolderList.map(rootNode => renderFolder(rootNode, 0))}

        {rootFolderList.length === 0 && (
          <div className="p-4 text-center text-xs text-slate-400 italic">
            {isJa ? "フォルダやタスクがありません" : "No folders or tasks"}
          </div>
        )}
      </div>

      {/* 3-dots Context Menu Popover */}
      {activeMenu && (
        <div 
          style={{ top: `${Math.min(activeMenu.y, window.innerHeight - 180)}px`, left: `${Math.min(activeMenu.x, window.innerWidth - 180)}px` }}
          className="fixed z-50 bg-white border border-slate-200 rounded-lg shadow-xl py-1 min-w-[150px] text-xs font-medium text-slate-700 animate-fade-in"
          onClick={(e) => e.stopPropagation()}
        >
          {activeMenu.type === 'folder' ? (
            <>
              <button
                onClick={() => {
                  const parts = activeMenu.idOrPath.split('/');
                  startRenaming('folder', activeMenu.idOrPath, parts[parts.length - 1]);
                }}
                className="w-full px-3 py-1.5 text-left hover:bg-slate-100 flex items-center gap-2"
              >
                <Edit2 size={13} className="text-slate-400" />
                <span>{isJa ? "名前を変更" : "Rename"}</span>
              </button>
              <button
                onClick={() => {
                  if (activeMenu.idOrPath && collapsedFolders.has(activeMenu.idOrPath)) {
                    const next = new Set<string>(collapsedFolders);
                    next.delete(activeMenu.idOrPath);
                    saveCollapsed(next);
                  }
                  setCreatingInFolder({ path: activeMenu.idOrPath, type: 'task' });
                  setInlineInputValue('');
                  setActiveMenu(null);
                }}
                className="w-full px-3 py-1.5 text-left hover:bg-slate-100 flex items-center gap-2"
              >
                <FilePlus size={13} className="text-indigo-600" />
                <span>{isJa ? "新規タスク作成" : "New Task"}</span>
              </button>
              <button
                onClick={() => {
                  if (activeMenu.idOrPath && collapsedFolders.has(activeMenu.idOrPath)) {
                    const next = new Set<string>(collapsedFolders);
                    next.delete(activeMenu.idOrPath);
                    saveCollapsed(next);
                  }
                  setCreatingInFolder({ path: activeMenu.idOrPath, type: 'folder' });
                  setInlineInputValue('');
                  setActiveMenu(null);
                }}
                className="w-full px-3 py-1.5 text-left hover:bg-slate-100 flex items-center gap-2"
              >
                <FolderPlus size={13} className="text-amber-500" />
                <span>{isJa ? "サブフォルダ作成" : "New Subfolder"}</span>
              </button>
              <div className="h-px bg-slate-100 my-1" />
              <button
                onClick={() => handleDeleteFolderAction(activeMenu.idOrPath)}
                className="w-full px-3 py-1.5 text-left hover:bg-red-50 text-red-600 flex items-center gap-2"
              >
                <Trash2 size={13} />
                <span>{isJa ? "フォルダ削除" : "Delete Folder"}</span>
              </button>
            </>
          ) : (
            // Task options
            (() => {
              const task = tasks.find(t => t.id === activeMenu.idOrPath);
              if (!task) return null;
              const isUrgent = task.category === 'Urgent';
              return (
                <>
                  <button
                    onClick={() => startRenaming('task', task.id, task.title)}
                    className="w-full px-3 py-1.5 text-left hover:bg-slate-100 flex items-center gap-2"
                  >
                    <Edit2 size={13} className="text-slate-400" />
                    <span>{isJa ? "名前を変更" : "Rename"}</span>
                  </button>
                  <button
                    onClick={() => {
                      onMoveTask(task.id, isUrgent ? 'Focus' : 'Urgent');
                      setActiveMenu(null);
                    }}
                    className="w-full px-3 py-1.5 text-left hover:bg-slate-100 flex items-center gap-2"
                  >
                    <Zap size={13} className={isUrgent ? "text-slate-400" : "text-red-500"} />
                    <span>{isUrgent ? (isJa ? "Focus解除" : "Remove Focus") : (isJa ? "Focusへ移動" : "Move to Focus")}</span>
                  </button>
                  <button
                    onClick={() => {
                      onToggleStar(task.id);
                      setActiveMenu(null);
                    }}
                    className="w-full px-3 py-1.5 text-left hover:bg-slate-100 flex items-center gap-2"
                  >
                    <Star size={13} className={task.isStarred ? "text-amber-500" : "text-slate-400"} />
                    <span>{task.isStarred ? (isJa ? "重要解除" : "Unstar") : (isJa ? "重要フラグ" : "Star")}</span>
                  </button>
                  {onTogglePin && (
                    <button
                      onClick={() => {
                        onTogglePin(task.id);
                        setActiveMenu(null);
                      }}
                      className="w-full px-3 py-1.5 text-left hover:bg-slate-100 flex items-center gap-2"
                    >
                      <Pin size={13} className={task.isPinned ? "text-indigo-600" : "text-slate-400"} />
                      <span>{task.isPinned ? (isJa ? "ピン解除" : "Unpin") : (isJa ? "ピン留め" : "Pin")}</span>
                    </button>
                  )}
                  {onDuplicateTask && (
                    <button
                      onClick={() => {
                        onDuplicateTask(task);
                        setActiveMenu(null);
                      }}
                      className="w-full px-3 py-1.5 text-left hover:bg-slate-100 flex items-center gap-2 text-slate-700"
                    >
                      <Copy size={13} className="text-slate-400" />
                      <span>{isJa ? "複製" : "Duplicate"}</span>
                    </button>
                  )}
                  <div className="h-px bg-slate-100 my-1" />
                  <button
                    onClick={() => handleDeleteTaskAction(task.id)}
                    className="w-full px-3 py-1.5 text-left hover:bg-red-50 text-red-600 flex items-center gap-2"
                  >
                    <Trash2 size={13} />
                    <span>{isJa ? "ゴミ箱へ移動" : "Delete"}</span>
                  </button>
                </>
              );
            })()
          )}
        </div>
      )}

      {/* Resize Handle on Right Border (Desktop only) */}
      <div
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClickResizer}
        className="hidden lg:block absolute top-0 right-0 bottom-0 w-1 cursor-col-resize hover:bg-indigo-500/50 transition-colors z-20 group"
        title={isJa ? "ドラッグして幅を変更 (ダブルクリックでリセット)" : "Drag to resize (Double click to reset)"}
      >
        <div className="w-full h-full group-hover:bg-indigo-500" />
      </div>
    </aside>
  );
};
