import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Folder,
  FolderPlus,
  ChevronRight,
  Check,
  Plus,
  X,
  FolderTree,
  CornerDownRight,
  Sparkles
} from 'lucide-react';
import { cn, tr } from '../lib/utils';

export interface FinderFolderPickerProps {
  selectedFolder: string;
  onSelectFolder: (folderPath: string) => void;
  existingFolders: string[];
  activeSection: string;
  language?: string;
  onFolderCreated?: (newFolderPath: string) => void;
}

export const FinderFolderPicker: React.FC<FinderFolderPickerProps> = ({
  selectedFolder,
  onSelectFolder,
  existingFolders,
  activeSection,
  language = 'ja',
  onFolderCreated
}) => {
  const L = (ja: string, en: string, fr: string) => tr(language, ja, en, fr);

  // Normalize selected folder into path segments
  const selectedSegments = useMemo(() => {
    return (selectedFolder || 'General')
      .split('/')
      .map(s => s.trim())
      .filter(Boolean);
  }, [selectedFolder]);

  // Internal navigation trail (tracks active column selections)
  const [navTrail, setNavTrail] = useState<string[]>(selectedSegments);

  // Synchronize navTrail when selectedFolder prop changes externally
  useEffect(() => {
    setNavTrail(selectedSegments);
  }, [selectedFolder]);

  // Local state for folders created in this session before re-sync
  const [locallyCreatedFolders, setLocallyCreatedFolders] = useState<string[]>([]);

  // Combined list of all available folder paths
  const allFolders = useMemo(() => {
    const set = new Set<string>(['General']);
    existingFolders.forEach(f => {
      if (typeof f === 'string' && f.trim()) set.add(f.trim());
    });
    locallyCreatedFolders.forEach(f => {
      if (typeof f === 'string' && f.trim()) set.add(f.trim());
    });
    return Array.from(set);
  }, [existingFolders, locallyCreatedFolders]);

  // Inline creation states for each column index
  const [creatingColIdx, setCreatingColIdx] = useState<number | null>(null);
  const [newFolderNameInput, setNewFolderNameInput] = useState('');
  const inlineInputRef = useRef<HTMLInputElement>(null);

  // Horizontal scroll container reference
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (creatingColIdx !== null) {
      setTimeout(() => {
        inlineInputRef.current?.focus();
      }, 50);
    }
  }, [creatingColIdx]);

  // Helper: Get direct child folder names for a given parent path (or root if null)
  const getDirectChildren = (parentPath: string | null): string[] => {
    const set = new Set<string>();
    if (parentPath === null) {
      // Root folders: first segment
      allFolders.forEach(f => {
        const segs = f.split('/').map(s => s.trim()).filter(Boolean);
        if (segs.length > 0) {
          set.add(segs[0]);
        }
      });
      set.add('General');
    } else {
      const prefix = parentPath + '/';
      allFolders.forEach(f => {
        if (f.startsWith(prefix)) {
          const rest = f.slice(prefix.length);
          const segs = rest.split('/').map(s => s.trim()).filter(Boolean);
          if (segs.length > 0) {
            set.add(segs[0]);
          }
        }
      });
    }
    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );
  };

  // Helper: Check if a full folder path has subfolders
  const hasChildren = (fullPath: string): boolean => {
    const prefix = fullPath + '/';
    return allFolders.some(f => f.startsWith(prefix));
  };

  // Determine how many columns to display (at least 3 columns for authentic Mac Finder 3-column view)
  const numColumns = Math.max(3, navTrail.length + 1);

  // Handle selecting an item in a specific column
  const handleSelectItem = (colIdx: number, itemName: string) => {
    const newTrail = [...navTrail.slice(0, colIdx), itemName];
    setNavTrail(newTrail);
    const fullPath = newTrail.join('/');
    onSelectFolder(fullPath);

    // Auto-scroll container to the right if next column will be active
    setTimeout(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTo({
          left: scrollContainerRef.current.scrollWidth,
          behavior: 'smooth'
        });
      }
    }, 80);
  };

  // Handle creating a new folder in a specific column
  const handleCreateFolder = (colIdx: number) => {
    const trimmed = newFolderNameInput.trim().replace(/\//g, '_');
    if (!trimmed) {
      setCreatingColIdx(null);
      setNewFolderNameInput('');
      return;
    }

    let newFullPath = '';
    if (colIdx === 0) {
      newFullPath = trimmed;
    } else {
      const parentPath = navTrail.slice(0, colIdx).join('/');
      newFullPath = parentPath ? `${parentPath}/${trimmed}` : trimmed;
    }

    // Save to localStorage customFolders
    try {
      const storageKey = `navfor_folders_${activeSection}`;
      const saved = localStorage.getItem(storageKey);
      const currentList: string[] = saved ? JSON.parse(saved) : [];
      if (!currentList.includes(newFullPath)) {
        currentList.push(newFullPath);
        localStorage.setItem(storageKey, JSON.stringify(currentList));
      }
      window.dispatchEvent(new Event('navfor_folders_updated'));
    } catch (e) {
      console.error('Failed to save new folder to localStorage:', e);
    }

    setLocallyCreatedFolders(prev => [...prev, newFullPath]);
    onFolderCreated?.(newFullPath);

    // Select the newly created folder
    const newTrail = colIdx === 0 ? [trimmed] : [...navTrail.slice(0, colIdx), trimmed];
    setNavTrail(newTrail);
    onSelectFolder(newFullPath);

    setCreatingColIdx(null);
    setNewFolderNameInput('');
  };

  return (
    <div className="w-full bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden flex flex-col select-none text-xs">
      {/* 1. Header Bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-b from-slate-100 to-slate-200/80 border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-1.5 text-slate-700 font-bold text-[11px] min-w-0">
          <FolderTree size={14} className="text-indigo-600 shrink-0" />
          <span className="shrink-0">{L('フォルダ選択（3列カラム表示）', 'Folder Selection (3 Columns)', 'Sélection de dossier (3 colonnes)')}</span>
        </div>

        {/* Global Quick Add Folder Button */}
        <button
          type="button"
          onClick={() => {
            // If something is navigated, create inside it; otherwise at root
            const targetCol = navTrail.length > 0 ? navTrail.length : 0;
            setCreatingColIdx(targetCol);
            setNewFolderNameInput('');
          }}
          className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-white/90 hover:bg-white text-indigo-700 border border-slate-300 rounded shadow-2xs transition-colors cursor-pointer"
          title={L('新規フォルダを作成', 'Create new folder', 'Créer un dossier')}
        >
          <FolderPlus size={11} className="text-indigo-600" />
          <span>{L('＋ 新規フォルダ', '+ New Folder', '+ Nouveau dossier')}</span>
        </button>
      </div>

      {/* 2. Breadcrumb Path Bar */}
      <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-200 flex items-center gap-1 text-[11px] text-slate-600 overflow-x-auto custom-scrollbar-none">
        <span className="text-slate-400 font-medium shrink-0">{L('パス', 'Path', 'Chemin')}:</span>
        <button
          type="button"
          onClick={() => {
            setNavTrail([]);
            onSelectFolder('General');
          }}
          className={cn(
            "px-1.5 py-0.5 rounded transition-colors shrink-0 font-mono",
            navTrail.length === 0
              ? "bg-indigo-100 text-indigo-700 font-bold"
              : "hover:bg-slate-200/60 text-slate-700"
          )}
        >
          {L('ルート', 'Root', 'Racine')}
        </button>

        {navTrail.map((seg, idx) => {
          const isLast = idx === navTrail.length - 1;
          const subPath = navTrail.slice(0, idx + 1).join('/');
          return (
            <React.Fragment key={idx}>
              <ChevronRight size={11} className="text-slate-400 shrink-0" />
              <button
                type="button"
                onClick={() => {
                  setNavTrail(navTrail.slice(0, idx + 1));
                  onSelectFolder(subPath);
                }}
                className={cn(
                  "px-1.5 py-0.5 rounded transition-colors shrink-0 font-mono flex items-center gap-1",
                  isLast
                    ? "bg-indigo-600 text-white font-bold shadow-2xs"
                    : "hover:bg-slate-200/60 text-slate-700"
                )}
              >
                <Folder size={11} className={isLast ? "text-indigo-200" : "text-amber-500"} />
                <span>{seg}</span>
              </button>
            </React.Fragment>
          );
        })}
      </div>

      {/* 3. Mac Finder Miller Columns (3 Columns displayed side-by-side) */}
      <div
        ref={scrollContainerRef}
        className="flex flex-row overflow-x-auto min-h-[220px] max-h-[260px] bg-white divide-x divide-slate-200 custom-scrollbar"
      >
        {Array.from({ length: numColumns }).map((_, colIdx) => {
          // Parent full path for this column
          const parentPath = colIdx === 0 ? null : navTrail.slice(0, colIdx).join('/');
          const isUnlocked = colIdx === 0 || navTrail.length >= colIdx;
          const items = isUnlocked ? getDirectChildren(parentPath) : [];
          const selectedInThisCol = navTrail[colIdx] || null;

          // Column header title
          let colTitle = '';
          if (colIdx === 0) {
            colTitle = L('親フォルダ (ルート)', 'Root Folders', 'Dossiers racines');
          } else {
            const parentName = navTrail[colIdx - 1];
            colTitle = parentName ? `${parentName} ›` : `Column ${colIdx + 1}`;
          }

          return (
            <div
              key={colIdx}
              className={cn(
                "flex-1 min-w-[155px] max-w-[210px] sm:max-w-none flex flex-col bg-white overflow-hidden shrink-0",
                !isUnlocked && "bg-slate-50/50"
              )}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between px-2.5 py-1.5 bg-slate-50/90 border-b border-slate-100 text-[10px] font-bold text-slate-500 shrink-0">
                <span className="truncate" title={colTitle}>
                  {colTitle}
                </span>
                {isUnlocked && (
                  <span className="text-[9px] font-mono font-medium text-slate-400 bg-slate-200/60 px-1 py-0.2 rounded shrink-0">
                    {items.length}
                  </span>
                )}
              </div>

              {/* Column Items List */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-1 space-y-0.5">
                {!isUnlocked ? (
                  <div className="p-4 text-center text-slate-400 text-[11px] italic">
                    {L('左のフォルダを選択してください', 'Select a folder on the left', 'Sélectionnez un dossier à gauche')}
                  </div>
                ) : items.length === 0 && creatingColIdx !== colIdx ? (
                  <div className="p-3 text-center text-slate-400 text-[10.5px]">
                    <div className="mb-1">{L('サブフォルダはありません', 'No subfolders', 'Aucun sous-dossier')}</div>
                    <button
                      type="button"
                      onClick={() => {
                        setCreatingColIdx(colIdx);
                        setNewFolderNameInput('');
                      }}
                      className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded transition-colors"
                    >
                      <Plus size={10} />
                      <span>{L('サブフォルダ作成', 'Add subfolder', 'Créer un sous-dossier')}</span>
                    </button>
                  </div>
                ) : (
                  items.map(itemName => {
                    const itemFullPath = colIdx === 0
                      ? itemName
                      : `${parentPath}/${itemName}`;
                    const isSelected = selectedInThisCol === itemName;
                    const isFinalTarget = itemFullPath === selectedFolder;
                    const itemHasSubs = hasChildren(itemFullPath);

                    return (
                      <button
                        key={itemName}
                        type="button"
                        onClick={() => handleSelectItem(colIdx, itemName)}
                        className={cn(
                          "w-full px-2 py-1.5 rounded-lg text-left flex items-center justify-between gap-1.5 transition-colors cursor-pointer text-xs group",
                          isSelected
                            ? isFinalTarget
                              ? "bg-indigo-600 text-white font-bold shadow-xs"
                              : "bg-indigo-100/90 text-indigo-950 font-bold border-r-2 border-indigo-600"
                            : "hover:bg-slate-100 text-slate-700"
                        )}
                        title={itemFullPath}
                      >
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          <Folder
                            size={13}
                            className={cn(
                              "shrink-0",
                              isSelected
                                ? isFinalTarget
                                  ? "text-white"
                                  : "text-indigo-600"
                                : "text-amber-500"
                            )}
                          />
                          <span className="truncate font-mono text-[11.5px] leading-tight">
                            {itemName}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {isFinalTarget && (
                            <Check
                              size={11}
                              strokeWidth={3}
                              className={isSelected ? "text-white" : "text-indigo-600"}
                            />
                          )}
                          {itemHasSubs && (
                            <ChevronRight
                              size={12}
                              className={cn(
                                "shrink-0 transition-transform",
                                isSelected
                                  ? isFinalTarget
                                    ? "text-white"
                                    : "text-indigo-700"
                                  : "text-slate-400 group-hover:text-slate-600"
                              )}
                            />
                          )}
                        </div>
                      </button>
                    );
                  })
                )}

                {/* Inline New Folder Input when creating in this column */}
                {isUnlocked && creatingColIdx === colIdx && (
                  <div className="p-1.5 bg-indigo-50/70 border border-indigo-200 rounded-lg space-y-1 animate-in fade-in zoom-in-95 duration-100 mt-1">
                    <div className="flex items-center gap-1 text-[10px] font-bold text-indigo-800">
                      <FolderPlus size={11} className="text-indigo-600 shrink-0" />
                      <span>{L('新規フォルダ名', 'New Folder Name', 'Nom du dossier')}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <input
                        ref={inlineInputRef}
                        type="text"
                        value={newFolderNameInput}
                        onChange={e => setNewFolderNameInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleCreateFolder(colIdx);
                          } else if (e.key === 'Escape') {
                            setCreatingColIdx(null);
                            setNewFolderNameInput('');
                          }
                        }}
                        placeholder={L('名前を入力...', 'Name...', 'Nom...')}
                        className="flex-1 bg-white border border-indigo-300 rounded px-1.5 py-0.5 text-xs font-mono outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={() => handleCreateFolder(colIdx)}
                        className="px-1.5 py-0.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[10px] font-bold shrink-0 cursor-pointer"
                      >
                        {L('作成', 'Create', 'Créer')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCreatingColIdx(null);
                          setNewFolderNameInput('');
                        }}
                        className="p-0.5 text-slate-400 hover:text-slate-600 rounded shrink-0 cursor-pointer"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Column Footer: Inline + Button to add to this level */}
              {isUnlocked && creatingColIdx !== colIdx && (
                <div className="p-1 border-t border-slate-100 bg-slate-50/50 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setCreatingColIdx(colIdx);
                      setNewFolderNameInput('');
                    }}
                    className="w-full py-1 px-1.5 text-[10px] font-medium text-slate-500 hover:text-indigo-600 hover:bg-indigo-50/70 border border-dashed border-slate-200 hover:border-indigo-300 rounded-md transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    title={
                      colIdx === 0
                        ? L('ルートに新規フォルダを作成', 'Create folder at root', 'Créer à la racine')
                        : L(`「${navTrail[colIdx - 1]}」内にサブフォルダを作成`, `Create subfolder inside "${navTrail[colIdx - 1]}"`, 'Créer un sous-dossier')
                    }
                  >
                    <Plus size={10} />
                    <span className="truncate">
                      {colIdx === 0
                        ? L('＋ 新規フォルダ', '+ New Folder', '+ Nouveau dossier')
                        : L('＋ サブフォルダ', '+ Subfolder', '+ Sous-dossier')}
                    </span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 4. Bottom Confirmation & Status Bar */}
      <div className="px-3 py-2 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[10.5px] font-bold text-slate-500 shrink-0">
            {L('選択中:', 'Selected:', 'Sélectionné :')}
          </span>
          <div className="flex items-center gap-1 px-2 py-0.5 bg-indigo-50 border border-indigo-200/80 rounded-md text-indigo-700 font-mono font-bold text-[11px] truncate shadow-2xs">
            <Folder size={12} className="text-amber-500 shrink-0" />
            <span className="truncate">{selectedFolder || 'General'}</span>
          </div>
        </div>

        <div className="flex items-center gap-1 text-[10px] text-slate-400">
          <Sparkles size={11} className="text-amber-500 shrink-0" />
          <span>{L('タスクはこのフォルダに保存されます', 'Tasks will be created in this folder', 'La tâche sera créée dans ce dossier')}</span>
        </div>
      </div>
    </div>
  );
};
