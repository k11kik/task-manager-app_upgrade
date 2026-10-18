import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Clock, 
  Folder, 
  FolderOpen, 
  FolderPlus,
  Plus, 
  Star, 
  CheckCircle2, 
  Circle, 
  Zap, 
  Pin,
  Layers,
  ArrowRight,
  Filter,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  CalendarDays,
  SlidersHorizontal,
  Edit2,
  Trash2,
  GripVertical,
  Check,
  X,
  RefreshCw,
  ListTodo,
  RotateCcw,
  Repeat,
  LayoutGrid,
  ArrowLeftRight,
  MoreHorizontal,
  Copy,
  FilePlus,
  Maximize2,
  Minimize2,
  Workflow,
  Menu
} from 'lucide-react';
import { Task, Category, FolderMeta } from '../types';
import { cn, tr } from '../lib/utils';
import { format, addDays, subDays, startOfDay, isSameDay, isToday, isTomorrow, differenceInCalendarDays } from 'date-fns';
import { isTaskOccurringOnDate } from '../lib/taskDateUtils';
import { db } from '../lib/firebase';
import { doc, setDoc, onSnapshot, query, collection, where } from 'firebase/firestore';
import { User } from 'firebase/auth';

export interface CustomTimelineColumn {
  id: string;
  label: string;
}

export interface PhasePattern {
  id: string;
  name: string;
  columns: CustomTimelineColumn[];
  createdAt?: number;
  updatedAt?: number;
}

export type TimeFilterUnit = 'week' | 'month' | 'year';

export interface TimelineTimeFilter {
  enabled: boolean;
  amount: number;
  unit: TimeFilterUnit;
}

export const DEFAULT_PATTERN_ID = 'default';

export type TimelineNavItem = 
  | { type: 'folder'; path: string; name: string; level: number; projectIndex: number; colIndex: number; slotKey: string }
  | { type: 'task'; taskId: string; task: Task; projectPath: string; projectIndex: number; colIndex: number; slotKey: string; cellIndex: number };

const DEFAULT_CUSTOM_COLUMNS: CustomTimelineColumn[] = [
  { id: 'phase-1', label: 'Phase 1' },
  { id: 'phase-2', label: 'Phase 2' },
  { id: 'phase-3', label: 'Phase 3' },
  { id: 'phase-4', label: 'Phase 4' },
  { id: 'phase-5', label: 'Phase 5' }
];

export const getTaskCurrentColumnId = (
  task: Task, 
  cols: CustomTimelineColumn[],
  patternId?: string
): string | undefined => {
  // 1. Check pattern-specific column mapping first if patternId is given
  if (patternId && task.timelinePresetColumns && task.timelinePresetColumns[patternId]) {
    const colId = task.timelinePresetColumns[patternId];
    if (cols.some(c => c.id === colId)) {
      return colId;
    }
    return undefined;
  }
  // 2. Backward compatibility: if patternId is 'default' or not provided, check direct timelineColumn
  if ((!patternId || patternId === DEFAULT_PATTERN_ID) && task.timelineColumn && cols.some(c => c.id === task.timelineColumn)) {
    return task.timelineColumn;
  }
  // 3. Fallback check for legacy timelinePresetColumns only if patternId is not specified
  if (!patternId && task.timelinePresetColumns) {
    for (const [, colId] of Object.entries(task.timelinePresetColumns)) {
      if (colId && cols.some(c => c.id === colId)) {
        return colId;
      }
    }
  }
  return undefined;
};

export const getTaskCurrentStep = (
  task: Task,
  patternId?: string
): number => {
  if (patternId && task.timelinePresetSteps && task.timelinePresetSteps[patternId] !== undefined) {
    return task.timelinePresetSteps[patternId];
  }
  if (!patternId || patternId === DEFAULT_PATTERN_ID) {
    return task.timelineStep ?? 0;
  }
  return 0;
};

// Helper to determine if a task has an all-day deadline or is all-day
export const isTaskAllDayDeadline = (task: { deadline?: number; startDate?: number; isAllDay?: boolean } | null | undefined): boolean => {
  if (!task) return false;
  if (task.isAllDay) return true;
  if (typeof task.deadline === 'number') {
    const d = new Date(task.deadline);
    if (d.getHours() === 23 && d.getMinutes() >= 59) return true;
    if (d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0) return true;
    if (d.getHours() === 18 && d.getMinutes() === 0 && d.getSeconds() === 0) return true;
  }
  return false;
};

// Helper for approaching or overdue deadline alerts
export const getTaskDeadlineAlert = (deadline?: number, isDone?: boolean, language: string = 'ja', taskIsAllDay?: boolean) => {
  if (!deadline || isDone) return null;
  const now = Date.now();
  const targetDate = new Date(deadline);
  const isTargetToday = isToday(targetDate);
  const isTargetTomorrow = isTomorrow(targetDate);
  const daysDiff = differenceInCalendarDays(targetDate, new Date());
  const isAllDay = taskIsAllDay ?? isTaskAllDayDeadline({ deadline });

  // For all-day tasks on today, they are due until 23:59:59 of today, so they are NEVER overdue while it's still today
  if (isTargetToday && isAllDay) {
    return {
      isOverdue: false,
      label: tr(language, '本日', 'Today', 'Auj.'),
      tooltip: tr(language, '本日締切 (終日)', 'Due today (All day)', "Échéance aujourd'hui (Toute la journée)")
    };
  }

  const effectiveDeadline = (isAllDay && isTargetToday)
    ? new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59, 999).getTime()
    : deadline;

  const isOverdue = effectiveDeadline < now;

  if (isOverdue) {
    return {
      isOverdue: true,
      label: tr(language, '期限切', 'Overdue', 'Retard'),
      tooltip: tr(language, `期限切れ: ${format(targetDate, isAllDay ? 'yyyy/MM/dd' : 'yyyy/MM/dd HH:mm')}`, `Overdue: ${format(targetDate, isAllDay ? 'MM/dd/yyyy' : 'MM/dd/yyyy HH:mm')}`, `En retard : ${format(targetDate, isAllDay ? 'dd/MM/yyyy' : 'dd/MM/yyyy HH:mm')}`)
    };
  }
  if (isTargetToday) {
    return {
      isOverdue: false,
      label: tr(language, '本日', 'Today', 'Auj.'),
      tooltip: isAllDay 
        ? tr(language, '本日締切 (終日)', 'Due today (All day)', "Échéance aujourd'hui (Toute la journée)")
        : tr(language, `本日締切: ${format(targetDate, 'HH:mm')}`, `Due today: ${format(targetDate, 'HH:mm')}`, `Échéance aujourd'hui : ${format(targetDate, 'HH:mm')}`)
    };
  }
  if (isTargetTomorrow) {
    return {
      isOverdue: false,
      label: tr(language, '明日', 'Tomorrow', 'Demain'),
      tooltip: tr(language, `明日締切: ${format(targetDate, 'MM/dd')}`, `Due tomorrow: ${format(targetDate, 'MM/dd')}`, `Échéance demain : ${format(targetDate, 'dd/MM')}`)
    };
  }
  if (daysDiff <= 3 && daysDiff > 0) {
    return {
      isOverdue: false,
      label: tr(language, `あと${daysDiff}日`, `In ${daysDiff}d`, `Dans ${daysDiff}j`),
      tooltip: tr(language, `締切間近: ${format(targetDate, 'MM/dd')}`, `Due soon: ${format(targetDate, 'MM/dd')}`, `Échéance proche : ${format(targetDate, 'dd/MM')}`)
    };
  }
  return null;
};

interface ProjectTimelineViewProps {
  tasks: Task[];
  activeTaskId: string | null;
  onSelectTask: (taskId: string, isPermanent?: boolean) => void;
  onUpdateTask?: (taskId: string, updates: Partial<Task>) => void;
  onScheduleTask?: (taskId: string, deadline?: number) => void;
  onMoveTaskFolder?: (taskId: string, newProject: string) => void;
  onMoveFolder?: (sourceFolderPath: string, targetFolderPath: string) => void;
  onRenameFolder?: (oldFolderPath: string, newFolderPath: string, newTitle?: string) => void;
  onDeleteFolder?: (folderPath: string) => void;
  onDuplicateFolder?: (folderPath: string) => void;
  onRenameTask?: (taskId: string, newTitle: string) => void;
  onDeleteTask?: (taskId: string) => void;
  onDuplicateTask?: (task: Task, targetProject?: string) => void;
  onToggleDone: (taskId: string) => void;
  onToggleStar: (taskId: string) => void;
  onTogglePin?: (taskId: string) => void;
  onMoveTask?: (taskId: string, category: Category) => void;
  onAddTask: (taskData: { 
    title: string; 
    project: string; 
    deadline?: number; 
    isAllDay?: boolean;
    timelineColumn?: string;
    timelineStep?: number;
    timelinePresetColumns?: Record<string, string>;
    order?: number;
  }) => Promise<void>;
  activeSection?: string;
  language?: string;
  folderMetas?: Record<string, FolderMeta>;
  onUpdateFolderMeta?: (folderPath: string, updates: Partial<FolderMeta>, options?: { skipHistory?: boolean }) => void;
  onToggleFolderStar?: (folderPath: string) => void;
  onToggleFolderPin?: (folderPath: string) => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onOpenCreateTaskModal?: (defaultProject?: string) => void;
  phasePatterns?: PhasePattern[];
  activePatternId?: string;
  onSavePhasePatterns?: (section: string, patterns: PhasePattern[], activePatternId?: string) => Promise<void> | void;
  user?: User | null;
  t: (key: string) => string;
}

export const ProjectTimelineView: React.FC<ProjectTimelineViewProps> = ({
  tasks,
  activeTaskId,
  onSelectTask,
  onUpdateTask,
  onScheduleTask,
  onMoveTaskFolder,
  onMoveFolder,
  onRenameFolder,
  onDeleteFolder,
  onDuplicateFolder,
  onRenameTask,
  onDeleteTask,
  onDuplicateTask,
  onToggleDone,
  onToggleStar,
  onTogglePin,
  onMoveTask,
  onAddTask,
  activeSection = 'dashboard',
  language = 'en',
  folderMetas,
  onUpdateFolderMeta,
  onToggleFolderStar,
  onToggleFolderPin,
  isFullscreen = false,
  onToggleFullscreen,
  onOpenCreateTaskModal,
  phasePatterns: propPhasePatterns,
  activePatternId: propActivePatternId,
  onSavePhasePatterns,
  user,
  t
}) => {
  const L = (ja: string, en: string, fr: string) => tr(language, ja, en, fr);

  // Mode: 'calendar' (specific dates) vs 'custom' (abstract columns: 1 day, 1 week, custom stages)
  const [timelineMode, setTimelineMode] = useState<'calendar' | 'custom'>(() => {
    try {
      return (localStorage.getItem('navfor_timeline_mode') as 'calendar' | 'custom') || 'calendar';
    } catch {
      return 'calendar';
    }
  });

  const handleSetTimelineMode = (mode: 'calendar' | 'custom') => {
    setTimelineMode(mode);
    try {
      localStorage.setItem('navfor_timeline_mode', mode);
    } catch (e) {
      console.error(e);
    }
  };

  // Phase Patterns State (Prop-driven from App.tsx settings with local storage fallback)
  const [localPhasePatterns, setLocalPhasePatterns] = useState<PhasePattern[]>(() => {
    if (propPhasePatterns && propPhasePatterns.length > 0) return propPhasePatterns;
    try {
      const saved = localStorage.getItem(`navfor_phase_patterns_${activeSection}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
      // Check legacy single-pattern custom columns if existing
      const legacyColsSaved = localStorage.getItem(`navfor_custom_timeline_cols_${activeSection}`);
      let legacyCols: CustomTimelineColumn[] | undefined;
      if (legacyColsSaved) {
        const parsed = JSON.parse(legacyColsSaved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const isOldDayDefault = parsed.length === 7 && parsed[0]?.id === 'day-1' && parsed[6]?.id === 'day-7';
          if (!isOldDayDefault) {
            legacyCols = parsed;
          }
        }
      }
      return [
        {
          id: DEFAULT_PATTERN_ID,
          name: language === 'ja' ? 'デフォルト' : language === 'fr' ? 'Par défaut' : 'Default',
          columns: legacyCols || DEFAULT_CUSTOM_COLUMNS,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      ];
    } catch (e) {
      console.error(e);
      return [
        {
          id: DEFAULT_PATTERN_ID,
          name: language === 'ja' ? 'デフォルト' : language === 'fr' ? 'Par défaut' : 'Default',
          columns: DEFAULT_CUSTOM_COLUMNS,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      ];
    }
  });

  const [localActivePatternId, setLocalActivePatternId] = useState<string>(() => {
    if (propActivePatternId) return propActivePatternId;
    try {
      const saved = localStorage.getItem(`navfor_active_phase_pattern_${activeSection}`);
      if (saved) return saved;
    } catch (e) {}
    return DEFAULT_PATTERN_ID;
  });

  // Effective state: merge prop from App.tsx, local state, and localStorage so user patterns are NEVER lost or overwritten
  const phasePatterns = useMemo(() => {
    const map = new Map<string, PhasePattern>();
    // 1. Local state (including Firestore real-time listener updates)
    if (Array.isArray(localPhasePatterns)) {
      localPhasePatterns.forEach(p => {
        if (p && p.id) map.set(p.id, p);
      });
    }
    // 2. Prop from App.tsx
    if (propPhasePatterns && Array.isArray(propPhasePatterns)) {
      propPhasePatterns.forEach(p => {
        if (p && p.id) {
          const existing = map.get(p.id);
          if (!existing || (p.updatedAt && (!existing.updatedAt || p.updatedAt >= existing.updatedAt))) {
            map.set(p.id, p);
          }
        }
      });
    }
    // 3. Fallback from localStorage (all sections across user account)
    try {
      const keys = Object.keys(localStorage).filter(k => k.startsWith('navfor_phase_patterns_'));
      keys.forEach(k => {
        const saved = localStorage.getItem(k);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            parsed.forEach((p: PhasePattern) => {
              if (p && p.id && !map.has(p.id)) {
                map.set(p.id, p);
              }
            });
          }
        }
      });
    } catch {}

    const result = Array.from(map.values());
    return result.length > 0 ? result : [
      {
        id: DEFAULT_PATTERN_ID,
        name: language === 'ja' ? 'デフォルト' : language === 'fr' ? 'Par défaut' : 'Default',
        columns: DEFAULT_CUSTOM_COLUMNS,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
    ];
  }, [localPhasePatterns, propPhasePatterns, activeSection, language]);

  const activePatternId = useMemo(() => {
    if (propActivePatternId && phasePatterns.some(p => p.id === propActivePatternId)) {
      return propActivePatternId;
    }
    if (localActivePatternId && phasePatterns.some(p => p.id === localActivePatternId)) {
      return localActivePatternId;
    }
    return phasePatterns[0]?.id || DEFAULT_PATTERN_ID;
  }, [propActivePatternId, localActivePatternId, phasePatterns]);

  // Keep local state in sync when cloud props change without dropping custom patterns
  useEffect(() => {
    if (propPhasePatterns && propPhasePatterns.length > 0) {
      setLocalPhasePatterns(prev => {
        const map = new Map<string, PhasePattern>();
        prev.forEach(p => map.set(p.id, p));
        propPhasePatterns.forEach(p => map.set(p.id, p));
        const merged = Array.from(map.values());
        try {
          localStorage.setItem(`navfor_phase_patterns_${activeSection}`, JSON.stringify(merged));
          if (propActivePatternId) {
            localStorage.setItem(`navfor_active_phase_pattern_${activeSection}`, propActivePatternId);
          }
        } catch {}
        return merged;
      });
    }
  }, [propPhasePatterns, propActivePatternId, activeSection]);

  // Re-sync patterns and active pattern when activeSection changes or external update occurs
  const syncPatterns = useCallback(() => {
    try {
      const saved = localStorage.getItem(`navfor_phase_patterns_${activeSection}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setLocalPhasePatterns(prev => {
            const map = new Map<string, PhasePattern>();
            prev.forEach(p => map.set(p.id, p));
            parsed.forEach((p: PhasePattern) => map.set(p.id, p));
            return Array.from(map.values());
          });
        }
      }
      const savedActive = localStorage.getItem(`navfor_active_phase_pattern_${activeSection}`);
      if (savedActive) {
        setLocalActivePatternId(savedActive);
      }
    } catch (e) {
      console.error(e);
    }
  }, [activeSection]);

  useEffect(() => {
    syncPatterns();
    window.addEventListener('navfor_phase_patterns_updated', syncPatterns);
    return () => window.removeEventListener('navfor_phase_patterns_updated', syncPatterns);
  }, [syncPatterns]);

  // Helper for safe Firestore Phase Config document ID
  const getPhaseConfigDocId = useCallback((uid: string, section: string) => {
    const safeSection = encodeURIComponent(section).replace(/[^a-zA-Z0-9_-]/g, '_') || 'General';
    return `${uid}_${safeSection}`;
  }, []);

  // Real-time Cloud Synchronization of Phase Patterns per user account & section across devices
  useEffect(() => {
    if (!user?.uid) return;

    // Listen to all phase configs belonging to this user account
    const q = query(collection(db, 'phase_configs'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let currentSectionDoc: any = null;
      const allUserPatternsMap = new Map<string, PhasePattern>();

      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (data.userId === user.uid && Array.isArray(data.patterns)) {
          if (data.section === activeSection) {
            currentSectionDoc = data;
          }
          data.patterns.forEach((p: PhasePattern) => {
            if (p && p.id) {
              const existing = allUserPatternsMap.get(p.id);
              if (!existing || (p.updatedAt && (!existing.updatedAt || p.updatedAt >= existing.updatedAt))) {
                allUserPatternsMap.set(p.id, p);
              }
            }
          });
        }
      });

      // Get current local patterns from storage
      const localRaw = localStorage.getItem(`navfor_phase_patterns_${activeSection}`);
      let localParsed: PhasePattern[] = [];
      try { if (localRaw) localParsed = JSON.parse(localRaw); } catch {}

      const mergedMap = new Map<string, PhasePattern>();
      // 1. Current section patterns from cloud
      if (currentSectionDoc && Array.isArray(currentSectionDoc.patterns)) {
        currentSectionDoc.patterns.forEach((p: PhasePattern) => mergedMap.set(p.id, p));
      }
      // 2. Local patterns
      if (Array.isArray(localParsed)) {
        localParsed.forEach((p: PhasePattern) => {
          if (!mergedMap.has(p.id)) mergedMap.set(p.id, p);
        });
      }
      // 3. User account patterns across all sections
      allUserPatternsMap.forEach((p: PhasePattern) => {
        if (!mergedMap.has(p.id)) mergedMap.set(p.id, p);
      });

      const mergedPatterns = Array.from(mergedMap.values());
      if (mergedPatterns.length > 0) {
        setLocalPhasePatterns(mergedPatterns);
        const targetActive = currentSectionDoc?.activePatternId ||
          (mergedMap.has(activePatternId) ? activePatternId : mergedPatterns[0]?.id || DEFAULT_PATTERN_ID);
        setLocalActivePatternId(targetActive);

        try {
          localStorage.setItem(`navfor_phase_patterns_${activeSection}`, JSON.stringify(mergedPatterns));
          localStorage.setItem(`navfor_active_phase_pattern_${activeSection}`, targetActive);
          const current = mergedPatterns.find(p => p.id === targetActive) || mergedPatterns[0];
          if (current) {
            localStorage.setItem(`navfor_custom_timeline_cols_${activeSection}`, JSON.stringify(current.columns));
          }
        } catch {}

        // If current section cloud doc didn't exist or missed any patterns, sync back to cloud!
        if (!currentSectionDoc || currentSectionDoc.patterns.length < mergedPatterns.length) {
          const configDocId = getPhaseConfigDocId(user.uid, activeSection);
          const configDocRef = doc(db, 'phase_configs', configDocId);
          setDoc(configDocRef, {
            userId: user.uid,
            section: activeSection,
            activePatternId: targetActive,
            patterns: mergedPatterns.map(p => ({
              id: p.id,
              name: p.name,
              columns: p.columns || [],
              createdAt: p.createdAt || Date.now(),
              updatedAt: p.updatedAt || Date.now()
            })),
            updatedAt: Date.now()
          }, { merge: true }).catch(() => {});
        }
      }
    }, (err) => {
      console.warn("Phase patterns account sync notice:", err.message);
    });

    return () => unsubscribe();
  }, [user?.uid, activeSection, getPhaseConfigDocId]);

  // Active pattern resolution
  const activePattern = useMemo<PhasePattern>(() => {
    return phasePatterns.find(p => p.id === activePatternId) || phasePatterns[0] || {
      id: DEFAULT_PATTERN_ID,
      name: language === 'ja' ? 'デフォルト' : 'Default',
      columns: DEFAULT_CUSTOM_COLUMNS
    };
  }, [phasePatterns, activePatternId, language]);

  const customColumns = activePattern.columns;

  const savePhasePatterns = (patterns: PhasePattern[], newActivePatternId?: string) => {
    const targetActiveId = newActivePatternId || activePatternId;
    setLocalPhasePatterns(patterns);
    if (newActivePatternId) {
      setLocalActivePatternId(newActivePatternId);
    }
    try {
      localStorage.setItem(`navfor_phase_patterns_${activeSection}`, JSON.stringify(patterns));
      localStorage.setItem(`navfor_active_phase_pattern_${activeSection}`, targetActiveId);
      const current = patterns.find(p => p.id === targetActiveId) || patterns[0];
      if (current) {
        localStorage.setItem(`navfor_custom_timeline_cols_${activeSection}`, JSON.stringify(current.columns));
      }
      window.dispatchEvent(new Event('navfor_phase_patterns_updated'));
    } catch (e) {
      console.error(e);
    }

    // Account Cloud Synchronization across devices
    if (onSavePhasePatterns) {
      onSavePhasePatterns(activeSection, patterns, targetActiveId);
    } else if (user?.uid) {
      try {
        const configDocId = getPhaseConfigDocId(user.uid, activeSection);
        const configDocRef = doc(db, 'phase_configs', configDocId);
        const payload = {
          userId: user.uid,
          section: activeSection,
          activePatternId: targetActiveId,
          patterns: patterns.map(p => ({
            id: p.id,
            name: p.name,
            columns: p.columns || [],
            createdAt: p.createdAt || Date.now(),
            updatedAt: p.updatedAt || Date.now()
          })),
          updatedAt: Date.now()
        };
        setDoc(configDocRef, payload, { merge: true }).catch(err => {
          console.warn("Phase config cloud write notice:", err);
        });
      } catch (err) {
        console.warn("Error initiating phase config save to cloud:", err);
      }
    }
  };

  const handleSelectPattern = (patternId: string) => {
    setLocalActivePatternId(patternId);
    try {
      localStorage.setItem(`navfor_active_phase_pattern_${activeSection}`, patternId);
      const current = phasePatterns.find(p => p.id === patternId);
      if (current) {
        localStorage.setItem(`navfor_custom_timeline_cols_${activeSection}`, JSON.stringify(current.columns));
      }
      window.dispatchEvent(new Event('navfor_phase_patterns_updated'));
    } catch (e) {
      console.error(e);
    }

    // Account Cloud Synchronization across devices
    if (onSavePhasePatterns) {
      onSavePhasePatterns(activeSection, phasePatterns, patternId);
    } else if (user?.uid) {
      try {
        const configDocId = getPhaseConfigDocId(user.uid, activeSection);
        const configDocRef = doc(db, 'phase_configs', configDocId);
        setDoc(configDocRef, {
          userId: user.uid,
          section: activeSection,
          activePatternId: patternId,
          patterns: phasePatterns.map(p => ({
            id: p.id,
            name: p.name,
            columns: p.columns || [],
            createdAt: p.createdAt || Date.now(),
            updatedAt: p.updatedAt || Date.now()
          })),
          updatedAt: Date.now()
        }, { merge: true }).catch(err => {
          console.warn("Phase active pattern cloud write notice:", err);
        });
      } catch (err) {
        console.warn("Error updating active pattern in cloud:", err);
      }
    }
  };

  const saveCustomColumns = (cols: CustomTimelineColumn[]) => {
    const hasPattern = phasePatterns.some(p => p.id === activePattern.id);
    let updated: PhasePattern[];
    if (hasPattern) {
      updated = phasePatterns.map(p => 
        p.id === activePattern.id ? { ...p, columns: cols, updatedAt: Date.now() } : p
      );
    } else {
      updated = [...phasePatterns, { ...activePattern, columns: cols, updatedAt: Date.now() }];
    }
    savePhasePatterns(updated);
  };

  // Reset custom columns/phases to default Phase 1, Phase 2, Phase 3...
  const handleResetCustomColumns = (mode: 'names_only' | 'default_5' = 'names_only') => {
    setEditingColumnId(null);
    setEditingColumnLabel('');

    if (mode === 'default_5') {
      saveCustomColumns(DEFAULT_CUSTOM_COLUMNS);
      return;
    }

    // Default: Reset Phase column names to Phase 1, Phase 2, Phase 3... preserving existing columns & placed tasks
    if (!customColumns || customColumns.length === 0) {
      saveCustomColumns(DEFAULT_CUSTOM_COLUMNS);
    } else {
      const updated = customColumns.map((col, idx) => ({
        ...col,
        label: `Phase ${idx + 1}`
      }));
      saveCustomColumns(updated);
    }
  };

  // Pattern management dropdown & modal state
  const [isPatternMenuOpen, setIsPatternMenuOpen] = useState(false);
  const patternMenuRef = useRef<HTMLDivElement>(null);
  const [isCreatePatternModalOpen, setIsCreatePatternModalOpen] = useState(false);
  const [newPatternName, setNewPatternName] = useState('');
  const [newPatternCopyCols, setNewPatternCopyCols] = useState(true);
  const [newPatternCopyTasks, setNewPatternCopyTasks] = useState(false);
  const [editingPatternId, setEditingPatternId] = useState<string | null>(null);
  const [editingPatternName, setEditingPatternName] = useState('');
  const [isRenamingActiveInToolbar, setIsRenamingActiveInToolbar] = useState(false);
  const [toolbarPatternName, setToolbarPatternName] = useState('');

  // Close pattern dropdown on outside click or escape
  useEffect(() => {
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (patternMenuRef.current && patternMenuRef.current.contains(target)) {
        return;
      }
      const el = target instanceof Element ? target : target.parentElement;
      if (el?.closest('[data-dropdown-trigger="pattern"]')) {
        return;
      }
      setIsPatternMenuOpen(false);
      setEditingPatternId(null);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsPatternMenuOpen(false);
        setEditingPatternId(null);
      }
    };
    if (isPatternMenuOpen) {
      document.addEventListener('mousedown', handleOutside);
      document.addEventListener('touchstart', handleOutside);
      document.addEventListener('keydown', handleKey);
      return () => {
        document.removeEventListener('mousedown', handleOutside);
        document.removeEventListener('touchstart', handleOutside);
        document.removeEventListener('keydown', handleKey);
      };
    }
  }, [isPatternMenuOpen]);

  // Quick Menu (3-line hamburger menu for quick access to all functions)
  const [isQuickMenuOpen, setIsQuickMenuOpen] = useState(false);
  const [quickMenuOrigin, setQuickMenuOrigin] = useState<'toolbar' | 'floating'>('toolbar');
  const [quickMenuTriggerRect, setQuickMenuTriggerRect] = useState<DOMRect | null>(null);
  const [patternMenuTriggerRect, setPatternMenuTriggerRect] = useState<DOMRect | null>(null);
  const quickMenuRef = useRef<HTMLDivElement>(null);

  // Time Filter State (filter tasks by updatedAt)
  const [timeFilter, setTimeFilter] = useState<TimelineTimeFilter>(() => {
    try {
      const saved = localStorage.getItem(`navfor_timeline_time_filter_${activeSection}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed === 'object' && parsed !== null) {
          return {
            enabled: Boolean(parsed.enabled),
            amount: Number(parsed.amount) > 0 ? Number(parsed.amount) : 2,
            unit: ['week', 'month', 'year'].includes(parsed.unit) ? parsed.unit : 'week'
          };
        }
      }
    } catch (e) {}
    return { enabled: false, amount: 2, unit: 'week' };
  });

  const [isTimeFilterOpen, setIsTimeFilterOpen] = useState(false);
  const [timeFilterTriggerRect, setTimeFilterTriggerRect] = useState<DOMRect | null>(null);
  const timeFilterMenuRef = useRef<HTMLDivElement>(null);
  const [customAmountInput, setCustomAmountInput] = useState<number>(timeFilter.amount || 2);
  const [customUnitInput, setCustomUnitInput] = useState<TimeFilterUnit>(timeFilter.unit || 'week');

  useEffect(() => {
    setCustomAmountInput(timeFilter.amount || 2);
    setCustomUnitInput(timeFilter.unit || 'week');
  }, [timeFilter.amount, timeFilter.unit, isTimeFilterOpen]);

  useEffect(() => {
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (timeFilterMenuRef.current && timeFilterMenuRef.current.contains(target)) {
        return;
      }
      const el = target instanceof Element ? target : target.parentElement;
      if (el?.closest('[data-dropdown-trigger="time-filter"]')) {
        return;
      }
      setIsTimeFilterOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsTimeFilterOpen(false);
      }
    };
    if (isTimeFilterOpen) {
      document.addEventListener('mousedown', handleOutside);
      document.addEventListener('touchstart', handleOutside);
      document.addEventListener('keydown', handleKey);
      return () => {
        document.removeEventListener('mousedown', handleOutside);
        document.removeEventListener('touchstart', handleOutside);
        document.removeEventListener('keydown', handleKey);
      };
    }
  }, [isTimeFilterOpen]);

  const handleUpdateTimeFilter = (updates: Partial<TimelineTimeFilter>) => {
    setTimeFilter(prev => {
      const next = { ...prev, ...updates };
      try {
        localStorage.setItem(`navfor_timeline_time_filter_${activeSection}`, JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  const getTimeFilterLabel = (filter: TimelineTimeFilter): string => {
    if (!filter.enabled) {
      return L('すべて', 'All', 'Tous');
    }
    if (filter.unit === 'week') {
      return L(`${filter.amount}週間以上前`, `${filter.amount}w+ ago`, `+ de ${filter.amount} sem.`);
    }
    if (filter.unit === 'month') {
      return L(`${filter.amount}ヶ月以上前`, `${filter.amount}mo+ ago`, `+ de ${filter.amount} mois`);
    }
    return L(`${filter.amount}年以上前`, `${filter.amount}y+ ago`, `+ de ${filter.amount} an(s)`);
  };

  const timeFilterCutoffMs = useMemo(() => {
    if (!timeFilter.enabled) return null;
    const now = new Date();
    const amount = Math.max(1, timeFilter.amount);
    if (timeFilter.unit === 'week') {
      now.setDate(now.getDate() - amount * 7);
    } else if (timeFilter.unit === 'month') {
      now.setMonth(now.getMonth() - amount);
    } else if (timeFilter.unit === 'year') {
      now.setFullYear(now.getFullYear() - amount);
    }
    return now.getTime();
  }, [timeFilter.enabled, timeFilter.amount, timeFilter.unit]);

  useEffect(() => {
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (quickMenuRef.current && quickMenuRef.current.contains(target)) {
        return;
      }
      const el = target instanceof Element ? target : target.parentElement;
      if (el?.closest('[data-dropdown-trigger="quick-menu"]')) {
        return;
      }
      setIsQuickMenuOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsQuickMenuOpen(false);
      }
    };
    if (isQuickMenuOpen) {
      document.addEventListener('mousedown', handleOutside);
      document.addEventListener('touchstart', handleOutside);
      document.addEventListener('keydown', handleKey);
      return () => {
        document.removeEventListener('mousedown', handleOutside);
        document.removeEventListener('touchstart', handleOutside);
        document.removeEventListener('keydown', handleKey);
      };
    }
  }, [isQuickMenuOpen]);

  const handleCreatePattern = async (name: string, copyCols = true, copyTasks = false) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const newId = `pattern-${Date.now()}`;
    const newCols: CustomTimelineColumn[] = copyCols
      ? activePattern.columns.map(c => ({ ...c }))
      : DEFAULT_CUSTOM_COLUMNS.map(c => ({ ...c }));
    const newPattern: PhasePattern = {
      id: newId,
      name: trimmed,
      columns: newCols,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    const nextPatterns = [...phasePatterns, newPattern];
    savePhasePatterns(nextPatterns, newId);

    // If copying task placements from current pattern
    if (copyTasks && onUpdateTask) {
      const scheduledTasks = activeTasks.filter(t => Boolean(getTaskCurrentColumnId(t, activePattern.columns, activePattern.id)));
      for (const t of scheduledTasks) {
        const colId = getTaskCurrentColumnId(t, activePattern.columns, activePattern.id);
        const stepIdx = getTaskCurrentStep(t, activePattern.id);
        if (colId) {
          const nextPresetCols = { ...(t.timelinePresetColumns || {}) };
          const nextPresetSteps = { ...(t.timelinePresetSteps || {}) };
          nextPresetCols[newId] = colId;
          nextPresetSteps[newId] = stepIdx;
          onUpdateTask(t.id, {
            timelinePresetColumns: nextPresetCols,
            timelinePresetSteps: nextPresetSteps
          });
        }
      }
    }

    setIsCreatePatternModalOpen(false);
    setNewPatternName('');
    setIsPatternMenuOpen(false);
  };

  const handleRenamePattern = (patternId: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) {
      setEditingPatternId(null);
      return;
    }
    const updated = phasePatterns.map(p => 
      p.id === patternId ? { ...p, name: trimmed, updatedAt: Date.now() } : p
    );
    savePhasePatterns(updated);
    setEditingPatternId(null);
    setEditingPatternName('');
  };

  const handleDuplicatePattern = async (patternId: string) => {
    const target = phasePatterns.find(p => p.id === patternId) || activePattern;
    const newId = `pattern-${Date.now()}`;
    const newPattern: PhasePattern = {
      id: newId,
      name: `${target.name} ${L('(コピー)', '(Copy)', '(Copie)')}`,
      columns: target.columns.map(c => ({ ...c })),
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    const nextPatterns = [...phasePatterns, newPattern];
    savePhasePatterns(nextPatterns, newId);

    // Automatically copy task placements for duplicated pattern
    if (onUpdateTask) {
      const scheduledTasks = activeTasks.filter(t => Boolean(getTaskCurrentColumnId(t, target.columns, target.id)));
      for (const t of scheduledTasks) {
        const colId = getTaskCurrentColumnId(t, target.columns, target.id);
        const stepIdx = getTaskCurrentStep(t, target.id);
        if (colId) {
          const nextPresetCols = { ...(t.timelinePresetColumns || {}) };
          const nextPresetSteps = { ...(t.timelinePresetSteps || {}) };
          nextPresetCols[newId] = colId;
          nextPresetSteps[newId] = stepIdx;
          onUpdateTask(t.id, {
            timelinePresetColumns: nextPresetCols,
            timelinePresetSteps: nextPresetSteps
          });
        }
      }
    }

    setIsPatternMenuOpen(false);
  };

  const handleDeletePattern = (patternId: string) => {
    if (phasePatterns.length <= 1) {
      return;
    }
    const target = phasePatterns.find(p => p.id === patternId);
    if (!window.confirm(L(`フェーズパターン「${target?.name}」を削除しますか？\n（このパターンで割り当てられた列配置データも非表示になります）`, `Delete phase pattern "${target?.name}"?`, `Supprimer le modèle « ${target?.name} » ?`))) {
      return;
    }
    const nextPatterns = phasePatterns.filter(p => p.id !== patternId);
    const newActiveId = activePatternId === patternId ? nextPatterns[0].id : undefined;
    savePhasePatterns(nextPatterns, newActiveId);
  };

  // Column renaming state
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
  const [editingColumnLabel, setEditingColumnLabel] = useState('');

  // Calendar Timeline view window state (start date, number of days visible)
  const [windowStartDate, setWindowStartDate] = useState<Date>(() => startOfDay(new Date()));
  const [daysCount, setDaysCount] = useState<number>(14); // 7, 14, 21, 30
  const [showUnscheduledColumn, setShowUnscheduledColumn] = useState(true);
  const [collapsedProjectPaths, setCollapsedProjectPaths] = useState<Set<string>>(new Set());
  const [showLanesInFullscreen, setShowLanesInFullscreen] = useState(true);
  const hideSideColumns = Boolean(isFullscreen && !showLanesInFullscreen);
  const effectiveShowUnscheduled = showUnscheduledColumn;

  // Fine Grid Step in hours (1h, 2h, 4h, 6h, 12h, 24h)
  const [gridStepHours, setGridStepHours] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('navfor_timeline_grid_step');
      return saved ? Number(saved) : 4;
    } catch {
      return 4;
    }
  });

  const handleSetGridStepHours = (hours: number) => {
    setGridStepHours(hours);
    try {
      localStorage.setItem('navfor_timeline_grid_step', String(hours));
    } catch (e) {
      console.error(e);
    }
  };

  // Grid ON / OFF toggle (works for both Dates and Custom/Stages modes) - Default is OFF
  const [isGridEnabled, setIsGridEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('navfor_timeline_grid_enabled');
      return saved !== null ? saved === 'true' : false;
    } catch {
      return false;
    }
  });

  const handleToggleGrid = (enabled: boolean) => {
    setIsGridEnabled(enabled);
    try {
      localStorage.setItem('navfor_timeline_grid_enabled', String(enabled));
    } catch (e) {
      console.error(e);
    }
  };

  // Stage grid subdivisions for Custom/Stages mode (e.g. 2, 3, 4, 5)
  const [stageSubdivisions, setStageSubdivisions] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('navfor_timeline_stage_subdivisions');
      return saved ? Number(saved) : 3;
    } catch {
      return 3;
    }
  });

  const handleSetStageSubdivisions = (subs: number) => {
    setStageSubdivisions(subs);
    try {
      localStorage.setItem('navfor_timeline_stage_subdivisions', String(subs));
    } catch (e) {
      console.error(e);
    }
  };

  // Drag over fine grid slot state
  const [dragOverGridSlot, setDragOverGridSlot] = useState<{ project: string; slotIdx: number } | null>(null);

  // Per-workspace custom folders (including empty folders)
  const [customFolders, setCustomFolders] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`navfor_folders_${activeSection}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Re-sync customFolders when activeSection changes or custom folders updated
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

  const saveCustomFolders = (folders: string[]) => {
    setCustomFolders(folders);
    try {
      localStorage.setItem(`navfor_folders_${activeSection}`, JSON.stringify(folders));
      window.dispatchEvent(new Event('navfor_folders_updated'));
    } catch (err) {
      console.error(err);
    }
  };

  // State for creating new project folder
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [targetParentFolder, setTargetParentFolder] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');

  // Active selected item in timeline for keyboard navigation & focus ('folder:PATH' or 'task:ID')
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectedFolderPath, setSelectedFolderPath] = useState<string | null>(null);
  const timelineGridRef = useRef<HTMLDivElement>(null);

  // Inline rename state for folder or task
  const [renamingItem, setRenamingItem] = useState<{
    type: 'folder' | 'task';
    idOrPath: string;
    initialValue: string;
  } | null>(null);
  const [renameInputValue, setRenameInputValue] = useState('');

  // 3-dots dropdown context menu state for folders and task files
  const [activeMenu, setActiveMenu] = useState<{
    type: 'folder' | 'task';
    idOrPath: string;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    const handleOutsideClick = () => setActiveMenu(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveMenu(null);
    };
    if (activeMenu) {
      window.addEventListener('click', handleOutsideClick);
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('click', handleOutsideClick);
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [activeMenu]);

  const startRenaming = (type: 'folder' | 'task', idOrPath: string, initialValue: string) => {
    setRenamingItem({ type, idOrPath, initialValue });
    setRenameInputValue(initialValue);
    setActiveMenu(null);
  };

  const handleDeleteFolderAction = (folderPath: string) => {
    if (!window.confirm(L(`フォルダ「${folderPath}」および中の項目を削除しますか？`, `Delete folder "${folderPath}" and its items?`, `Supprimer le dossier « ${folderPath} » et son contenu ?`))) {
      return;
    }
    if (onDeleteFolder) {
      onDeleteFolder(folderPath);
    }
    const next = customFolders.filter(f => f !== folderPath && !f.startsWith(folderPath + '/'));
    saveCustomFolders(next);
    if (selectedFolderPath === folderPath || selectedFolderPath?.startsWith(folderPath + '/')) {
      setSelectedFolderPath(null);
      setSelectedKey(null);
    }
    setActiveMenu(null);
  };

  const handleDeleteTaskAction = (taskId: string) => {
    if (onDeleteTask) {
      onDeleteTask(taskId);
    } else if (onMoveTask) {
      onMoveTask(taskId, 'Trash');
    }
    setActiveMenu(null);
  };

  const handleRenameSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!renamingItem) return;

    const val = renameInputValue.trim();
    if (val && val !== renamingItem.initialValue) {
      if (renamingItem.type === 'task') {
        if (onRenameTask) {
          onRenameTask(renamingItem.idOrPath, val);
        }
      } else {
        // Folder rename
        if (onRenameFolder) {
          const oldPath = renamingItem.idOrPath;
          const parts = oldPath.split('/');
          parts[parts.length - 1] = val;
          const newPath = parts.join('/');
          onRenameFolder(oldPath, newPath, val);

          // Also update customFolders
          const updatedCustom = customFolders.map(f => {
            if (f === oldPath) return newPath;
            if (f.startsWith(oldPath + '/')) return f.replace(oldPath, newPath);
            return f;
          });
          saveCustomFolders(updatedCustom);

          // Update collapsedProjectPaths state
          setCollapsedProjectPaths(prev => {
            const next = new Set<string>();
            prev.forEach(p => {
              if (p === oldPath) next.add(newPath);
              else if (p.startsWith(oldPath + '/')) next.add(p.replace(oldPath, newPath));
              else next.add(p);
            });
            return next;
          });

          setSelectedFolderPath(newPath);
          setSelectedKey(`folder:${newPath}`);
        }
      }
    }
    setRenamingItem(null);
    setRenameInputValue('');
  };

  // Sync selectedKey and selectedFolderPath when activeTaskId is selected from outside
  useEffect(() => {
    if (activeTaskId) {
      if (activeTaskId.startsWith('folder:')) {
        const fp = activeTaskId.slice(7);
        setSelectedKey(`folder:${fp}`);
        setSelectedFolderPath(fp);
      } else {
        setSelectedKey(`task:${activeTaskId}`);
        setSelectedFolderPath(null);
        const task = tasks.find(t => t.id === activeTaskId);
        if (task?.project && collapsedProjectPaths.has(task.project)) {
          setCollapsedProjectPaths(prev => {
            const next = new Set(prev);
            next.delete(task.project);
            return next;
          });
        }
      }
    }
  }, [activeTaskId, tasks]);

  // User adjustable project column width (Standard view & Fullscreen view)
  const [projectColWidth, setProjectColWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('navfor_timeline_project_col_width');
      if (saved) return parseInt(saved, 10);
    } catch {}
    return typeof window !== 'undefined' && window.innerWidth < 640 ? 210 : 256;
  });
  const [fullscreenProjectColWidth, setFullscreenProjectColWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('navfor_timeline_fs_project_col_width');
      if (saved) return parseInt(saved, 10);
    } catch {}
    return 135;
  });
  const effectiveProjectColWidth = isFullscreen ? fullscreenProjectColWidth : projectColWidth;

  const isResizingProject = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const handleStartProjectResize = (clientX: number, initialWidthOverride?: number) => {
    isResizingProject.current = true;
    startXRef.current = clientX;
    startWidthRef.current = initialWidthOverride ?? effectiveProjectColWidth;
    if (isFullscreen && !showLanesInFullscreen) {
      setShowLanesInFullscreen(true);
    }
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!isResizingProject.current) return;
      if ('touches' in e && e.cancelable) {
        e.preventDefault();
      }
      const currentX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const delta = currentX - startXRef.current;
      const minW = isFullscreen ? 56 : 64;
      const maxW = isFullscreen ? 450 : 500;
      const newWidth = Math.max(minW, Math.min(maxW, Math.round(startWidthRef.current + delta)));
      if (isFullscreen) {
        setFullscreenProjectColWidth(newWidth);
      } else {
        setProjectColWidth(newWidth);
      }
    };

    const handleEnd = () => {
      if (!isResizingProject.current) return;
      isResizingProject.current = false;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
      try {
        if (isFullscreen) {
          setFullscreenProjectColWidth(w => {
            localStorage.setItem('navfor_timeline_fs_project_col_width', String(w));
            return w;
          });
        } else {
          setProjectColWidth(w => {
            localStorage.setItem('navfor_timeline_project_col_width', String(w));
            return w;
          });
        }
      } catch {}
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleEnd);
  };

  // User adjustable ToDo List column width
  const [todoColWidth, setTodoColWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('navfor_timeline_todo_col_width');
      if (saved) return parseInt(saved, 10);
    } catch {}
    return 160;
  });

  const isResizingTodo = useRef(false);
  const startTodoXRef = useRef(0);
  const startTodoWidthRef = useRef(0);

  const handleStartTodoResize = (clientX: number) => {
    isResizingTodo.current = true;
    startTodoXRef.current = clientX;
    startTodoWidthRef.current = todoColWidth;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!isResizingTodo.current) return;
      const currentX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const delta = currentX - startTodoXRef.current;
      const newWidth = Math.max(100, Math.min(450, startTodoWidthRef.current + delta));
      setTodoColWidth(newWidth);
    };

    const handleEnd = () => {
      if (!isResizingTodo.current) return;
      isResizingTodo.current = false;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
      try {
        setTodoColWidth(w => {
          localStorage.setItem('navfor_timeline_todo_col_width', String(w));
          return w;
        });
      } catch {}
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleEnd);
  };

  // User adjustable Phase (custom) columns width
  const [customColWidths, setCustomColWidths] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('navfor_timeline_custom_col_widths');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  });

  const isResizingCustomCol = useRef<string | null>(null);
  const startCustomXRef = useRef(0);
  const startCustomWidthRef = useRef(0);

  const defaultCustomColWidth = useMemo(() => {
    const subs = isGridEnabled ? stageSubdivisions : 1;
    if (!isGridEnabled) return 200;
    if (subs <= 2) return 200;
    if (subs <= 3) return 240;
    if (subs <= 4) return 272;
    return 300;
  }, [isGridEnabled, stageSubdivisions]);

  const getCustomColWidth = useCallback((colId: string): number => {
    return customColWidths[colId] || defaultCustomColWidth;
  }, [customColWidths, defaultCustomColWidth]);

  const handleStartCustomColResize = (colId: string, clientX: number) => {
    isResizingCustomCol.current = colId;
    startCustomXRef.current = clientX;
    startCustomWidthRef.current = getCustomColWidth(colId);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!isResizingCustomCol.current) return;
      const currentX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const delta = currentX - startCustomXRef.current;
      const newWidth = Math.max(120, Math.min(800, startCustomWidthRef.current + delta));
      setCustomColWidths(prev => ({
        ...prev,
        [colId]: newWidth
      }));
    };

    const handleEnd = () => {
      if (!isResizingCustomCol.current) return;
      isResizingCustomCol.current = null;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
      try {
        setCustomColWidths(widths => {
          localStorage.setItem('navfor_timeline_custom_col_widths', JSON.stringify(widths));
          return widths;
        });
      } catch {}
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleEnd);
  };

  // Fine grid calculations for Calendar Mode
  const effectiveGridStep = isGridEnabled ? gridStepHours : 24;
  const slotDurationMs = useMemo(() => effectiveGridStep * 3600 * 1000, [effectiveGridStep]);
  const slotsPerDay = useMemo(() => Math.max(1, Math.round(24 / effectiveGridStep)), [effectiveGridStep]);

  // User adjustable Date columns width (for Dates mode)
  // Default is 200px when grid is OFF (matching Phase display default of 200px)
  const defaultDateColWidth = useMemo(() => {
    if (!isGridEnabled) return 200;
    if (gridStepHours <= 1) return 30 * 24; // 720
    if (gridStepHours <= 2) return 38 * 12; // 456
    if (gridStepHours <= 4) return 46 * 6;  // 276
    if (gridStepHours <= 6) return 60 * 4;  // 240
    if (gridStepHours <= 12) return 84 * 2; // 168
    return 200;
  }, [isGridEnabled, gridStepHours]);

  const [customDateColWidthOff, setCustomDateColWidthOff] = useState<number | null>(() => {
    try {
      const saved = localStorage.getItem('navfor_timeline_date_col_width_off');
      if (saved) {
        const parsed = Number(saved);
        if (!isNaN(parsed) && parsed >= 80) return parsed;
      }
    } catch {}
    return null;
  });

  const [customDateColWidthOn, setCustomDateColWidthOn] = useState<number | null>(() => {
    try {
      const saved = localStorage.getItem('navfor_timeline_date_col_width_on');
      if (saved) {
        const parsed = Number(saved);
        if (!isNaN(parsed) && parsed >= 80) return parsed;
      }
    } catch {}
    return null;
  });

  const isResizingDateCol = useRef(false);
  const startDateXRef = useRef(0);
  const startDateWidthRef = useRef(0);

  const effectiveDateColWidth = useMemo(() => {
    if (!isGridEnabled) {
      return customDateColWidthOff ?? 200;
    }
    return customDateColWidthOn ?? defaultDateColWidth;
  }, [isGridEnabled, customDateColWidthOff, customDateColWidthOn, defaultDateColWidth]);

  const slotWidth = useMemo(() => {
    if (!isGridEnabled) return effectiveDateColWidth;
    return Math.max(20, Math.round(effectiveDateColWidth / slotsPerDay));
  }, [isGridEnabled, effectiveDateColWidth, slotsPerDay]);

  const handleStartDateColResize = (clientX: number) => {
    isResizingDateCol.current = true;
    startDateXRef.current = clientX;
    startDateWidthRef.current = effectiveDateColWidth;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    const minWidth = !isGridEnabled ? 100 : Math.max(120, slotsPerDay * 20);
    const maxWidth = !isGridEnabled ? 800 : Math.max(800, slotsPerDay * 80);

    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!isResizingDateCol.current) return;
      const currentX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const delta = currentX - startDateXRef.current;
      const newWidth = Math.max(minWidth, Math.min(maxWidth, startDateWidthRef.current + delta));

      if (!isGridEnabled) {
        setCustomDateColWidthOff(newWidth);
      } else {
        setCustomDateColWidthOn(newWidth);
      }
    };

    const handleEnd = () => {
      if (!isResizingDateCol.current) return;
      isResizingDateCol.current = false;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
      try {
        if (!isGridEnabled) {
          setCustomDateColWidthOff(w => {
            if (w !== null) localStorage.setItem('navfor_timeline_date_col_width_off', String(w));
            return w;
          });
        } else {
          setCustomDateColWidthOn(w => {
            if (w !== null) localStorage.setItem('navfor_timeline_date_col_width_on', String(w));
            return w;
          });
        }
      } catch {}
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleEnd);
  };

  const handleResetColumnWidths = () => {
    const defaultProj = typeof window !== 'undefined' && window.innerWidth < 640 ? 210 : 256;
    setProjectColWidth(defaultProj);
    setFullscreenProjectColWidth(135);
    setTodoColWidth(160);
    setCustomColWidths({});
    setCustomDateColWidthOff(null);
    setCustomDateColWidthOn(null);
    try {
      localStorage.removeItem('navfor_timeline_project_col_width');
      localStorage.removeItem('navfor_timeline_fs_project_col_width');
      localStorage.removeItem('navfor_timeline_todo_col_width');
      localStorage.removeItem('navfor_timeline_custom_col_widths');
      localStorage.removeItem('navfor_timeline_date_col_width_off');
      localStorage.removeItem('navfor_timeline_date_col_width_on');
    } catch {}
  };

  // Drag over target cell state
  const [dragOverCell, setDragOverCell] = useState<{ 
    project: string; 
    slotKey: string; // date timestamp, columnId, or 'backlog'
  } | null>(null);

  // Drag over task target state (for reordering before/after)
  const [dragOverTask, setDragOverTask] = useState<{
    taskId: string;
    position: 'before' | 'after';
  } | null>(null);

  // Quick inline task creation in timeline cell
  const isSubmittingQuickAddRef = useRef(false);
  const [quickAddCell, setQuickAddCell] = useState<{ 
    project: string; 
    slotKey: string; 
    type: 'calendar' | 'custom' | 'backlog';
    dateMs?: number;
    columnId?: string;
    stepIdx?: number;
    slotIdx?: number;
  } | null>(null);
  const [quickAddTitle, setQuickAddTitle] = useState('');

  // Generate date columns
  const timelineDates = useMemo(() => {
    const dates: Date[] = [];
    for (let i = 0; i < daysCount; i++) {
      dates.push(addDays(windowStartDate, i));
    }
    return dates;
  }, [windowStartDate, daysCount]);

  const totalSlots = useMemo(() => daysCount * slotsPerDay, [daysCount, slotsPerDay]);
  const timelineStartMs = useMemo(() => startOfDay(windowStartDate).getTime(), [windowStartDate]);

  const totalGridWidth = useMemo(() => totalSlots * slotWidth, [totalSlots, slotWidth]);

  // Grid calculations for Custom/Stages Mode (Dates pattern without dates)
  const totalCustomGridWidth = useMemo(() => {
    return customColumns.reduce((sum, col) => sum + getCustomColWidth(col.id), 0);
  }, [customColumns, getCustomColWidth]);

  interface GridSlotInfo {
    index: number;
    startMs: number;
    endMs: number;
    date: Date;
    hour: number;
    isDayStart: boolean;
    isToday: boolean;
    dayIndex: number;
  }

  const gridSlots = useMemo<GridSlotInfo[]>(() => {
    const slots: GridSlotInfo[] = [];
    const today = startOfDay(new Date());
    for (let d = 0; d < daysCount; d++) {
      const dayDate = addDays(windowStartDate, d);
      const isDayToday = isSameDay(dayDate, today);
      for (let s = 0; s < slotsPerDay; s++) {
        const startMs = dayDate.getTime() + s * slotDurationMs;
        const endMs = startMs + slotDurationMs;
        const hour = s * gridStepHours;
        slots.push({
          index: d * slotsPerDay + s,
          startMs,
          endMs,
          date: dayDate,
          hour,
          isDayStart: s === 0,
          isToday: isDayToday,
          dayIndex: d
        });
      }
    }
    return slots;
  }, [windowStartDate, daysCount, slotsPerDay, slotDurationMs, gridStepHours]);

  // Current time line offset in px
  const nowOffsetPx = useMemo(() => {
    const nowMs = Date.now();
    const diffMs = nowMs - timelineStartMs;
    const totalMs = totalSlots * slotDurationMs;
    if (diffMs < 0 || diffMs > totalMs) return -1;
    return (diffMs / slotDurationMs) * slotWidth;
  }, [timelineStartMs, totalSlots, slotDurationMs, slotWidth]);

  // All active tasks for this section (Urgent + Focus + Restored Backlog)
  const allActiveTasks = useMemo(() => {
    return tasks.filter(t => t.category === 'Urgent' || t.category === 'Focus' || (t.category as string) === 'Backlog');
  }, [tasks]);

  // Active tasks filtered by updated date (if time filter is enabled, show tasks older than specified period)
  const activeTasks = useMemo(() => {
    if (!timeFilterCutoffMs) return allActiveTasks;
    return allActiveTasks.filter(t => {
      const taskTime = t.updatedAt || t.createdAt || 0;
      return taskTime <= timeFilterCutoffMs;
    });
  }, [allActiveTasks, timeFilterCutoffMs]);

  // Group tasks by project matching TaskExplorerTree hierarchy and ordering
  const projectTree = useMemo(() => {
    interface Node {
      name: string;
      fullPath: string;
      level: number;
      subfolders: Map<string, Node>;
      tasks: Task[];
    }

    const root: Node = {
      name: 'root',
      fullPath: '',
      level: -1,
      subfolders: new Map(),
      tasks: []
    };

    const getOrCreateFolder = (pathParts: string[]): Node => {
      let current = root;
      let accPath = '';
      pathParts.forEach((part, idx) => {
        accPath = accPath ? `${accPath}/${part}` : part;
        if (!current.subfolders.has(part)) {
          current.subfolders.set(part, {
            name: part,
            fullPath: accPath,
            level: idx,
            subfolders: new Map(),
            tasks: []
          });
        }
        current = current.subfolders.get(part)!;
      });
      return current;
    };

    // Helper to check if a folder path or any of its ancestors is marked as Trash/Archive
    const isTrashedOrArchived = (path: string): boolean => {
      // If any active task belongs to this folder or its subfolders, it is NOT trashed or archived
      const hasActive = activeTasks.some(t => t.project === path || t.project?.startsWith(path + '/'));
      if (hasActive) return false;

      const parts = path.split(/[\/\\]/).map(p => p.trim()).filter(Boolean);
      let cur = '';
      for (const part of parts) {
        cur = cur ? `${cur}/${part}` : part;
        const cat = folderMetas?.[cur]?.category;
        if (cat === 'Trash' || cat === 'Archive') return true;
      }
      return false;
    };

    // 1. Include custom empty folders (matching Explorer, excluding trashed/archived)
    customFolders.forEach(folderPath => {
      if (!folderPath) return;
      if (isTrashedOrArchived(folderPath)) return;
      const parts = folderPath.split(/[\/\\]/).map(p => p.trim()).filter(Boolean);
      if (parts.length > 0) {
        getOrCreateFolder(parts);
      }
    });

    // 1b. Include active folders from folderMetas for this workspace (excluding trashed/archived)
    Object.values(folderMetas || {}).forEach((meta: FolderMeta) => {
      if (!meta || !meta.path) return;
      if (meta.section && meta.section !== activeSection) return;
      if (meta.category === 'Trash' || meta.category === 'Archive') return;
      if (isTrashedOrArchived(meta.path)) return;
      const parts = meta.path.split(/[\/\\]/).map(p => p.trim()).filter(Boolean);
      if (parts.length > 0) {
        getOrCreateFolder(parts);
      }
    });

    // 1c. Include folders from active tasks in this workspace
    activeTasks.forEach(task => {
      if (task.category === 'Trash' || task.category === 'Archive') return;
      const proj = task.project?.trim();
      if (!proj || proj === 'General') return;
      const parts = proj.split(/[\/\\]/).map(p => p.trim()).filter(Boolean);
      if (parts.length > 0) {
        getOrCreateFolder(parts);
      }
    });

    // 2. Include all active tasks (Urgent, Focus, or Restored)
    activeTasks.forEach(task => {
      const proj = task.project?.trim() || 'General';
      const parts = proj.split(/[\/\\]/).map(p => p.trim()).filter(Boolean);
      const folder = getOrCreateFolder(parts.length > 0 ? parts : ['General']);
      folder.tasks.push(task);
    });

    // Traverse recursively matching Explorer display order (depth-first, sorted alphabetically)
    const result: { fullPath: string; name: string; level: number; tasks: Task[] }[] = [];

    const traverse = (node: Node) => {
      const sortedSubs = Array.from(node.subfolders.values()).sort((a, b) => {
        const nameA = folderMetas?.[a.fullPath]?.title || a.name;
        const nameB = folderMetas?.[b.fullPath]?.title || b.name;
        return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
      });

      sortedSubs.forEach(sub => {
        result.push({
          fullPath: sub.fullPath,
          name: folderMetas?.[sub.fullPath]?.title || sub.name,
          level: sub.level,
          tasks: sub.tasks
        });
        traverse(sub);
      });
    };

    traverse(root);

    // If completely empty, ensure General exists
    if (result.length === 0) {
      result.push({
        fullPath: 'General',
        name: folderMetas?.['General']?.title || 'General',
        level: 0,
        tasks: []
      });
    }

    return result;
  }, [activeTasks, tasks, customFolders, folderMetas, activeSection]);

  const toggleProjectCollapse = (path: string) => {
    setCollapsedProjectPaths(prev => {
      const next = new Set(prev);
      const isCurrentlyCollapsed = next.has(path);
      if (isCurrentlyCollapsed) {
        // Expanding parent: remove parent AND all its child/descendant folders so children are toggled open
        next.delete(path);
        projectTree.forEach(p => {
          if (p.fullPath.startsWith(path + '/')) {
            next.delete(p.fullPath);
          }
        });
      } else {
        // Collapsing parent: collapse this folder AND all its child/descendant folders
        next.add(path);
        projectTree.forEach(p => {
          if (p.fullPath.startsWith(path + '/')) {
            next.add(p.fullPath);
          }
        });
      }
      return next;
    });
  };

  // Visible projects in Timeline: a project row is displayed only if none of its parent ancestors are collapsed
  const visibleProjectTree = useMemo(() => {
    return projectTree.filter(project => {
      const parts = project.fullPath.split(/[\/\\]/).filter(Boolean);
      let current = '';
      for (let i = 0; i < parts.length - 1; i++) {
        current = current ? `${current}/${parts[i]}` : parts[i];
        if (collapsedProjectPaths.has(current)) {
          return false;
        }
      }
      return true;
    });
  }, [projectTree, collapsedProjectPaths]);

  // Check if all projects are collapsed
  const isAllProjectsCollapsed = useMemo(() => {
    if (projectTree.length === 0) return false;
    return projectTree.every(p => collapsedProjectPaths.has(p.fullPath));
  }, [projectTree, collapsedProjectPaths]);

  // Toggle Collapse All / Expand All projects
  const handleToggleCollapseAllProjects = () => {
    if (isAllProjectsCollapsed) {
      setCollapsedProjectPaths(new Set());
    } else {
      setCollapsedProjectPaths(new Set(projectTree.map(p => p.fullPath)));
    }
  };

  // Chronological execution sequence for each task within its project lane (#1, #2, ...)
  // Timeline tasks have higher priority than ToDo list tasks. Done tasks do not receive sequence numbers.
  const projectTaskSequenceMap = useMemo(() => {
    const map = new Map<string, number>();

    projectTree.forEach(project => {
      const nonDoneTasks = project.tasks.filter(t => !t.isDone);
      const sorted = [...nonDoneTasks].sort((a, b) => {
        if (timelineMode === 'calendar') {
          const aHas = typeof a.deadline === 'number' || typeof a.startDate === 'number' || (a.recurrence && a.recurrence.type !== 'none');
          const bHas = typeof b.deadline === 'number' || typeof b.startDate === 'number' || (b.recurrence && b.recurrence.type !== 'none');
          if (!aHas && !bHas) {
            return (a.order ?? 0) - (b.order ?? 0) || a.createdAt - b.createdAt;
          }
          // Timeline tasks (> ToDo tasks) come first!
          if (aHas && !bHas) return -1;
          if (!aHas && bHas) return 1;
          const aD = startOfDay(new Date(a.startDate || a.deadline || a.createdAt)).getTime();
          const bD = startOfDay(new Date(b.startDate || b.deadline || b.createdAt)).getTime();
          if (aD !== bD) return aD - bD;
          return (a.order ?? 0) - (b.order ?? 0) || a.createdAt - b.createdAt;
        } else {
          const aCol = getTaskCurrentColumnId(a, customColumns, activePattern.id);
          const bCol = getTaskCurrentColumnId(b, customColumns, activePattern.id);
          const aIdx = aCol ? customColumns.findIndex(c => c.id === aCol) : -1;
          const bIdx = bCol ? customColumns.findIndex(c => c.id === bCol) : -1;
          if (aIdx === -1 && bIdx === -1) {
            return (a.order ?? 0) - (b.order ?? 0) || a.createdAt - b.createdAt;
          }
          // Timeline tasks (> ToDo tasks) come first!
          if (aIdx !== -1 && bIdx === -1) return -1;
          if (aIdx === -1 && bIdx !== -1) return 1;
          if (aIdx !== bIdx) return aIdx - bIdx;
          const aStep = getTaskCurrentStep(a, activePattern.id);
          const bStep = getTaskCurrentStep(b, activePattern.id);
          if (aStep !== bStep) return aStep - bStep;
          return (a.order ?? 0) - (b.order ?? 0) || a.createdAt - b.createdAt;
        }
      });

      sorted.forEach((task, idx) => {
        map.set(task.id, idx + 1);
      });
    });

    return map;
  }, [projectTree, timelineMode, customColumns, activePattern.id]);

  interface PlacedTask {
    task: Task;
    startPx: number;
    widthPx: number;
    endPx: number;
    rowIdx: number;
    topPx: number;
    occurrenceKey: string;
  }

  // Calculate layout of tasks for a project lane on the fine grid (Timeline Dates mode)
  const getPlacedTasksForProject = (projectTasks: Task[]) => {
    const placed: PlacedTask[] = [];
    const rowEndPx: number[] = [];

    // Separate into scheduled tasks (with deadline, startDate, or recurrence)
    const scheduled = projectTasks.filter(t => 
      typeof t.deadline === 'number' || 
      typeof t.startDate === 'number' || 
      (t.recurrence && t.recurrence.type !== 'none')
    );

    interface CandidateItem {
      task: Task;
      startMs: number;
      endMs: number;
      occurrenceKey: string;
    }

    const items: CandidateItem[] = [];

    scheduled.forEach(task => {
      const allDay = isTaskAllDayDeadline(task) || !isGridEnabled;

      if (task.recurrence && task.recurrence.type !== 'none') {
        // Evaluate recurrence across the visible window dates
        for (let d = 0; d < daysCount; d++) {
          const dayDate = addDays(windowStartDate, d);
          if (isTaskOccurringOnDate(task, dayDate, true)) {
            let startMs = dayDate.getTime();
            let endMs = dayDate.getTime() + 86400000;
            if (!allDay && isGridEnabled && (task.startDate || task.deadline)) {
              const refDate = new Date(task.startDate || task.deadline!);
              const hours = refDate.getHours();
              const mins = refDate.getMinutes();
              startMs = dayDate.getTime() + hours * 3600000 + mins * 60000;
              endMs = startMs + Math.max(slotDurationMs, 3600000);
            }
            items.push({
              task,
              startMs,
              endMs,
              occurrenceKey: `${task.id}_rec_${format(dayDate, 'yyyy-MM-dd')}`
            });
          }
        }
      } else {
        // Non-recurring task with deadline, startDate, or both
        const hasStart = typeof task.startDate === 'number';
        const hasEnd = typeof task.deadline === 'number';
        let startMs: number;
        let endMs: number;

        if (hasStart && hasEnd && task.startDate! <= task.deadline!) {
          if (allDay) {
            startMs = startOfDay(new Date(task.startDate!)).getTime();
            endMs = startOfDay(new Date(task.deadline!)).getTime() + 86400000;
          } else {
            startMs = task.startDate!;
            endMs = task.deadline!;
          }
        } else if (hasEnd) {
          if (allDay) {
            startMs = startOfDay(new Date(task.deadline!)).getTime();
            endMs = startMs + 86400000;
          } else {
            startMs = task.deadline!;
            endMs = task.deadline! + Math.max(slotDurationMs, 3600000);
          }
        } else if (hasStart) {
          if (allDay) {
            startMs = startOfDay(new Date(task.startDate!)).getTime();
            endMs = startMs + 86400000;
          } else {
            startMs = task.startDate!;
            endMs = task.startDate! + Math.max(slotDurationMs, 3600000);
          }
        } else {
          return;
        }

        items.push({
          task,
          startMs,
          endMs,
          occurrenceKey: `${task.id}_single`
        });
      }
    });

    items.sort((a, b) => a.startMs - b.startMs || (a.task.order ?? 0) - (b.task.order ?? 0) || a.task.createdAt - b.task.createdAt);

    const dayWidth = slotsPerDay * slotWidth;

    items.forEach(({ task, startMs, endMs, occurrenceKey }) => {
      const startSlotIdx = (startMs - timelineStartMs) / slotDurationMs;
      const endSlotIdx = (endMs - timelineStartMs) / slotDurationMs;

      // Skip items completely outside visible window
      if (endSlotIdx <= 0 || startSlotIdx >= totalSlots) {
        return;
      }

      const visibleStartSlotIdx = Math.max(0, startSlotIdx);
      const rawStartPx = visibleStartSlotIdx * slotWidth;
      const startPx = rawStartPx + 3;

      let widthPx: number;
      const allDay = isTaskAllDayDeadline(task) || !isGridEnabled;
      const isMultiDay = Boolean(
        task.startDate && 
        task.deadline && 
        startOfDay(new Date(task.startDate)).getTime() < startOfDay(new Date(task.deadline)).getTime() && 
        (!task.recurrence || task.recurrence.type === 'none')
      );

      if (isMultiDay) {
        const spanSlots = Math.max(1, endSlotIdx - visibleStartSlotIdx);
        const spanPx = spanSlots * slotWidth;
        widthPx = Math.max(90, spanPx - 6);
      } else if (allDay) {
        widthPx = Math.max(90, dayWidth - 6);
      } else {
        const spanSlots = Math.max(1, endSlotIdx - visibleStartSlotIdx);
        const spanPx = spanSlots * slotWidth;
        widthPx = Math.max(90, Math.min(dayWidth - 6, Math.max(spanPx - 6, slotWidth * 2 - 6)));
      }
      const endPx = startPx + widthPx;

      let rowIdx = 0;
      while (rowIdx < rowEndPx.length && startPx < (rowEndPx[rowIdx] + 6)) {
        rowIdx++;
      }

      rowEndPx[rowIdx] = endPx;
      const baseTop = hideSideColumns ? 24 : 6;
      const rowStep = 38;
      const topPx = baseTop + rowIdx * rowStep;

      placed.push({
        task,
        startPx,
        widthPx,
        endPx,
        rowIdx,
        topPx,
        occurrenceKey
      });
    });

    const laneHeight = Math.max(58, (rowEndPx.length || 1) * 38 + (hideSideColumns ? 28 : 16));
    return { placed, laneHeight };
  };

  interface PlacedCustomTask {
    task: Task;
    startPx: number;
    widthPx: number;
    endPx: number;
    rowIdx: number;
    topPx: number;
    colIdx: number;
    stepIdx: number;
  }

  // Calculate layout of tasks for a project lane on the Custom Stages grid (Dates pattern without dates)
  const getPlacedCustomTasksForProject = (projectTasks: Task[]) => {
    // Tasks assigned to a custom column
    const scheduled = projectTasks.filter(t => Boolean(getTaskCurrentColumnId(t, customColumns, activePattern.id)));

    // Sort by column index, then timelineStep, then order, then createdAt
    const colOrderMap = new Map<string, number>(customColumns.map((c, idx) => [c.id, idx]));
    scheduled.sort((a, b) => {
      const colA = colOrderMap.get(getTaskCurrentColumnId(a, customColumns, activePattern.id) || '') ?? 999;
      const colB = colOrderMap.get(getTaskCurrentColumnId(b, customColumns, activePattern.id) || '') ?? 999;
      if (colA !== colB) return colA - colB;
      const stepA = getTaskCurrentStep(a, activePattern.id);
      const stepB = getTaskCurrentStep(b, activePattern.id);
      if (stepA !== stepB) return stepA - stepB;
      return (a.order ?? 0) - (b.order ?? 0) || a.createdAt - b.createdAt;
    });

    const placed: PlacedCustomTask[] = [];
    const rowEndPx: number[] = [];
    const effectiveSubs = isGridEnabled ? stageSubdivisions : 1;

    // Cumulative horizontal start offsets for each custom column
    const colOffsets: number[] = [];
    let accX = 0;
    customColumns.forEach(col => {
      colOffsets.push(accX);
      accX += getCustomColWidth(col.id);
    });

    scheduled.forEach(task => {
      const colId = getTaskCurrentColumnId(task, customColumns, activePattern.id);
      const colIdx = customColumns.findIndex(c => c.id === colId);
      if (colIdx === -1) return;

      const rawStep = getTaskCurrentStep(task, activePattern.id);
      const stepIdx = Math.max(0, Math.min(effectiveSubs - 1, rawStep));

      const thisColWidth = getCustomColWidth(colId!);
      const thisSubSlotWidth = thisColWidth / effectiveSubs;

      // Horizontal coordinate calculation
      const startPx = colOffsets[colIdx] + stepIdx * thisSubSlotWidth + 4;
      // Width of chip: spans comfortably within step slot, minimum 120px
      const widthPx = Math.max(120, Math.min(thisColWidth - 8, thisSubSlotWidth * 1.5 - 8));
      const endPx = startPx + widthPx;

      let rowIdx = 0;
      while (rowIdx < rowEndPx.length && startPx < (rowEndPx[rowIdx] + 6)) {
        rowIdx++;
      }

      rowEndPx[rowIdx] = endPx;
      const baseTop = hideSideColumns ? 24 : 6;
      const rowStep = 38;
      const topPx = baseTop + rowIdx * rowStep;

      placed.push({
        task,
        startPx,
        widthPx,
        endPx,
        rowIdx,
        topPx,
        colIdx,
        stepIdx
      });
    });

    const laneHeight = Math.max(58, (rowEndPx.length || 1) * 38 + (hideSideColumns ? 28 : 16));
    return { placed, laneHeight };
  };

  const handleGridDrop = (e: React.DragEvent, projectPath: string, targetTimeMs: number) => {
    const data = getDraggedTaskData(e);
    if (!data?.taskId) return;

    let finalDeadline = targetTimeMs;
    const isAllDay = !isGridEnabled;
    if (isAllDay) {
      const d = new Date(targetTimeMs);
      d.setHours(23, 59, 59, 999);
      finalDeadline = d.getTime();
    }

    const updates: Partial<Task> = {
      project: projectPath,
      deadline: finalDeadline,
      isAllDay
    };

    if (onUpdateTask) {
      onUpdateTask(data.taskId, updates);
    } else {
      if (onMoveTaskFolder) onMoveTaskFolder(data.taskId, projectPath);
      if (onScheduleTask) onScheduleTask(data.taskId, finalDeadline);
    }
    (window as any).__navforDraggingTask = null;
  };

  const handleCustomGridDrop = (e: React.DragEvent, projectPath: string, columnId: string, stepIdx: number) => {
    const data = getDraggedTaskData(e);
    if (!data?.taskId) return;

    const draggedTask = activeTasks.find(t => t.id === data.taskId);
    const nextPresetCols = { ...(draggedTask?.timelinePresetColumns || {}) };
    const nextPresetSteps = { ...(draggedTask?.timelinePresetSteps || {}) };
    nextPresetCols[activePattern.id] = columnId;
    nextPresetSteps[activePattern.id] = stepIdx;

    const updates: Partial<Task> = {
      project: projectPath,
      ...(activePattern.id === DEFAULT_PATTERN_ID ? { timelineColumn: columnId, timelineStep: stepIdx } : {}),
      timelinePresetColumns: nextPresetCols,
      timelinePresetSteps: nextPresetSteps
    };

    if (onUpdateTask) {
      onUpdateTask(data.taskId, updates);
    } else {
      if (onMoveTaskFolder) onMoveTaskFolder(data.taskId, projectPath);
    }
    (window as any).__navforDraggingTask = null;
  };

  // 2D representation of all visible tasks on the timeline for deterministic arrow key navigation
  const timelineLanes = useMemo(() => {
    return visibleProjectTree.map((project, pIdx) => {
      const projectTasks = project.tasks;

      // Unscheduled tasks (ToDo list) - Sorted: Active (A-Z), then Done (A-Z)
      const unscheduled = (showUnscheduledColumn 
        ? projectTasks.filter(t => timelineMode === 'calendar' ? (!t.deadline && !t.startDate && (!t.recurrence || t.recurrence.type === 'none')) : !getTaskCurrentColumnId(t, customColumns, activePattern.id))
        : []
      ).sort((a, b) => {
        const aDone = Boolean(a.isDone);
        const bDone = Boolean(b.isDone);
        if (aDone !== bDone) return aDone ? 1 : -1;
        return (a.title || '').localeCompare(b.title || '', undefined, { numeric: true, sensitivity: 'base' });
      });

      // Scheduled / column tasks
      let scheduled: Task[] = [];
      if (timelineMode === 'calendar') {
        scheduled = projectTasks.filter(t => typeof t.deadline === 'number' || typeof t.startDate === 'number' || (t.recurrence && t.recurrence.type !== 'none'))
          .sort((a, b) => {
            const aAllDay = isTaskAllDayDeadline(a) || !isGridEnabled;
            const bAllDay = isTaskAllDayDeadline(b) || !isGridEnabled;
            const aTime = aAllDay ? startOfDay(new Date(a.startDate || a.deadline || 0)).getTime() : (a.startDate || a.deadline || 0);
            const bTime = bAllDay ? startOfDay(new Date(b.startDate || b.deadline || 0)).getTime() : (b.startDate || b.deadline || 0);
            return aTime - bTime || (a.order ?? 0) - (b.order ?? 0) || a.createdAt - b.createdAt;
          });
      } else {
        const colOrderMap = new Map<string, number>(customColumns.map((c, idx) => [c.id, idx]));
        scheduled = projectTasks.filter(t => Boolean(getTaskCurrentColumnId(t, customColumns, activePattern.id)))
          .sort((a, b) => {
            const colA: number = colOrderMap.get(getTaskCurrentColumnId(a, customColumns, activePattern.id) || '') ?? 999;
            const colB: number = colOrderMap.get(getTaskCurrentColumnId(b, customColumns, activePattern.id) || '') ?? 999;
            if (colA !== colB) return colA - colB;
            const stepA = getTaskCurrentStep(a, activePattern.id);
            const stepB = getTaskCurrentStep(b, activePattern.id);
            if (stepA !== stepB) return stepA - stepB;
            return (a.order ?? 0) - (b.order ?? 0) || (Number(a.createdAt) - Number(b.createdAt));
          });
      }

      // Combine in visual left-to-right order with approximate horizontal coordinate
      const allTasksInLane = [
        ...unscheduled.map((t, idx) => ({ task: t, xApprox: -200 + idx * 10 })),
        ...scheduled.map((t) => {
          let xApprox = 0;
          if (timelineMode === 'calendar' && (t.deadline || t.startDate)) {
            const allDay = isTaskAllDayDeadline(t) || !isGridEnabled;
            const targetTime = allDay
              ? startOfDay(new Date(t.startDate || t.deadline!)).getTime()
              : (t.startDate || t.deadline!);
            xApprox = (targetTime - timelineStartMs) / slotDurationMs;
          } else {
            const colIdx = customColumns.findIndex(c => c.id === getTaskCurrentColumnId(t, customColumns, activePattern.id));
            const stepIdx = getTaskCurrentStep(t, activePattern.id);
            xApprox = colIdx >= 0 ? colIdx * 1000 + stepIdx * 100 + (t.order ?? 0) : 0;
          }
          return { task: t, xApprox };
        })
      ];

      return {
        project,
        pIdx,
        tasks: allTasksInLane
      };
    });
  }, [visibleProjectTree, showUnscheduledColumn, timelineMode, customColumns, activePattern.id, timelineStartMs, slotDurationMs]);

  // 2D Spatial Arrow Key Navigation: moves up, down, left, right exactly as displayed on the timeline
  const navigateSpatialTask = (direction: 'up' | 'down' | 'left' | 'right') => {
    (window as any).__navforActivePane = 'timeline';

    // 1. Gather all rendered task chips inside the timeline
    const allTaskEls = Array.from(
      document.querySelectorAll('#timeline-root [id^="timeline-task-"]')
    ) as HTMLElement[];

    if (allTaskEls.length === 0) return;

    // If no task is currently active, select the first or last task
    if (!activeTaskId) {
      const targetEl = (direction === 'down' || direction === 'right') ? allTaskEls[0] : allTaskEls[allTaskEls.length - 1];
      const targetId = targetEl.id.replace('timeline-task-', '');
      onSelectTask(targetId);
      setSelectedKey(`task:${targetId}`);
      setSelectedFolderPath(null);
      targetEl.focus({ preventScroll: true });
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      return;
    }

    const curEl = document.getElementById(`timeline-task-${activeTaskId}`);
    if (!curEl) {
      const targetId = allTaskEls[0].id.replace('timeline-task-', '');
      onSelectTask(targetId);
      setSelectedKey(`task:${targetId}`);
      setSelectedFolderPath(null);
      allTaskEls[0].focus({ preventScroll: true });
      allTaskEls[0].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      return;
    }

    const curRect = curEl.getBoundingClientRect();
    const curCx = curRect.left + curRect.width / 2;
    const curCy = curRect.top + curRect.height / 2;

    // Build candidates list with DOM bounding rects
    const candidates = allTaskEls
      .filter(el => el.id !== `timeline-task-${activeTaskId}`)
      .map(el => {
        const id = el.id.replace('timeline-task-', '');
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        return { el, id, rect, cx, cy };
      });

    let chosen: { el: HTMLElement; id: string } | null = null;

    if (direction === 'down') {
      // Find tasks strictly below current task
      const below = candidates.filter(c => c.cy > curCy + 6 || c.rect.top >= curRect.top + 8);
      if (below.length > 0) {
        let bestScore = Infinity;
        for (const cand of below) {
          const dy = cand.cy - curCy; // > 0
          const dx = cand.cx - curCx;
          // Check if candidate is vertically aligned (same column / stack)
          const isDirectlyBelow = Math.abs(dx) <= Math.max(curRect.width, cand.rect.width) * 0.75;
          let score: number;
          if (isDirectlyBelow) {
            // Immediate next task below in same stack gets lowest score
            score = dy;
          } else {
            // Lower lane / another column: minimize dy with dx penalty
            score = dy * 1.5 + Math.abs(dx) * 2.2 + 1000;
          }
          if (score < bestScore) {
            bestScore = score;
            chosen = cand;
          }
        }
      }
    } else if (direction === 'up') {
      // Find tasks strictly above current task
      const above = candidates.filter(c => c.cy < curCy - 6 || c.rect.bottom <= curRect.bottom - 8);
      if (above.length > 0) {
        let bestScore = Infinity;
        for (const cand of above) {
          const dy = curCy - cand.cy; // > 0
          const dx = cand.cx - curCx;
          const isDirectlyAbove = Math.abs(dx) <= Math.max(curRect.width, cand.rect.width) * 0.75;
          let score: number;
          if (isDirectlyAbove) {
            score = dy;
          } else {
            score = dy * 1.5 + Math.abs(dx) * 2.2 + 1000;
          }
          if (score < bestScore) {
            bestScore = score;
            chosen = cand;
          }
        }
      }
    } else if (direction === 'right') {
      // Find tasks to the right of current task
      const right = candidates.filter(c => c.cx > curCx + 8 || c.rect.left >= curRect.left + 10);
      if (right.length > 0) {
        let bestScore = Infinity;
        for (const cand of right) {
          const dx = cand.cx - curCx; // > 0
          const dy = cand.cy - curCy;
          // In same horizontal lane or row?
          const isSameLane = Math.abs(dy) <= Math.max(curRect.height, cand.rect.height) * 1.8;
          let score: number;
          if (isSameLane) {
            score = dx;
          } else {
            score = dx * 1.2 + Math.abs(dy) * 3.0 + 1000;
          }
          if (score < bestScore) {
            bestScore = score;
            chosen = cand;
          }
        }
      } else {
        // Wrap to the next project lane below: pick leftmost task in lower lanes
        const below = candidates.filter(c => c.cy > curCy + 10);
        if (below.length > 0) {
          below.sort((a, b) => (a.cy - b.cy) || (a.cx - b.cx));
          chosen = below[0];
        }
      }
    } else if (direction === 'left') {
      // Find tasks to the left of current task
      const left = candidates.filter(c => c.cx < curCx - 8 || c.rect.right <= curRect.right - 10);
      if (left.length > 0) {
        let bestScore = Infinity;
        for (const cand of left) {
          const dx = curCx - cand.cx; // > 0
          const dy = cand.cy - curCy;
          const isSameLane = Math.abs(dy) <= Math.max(curRect.height, cand.rect.height) * 1.8;
          let score: number;
          if (isSameLane) {
            score = dx;
          } else {
            score = dx * 1.2 + Math.abs(dy) * 3.0 + 1000;
          }
          if (score < bestScore) {
            bestScore = score;
            chosen = cand;
          }
        }
      } else {
        // Wrap to previous project lane above: pick rightmost task in upper lanes
        const above = candidates.filter(c => c.cy < curCy - 10);
        if (above.length > 0) {
          above.sort((a, b) => (b.cy - a.cy) || (b.cx - a.cx));
          chosen = above[0];
        }
      }
    }

    if (chosen) {
      onSelectTask(chosen.id);
      setSelectedKey(`task:${chosen.id}`);
      setSelectedFolderPath(null);
      chosen.el.focus({ preventScroll: true });
      chosen.el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  };

  // Keyboard navigation: visual sequence task file selection navigation across lanes and rows
  const handleNavKey = (e: KeyboardEvent | React.KeyboardEvent) => {
    const target = e.target as HTMLElement;
    const activeEl = typeof document !== 'undefined' ? (document.activeElement as HTMLElement) : null;
    if (
      target?.tagName === 'INPUT' ||
      target?.tagName === 'TEXTAREA' ||
      target?.tagName === 'SELECT' ||
      target?.isContentEditable ||
      activeEl?.tagName === 'INPUT' ||
      activeEl?.tagName === 'TEXTAREA' ||
      activeEl?.tagName === 'SELECT' ||
      activeEl?.isContentEditable ||
      quickAddCell
    ) {
      return;
    }

    // 1. Task navigation if a task is active: 2D spatial navigation exactly as displayed
    if (activeTaskId) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        navigateSpatialTask('down');
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        navigateSpatialTask('up');
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        navigateSpatialTask('right');
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        navigateSpatialTask('left');
        return;
      }

      // SPACE: Toggle done
      if (e.key === ' ') {
        e.preventDefault();
        onToggleDone(activeTaskId);
        return;
      }

      // ENTER or F2: Inline rename task title (like Explorer)
      if (e.key === 'Enter' || e.key === 'F2') {
        e.preventDefault();
        const task = tasks.find(t => t.id === activeTaskId);
        if (task) {
          startRenaming('task', task.id, task.title);
        }
        return;
      }

      // ESCAPE: Clear selection
      if (e.key === 'Escape') {
        e.preventDefault();
        onSelectTask('');
        setSelectedKey(null);
        return;
      }
    }

    // 2. Folder navigation if folder is selected
    if (selectedFolderPath || (selectedKey && selectedKey.startsWith('folder:'))) {
      const curPath = selectedFolderPath || selectedKey?.slice(7) || '';
      const curIdx = visibleProjectTree.findIndex(p => p.fullPath === curPath);

      if (e.key === 'ArrowUp' && curIdx > 0) {
        e.preventDefault();
        const prev = visibleProjectTree[curIdx - 1];
        setSelectedFolderPath(prev.fullPath);
        setSelectedKey(`folder:${prev.fullPath}`);
        const el = document.getElementById(`timeline-project-${encodeURIComponent(prev.fullPath)}`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        return;
      }
      if (e.key === 'ArrowDown' && curIdx !== -1 && curIdx < visibleProjectTree.length - 1) {
        e.preventDefault();
        const next = visibleProjectTree[curIdx + 1];
        setSelectedFolderPath(next.fullPath);
        setSelectedKey(`folder:${next.fullPath}`);
        const el = document.getElementById(`timeline-project-${encodeURIComponent(next.fullPath)}`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (collapsedProjectPaths.has(curPath)) {
          toggleProjectCollapse(curPath);
          return;
        }
        // If expanded and has tasks, select first task in this lane
        const lane = timelineLanes[curIdx];
        if (lane && lane.tasks.length > 0) {
          const firstTask = lane.tasks[0].task;
          (window as any).__navforActivePane = 'timeline';
          onSelectTask(firstTask.id);
          setSelectedKey(`task:${firstTask.id}`);
          setSelectedFolderPath(null);
          const el = document.getElementById(`timeline-task-${firstTask.id}`);
          el?.focus({ preventScroll: true });
          el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        }
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (!collapsedProjectPaths.has(curPath)) {
          toggleProjectCollapse(curPath);
        }
        return;
      }
      if (e.key === 'Enter' || e.key === 'F2') {
        e.preventDefault();
        const parts = curPath.split('/');
        const folderName = parts[parts.length - 1];
        startRenaming('folder', curPath, folderName);
        return;
      }
    }

    // 3. If nothing selected and user presses ArrowDown or ArrowRight on timeline
    if (!activeTaskId && !selectedFolderPath && !selectedKey) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        navigateSpatialTask('down');
        return;
      }
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        navigateSpatialTask('up');
        return;
      }
    }
  };

  // Keep DOM focus on the selected task chip when Timeline is active
  useEffect(() => {
    if (activeTaskId && (window as any).__navforActivePane === 'timeline') {
      const el = document.getElementById(`timeline-task-${activeTaskId}`);
      if (el && document.activeElement !== el) {
        el.focus({ preventScroll: true });
      }
    }
  }, [activeTaskId]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement as HTMLElement;
      if (
        activeEl?.tagName === 'INPUT' ||
        activeEl?.tagName === 'TEXTAREA' ||
        activeEl?.tagName === 'SELECT' ||
        activeEl?.isContentEditable ||
        renamingItem
      ) {
        return;
      }

      // Check if Timeline is active pane
      const isTimelineActive =
        (window as any).__navforActivePane === 'timeline' ||
        Boolean(activeEl?.closest('#timeline-root')) ||
        Boolean((e.target as HTMLElement)?.closest('#timeline-root'));

      if (!isTimelineActive) {
        // If Explorer is active pane and target is in explorer, let Explorer handle
        const isInsideExplorer =
          (window as any).__navforActivePane === 'explorer' &&
          (Boolean(activeEl?.closest('#explorer-tree-root')) ||
           Boolean((e.target as HTMLElement)?.closest('#explorer-tree-root')));

        if (isInsideExplorer) {
          return;
        }
      }

      // Ignore if dialog or quick-add is active
      if (document.querySelector('[role="dialog"]') || quickAddCell) {
        return;
      }

      // Handle arrow keys, enter, space, escape, f2
      if (['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Enter', ' ', 'Escape', 'F2'].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation?.();
        handleNavKey(e);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown, true);
  }, [activeTaskId, selectedFolderPath, selectedKey, collapsedProjectPaths, quickAddCell, visibleProjectTree, tasks, slotDurationMs, timelineStartMs, renamingItem]);

  const handleNavigate = (direction: 'prev' | 'next' | 'today') => {
    if (direction === 'today') {
      setWindowStartDate(startOfDay(new Date()));
    } else if (direction === 'prev') {
      setWindowStartDate(prev => subDays(prev, 7));
    } else {
      setWindowStartDate(prev => addDays(prev, 7));
    }
  };

  // Add custom column (Phase)
  const handleAddColumn = () => {
    const nextNum = customColumns.length + 1;
    const newId = `phase-${Date.now()}`;
    const newLabel = `Phase ${nextNum}`;
    saveCustomColumns([...customColumns, { id: newId, label: newLabel }]);
    setEditingColumnId(newId);
    setEditingColumnLabel(newLabel);
  };

  // Rename custom column
  const handleSaveRenameColumn = (colId: string) => {
    if (!editingColumnLabel.trim()) {
      setEditingColumnId(null);
      return;
    }
    const updated = customColumns.map(col => 
      col.id === colId ? { ...col, label: editingColumnLabel.trim() } : col
    );
    saveCustomColumns(updated);
    setEditingColumnId(null);
  };

  // Delete custom column
  const handleDeleteColumn = (colId: string) => {
    if (customColumns.length <= 1) return;
    const updated = customColumns.filter(col => col.id !== colId);
    saveCustomColumns(updated);
  };

  // Drag and drop task & folder handling
  const [dragOverProjectHeader, setDragOverProjectHeader] = useState<string | null>(null);
  const [isDragOverRootHeader, setIsDragOverRootHeader] = useState(false);

  const handleProjectDragStart = (e: React.DragEvent, folderPath: string) => {
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

  const handleTaskDragStart = (e: React.DragEvent, task: Task) => {
    const payload = {
      type: 'task',
      taskId: task.id,
      fromProject: task.project,
      currentProject: task.project,
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

  // Robustly extract dragged task payload from dataTransfer or window state
  const getDraggedTaskData = (e: React.DragEvent) => {
    let data: any = null;
    try {
      const raw = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain');
      if (raw) data = JSON.parse(raw);
    } catch (err) {}
    if (!data && (window as any).__navforDraggingTask) {
      data = (window as any).__navforDraggingTask;
    }
    return data;
  };

  // Move task or folder to another project by dropping onto Project Lane title
  const handleProjectHeaderDrop = (e: React.DragEvent, targetProject: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverProjectHeader(null);

    // Check if dragging a folder/subproject
    let folderData: any = null;
    try {
      const raw = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain');
      if (raw) folderData = JSON.parse(raw);
    } catch (err) {}
    if (!folderData && (window as any).__navforDraggingFolder) {
      folderData = (window as any).__navforDraggingFolder;
    }

    if (folderData?.type === 'folder' && folderData.folderPath) {
      const sourcePath = folderData.folderPath;
      if (sourcePath !== targetProject && !targetProject.startsWith(sourcePath + '/')) {
        if (onMoveFolder) {
          onMoveFolder(sourcePath, targetProject);
        }
      }
      (window as any).__navforDraggingFolder = null;
      return;
    }

    // Otherwise check if dragging a task to this project
    const data = getDraggedTaskData(e);
    if (!data?.taskId) return;

    if (onUpdateTask) {
      onUpdateTask(data.taskId, { project: targetProject });
    } else if (onMoveTaskFolder) {
      onMoveTaskFolder(data.taskId, targetProject);
    }
    (window as any).__navforDraggingTask = null;
  };

  // Reorder / Move task by dropping onto a cell (row: project, col: time slot)
  const handleCellDrop = (
    e: React.DragEvent, 
    project: string, 
    slot: { type: 'calendar'; date: Date | null } | { type: 'custom'; columnId: string | null }
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverCell(null);
    setDragOverTask(null);

    try {
      const data = getDraggedTaskData(e);
      if (!data?.taskId) return;

      const draggedTask = activeTasks.find(t => t.id === data.taskId);
      const updates: Partial<Task> = {};
      // Row (project) update
      updates.project = project;

      // Column (time/slot) update
      if (slot.type === 'calendar') {
        if (slot.date) {
          const target = new Date(slot.date);
          target.setHours(23, 59, 59, 999);
          updates.deadline = target.getTime();
          updates.isAllDay = true;
          updates.timelineColumn = undefined;
        } else {
          // In ToDo List column: do NOT clear deadline, original deadline is preserved
          updates.timelineColumn = undefined;
        }
      } else {
        const nextPresetCols = { ...(draggedTask?.timelinePresetColumns || {}) };
        const nextPresetSteps = { ...(draggedTask?.timelinePresetSteps || {}) };
        if (slot.columnId) {
          const targetStep = draggedTask?.timelinePresetSteps?.[activePattern.id] ?? draggedTask?.timelineStep ?? 0;
          nextPresetCols[activePattern.id] = slot.columnId;
          nextPresetSteps[activePattern.id] = targetStep;
          if (activePattern.id === DEFAULT_PATTERN_ID) {
            updates.timelineColumn = slot.columnId;
            updates.timelineStep = targetStep;
          }
          updates.timelinePresetColumns = nextPresetCols;
          updates.timelinePresetSteps = nextPresetSteps;
          // In custom columns: do NOT clear deadline, original deadline is preserved
        } else {
          // In ToDo List (backlog): remove from column in current pattern
          delete nextPresetCols[activePattern.id];
          delete nextPresetSteps[activePattern.id];
          updates.timelinePresetColumns = nextPresetCols;
          updates.timelinePresetSteps = nextPresetSteps;
          if (activePattern.id === DEFAULT_PATTERN_ID) {
            updates.timelineColumn = undefined;
            updates.timelineStep = undefined;
          }
        }
      }

      // Calculate new order to place at end of slot
      const existingInSlot = activeTasks.filter(t => {
        if (t.project !== project) return false;
        if (t.id === data.taskId) return false;
        if (slot.type === 'calendar') {
          if (!slot.date) return !t.deadline;
          return t.deadline && isSameDay(new Date(t.deadline), slot.date);
        } else {
          const tCol = getTaskCurrentColumnId(t, customColumns, activePattern.id);
          if (!slot.columnId) return !tCol;
          return tCol === slot.columnId;
        }
      });

      const maxOrder = existingInSlot.reduce((max, t) => Math.max(max, t.order ?? 0), 0);
      updates.order = maxOrder + 10;

      if (onUpdateTask) {
        onUpdateTask(data.taskId, updates);
      } else {
        if (onMoveTaskFolder && updates.project) onMoveTaskFolder(data.taskId, updates.project);
        if (onScheduleTask && slot.type === 'calendar') onScheduleTask(data.taskId, updates.deadline);
      }

      (window as any).__navforDraggingTask = null;
    } catch (err) {
      console.error(err);
    }
  };

  // Reorder task by dropping directly before or after another task chip
  const handleTaskDropOnTask = (
    e: React.DragEvent,
    targetTask: Task,
    position: 'before' | 'after'
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverCell(null);
    setDragOverTask(null);

    try {
      const data = getDraggedTaskData(e);
      if (!data?.taskId || data.taskId === targetTask.id) return;

      const draggedTask = activeTasks.find(t => t.id === data.taskId);
      const targetColId = timelineMode === 'custom' ? getTaskCurrentColumnId(targetTask, customColumns, activePattern.id) : undefined;
      const isTargetBacklog = timelineMode === 'calendar' ? !targetTask.deadline : !targetColId;

      const updates: Partial<Task> = {
        project: targetTask.project,
      };

      if (timelineMode === 'custom') {
        const nextPresetCols = { ...(draggedTask?.timelinePresetColumns || {}) };
        const nextPresetSteps = { ...(draggedTask?.timelinePresetSteps || {}) };
        if (targetColId) {
          const targetStep = targetTask.timelinePresetSteps?.[activePattern.id] ?? targetTask.timelineStep ?? 0;
          nextPresetCols[activePattern.id] = targetColId;
          nextPresetSteps[activePattern.id] = targetStep;
          if (activePattern.id === DEFAULT_PATTERN_ID) {
            updates.timelineColumn = targetColId;
            updates.timelineStep = targetStep;
          }
          updates.timelinePresetColumns = nextPresetCols;
          updates.timelinePresetSteps = nextPresetSteps;
        } else {
          delete nextPresetCols[activePattern.id];
          delete nextPresetSteps[activePattern.id];
          updates.timelinePresetColumns = nextPresetCols;
          updates.timelinePresetSteps = nextPresetSteps;
          if (activePattern.id === DEFAULT_PATTERN_ID) {
            updates.timelineColumn = undefined;
            updates.timelineStep = undefined;
          }
        }
      } else {
        updates.timelineColumn = isTargetBacklog ? undefined : targetTask.timelineColumn;
      }

      // Only adjust deadline if explicitly scheduling onto a calendar date slot
      if (timelineMode === 'calendar' && targetTask.deadline) {
        updates.deadline = targetTask.deadline;
        updates.isAllDay = targetTask.isAllDay;
      }
      // If moving in custom columns or between ToDo items, do NOT touch or reset deadline!

      // Find all sibling tasks in target slot (including ToDo List / backlog)
      const siblings = activeTasks.filter(t => {
        if (t.project !== targetTask.project) return false;
        if (t.id === data.taskId) return false; // exclude dragging task
        if (timelineMode === 'calendar') {
          if (!targetTask.deadline) return !t.deadline;
          return t.deadline && isSameDay(new Date(t.deadline), new Date(targetTask.deadline));
        } else {
          const tCol = getTaskCurrentColumnId(t, customColumns, activePattern.id);
          if (!targetColId) return !tCol;
          return tCol === targetColId;
        }
      }).sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.createdAt - b.createdAt);

      const targetIdx = siblings.findIndex(s => s.id === targetTask.id);
      const insertIdx = position === 'before' ? Math.max(0, targetIdx) : targetIdx + 1;

      // Insert dragging task placeholder into list
      const reordered = [...siblings];
      reordered.splice(insertIdx, 0, { id: data.taskId } as any);

      // Distribute fresh spaced order numbers (10, 20, 30...)
      reordered.forEach((item, index) => {
        const newOrder = (index + 1) * 10;
        if (item.id === data.taskId) {
          updates.order = newOrder;
        } else if (item.order !== newOrder) {
          if (onUpdateTask) onUpdateTask(item.id, { order: newOrder });
        }
      });

      if (onUpdateTask) {
        onUpdateTask(data.taskId, updates);
      } else {
        if (onMoveTaskFolder) onMoveTaskFolder(data.taskId, updates.project);
        if (onScheduleTask && updates.deadline) onScheduleTask(data.taskId, updates.deadline);
      }

      (window as any).__navforDraggingTask = null;
    } catch (err) {
      console.error(err);
    }
  };

  const handleQuickAddSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSubmittingQuickAddRef.current) return;
    if (!quickAddCell || !quickAddTitle.trim()) {
      setQuickAddCell(null);
      setQuickAddTitle('');
      return;
    }

    const cell = quickAddCell;
    const title = quickAddTitle.trim();
    isSubmittingQuickAddRef.current = true;

    // Immediately clear quick add so no ghost duplicate card or input flashes while creating
    setQuickAddCell(null);
    setQuickAddTitle('');

    try {
      const nextPresetCols: Record<string, string> = {};
      const nextPresetSteps: Record<string, number> = {};
      if (cell.type === 'custom' && cell.columnId) {
        nextPresetCols[activePattern.id] = cell.columnId;
        nextPresetSteps[activePattern.id] = cell.stepIdx ?? 0;
      }

      let finalDeadline: number | undefined = undefined;
      const isAllDayTask = !isGridEnabled;
      if (cell.type === 'calendar' && cell.dateMs) {
        const d = new Date(cell.dateMs);
        if (isAllDayTask) {
          d.setHours(23, 59, 59, 999);
        }
        finalDeadline = d.getTime();
      }

      await onAddTask({
        title,
        project: cell.project,
        deadline: finalDeadline,
        timelineColumn: cell.type === 'custom' && activePattern.id === DEFAULT_PATTERN_ID ? cell.columnId : undefined,
        timelineStep: cell.type === 'custom' && activePattern.id === DEFAULT_PATTERN_ID ? (cell.stepIdx ?? 0) : undefined,
        timelinePresetColumns: cell.type === 'custom' && cell.columnId ? nextPresetCols : undefined,
        timelinePresetSteps: cell.type === 'custom' && cell.columnId ? nextPresetSteps : undefined,
        isAllDay: isAllDayTask,
        order: Date.now() % 10000
      });
    } finally {
      isSubmittingQuickAddRef.current = false;
    }
  };

  const renderPatternMenuDropdown = () => {
    if (typeof document === 'undefined') return null;

    const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
    let menuStyle: React.CSSProperties = {};

    if (isFullscreen) {
      menuStyle = {
        position: 'fixed',
        bottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))',
        right: '12px',
        maxWidth: 'calc(100vw - 24px)',
        maxHeight: 'calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 6rem)',
      };
    } else if (isMobile) {
      const topPx = patternMenuTriggerRect ? Math.max(8, patternMenuTriggerRect.bottom + 6) : 60;
      menuStyle = {
        position: 'fixed',
        top: `${topPx}px`,
        left: '10px',
        right: '10px',
        maxWidth: 'calc(100vw - 20px)',
        maxHeight: `calc(100dvh - ${topPx}px - 5.5rem - env(safe-area-inset-bottom, 0px))`,
      };
    } else {
      const topPx = patternMenuTriggerRect ? patternMenuTriggerRect.bottom + 6 : 60;
      const leftPx = patternMenuTriggerRect ? Math.max(12, patternMenuTriggerRect.left) : 16;
      menuStyle = {
        position: 'fixed',
        top: `${topPx}px`,
        left: `${leftPx}px`,
        width: '20rem',
        maxWidth: 'calc(100vw - 24px)',
        maxHeight: `min(${Math.max(260, window.innerHeight - topPx - 24)}px, 82vh)`,
      };
    }

    return createPortal(
      <>
        {/* Backdrop Overlay to ensure smooth touch dismissal and prevent cutoff */}
        <div 
          className="fixed inset-0 bg-slate-900/30 sm:bg-slate-900/10 backdrop-blur-2xs z-[120]"
          onClick={() => setIsPatternMenuOpen(false)}
        />
        <div 
          ref={patternMenuRef}
          style={menuStyle}
          className="bg-white border border-slate-200 rounded-2xl shadow-2xl z-[125] p-2 text-xs select-none animate-in fade-in zoom-in-95 duration-100 text-slate-800 overflow-y-auto overscroll-contain custom-scrollbar flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
        <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Workflow size={15} className="text-indigo-600" />
            <span className="font-bold text-slate-800 text-xs sm:text-xs">{L('Phaseパターン一覧', 'Phase Patterns', 'Modèles de phases')}</span>
          </div>
          <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
            {phasePatterns.length} {L('パターン', 'patterns', 'modèles')}
          </span>
        </div>

        {/* Pattern Items List */}
        <div className="py-1 max-h-60 overflow-y-auto space-y-1 custom-scrollbar">
          {phasePatterns.map((p) => {
            const isActive = p.id === activePattern.id;
            const isEditing = editingPatternId === p.id;

            if (isEditing) {
              return (
                <div key={p.id} className="p-1 bg-indigo-50 rounded-lg flex items-center gap-1">
                  <input
                    autoFocus
                    type="text"
                    value={editingPatternName}
                    onChange={(e) => setEditingPatternName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRenamePattern(p.id, editingPatternName);
                      if (e.key === 'Escape') setEditingPatternId(null);
                    }}
                    className="flex-1 bg-white border border-indigo-400 rounded px-2 py-1 text-xs font-bold text-slate-800 outline-none"
                    placeholder={L('パターン名', 'Pattern name', 'Nom du modèle')}
                  />
                  <button
                    type="button"
                    onClick={() => handleRenamePattern(p.id, editingPatternName)}
                    className="p-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 cursor-pointer"
                    title={L('保存', 'Save', 'Enregistrer')}
                  >
                    <Check size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingPatternId(null)}
                    className="p-1.5 bg-slate-200 text-slate-600 rounded hover:bg-slate-300 cursor-pointer"
                    title={L('キャンセル', 'Cancel', 'Annuler')}
                  >
                    <X size={14} />
                  </button>
                </div>
              );
            }

            return (
              <div
                key={p.id}
                onClick={() => {
                  handleSelectPattern(p.id);
                  setIsPatternMenuOpen(false);
                }}
                className={cn(
                  "px-3 py-2 rounded-xl flex items-center justify-between cursor-pointer transition-colors group min-h-[40px]",
                  isActive ? "bg-indigo-50/90 text-indigo-900 font-bold" : "hover:bg-slate-50 text-slate-700"
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-xs",
                    isActive ? "bg-indigo-600 text-white shadow-2xs" : "border border-slate-300 group-hover:border-slate-400"
                  )}>
                    {isActive && <Check size={12} strokeWidth={3} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-semibold flex items-center gap-1.5">
                      <span>{p.name}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 bg-slate-100 text-slate-500 rounded">
                        {p.columns.length}{L('列', 'cols', 'cols')}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 font-normal truncate mt-0.5">
                      {p.columns.map(c => c.label).join(' → ')}
                    </div>
                  </div>
                </div>

                {/* Actions on Pattern */}
                <div 
                  className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setEditingPatternId(p.id);
                      setEditingPatternName(p.name);
                    }}
                    className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-100/50 rounded transition-colors cursor-pointer"
                    title={L('名前を変更', 'Rename', 'Renommer')}
                  >
                    <Edit2 size={11} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDuplicatePattern(p.id)}
                    className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-100/50 rounded transition-colors cursor-pointer"
                    title={L('複製（列と配置タスクをコピー）', 'Duplicate pattern', 'Dupliquer le modèle')}
                  >
                    <Copy size={11} />
                  </button>
                  {phasePatterns.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleDeletePattern(p.id)}
                      className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                      title={L('削除', 'Delete', 'Supprimer')}
                    >
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Pattern Quick Tools & Create New */}
        <div className="pt-1.5 mt-1 border-t border-slate-100 space-y-1">
          <button
            type="button"
            onClick={() => {
              setNewPatternName(`${L('パターン', 'Pattern', 'Modèle')} ${phasePatterns.length + 1}`);
              setNewPatternCopyCols(true);
              setNewPatternCopyTasks(false);
              setIsCreatePatternModalOpen(true);
              setIsPatternMenuOpen(false);
            }}
            className="w-full py-2 px-3 bg-indigo-50 hover:bg-indigo-100/80 text-indigo-700 font-bold rounded-xl transition-colors flex items-center justify-center gap-2 text-xs cursor-pointer min-h-[38px]"
          >
            <Plus size={15} />
            <span>{L('新規パターンを追加', 'Add New Pattern', 'Nouveau modèle')}</span>
          </button>

          <div className="flex items-center gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => {
                handleAddColumn();
                setIsPatternMenuOpen(false);
              }}
              className="flex-1 py-1.5 px-2 text-xs bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer min-h-[32px]"
              title={L(`「${activePattern.name}」に列を追加`, `Add column to "${activePattern.name}"`, `Ajouter une colonne`)}
            >
              <Plus size={13} className="text-slate-500" />
              <span>{L('列を追加', 'Add Col', 'Ajouter col')}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                handleResetCustomColumns('names_only');
                setIsPatternMenuOpen(false);
              }}
              className="flex-1 py-1.5 px-2 text-xs bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer min-h-[32px]"
              title={L(`「${activePattern.name}」のPhase列名をPhase 1, 2, 3...に再設定`, `Reset column names to Phase 1, 2, 3...`, `Réinitialiser les phases`)}
            >
              <RefreshCw size={13} className="text-slate-500" />
              <span>{L('Reset Phases', 'Reset Phases', 'Réinit. phases')}</span>
            </button>
          </div>
          {/* Bottom clearance spacer so the last item is 100% visible and never crowded */}
          <div className="h-6 sm:h-3 shrink-0" />
        </div>
      </div>
    </>,
    document.body
  );
};

  const renderQuickMenuDropdown = (origin: 'toolbar' | 'floating') => {
    if (typeof document === 'undefined') return null;

    const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
    let menuStyle: React.CSSProperties = {};

    if (origin === 'floating') {
      menuStyle = {
        position: 'fixed',
        bottom: 'calc(3.75rem + env(safe-area-inset-bottom, 0px))',
        right: '12px',
        width: '20.5rem',
        maxWidth: 'calc(100vw - 24px)',
        maxHeight: 'calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 5rem)',
      };
    } else if (isMobile) {
      const topPx = quickMenuTriggerRect ? Math.max(8, quickMenuTriggerRect.bottom + 6) : 56;
      menuStyle = {
        position: 'fixed',
        top: `${topPx}px`,
        right: '8px',
        width: 'calc(100vw - 16px)',
        maxWidth: '22rem',
        maxHeight: `calc(100dvh - ${topPx}px - 1.25rem - env(safe-area-inset-bottom, 0px))`,
      };
    } else {
      const topPx = quickMenuTriggerRect ? Math.max(8, quickMenuTriggerRect.bottom + 6) : 56;
      const rightPx = quickMenuTriggerRect ? Math.max(12, window.innerWidth - quickMenuTriggerRect.right) : 16;
      menuStyle = {
        position: 'fixed',
        top: `${topPx}px`,
        right: `${rightPx}px`,
        width: '20.5rem',
        maxWidth: 'calc(100vw - 24px)',
        maxHeight: `min(${Math.max(260, window.innerHeight - topPx - 20)}px, 85vh)`,
      };
    }

    return createPortal(
      <>
        {/* Mobile & Desktop Backdrop Overlay to ensure smooth dismissal and prevent background taps */}
        <div 
          className="fixed inset-0 bg-slate-900/30 sm:bg-slate-900/10 backdrop-blur-2xs z-[120]"
          onClick={() => setIsQuickMenuOpen(false)}
        />
        <div
          ref={quickMenuRef}
          style={menuStyle}
          className="bg-white border border-slate-200 rounded-2xl shadow-2xl z-[125] p-2 text-xs text-slate-800 select-none animate-in fade-in zoom-in-95 duration-100 overflow-y-auto overscroll-contain custom-scrollbar flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-2.5 py-2 border-b border-slate-100 font-bold text-slate-800 shrink-0">
            <span className="flex items-center gap-2 text-xs sm:text-xs">
              <Menu size={15} className="text-indigo-600" />
              <span>{L('タイムライン メニュー', 'Timeline Menu', 'Menu chronologie')}</span>
            </span>
            <button
              type="button"
              onClick={() => setIsQuickMenuOpen(false)}
              className="w-7 h-7 flex items-center justify-center p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 active:bg-slate-200 transition-colors cursor-pointer"
            >
              <X size={15} />
            </button>
          </div>

        {/* Mode Switcher */}
        <div className="px-2 pt-2.5 pb-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          {L('表示モード', 'View Mode', 'Mode d\'affichage')}
        </div>
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => {
              handleSetTimelineMode('calendar');
              setIsQuickMenuOpen(false);
            }}
            className={cn(
              "w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-colors cursor-pointer min-h-[38px]",
              timelineMode === 'calendar' ? "bg-indigo-50 text-indigo-700 font-bold" : "hover:bg-slate-100 text-slate-700"
            )}
          >
            <span className="flex items-center gap-2.5">
              <CalendarIcon size={16} className="text-indigo-600 shrink-0" />
              <span className="text-xs">{L('日付基準（カレンダー）', 'Calendar Dates', 'Dates du calendrier')}</span>
            </span>
            {timelineMode === 'calendar' && <Check size={16} className="text-indigo-600 shrink-0" />}
          </button>

          <button
            type="button"
            onClick={() => {
              handleSetTimelineMode('custom');
              setIsQuickMenuOpen(false);
            }}
            className={cn(
              "w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-colors cursor-pointer min-h-[38px]",
              timelineMode === 'custom' ? "bg-indigo-50 text-indigo-700 font-bold" : "hover:bg-slate-100 text-slate-700"
            )}
          >
            <span className="flex items-center gap-2.5">
              <SlidersHorizontal size={16} className="text-indigo-600 shrink-0" />
              <span className="text-xs">{L('カスタム期間・Phase', 'Custom Stages (Phase)', 'Étapes personnalisées')}</span>
            </span>
            {timelineMode === 'custom' && <Check size={16} className="text-indigo-600 shrink-0" />}
          </button>
        </div>

        {/* Mode-Specific Sub-Controls */}
        {timelineMode === 'calendar' ? (
          <div className="mt-1 px-2.5 py-2 bg-slate-50 rounded-xl space-y-2 border border-slate-100">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-semibold">{L('日付移動', 'Navigate', 'Naviguer')}:</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleNavigate('prev')}
                  className="px-2 py-1 text-xs bg-white border border-slate-200 rounded-lg hover:bg-slate-100 text-slate-700 font-medium min-h-[28px] cursor-pointer"
                  title={L('1週間前へ', 'Previous week', 'Semaine précédente')}
                >
                  ◀ {L('前週', 'Prev', 'Préc.')}
                </button>
                <button
                  type="button"
                  onClick={() => handleNavigate('today')}
                  className="px-2.5 py-1 text-xs font-bold bg-indigo-50 border border-indigo-200 rounded-lg text-indigo-600 hover:bg-indigo-100 min-h-[28px] cursor-pointer"
                >
                  {L('今日', 'Today', 'Auj.')}
                </button>
                <button
                  type="button"
                  onClick={() => handleNavigate('next')}
                  className="px-2 py-1 text-xs bg-white border border-slate-200 rounded-lg hover:bg-slate-100 text-slate-700 font-medium min-h-[28px] cursor-pointer"
                  title={L('1週間後へ', 'Next week', 'Semaine suivante')}
                >
                  {L('翌週', 'Next', 'Suiv.')} ▶
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-semibold">{L('表示日数', 'Days range', 'Jours')}:</span>
              <div className="flex items-center gap-1">
                {[7, 14, 21].map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDaysCount(d)}
                    className={cn(
                      "px-2.5 py-1 text-xs rounded-lg border transition-all min-h-[28px] cursor-pointer",
                      daysCount === d ? "bg-indigo-600 text-white border-indigo-600 font-bold" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                    )}
                  >
                    {d}{L('日', 'd', 'j')}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-1 px-2.5 py-2 bg-slate-50 rounded-xl space-y-2 border border-slate-100">
            {/* Header: Phase Patterns List & Add New Button */}
            <div className="flex items-center justify-between text-xs pb-1.5 border-b border-slate-200/70">
              <span className="text-slate-700 font-bold flex items-center gap-1.5">
                <Workflow size={14} className="text-indigo-600 shrink-0" />
                <span>{L('Phaseパターン選択', 'Phase Patterns', 'Modèles')}</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 bg-indigo-100 text-indigo-800 rounded font-bold">
                  {phasePatterns.length}
                </span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setNewPatternName(`${L('パターン', 'Pattern', 'Modèle')} ${phasePatterns.length + 1}`);
                  setNewPatternCopyCols(true);
                  setNewPatternCopyTasks(false);
                  setIsCreatePatternModalOpen(true);
                  setIsQuickMenuOpen(false);
                }}
                className="px-2 py-1 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-2xs min-h-[28px]"
                title={L('新規パターンを作成', 'Create new pattern', 'Nouveau modèle')}
              >
                <Plus size={12} />
                <span>{L('新規作成', 'New', 'Nouveau')}</span>
              </button>
            </div>

            {/* List of ALL account-wide phase patterns */}
            <div className="max-h-48 overflow-y-auto space-y-1 custom-scrollbar py-0.5">
              {phasePatterns.map(p => {
                const isActive = p.id === activePattern.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      handleSelectPattern(p.id);
                    }}
                    className={cn(
                      "w-full px-2.5 py-2 rounded-xl text-left transition-all flex items-center justify-between gap-2 cursor-pointer text-xs min-h-[36px]",
                      isActive
                        ? "bg-white text-indigo-900 font-bold border border-indigo-300 shadow-2xs ring-1 ring-indigo-200"
                        : "bg-white/70 hover:bg-white text-slate-700 border border-slate-200/80 hover:border-slate-300"
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className={cn(
                        "w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-[10px]",
                        isActive ? "bg-indigo-600 text-white" : "border border-slate-300"
                      )}>
                        {isActive && <Check size={10} strokeWidth={3} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-semibold">{p.name}</div>
                        <div className="text-[10px] text-slate-400 font-normal truncate">
                          {p.columns.map(c => c.label).join(' → ')}
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded shrink-0">
                      {p.columns.length}{L('列', 'cols', 'cols')}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Sub-tools for active pattern */}
            <div className="flex items-center gap-1.5 pt-1.5 border-t border-slate-200/70">
              <button
                type="button"
                onClick={handleAddColumn}
                className="flex-1 py-1.5 px-2 text-xs bg-white border border-indigo-200 rounded-lg text-indigo-700 hover:bg-indigo-50 font-bold flex items-center justify-center gap-1 cursor-pointer shadow-2xs min-h-[30px]"
                title={L(`「${activePattern.name}」にPhase列を追加`, `Add Phase column to "${activePattern.name}"`, `Ajouter une colonne`)}
              >
                <Plus size={13} />
                <span>{L('列を追加', 'Add Col', 'Ajouter')}</span>
              </button>
              <button
                type="button"
                onClick={() => handleResetCustomColumns('names_only')}
                className="flex-1 py-1.5 px-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-100 font-bold flex items-center justify-center gap-1 cursor-pointer shadow-2xs min-h-[30px]"
                title={L(`「${activePattern.name}」のPhase列名をデフォルト（Phase 1, 2, 3...）に再設定`, `Reset column names to Phase 1, 2, 3...`, `Réinitialiser les phases`)}
              >
                <RefreshCw size={13} />
                <span>{L('Reset Phases', 'Reset Phases', 'Réinit.')}</span>
              </button>
            </div>
          </div>
        )}

        <div className="h-px bg-slate-100 my-1.5" />

        {/* Basic Functions */}
        <div className="px-2 pt-1 pb-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          {L('基本機能', 'Basic Functions', 'Fonctions de base')}
        </div>
        <div className="space-y-1">
          {/* Add New Task */}
          {onOpenCreateTaskModal && (
            <button
              type="button"
              onClick={() => {
                const activeTaskObj = activeTaskId && !activeTaskId.startsWith('folder:')
                  ? tasks.find(t => t.id === activeTaskId)
                  : null;
                const folderFromActiveTab = activeTaskId?.startsWith('folder:')
                  ? activeTaskId.slice(7)
                  : '';
                const targetFolder =
                  selectedFolderPath ||
                  (selectedKey?.startsWith('folder:') ? selectedKey.slice(7) : '') ||
                  folderFromActiveTab ||
                  activeTaskObj?.project ||
                  'General';
                onOpenCreateTaskModal(targetFolder);
                setIsQuickMenuOpen(false);
              }}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-indigo-50 text-indigo-700 transition-colors text-left cursor-pointer font-medium min-h-[40px]"
            >
              <span className="flex items-center gap-2.5">
                <Plus size={16} className="text-indigo-600 shrink-0" />
                <span className="text-xs font-semibold">{L('タスク追加', 'Add New Task', 'Ajouter une tâche')}</span>
              </span>
              <span className="text-[11px] text-indigo-500 font-normal">{L('新規作成', 'New Task', 'Nouveau')}</span>
            </button>
          )}

          {/* Add Project Folder */}
          <button
            type="button"
            onClick={() => {
              setTargetParentFolder(null);
              setNewFolderName('');
              setIsCreateFolderOpen(true);
              setIsQuickMenuOpen(false);
            }}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-indigo-50 text-indigo-700 transition-colors text-left cursor-pointer font-medium min-h-[40px]"
          >
            <span className="flex items-center gap-2.5">
              <FolderPlus size={16} className="text-indigo-600 shrink-0" />
              <span className="text-xs font-semibold">{L('フォルダ追加', 'Add Project Folder', 'Ajouter un dossier')}</span>
            </span>
            <span className="text-[11px] text-indigo-500 font-normal">{L('新規作成', 'New Folder', 'Nouveau')}</span>
          </button>

          {/* Collapse / Expand All */}
          <button
            type="button"
            onClick={() => {
              handleToggleCollapseAllProjects();
              setIsQuickMenuOpen(false);
            }}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-slate-100 text-slate-700 transition-colors text-left cursor-pointer min-h-[40px]"
          >
            <span className="flex items-center gap-2.5">
              {isAllProjectsCollapsed ? (
                <ChevronsUpDown size={16} className="text-amber-600 shrink-0" />
              ) : (
                <ChevronsDownUp size={16} className="text-slate-500 shrink-0" />
              )}
              <span className="text-xs">{isAllProjectsCollapsed ? L('全フォルダ展開', 'Expand All Folders', 'Développer tout') : L('全フォルダ折畳', 'Collapse All Folders', 'Tout réduire')}</span>
            </span>
            <span className={cn(
              "text-[10px] px-2 py-0.5 rounded-md font-mono font-bold",
              isAllProjectsCollapsed ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-500"
            )}>
              {isAllProjectsCollapsed ? L('折畳中', 'Collapsed', 'Réduit') : L('展開中', 'Expanded', 'Développé')}
            </span>
          </button>

          {/* Reset Column Widths */}
          <button
            type="button"
            onClick={() => {
              handleResetColumnWidths();
              setIsQuickMenuOpen(false);
            }}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-slate-100 text-slate-700 transition-colors text-left cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <ArrowLeftRight size={14} className="text-slate-500 shrink-0" />
              <span>{L('列幅リセット', 'Reset Column Widths', 'Réinitialiser largeurs')}</span>
            </span>
            <span className="text-[10px] text-slate-400">{L('初期値', 'Default', 'Défaut')}</span>
          </button>

          {/* Grid ON / OFF */}
          <div>
            <button
              type="button"
              onClick={() => {
                handleToggleGrid(!isGridEnabled);
              }}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-slate-100 text-slate-700 transition-colors text-left cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <LayoutGrid size={13} className={isGridEnabled ? "text-indigo-600" : "text-slate-400"} />
                <span>{L('グリッド線', 'Grid lines', 'Grille')}</span>
              </span>
              <span className={cn(
                "text-[9px] px-1.5 py-0.5 rounded font-mono font-bold uppercase",
                isGridEnabled ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"
              )}>
                {isGridEnabled ? 'ON' : 'OFF'}
              </span>
            </button>
            {isGridEnabled && (
              <div className="px-2.5 py-1 bg-slate-50 rounded-md flex items-center justify-between text-[10px] text-slate-600 mt-0.5">
                <span className="font-semibold text-slate-400">{L('刻み', 'Steps', 'Pas')}:</span>
                {timelineMode === 'calendar' ? (
                  <div className="flex items-center gap-1">
                    {[1, 2, 4, 6, 12, 24].map(h => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => handleSetGridStepHours(h)}
                        className={cn(
                          "px-1 py-0.5 rounded transition-all",
                          gridStepHours === h ? "bg-indigo-600 text-white font-bold" : "hover:text-slate-900 bg-white border border-slate-200"
                        )}
                      >
                        {h}h
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    {[2, 3, 4, 5].map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => handleSetStageSubdivisions(s)}
                        className={cn(
                          "px-1.5 py-0.5 rounded transition-all",
                          stageSubdivisions === s ? "bg-indigo-600 text-white font-bold" : "hover:text-slate-900 bg-white border border-slate-200"
                        )}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ToDo List Column Toggle */}
          <button
            type="button"
            onClick={() => {
              setShowUnscheduledColumn(prev => !prev);
              setIsQuickMenuOpen(false);
            }}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-slate-100 text-slate-700 transition-colors text-left cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <ListTodo size={13} className={showUnscheduledColumn ? "text-amber-600" : "text-slate-400"} />
              <span>{L('ToDo リスト列', 'ToDo List column', 'Colonne ToDo')}</span>
            </span>
            <span className={cn(
              "text-[9px] px-1.5 py-0.5 rounded font-mono font-bold uppercase",
              showUnscheduledColumn ? "bg-amber-600 text-white" : "bg-slate-100 text-slate-500"
            )}>
              {showUnscheduledColumn ? 'ON' : 'OFF'}
            </span>
          </button>

          {/* Time Filter in Quick Menu */}
          <button
            type="button"
            data-dropdown-trigger="time-filter"
            onClick={(e) => {
              // Anchor to the Menu button at the top toolbar (quickMenuTriggerRect) so it does not open at the bottom of the screen!
              const rect = quickMenuTriggerRect || e.currentTarget.getBoundingClientRect();
              setTimeFilterTriggerRect(rect);
              setIsQuickMenuOpen(false);
              setIsTimeFilterOpen(true);
            }}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-slate-100 text-slate-700 transition-colors text-left cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Clock size={13} className={timeFilter.enabled ? "text-indigo-600" : "text-slate-400"} />
              <span>{L('更新日時フィルター', 'Time Filter (Updated)', 'Filtre de date')}</span>
            </span>
            <span className={cn(
              "text-[9px] px-1.5 py-0.5 rounded font-mono font-bold",
              timeFilter.enabled ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"
            )}>
              {timeFilter.enabled ? getTimeFilterLabel(timeFilter) : L('すべて', 'All', 'Tous')}
            </span>
          </button>
        </div>

        {/* Fullscreen Toggle in Menu */}
        {onToggleFullscreen && (
          <>
            <div className="h-px bg-slate-100 my-1" />
            <button
              type="button"
              onClick={() => {
                onToggleFullscreen();
                setIsQuickMenuOpen(false);
              }}
              className={cn(
                "w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg font-bold transition-colors text-left cursor-pointer",
                isFullscreen ? "bg-indigo-600 text-white hover:bg-indigo-500" : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
              )}
            >
              <span className="flex items-center gap-2">
                {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                <span>{isFullscreen ? L('全画面を終了 (通常表示に戻す)', 'Exit Full View', 'Quitter plein écran') : L('全画面で表示 (Full View)', 'Enter Full View', 'Plein écran')}</span>
              </span>
            </button>
          </>
        )}
        {/* Bottom clearance spacer so the last item is 100% visible and never crowded or cut off */}
        <div className="h-8 sm:h-4 shrink-0" />
      </div>
    </>,
    document.body
  );
};

  const renderTimeFilterDropdown = () => {
    if (typeof document === 'undefined') return null;

    const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const estimatedHeight = 440;
    const menuWidth = 320; // 20rem

    let menuStyle: React.CSSProperties = {};

    if (isFullscreen) {
      menuStyle = {
        position: 'fixed',
        bottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))',
        right: '12px',
        maxWidth: 'calc(100vw - 24px)',
        maxHeight: 'calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 6rem)',
      };
    } else if (isMobile || viewportHeight < 560) {
      // Centered on mobile or short screens to ensure 100% visibility without cutoffs
      menuStyle = {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 'calc(100vw - 24px)',
        maxWidth: '360px',
        maxHeight: 'calc(100dvh - 2.5rem - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))',
      };
    } else {
      let topPx: number;
      if (timeFilterTriggerRect) {
        // If trigger is located in lower half of screen, open upwards above trigger
        if (timeFilterTriggerRect.top > viewportHeight - estimatedHeight) {
          topPx = Math.max(16, timeFilterTriggerRect.top - estimatedHeight - 8);
        } else {
          // Open downwards below trigger
          topPx = Math.max(16, timeFilterTriggerRect.bottom + 8);
        }

        // Strict clamp to guarantee the dropdown bottom NEVER extends beyond viewport
        if (topPx + estimatedHeight > viewportHeight - 16) {
          topPx = Math.max(16, viewportHeight - estimatedHeight - 16);
        }
      } else {
        topPx = 56;
      }

      let leftPx: number;
      if (timeFilterTriggerRect) {
        if (timeFilterTriggerRect.right > viewportWidth - 340) {
          leftPx = Math.max(12, Math.min(viewportWidth - menuWidth - 16, timeFilterTriggerRect.right - menuWidth));
        } else {
          leftPx = Math.max(12, Math.min(viewportWidth - menuWidth - 16, timeFilterTriggerRect.left));
        }
      } else {
        leftPx = 16;
      }

      menuStyle = {
        position: 'fixed',
        top: `${topPx}px`,
        left: `${leftPx}px`,
        width: '20rem',
        maxWidth: 'calc(100vw - 24px)',
        maxHeight: `${Math.max(260, viewportHeight - topPx - 16)}px`,
      };
    }

    return createPortal(
      <>
        {/* Backdrop Overlay to prevent cutoff and ensure smooth touch dismissal */}
        <div 
          className="fixed inset-0 bg-slate-900/30 sm:bg-slate-900/10 backdrop-blur-2xs z-[120]"
          onClick={() => setIsTimeFilterOpen(false)}
        />

        <div
          ref={timeFilterMenuRef}
          style={menuStyle}
          className="bg-white border border-slate-200 rounded-2xl shadow-2xl z-[125] p-3 text-xs select-none animate-in fade-in zoom-in-95 duration-100 text-slate-800 box-border overflow-y-auto overscroll-contain"
        >
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <Clock size={14} className="text-indigo-600 shrink-0" />
            <span className="font-extrabold text-slate-800 text-[11px] truncate">
              {L('更新日時フィルター', 'Time Filter (Updated)', 'Filtre de mise à jour')}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className={cn(
              "text-[10px] font-mono px-1.5 py-0.5 rounded-full font-bold",
              timeFilter.enabled ? "bg-indigo-50 text-indigo-700 border border-indigo-200" : "bg-slate-100 text-slate-500"
            )}>
              {activeTasks.length}/{allActiveTasks.length} {L('件', 'items', 'tâches')}
            </span>
            {timeFilter.enabled && (
              <button
                type="button"
                onClick={() => {
                  handleUpdateTimeFilter({ enabled: false });
                  setIsTimeFilterOpen(false);
                }}
                className="text-[10px] font-bold text-red-600 hover:text-red-700 hover:bg-red-50 px-1.5 py-0.5 rounded transition-colors cursor-pointer"
                title={L('フィルターを解除してすべて表示', 'Clear filter', 'Effacer le filtre')}
              >
                {L('解除', 'Clear', 'Effacer')}
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsTimeFilterOpen(false)}
              className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-1 rounded-lg transition-colors cursor-pointer ml-0.5"
              title={L('閉じる', 'Close', 'Fermer')}
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Quick Presets */}
        <div className="mb-2.5">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
            <span>{L('クイック指定', 'Quick Presets', 'Sélection rapide')}</span>
            <span className="text-[9px] text-slate-400 font-normal">{L('ワンクリックで絞り込み', 'One click', '1 clic')}</span>
          </div>
          <div className="grid grid-cols-3 gap-1">
            <button
              type="button"
              onClick={() => {
                handleUpdateTimeFilter({ enabled: false });
                setIsTimeFilterOpen(false);
              }}
              className={cn(
                "py-1 px-1 rounded-lg text-[10px] font-bold transition-all border text-center cursor-pointer truncate",
                !timeFilter.enabled
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs"
                  : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
              )}
            >
              {L('すべて表示', 'Show All', 'Tout afficher')}
            </button>
            {[
              { label: L('1週間以上前', '1w+ ago', '1+ sem.'), amount: 1, unit: 'week' as TimeFilterUnit },
              { label: L('2週間以上前', '2w+ ago', '2+ sem.'), amount: 2, unit: 'week' as TimeFilterUnit },
              { label: L('1ヶ月以上前', '1mo+ ago', '1+ mois'), amount: 1, unit: 'month' as TimeFilterUnit },
              { label: L('3ヶ月以上前', '3mo+ ago', '3+ mois'), amount: 3, unit: 'month' as TimeFilterUnit },
              { label: L('6ヶ月以上前', '6mo+ ago', '6+ mois'), amount: 6, unit: 'month' as TimeFilterUnit },
              { label: L('1年以上前', '1y+ ago', '1+ an'), amount: 1, unit: 'year' as TimeFilterUnit },
            ].map(preset => {
              const isSelected = timeFilter.enabled && timeFilter.amount === preset.amount && timeFilter.unit === preset.unit;
              return (
                <button
                  key={`${preset.amount}-${preset.unit}`}
                  type="button"
                  onClick={() => {
                    handleUpdateTimeFilter({ enabled: true, amount: preset.amount, unit: preset.unit });
                    setIsTimeFilterOpen(false);
                  }}
                  className={cn(
                    "py-1 px-1 rounded-lg text-[10px] font-bold transition-all border text-center cursor-pointer truncate",
                    isSelected
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs"
                      : "bg-white hover:bg-indigo-50/60 text-slate-700 border-slate-200"
                  )}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Number & Unit Selector */}
        <div className="pt-2 border-t border-slate-100">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
            {L('数値を指定して絞り込み', 'Custom Time Period', 'Période personnalisée')}
          </div>
          <div className="p-2 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-2">
            {/* Stepper & Number Input */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-slate-600 shrink-0">{L('期間の数値', 'Number', 'Nombre')}:</span>
              <div className="flex items-center bg-white border border-slate-300 rounded-lg p-0.5 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setCustomAmountInput(prev => Math.max(1, prev - 1))}
                  className="w-6 h-6 flex items-center justify-center rounded text-slate-600 hover:bg-slate-100 font-bold text-xs cursor-pointer"
                  title="-1"
                >
                  -
                </button>
                <input
                  type="number"
                  min="1"
                  max="99"
                  value={customAmountInput}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val) && val > 0) setCustomAmountInput(Math.min(99, val));
                  }}
                  className="w-10 text-center font-mono font-bold text-xs text-slate-800 outline-none p-0 border-0"
                />
                <button
                  type="button"
                  onClick={() => setCustomAmountInput(prev => Math.min(99, prev + 1))}
                  className="w-6 h-6 flex items-center justify-center rounded text-slate-600 hover:bg-slate-100 font-bold text-xs cursor-pointer"
                  title="+1"
                >
                  +
                </button>
              </div>
            </div>

            {/* Unit Tabs */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-slate-600 shrink-0">{L('単位', 'Unit', 'Unité')}:</span>
              <div className="grid grid-cols-3 gap-1 bg-slate-200/60 p-0.5 rounded-lg flex-1 max-w-[170px]">
                {[
                  { id: 'week' as TimeFilterUnit, ja: '週間', en: 'Weeks', fr: 'Sem.' },
                  { id: 'month' as TimeFilterUnit, ja: 'ヶ月', en: 'Months', fr: 'Mois' },
                  { id: 'year' as TimeFilterUnit, ja: '年', en: 'Years', fr: 'Ans' },
                ].map(u => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setCustomUnitInput(u.id)}
                    className={cn(
                      "py-1 text-[10px] font-bold rounded-md transition-all text-center cursor-pointer",
                      customUnitInput === u.id
                        ? "bg-white text-indigo-700 shadow-2xs font-extrabold"
                        : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    {tr(language, u.ja, u.en, u.fr)}
                  </button>
                ))}
              </div>
            </div>

            {/* Apply button */}
            <button
              type="button"
              onClick={() => {
                handleUpdateTimeFilter({
                  enabled: true,
                  amount: Math.max(1, customAmountInput),
                  unit: customUnitInput
                });
                setIsTimeFilterOpen(false);
              }}
              className="w-full py-2 px-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer mt-1"
            >
              <Check size={13} className="shrink-0" />
              <span className="text-center leading-tight truncate">
                {L(
                  `${customAmountInput}${customUnitInput === 'week' ? '週間' : customUnitInput === 'month' ? 'ヶ月' : '年'}以上前のタスクを表示`,
                  `Show tasks older than ${customAmountInput} ${customUnitInput === 'week' ? 'w' : customUnitInput === 'month' ? 'mo' : 'y'}`,
                  `Afficher tâches > ${customAmountInput} ${customUnitInput}`
                )}
              </span>
            </button>
          </div>
        </div>

        {/* Explanatory description footer */}
        <div className="mt-2 text-[9.5px] text-slate-500 leading-tight flex items-start gap-1">
          <Clock size={10} className="shrink-0 mt-0.5 text-slate-400" />
          <span>
            {L(
              '指定期間よりも古い（指定期間以上更新されていない）タスクをタイムライン上に表示します。',
              'Shows tasks older than the specified period (not updated since then).',
              'Affiche les tâches antérieures à la période spécifiée.'
            )}
          </span>
        </div>
      </div>
    </>,
    document.body
  );
};

  return (
    <div 
      id="timeline-root"
      onMouseDown={() => {
        (window as any).__navforActivePane = 'timeline';
      }}
      onFocus={() => {
        (window as any).__navforActivePane = 'timeline';
      }}
      className={cn(
        "flex-1 h-full min-h-0 flex flex-col bg-white overflow-hidden relative",
        isFullscreen ? "border-0 rounded-none" : "border border-slate-200/90 rounded-xl shadow-2xs"
      )}
    >
      {/* Timeline Top Control Toolbar (Normal View only - Hidden in Full View to maximize screen space for Timeline) */}
      {!isFullscreen && (
        <div className="relative z-50 flex items-center justify-between px-2 sm:px-3 border-b shrink-0 select-none py-1.5 bg-slate-50/90 border-slate-200 min-h-[38px] w-full max-w-full flex-nowrap gap-1.5 sm:gap-2">
          {/* Left: Mode Switcher (Dates vs Custom/Stages) & Phase Pattern Button */}
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1 flex-nowrap">
            {/* Optional Small Project Timeline Title (hidden on small/medium screens to ensure 100% 1-line fit on mobile) */}
            <button
              type="button"
              onClick={() => onToggleFullscreen?.()}
              className="hidden lg:flex items-center gap-1.5 text-xs font-bold text-slate-800 hover:text-indigo-600 transition-colors cursor-pointer shrink-0"
              title={L('クリックしてタイムラインを全画面表示 (Full view)', 'Click to enter Fullscreen Timeline (Full view)', 'Appuyez pour passer en plein écran')}
            >
              <CalendarDays size={15} className="text-indigo-600 shrink-0" />
              <span className="whitespace-nowrap">{L('タイムライン', 'Timeline', 'Chronologie')}</span>
            </button>

            <div className="h-4 w-px bg-slate-200 mx-0.5 hidden lg:block shrink-0" />

            {/* 1. Dates vs Custom/Phase Switcher */}
            <div className="flex items-center bg-white border border-slate-200 rounded-xl p-0.5 shadow-2xs shrink-0">
              <button
                type="button"
                onClick={() => handleSetTimelineMode('calendar')}
                className={cn(
                  "px-2 sm:px-2.5 py-1.5 sm:py-1 text-xs sm:text-[11px] font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shrink-0 min-h-[36px] sm:min-h-[30px]",
                  timelineMode === 'calendar'
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                )}
                title={L("Dates（カレンダー日付基準）", "Calendar Dates", "Dates du calendrier")}
              >
                <CalendarIcon size={15} className="shrink-0" />
                <span>Dates</span>
              </button>
              <button
                type="button"
                onClick={() => handleSetTimelineMode('custom')}
                className={cn(
                  "px-2 sm:px-2.5 py-1.5 sm:py-1 text-xs sm:text-[11px] font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shrink-0 min-h-[36px] sm:min-h-[30px]",
                  timelineMode === 'custom'
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                )}
                title={L("Phase（ステージ・カスタム期間）", "Phase / Stages", "Phases")}
              >
                <SlidersHorizontal size={15} className="shrink-0" />
                <span>Phase</span>
              </button>
            </div>

            {/* 2. Phase Pattern Button */}
            <div className="relative inline-flex items-center min-w-0 shrink">
              <button
                type="button"
                data-dropdown-trigger="pattern"
                onClick={(e) => {
                  if (timelineMode !== 'custom') {
                    handleSetTimelineMode('custom');
                  }
                  const rect = e.currentTarget.getBoundingClientRect();
                  setPatternMenuTriggerRect(rect);
                  setIsPatternMenuOpen(prev => !prev);
                }}
                className={cn(
                  "px-2.5 sm:px-2.5 py-1.5 sm:py-1 text-xs sm:text-[11px] font-bold rounded-xl border transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer select-none min-w-0 max-w-[145px] xs:max-w-[180px] sm:max-w-[220px] min-h-[36px] sm:min-h-[30px]",
                  timelineMode === 'custom'
                    ? "bg-indigo-50 border-indigo-200/90 text-indigo-900 hover:bg-indigo-100/70"
                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                )}
                title={L('Phaseパターンを切り替え・管理', 'Switch & manage phase patterns', 'Gérer les modèles de phases')}
              >
                <Workflow size={15} className="text-indigo-600 shrink-0" />
                <span className="truncate min-w-0 font-extrabold text-indigo-700">{activePattern.name}</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 bg-indigo-200/70 text-indigo-800 rounded font-bold leading-tight hidden xs:inline shrink-0">
                  {customColumns.length}{L('列', 'c', 'c')}
                </span>
                <ChevronDown size={13} className={cn("text-indigo-500 shrink-0 transition-transform duration-150", isPatternMenuOpen && "rotate-180")} />
              </button>

              {/* Dropdown Menu */}
              {!isFullscreen && isPatternMenuOpen && renderPatternMenuDropdown()}
            </div>

            {/* 3. Time Filter Button on Timeline Top Toolbar (Dates/Phase, Phase patternボタンの横) */}
            <div className="relative inline-flex items-center shrink-0">
              <button
                type="button"
                data-dropdown-trigger="time-filter"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setTimeFilterTriggerRect(rect);
                  setIsTimeFilterOpen(prev => !prev);
                }}
                className={cn(
                  "px-2 sm:px-2.5 py-1.5 sm:py-1 text-xs sm:text-[11px] font-bold rounded-xl border transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer select-none shrink-0 min-h-[36px] sm:min-h-[30px]",
                  timeFilter.enabled
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                    : isTimeFilterOpen
                      ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:text-indigo-600"
                )}
                title={L('Time filter（更新日時でタスクを絞り込み）', 'Time filter (Filter tasks by updated date)', 'Filtre temporel')}
              >
                <Clock size={14} className={cn("shrink-0", timeFilter.enabled ? "text-white" : "text-indigo-600")} />
                <span className="font-bold">
                  {timeFilter.enabled ? getTimeFilterLabel(timeFilter) : 'Time filter'}
                </span>
                {timeFilter.enabled && (
                  <span className="text-[10px] bg-white/20 px-1 py-0.2 rounded font-mono font-bold shrink-0">
                    {activeTasks.length}/{allActiveTasks.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Right: 3. Menu Button ONLY */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="relative inline-flex items-center">
              <button
                type="button"
                data-dropdown-trigger="quick-menu"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setQuickMenuTriggerRect(rect);
                  setQuickMenuOrigin('toolbar');
                  setIsQuickMenuOpen(prev => !prev);
                }}
                className={cn(
                  "px-2.5 sm:px-3 py-1.5 sm:py-1 text-xs sm:text-[11px] font-bold rounded-xl border transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer select-none shrink-0 min-h-[36px] sm:min-h-[30px]",
                  isQuickMenuOpen && quickMenuOrigin === 'toolbar'
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:text-indigo-600"
                )}
                title={L('メニュー（全機能の操作・設定）', 'Menu (All functions & settings)', 'Menu')}
              >
                <Menu size={16} className="shrink-0" />
                <span className="font-semibold text-xs">{L('メニュー', 'Menu', 'Menu')}</span>
              </button>

              {/* Quick Menu Dropdown */}
              {!isFullscreen && isQuickMenuOpen && quickMenuOrigin === 'toolbar' && renderQuickMenuDropdown('toolbar')}
            </div>

            {/* Time Filter Dropdown (Rendered when opened via Menu) */}
            {!isFullscreen && isTimeFilterOpen && renderTimeFilterDropdown()}
          </div>
        </div>
      )}

      {/* Timeline Grid Container */}
      <div 
        ref={timelineGridRef}
        tabIndex={0}
        onClick={() => {
          (window as any).__navforActivePane = 'timeline';
        }}
        className="flex-1 min-h-0 overflow-auto custom-scrollbar relative flex flex-col outline-none focus:ring-1 focus:ring-indigo-500/20"
      >
        {/* Table/Grid Header - Permanently sticky top & max-width bounds */}
        <div className="flex border-b border-slate-200 bg-slate-100 sticky top-0 z-30 shrink-0 select-none min-w-max w-max">
          {/* Project Column Header (Permanently sticky left cell, hidden in Fullscreen unless lanes toggled on) */}
          {!hideSideColumns && (
          <div 
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              setIsDragOverRootHeader(true);
            }}
            onDragLeave={() => setIsDragOverRootHeader(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOverRootHeader(false);
              let folderData: any = null;
              try {
                const raw = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain');
                if (raw) folderData = JSON.parse(raw);
              } catch (err) {}
              if (!folderData && (window as any).__navforDraggingFolder) {
                folderData = (window as any).__navforDraggingFolder;
              }
              if (folderData?.type === 'folder' && folderData.folderPath) {
                if (onMoveFolder) {
                  onMoveFolder(folderData.folderPath, 'General');
                }
                (window as any).__navforDraggingFolder = null;
              }
            }}
            style={{ width: `${effectiveProjectColWidth}px` }}
            className={cn(
              "shrink-0 px-2 sm:px-3 border-r border-slate-200 flex items-center justify-between text-xs sm:text-[11px] font-bold uppercase tracking-wider text-slate-700 bg-slate-100 sticky left-0 z-50 transition-colors group/projcol",
              isFullscreen ? "py-1.5" : "py-2.5",
              isDragOverRootHeader && "bg-indigo-100 ring-2 ring-indigo-500 ring-inset"
            )}
            title={L("サブプロジェクトをここにドロップすると最上位プロジェクト化できます", "Drop subproject here to make it a top-level project", "Déposez un sous-projet ici pour en faire un projet racine")}
          >
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <span className="truncate">{L('プロジェクトレーン', 'Project Lanes', 'Couloirs de projets')}</span>
            </div>

            {/* Quick Add Project Folder Button */}
            {effectiveProjectColWidth >= 105 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setTargetParentFolder(null);
                  setNewFolderName('');
                  setIsCreateFolderOpen(true);
                }}
                className="p-1 mr-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-200/80 rounded transition-colors shrink-0"
                title={L("プロジェクトフォルダを作成", "Add Project Folder", "Ajouter un dossier de projet")}
              >
                <FolderPlus size={15} />
              </button>
            )}

            {/* Draggable resize handle on right edge */}
            <div
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleStartProjectResize(e.clientX);
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
                handleStartProjectResize(e.touches[0].clientX);
              }}
              className="absolute -right-1 top-0 bottom-0 w-3.5 touch-none cursor-col-resize hover:bg-indigo-500/50 active:bg-indigo-600 transition-colors z-50 flex items-center justify-center group-hover/projcol:bg-slate-300/60"
              title={L("左右にドラッグしてプロジェクト列幅を調整", "Drag left/right to resize project column width", "Glisser pour ajuster la largeur de la colonne")}
            >
              <div className="w-0.5 h-3.5 bg-slate-400 rounded-full" />
            </div>
          </div>
          )}

          {/* ToDo List Column Header */}
          {effectiveShowUnscheduled && (
            <div 
              style={{ 
                width: `${todoColWidth}px`, 
                left: hideSideColumns ? 0 : `${effectiveProjectColWidth}px`
              }}
              className={cn(
                "shrink-0 px-2.5 border-r border-slate-200 bg-[#fffdf5] text-xs sm:text-[11px] font-bold text-amber-900 flex items-center justify-between sticky z-40 group/todocol shadow-2xs",
                isFullscreen ? "py-1.5" : "py-2.5"
              )}
            >
              <span className="flex items-center gap-1.5 font-bold truncate">
                <ListTodo size={15} className="text-amber-600 shrink-0" />
                <span className="truncate">{L('ToDo リスト', 'ToDo List', 'Liste de tâches')}</span>
              </span>

              {/* Draggable resize handle on right edge */}
              <div
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleStartTodoResize(e.clientX);
                }}
                onTouchStart={(e) => {
                  e.stopPropagation();
                  handleStartTodoResize(e.touches[0].clientX);
                }}
                className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize hover:bg-amber-500/50 active:bg-amber-600 transition-colors z-20 flex items-center justify-center group-hover/todocol:bg-amber-300/60"
                title={L("ドラッグしてToDoリスト列幅を調整", "Drag to resize ToDo list column width", "Glisser pour ajuster la largeur de la liste")}
              >
                <div className="w-0.5 h-3.5 bg-amber-400 rounded-full" />
              </div>
            </div>
          )}

          {/* Columns Header: Calendar Dates with Fine Grid Slots vs Custom Columns */}
          {timelineMode === 'calendar' ? (
            <div className="flex flex-1 min-w-max" style={{ width: `${totalGridWidth}px` }}>
              {timelineDates.map(date => {
                const today = isToday(date);
                const dayIdx = date.getDay();
                const isWeekend = dayIdx === 0 || dayIdx === 6;
                const dayOfWeek =
                  language === 'ja'
                    ? ['日', '月', '火', '水', '木', '金', '土'][dayIdx]
                    : language === 'fr'
                      ? ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'][dayIdx]
                      : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayIdx];
                const formattedMonthDay = format(date, language === 'fr' ? 'd/M' : 'M/d');
                const dayWidth = slotsPerDay * slotWidth;

                return (
                  <div
                    key={date.toISOString()}
                    style={{ width: `${dayWidth}px` }}
                    className={cn(
                      "shrink-0 border-r border-slate-300 select-none transition-colors flex flex-col justify-center group/datecol relative",
                      today && "bg-indigo-50/80 font-bold",
                      !today && isWeekend && "bg-slate-50 text-slate-500",
                      !today && !isWeekend && "bg-slate-100 text-slate-700"
                    )}
                  >
                    <div className={cn(
                      "px-2 flex items-center justify-between",
                      isFullscreen ? "py-1" : "py-1.5"
                    )}>
                      <span className={cn(
                        "text-[11px] sm:text-[10px] uppercase font-bold leading-none",
                        dayIdx === 0 ? "text-red-500" : dayIdx === 6 ? "text-indigo-500" : "text-slate-500"
                      )}>
                        {dayOfWeek}
                      </span>
                      <span className={cn(
                        "font-mono font-bold px-1.5 rounded",
                        isFullscreen ? "text-xs py-0.5" : "text-xs py-0.5",
                        today ? "bg-indigo-600 text-white shadow-2xs" : "text-slate-800"
                      )}>
                        {formattedMonthDay}
                      </span>
                    </div>

                    {/* Fine Grid Slot Markers within Day */}
                    {slotsPerDay > 1 && (
                      <div className="flex divide-x divide-slate-200/60 text-[9px] text-slate-400 font-mono">
                        {Array.from({ length: slotsPerDay }).map((_, sIdx) => (
                          <div
                            key={sIdx}
                            style={{ width: `${slotWidth}px` }}
                            className={cn(
                              "text-center truncate select-none",
                              isFullscreen ? "py-0 leading-tight" : "py-0.5"
                            )}
                            title={`${String(sIdx * gridStepHours).padStart(2, '0')}:00`}
                          >
                            {String(sIdx * gridStepHours).padStart(2, '0')}h
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Draggable resize handle on right edge */}
                    <div
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleStartDateColResize(e.clientX);
                      }}
                      onTouchStart={(e) => {
                        e.stopPropagation();
                        handleStartDateColResize(e.touches[0].clientX);
                      }}
                      className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize hover:bg-indigo-500/50 active:bg-indigo-600 transition-colors z-30 flex items-center justify-center group-hover/datecol:bg-slate-300/60"
                      title={L("ドラッグして日付列の幅を調整", "Drag to resize date column width", "Glisser pour ajuster la largeur de la colonne")}
                    >
                      <div className="w-0.5 h-3.5 bg-slate-400 rounded-full" />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Custom Abstract Columns Header */
            <div className="flex flex-1 min-w-max" style={{ width: `${totalCustomGridWidth + 48}px` }}>
              {customColumns.map(col => {
                const isEditing = editingColumnId === col.id;
                const colWidth = getCustomColWidth(col.id);
                const stepWidth = isGridEnabled && stageSubdivisions > 1 ? colWidth / stageSubdivisions : colWidth;

                return (
                  <div
                    key={col.id}
                    style={{ width: `${colWidth}px` }}
                    className="shrink-0 border-r border-slate-200 bg-slate-100 text-slate-700 flex flex-col justify-between group relative select-none"
                  >
                    <div className={cn(
                      "px-2 flex items-center justify-between",
                      isFullscreen ? "py-0.5" : "py-1.5"
                    )}>
                      {isEditing ? (
                        <div className="flex items-center gap-1 w-full">
                          <input
                            autoFocus
                            type="text"
                            value={editingColumnLabel}
                            onChange={(e) => setEditingColumnLabel(e.target.value)}
                            onKeyDown={(e) => {
                              e.stopPropagation();
                              if (e.key === 'Enter') handleSaveRenameColumn(col.id);
                              if (e.key === 'Escape') setEditingColumnId(null);
                            }}
                            onBlur={() => handleSaveRenameColumn(col.id)}
                            className="w-full bg-white border border-indigo-400 rounded px-1.5 py-0.5 text-xs font-bold text-slate-800 outline-none"
                          />
                        </div>
                      ) : (
                        <>
                          <span 
                            onDoubleClick={() => {
                              setEditingColumnId(col.id);
                              setEditingColumnLabel(col.label);
                            }}
                            className="text-xs font-bold truncate flex-1 cursor-pointer hover:text-indigo-600"
                            title={L("ダブルクリックで名前変更", "Double-click to rename", "Double-cliquez pour renommer")}
                          >
                            {col.label}
                          </span>
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity mr-2">
                            <button
                              onClick={() => {
                                setEditingColumnId(col.id);
                                setEditingColumnLabel(col.label);
                              }}
                              className="p-1 hover:text-indigo-600 hover:bg-slate-200 rounded text-slate-400"
                              title={L("列名を変更", "Rename column", "Renommer la colonne")}
                            >
                              <Edit2 size={11} />
                            </button>
                            {customColumns.length > 1 && (
                              <button
                                onClick={() => handleDeleteColumn(col.id)}
                                className="p-1 hover:text-red-600 hover:bg-red-50 rounded text-slate-400"
                                title={L("列を削除", "Delete column", "Supprimer la colonne")}
                              >
                                <Trash2 size={11} />
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    {/* Stage sub-slot grid indicators when grid is enabled */}
                    {isGridEnabled && stageSubdivisions > 1 && (
                      <div className="flex border-t border-slate-200/80 text-[9px] font-mono text-slate-400 divide-x divide-slate-200/60 bg-slate-50/70">
                        {Array.from({ length: stageSubdivisions }).map((_, sIdx) => (
                          <div
                            key={sIdx}
                            style={{ width: `${stepWidth}px` }}
                            className="text-center py-0.5 truncate select-none"
                            title={`Step ${sIdx + 1}`}
                          >
                            Step {sIdx + 1}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Draggable resize handle on right edge */}
                    <div
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleStartCustomColResize(col.id, e.clientX);
                      }}
                      onTouchStart={(e) => {
                        e.stopPropagation();
                        handleStartCustomColResize(col.id, e.touches[0].clientX);
                      }}
                      className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize hover:bg-indigo-500/50 active:bg-indigo-600 transition-colors z-30 flex items-center justify-center group-hover:bg-slate-300/60"
                      title={L(`ドラッグして「${col.label}」の列幅を調整`, `Drag to resize ${col.label} column width`, `Glisser pour ajuster la largeur de ${col.label}`)}
                    >
                      <div className="w-0.5 h-3.5 bg-slate-400 rounded-full" />
                    </div>
                  </div>
                );
              })}

              {/* End of columns Add Button */}
              <button
                onClick={handleAddColumn}
                className="w-12 shrink-0 border-r border-slate-200 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                title={L("新しいPhase列を追加", "Add new Phase column", "Ajouter une colonne de phase")}
              >
                <Plus size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Time Filter Active Notice */}
        {timeFilter.enabled && (
          <div className="px-3 py-1.5 bg-indigo-50/90 border-b border-indigo-200/70 flex items-center justify-between text-xs text-indigo-950 shrink-0 sticky top-0 z-30 select-none">
            <div className="flex items-center gap-2 min-w-0">
              <Clock size={13} className="text-indigo-600 shrink-0" />
              <span className="font-bold truncate text-[11px]">
                {L(
                  `更新日時フィルター適用中: ${getTimeFilterLabel(timeFilter)} (${activeTasks.length} / ${allActiveTasks.length} 件を表示中)`,
                  `Time filter active: ${getTimeFilterLabel(timeFilter)} (showing ${activeTasks.length} of ${allActiveTasks.length} tasks)`,
                  `Filtre de date actif: ${getTimeFilterLabel(timeFilter)} (${activeTasks.length} / ${allActiveTasks.length} tâches)`
                )}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsTimeFilterOpen(true)}
                className="text-[10px] text-indigo-700 hover:text-indigo-900 font-bold underline cursor-pointer"
              >
                {L('条件変更', 'Change', 'Modifier')}
              </button>
              <button
                type="button"
                onClick={() => handleUpdateTimeFilter({ enabled: false })}
                className="px-2 py-0.5 rounded bg-white hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[10px] font-bold transition-colors cursor-pointer shadow-2xs"
              >
                {L('すべて表示 (解除)', 'Clear', 'Effacer')}
              </button>
            </div>
          </div>
        )}

        {/* Empty matching notice when timeFilter is active and 0 tasks match */}
        {timeFilter.enabled && activeTasks.length === 0 && (
          <div className="p-6 m-4 bg-indigo-50/50 border border-indigo-200/80 rounded-2xl flex flex-col items-center justify-center text-center gap-2 max-w-md mx-auto">
            <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center">
              <Clock size={20} />
            </div>
            <h4 className="text-xs font-bold text-slate-800">
              {L(
                `指定期間（${getTimeFilterLabel(timeFilter)}）より古いタスクはありません`,
                `No tasks older than ${getTimeFilterLabel(timeFilter)}`,
                `Aucune tâche antérieure à ${getTimeFilterLabel(timeFilter)}`
              )}
            </h4>
            <p className="text-[11px] text-slate-500">
              {L(
                `全 ${allActiveTasks.length} 件のタスクはすべて指定期間よりも新しく更新されています。条件を変更するか解除してください。`,
                `All ${allActiveTasks.length} tasks were updated more recently than this timeframe. Adjust the range or clear the filter.`,
                `Toutes les ${allActiveTasks.length} tâches ont été mises à jour plus récemment.`
              )}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <button
                type="button"
                onClick={() => setIsTimeFilterOpen(true)}
                className="px-3 py-1 bg-white hover:bg-slate-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold shadow-2xs cursor-pointer"
              >
                {L('期間を変更する', 'Change Period', 'Modifier')}
              </button>
              <button
                type="button"
                onClick={() => handleUpdateTimeFilter({ enabled: false })}
                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
              >
                {L('フィルターを解除してすべて表示', 'Show All Tasks', 'Tout afficher')}
              </button>
            </div>
          </div>
        )}

        {/* Project Rows */}
        <div className="flex-1 shrink-0 flex flex-col divide-y divide-slate-100 min-w-max pb-28 lg:pb-16">
          {visibleProjectTree.map(project => {
            const isCollapsed = collapsedProjectPaths.has(project.fullPath);
            const isCompactLaneCol = effectiveProjectColWidth < 120;
            const indentPx = project.level * (isCompactLaneCol ? 8 : 14);

            // Separate tasks for this project
            const projectTasks = project.tasks;

            // Total tasks in this project and all its subfolders (for accurate collapsed summary)
            const totalDescendantTasks = activeTasks.filter(t => {
              const p = t.project?.trim() || 'General';
              return p === project.fullPath || p.startsWith(project.fullPath + '/');
            }).length;

            // Unscheduled tasks (no deadline/startDate/recurrence in calendar mode, no timelineColumn in current preset for custom mode)
            // Sorted: Active (A-Z), then Done (A-Z) as requested
            const unscheduledTasks = projectTasks.filter(t => {
              if (timelineMode === 'calendar') return !t.deadline && !t.startDate && (!t.recurrence || t.recurrence.type === 'none');
              return !getTaskCurrentColumnId(t, customColumns, activePattern.id);
            }).sort((a, b) => {
              const aDone = Boolean(a.isDone);
              const bDone = Boolean(b.isDone);
              if (aDone !== bDone) return aDone ? 1 : -1;
              return (a.title || '').localeCompare(b.title || '', undefined, { numeric: true, sensitivity: 'base' });
            });

            // Fine grid task placements and dynamic lane height for calendar and custom stages
            const { placed: calendarPlaced, laneHeight: calendarLaneHeight } = getPlacedTasksForProject(projectTasks);
            const { placed: customPlaced, laneHeight: customLaneHeight } = getPlacedCustomTasksForProject(projectTasks);
            const placed = calendarPlaced;

            // Calculate minimum height required for unscheduled tasks column
            const unscheduledEstimatedHeight = effectiveShowUnscheduled && unscheduledTasks.length > 0
              ? Math.max(58, unscheduledTasks.length * 38 + 16 + (quickAddCell?.project === project.fullPath && quickAddCell?.slotKey === 'backlog' ? 44 : 0))
              : 58;

            const gridContentHeight = timelineMode === 'calendar' ? calendarLaneHeight : customLaneHeight;
            const laneHeight = isCollapsed ? 36 : Math.max(58, gridContentHeight, unscheduledEstimatedHeight);

            return (
              <div 
                key={project.fullPath} 
                className={cn(
                  "flex group transition-colors hover:bg-slate-50/40 min-w-max w-max",
                  project.level === 0 ? "bg-white" : "bg-slate-50/20"
                )}
              >
                {/* In Fullscreen Mode when side columns are hidden: Zero-width sticky-left inline folder badge */}
                {hideSideColumns ? (
                  <div className="sticky left-0 z-20 w-0 overflow-visible self-start pointer-events-none">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleProjectCollapse(project.fullPath);
                      }}
                      style={{ marginLeft: `${Math.max(4, project.level * 10 + 4)}px` }}
                      className="pointer-events-auto mt-1 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/80 hover:bg-indigo-600 text-white text-xs font-medium backdrop-blur-md shadow-xs transition-colors whitespace-nowrap leading-none cursor-pointer min-h-[28px]"
                      title={L(`${project.fullPath} (タップで折りたたみ/展開)`, `${project.fullPath} (Tap to collapse/expand)`, `${project.fullPath} (Appuyer pour réduire/développer)`)}
                    >
                      {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                      <Folder size={12} className={project.level === 0 ? "text-indigo-300 shrink-0" : "text-amber-300 shrink-0"} />
                      <span className="max-w-[150px] truncate">{project.name}</span>
                    </button>
                  </div>
                ) : (
                /* Project Lane Title Column (Permanently Sticky Left, Draggable for Subproject Nesting / Movement) */
                <div 
                  id={`timeline-project-${encodeURIComponent(project.fullPath)}`}
                  draggable={true}
                  onDragStart={(e) => handleProjectDragStart(e, project.fullPath)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    setDragOverProjectHeader(project.fullPath);
                  }}
                  onDragLeave={() => {
                    if (dragOverProjectHeader === project.fullPath) {
                      setDragOverProjectHeader(null);
                    }
                  }}
                  onDrop={(e) => handleProjectHeaderDrop(e, project.fullPath)}
                  style={{ width: `${effectiveProjectColWidth}px`, minHeight: `${laneHeight}px`, paddingLeft: `${Math.max(4, indentPx + 4)}px` }}
                  className={cn(
                    "shrink-0 px-1.5 sm:px-2 py-2 border-r border-slate-200 flex items-center justify-between bg-white sticky left-0 z-20 select-none transition-colors cursor-grab active:cursor-grabbing group/lane self-stretch",
                    isCollapsed ? "min-h-[36px]" : "min-h-[58px]",
                    project.level === 0 ? "font-bold text-slate-800" : "font-medium text-slate-700",
                    dragOverProjectHeader === project.fullPath && "bg-indigo-50/90 ring-2 ring-indigo-500 ring-inset",
                    (selectedFolderPath === project.fullPath || selectedKey === `folder:${project.fullPath}` || activeTaskId === `folder:${project.fullPath}`) && "bg-indigo-50/90 ring-2 ring-indigo-500 ring-inset"
                  )}
                  title={L("クリックでフォルダ詳細を開く / ドラッグで移動", "Click to open folder detail / drag to move", "Cliquer pour ouvrir les détails / glisser pour déplacer")}
                >
                  <div 
                    onClick={() => {
                      (window as any).__navforActivePane = 'timeline';
                      setSelectedKey(`folder:${project.fullPath}`);
                      setSelectedFolderPath(project.fullPath);
                      onSelectTask(`folder:${project.fullPath}`, false);
                    }}
                    onDoubleClick={() => {
                      toggleProjectCollapse(project.fullPath);
                      onSelectTask(`folder:${project.fullPath}`, true);
                    }}
                    className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden cursor-pointer hover:text-indigo-600 transition-colors"
                  >
                    <GripVertical size={13} className="hidden sm:block text-slate-300 group-hover/lane:text-slate-500 shrink-0 mr-0.5 cursor-grab active:cursor-grabbing" />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleProjectCollapse(project.fullPath);
                        setSelectedKey(`folder:${project.fullPath}`);
                        setSelectedFolderPath(project.fullPath);
                      }}
                      className="w-7 h-7 sm:w-6 sm:h-6 flex items-center justify-center text-slate-400 hover:text-slate-700 active:bg-slate-200/60 rounded-md transition-transform shrink-0 cursor-pointer"
                    >
                      {isCollapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
                    </button>

                    <Folder size={15} className={cn("shrink-0 transition-colors", project.level === 0 ? "text-indigo-600" : "text-amber-500")} />

                    {renamingItem?.type === 'folder' && renamingItem.idOrPath === project.fullPath ? (
                      <form 
                        onSubmit={handleRenameSubmit} 
                        onClick={(e) => e.stopPropagation()} 
                        className="flex-1 min-w-0 mr-1"
                      >
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
                          className="w-full bg-white border border-indigo-500 rounded px-1.5 py-0.5 text-xs outline-none shadow-2xs font-mono font-normal text-slate-800 focus:ring-1 focus:ring-indigo-400"
                        />
                      </form>
                    ) : (
                      <span 
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          startRenaming('folder', project.fullPath, project.name);
                        }}
                        className="text-xs truncate font-mono tracking-tight flex-1 min-w-0" 
                        title={L(`${project.fullPath} (選択してEnterまたはダブルクリックで名前変更)`, `${project.fullPath} (Select & Enter or double-click to rename)`, `${project.fullPath} (Entrée ou double-clic pour renommer)`)}
                      >
                        {project.name}
                      </span>
                    )}

                    {/* Folder Star, Pin, Deadline icons */}
                    {(() => {
                      const fMeta = folderMetas?.[project.fullPath];
                      const fDeadlineAlert = fMeta?.deadline ? getTaskDeadlineAlert(fMeta.deadline, false, language) : null;
                      return (
                        <div className="flex items-center gap-1 shrink-0 ml-1" onClick={(e) => e.stopPropagation()}>
                          {/* Star */}
                          {fMeta?.isStarred ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleFolderStar?.(project.fullPath);
                              }}
                              className="text-amber-400 hover:text-amber-500 shrink-0"
                              title={L("スター解除", "Unstar folder", "Retirer des favoris")}
                            >
                              <Star size={11} fill="currentColor" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleFolderStar?.(project.fullPath);
                              }}
                              className="text-slate-300 hover:text-amber-400 shrink-0 opacity-0 group-hover/lane:opacity-100 transition-opacity"
                              title={L("スターを付ける", "Star folder", "Ajouter aux favoris")}
                            >
                              <Star size={11} />
                            </button>
                          )}

                          {/* Pin */}
                          {fMeta?.isPinned && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleFolderPin?.(project.fullPath);
                              }}
                              className="text-indigo-500 hover:text-indigo-600 shrink-0"
                              title={L("ピン留め解除", "Unpin folder", "Désépingler le dossier")}
                            >
                              <Pin size={11} fill="currentColor" />
                            </button>
                          )}

                          {/* Deadline Badge */}
                          {fDeadlineAlert && (
                            <span
                              className={cn(
                                "text-[9px] px-1 py-0.2 rounded font-mono font-bold shrink-0 leading-none",
                                fDeadlineAlert.isOverdue
                                  ? "bg-red-100 text-red-700 border border-red-200"
                                  : "bg-amber-100 text-amber-800 border border-amber-200"
                              )}
                              title={fDeadlineAlert.tooltip}
                            >
                              {fDeadlineAlert.label}
                            </span>
                          )}
                          {!fDeadlineAlert && fMeta?.deadline && (
                            <span
                              className="text-[9px] px-1 py-0.2 rounded font-mono text-slate-400 font-normal shrink-0 leading-none"
                              title={format(new Date(fMeta.deadline), language === 'fr' ? 'dd/MM/yyyy HH:mm' : language === 'en' ? 'MM/dd/yyyy HH:mm' : 'yyyy/MM/dd HH:mm')}
                            >
                              {format(new Date(fMeta.deadline), language === 'fr' ? 'd/M' : 'M/d')}
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Subfolder add, quick task add, and 3-dots menu buttons */}
                  <div className="flex items-center gap-0.5 shrink-0 ml-0.5">
                    {!isCompactLaneCol && (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setTargetParentFolder(project.fullPath);
                            setNewFolderName('');
                            setIsCreateFolderOpen(true);
                          }}
                          className="hidden group-hover/lane:flex p-0.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                          title={L('サブフォルダを追加', 'Add subfolder', 'Ajouter un sous-dossier')}
                        >
                          <FolderPlus size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (collapsedProjectPaths.has(project.fullPath)) {
                              toggleProjectCollapse(project.fullPath);
                            }
                            if (!showUnscheduledColumn) {
                              setShowUnscheduledColumn(true);
                            }
                            setQuickAddCell({ 
                              project: project.fullPath, 
                              slotKey: 'backlog', 
                              type: 'backlog' 
                            });
                            setQuickAddTitle('');
                          }}
                          className="hidden sm:flex p-0.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                          title={L('このプロジェクトにタスク追加', 'Add task in project', 'Ajouter une tâche dans ce projet')}
                        >
                          <Plus size={12} />
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const rect = e.currentTarget.getBoundingClientRect();
                        setActiveMenu({
                          type: 'folder',
                          idOrPath: project.fullPath,
                          x: rect.right,
                          y: rect.bottom
                        });
                      }}
                      className={cn(
                        "w-7 h-7 sm:w-6 sm:h-6 flex items-center justify-center text-slate-400 hover:text-slate-700 active:bg-slate-200/60 rounded-md transition-opacity shrink-0 mr-1 cursor-pointer",
                        activeMenu?.type === 'folder' && activeMenu.idOrPath === project.fullPath
                          ? "opacity-100 bg-slate-200/70 text-slate-800"
                          : "opacity-70 group-hover/lane:opacity-100"
                      )}
                      title={L("フォルダオプション", "Folder options", "Options du dossier")}
                    >
                      <MoreHorizontal size={15} />
                    </button>
                  </div>

                  {/* Draggable resize handle on right edge of every Project Lane row */}
                  <div
                    draggable={false}
                    onDragStart={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleStartProjectResize(e.clientX);
                    }}
                    onTouchStart={(e) => {
                      e.stopPropagation();
                      handleStartProjectResize(e.touches[0].clientX);
                    }}
                    className="absolute -right-1 top-0 bottom-0 w-3.5 touch-none cursor-col-resize hover:bg-indigo-500/40 active:bg-indigo-600 transition-colors z-30 flex items-center justify-center group-hover/lane:bg-slate-200/60"
                    title={L("左右にドラッグしてプロジェクト列幅を調整", "Drag left/right to resize project column width", "Glisser pour ajuster la largeur de la colonne")}
                  >
                    <div className="w-0.5 h-4 bg-slate-300 group-hover/lane:bg-indigo-400 rounded-full" />
                  </div>
                </div>
                )}

                {/* Content cells (Visible only if project is not collapsed) */}
                {!isCollapsed ? (
                  <>
                    {/* Unscheduled / Backlog Cell */}
                    {effectiveShowUnscheduled && (
                      <div
                        onDragOver={(e) => {
                          e.preventDefault();
                          setDragOverCell({ project: project.fullPath, slotKey: 'backlog' });
                        }}
                        onDragLeave={() => setDragOverCell(null)}
                        onDrop={(e) => handleCellDrop(e, project.fullPath, { 
                          type: timelineMode === 'calendar' ? 'calendar' : 'custom', 
                          date: null, 
                          columnId: null 
                        } as any)}
                        className={cn(
                          "shrink-0 p-1.5 border-r border-slate-200/80 bg-[#fffdf7] flex flex-col gap-1 min-h-[56px] transition-colors sticky z-10 self-stretch",
                          dragOverCell?.project === project.fullPath && dragOverCell?.slotKey === 'backlog' && "bg-amber-100/70 ring-2 ring-amber-500 ring-inset"
                        )}
                        style={{ 
                          width: `${todoColWidth}px`, 
                          minHeight: `${laneHeight}px`,
                          left: hideSideColumns ? 0 : `${effectiveProjectColWidth}px`
                        }}
                      >
                        {/* Task items in unscheduled */}
                        {unscheduledTasks.map((task) => renderTaskChip(task))}

                        {/* Quick Add Form in Unscheduled */}
                        {quickAddCell?.project === project.fullPath && quickAddCell?.slotKey === 'backlog' && (
                          <form onSubmit={handleQuickAddSubmit} className="mt-1">
                            <input
                              autoFocus
                              type="text"
                              placeholder={L("タスク名...", "Task name...", "Nom de la tâche...")}
                              value={quickAddTitle}
                              onChange={(e) => setQuickAddTitle(e.target.value)}
                              onKeyDown={(e) => {
                                e.stopPropagation();
                                if (e.key === 'Escape') {
                                  setQuickAddCell(null);
                                  setQuickAddTitle('');
                                }
                              }}
                              onBlur={() => {
                                if (isSubmittingQuickAddRef.current) return;
                                if (quickAddTitle.trim()) {
                                  handleQuickAddSubmit();
                                } else {
                                  setQuickAddCell(null);
                                }
                              }}
                              className="w-full bg-white border border-indigo-300 rounded px-1.5 py-1 text-xs outline-none focus:ring-1 focus:ring-indigo-500 shadow-2xs"
                            />
                          </form>
                        )}
                      </div>
                    )}

                    {/* Content Columns: Calendar Mode with Fine Grid vs Custom Mode */}
                    {timelineMode === 'calendar' ? (
                      /* Calendar Fine Grid Lane */
                      <div 
                        style={{ width: `${totalGridWidth}px`, minHeight: `${laneHeight}px` }}
                        className="relative flex-1 shrink-0 select-none bg-white self-stretch"
                      >
                        {/* Vertical Grid Lines & Droppable / Double-Clickable Slots */}
                        <div className="absolute inset-0 flex pointer-events-auto">
                          {timelineDates.map((date, dayIdx) => {
                            const isDateToday = isToday(date);
                            const dayWidth = slotsPerDay * slotWidth;

                            return (
                              <div 
                                key={date.toISOString()}
                                style={{ width: `${dayWidth}px` }}
                                className={cn(
                                  "flex divide-x divide-slate-100/80 border-r border-slate-300 h-full shrink-0",
                                  isDateToday && "bg-indigo-50/20"
                                )}
                              >
                                {Array.from({ length: slotsPerDay }).map((_, sIdx) => {
                                  const slotIdx = dayIdx * slotsPerDay + sIdx;
                                  const slotStartMs = timelineStartMs + slotIdx * slotDurationMs;
                                  const slotKey = `slot-${project.fullPath}-${slotIdx}`;
                                  const isDragOver = dragOverCell?.project === project.fullPath && dragOverCell?.slotKey === slotKey;

                                  return (
                                    <div
                                      key={sIdx}
                                      style={{ width: `${slotWidth}px` }}
                                      onDragOver={(e) => {
                                        e.preventDefault();
                                        setDragOverCell({ project: project.fullPath, slotKey });
                                      }}
                                      onDragLeave={() => setDragOverCell(null)}
                                      onDrop={(e) => {
                                        e.preventDefault();
                                        setDragOverCell(null);
                                        handleGridDrop(e, project.fullPath, slotStartMs);
                                      }}
                                      onDoubleClick={(e) => {
                                        e.stopPropagation();
                                        setQuickAddCell({
                                          project: project.fullPath,
                                          slotKey,
                                          type: 'calendar',
                                          dateMs: slotStartMs,
                                          slotIdx
                                        });
                                        setQuickAddTitle('');
                                      }}
                                      className={cn(
                                        "h-full transition-colors relative group/slot cursor-pointer shrink-0",
                                        isDragOver && "bg-indigo-100 border-2 border-dashed border-indigo-500",
                                        "hover:bg-indigo-50/30"
                                      )}
                                      title={L(`${format(new Date(slotStartMs), 'M/d HH:mm')} - ダブルクリックでタスク追加`, `${format(new Date(slotStartMs), 'M/d HH:mm')} - Double-click to add task`, `${format(new Date(slotStartMs), 'd/M HH:mm')} - Double-cliquez pour ajouter une tâche`)}
                                    />
                                  );
                                })}
                              </div>
                            );
                          })}
                        </div>

                        {/* Placed Task Chips on Fine Grid */}
                        <div className="absolute inset-0 pointer-events-none">
                          {placed.map(({ task, startPx, widthPx, topPx, occurrenceKey }) => (
                            <div
                              key={occurrenceKey}
                              style={{
                                position: 'absolute',
                                left: `${startPx}px`,
                                top: `${topPx}px`,
                                width: `${widthPx}px`,
                                pointerEvents: 'auto'
                              }}
                            >
                              {renderTaskChip(task)}
                            </div>
                          ))}
                        </div>

                        {/* Quick Add Form in clicked grid slot */}
                        {quickAddCell?.project === project.fullPath && quickAddCell?.type === 'calendar' && (
                          <div
                            style={{
                              position: 'absolute',
                              left: `${Math.min(totalGridWidth - 220, (quickAddCell.slotIdx ?? 0) * slotWidth)}px`,
                              top: '4px',
                              width: '210px',
                              zIndex: 40
                            }}
                            className="bg-white p-1 rounded-lg shadow-xl border border-indigo-400 pointer-events-auto"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <form onSubmit={handleQuickAddSubmit}>
                              <input
                                autoFocus
                                type="text"
                                placeholder={L("タスク名を入力...", "Task name...", "Nom de la tâche...")}
                                value={quickAddTitle}
                                onChange={(e) => setQuickAddTitle(e.target.value)}
                                onKeyDown={(e) => {
                                  e.stopPropagation();
                                  if (e.key === 'Escape') {
                                    setQuickAddCell(null);
                                    setQuickAddTitle('');
                                  }
                                }}
                                onBlur={() => {
                                  if (isSubmittingQuickAddRef.current) return;
                                  if (quickAddTitle.trim()) {
                                    handleQuickAddSubmit();
                                  } else {
                                    setQuickAddCell(null);
                                  }
                                }}
                                className="w-full bg-white border border-indigo-300 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-indigo-500 shadow-2xs"
                              />
                            </form>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Custom Abstract Columns / Stages Grid Lane (Dates pattern without dates) */
                      <div 
                        style={{ width: `${totalCustomGridWidth + 48}px`, minHeight: `${laneHeight}px` }}
                        className="relative flex-1 shrink-0 select-none bg-white self-stretch"
                      >
                        {/* Background Phase & Step Grid Slots */}
                        <div className="absolute inset-0 flex pointer-events-auto">
                          {customColumns.map((col) => {
                            const effectiveSubs = isGridEnabled ? stageSubdivisions : 1;
                            const colWidth = getCustomColWidth(col.id);
                            const stepWidth = colWidth / effectiveSubs;

                            return (
                              <div
                                key={col.id}
                                style={{ width: `${colWidth}px` }}
                                className="flex divide-x divide-slate-100/80 border-r border-slate-300 h-full shrink-0"
                              >
                                {Array.from({ length: effectiveSubs }).map((_, sIdx) => {
                                  const slotKey = `custom-${project.fullPath}-${col.id}-${sIdx}`;
                                  const isDragOver = dragOverCell?.project === project.fullPath && dragOverCell?.slotKey === slotKey;

                                  return (
                                    <div
                                      key={sIdx}
                                      style={{ width: `${stepWidth}px` }}
                                      onDragOver={(e) => {
                                        e.preventDefault();
                                        setDragOverCell({ project: project.fullPath, slotKey });
                                      }}
                                      onDragLeave={() => setDragOverCell(null)}
                                      onDrop={(e) => {
                                        e.preventDefault();
                                        setDragOverCell(null);
                                        handleCustomGridDrop(e, project.fullPath, col.id, sIdx);
                                      }}
                                      onDoubleClick={(e) => {
                                        e.stopPropagation();
                                        setQuickAddCell({
                                          project: project.fullPath,
                                          slotKey,
                                          type: 'custom',
                                          columnId: col.id,
                                          stepIdx: sIdx
                                        });
                                        setQuickAddTitle('');
                                      }}
                                      className={cn(
                                        "h-full transition-colors relative group/slot cursor-pointer shrink-0",
                                        isDragOver && "bg-indigo-100 border-2 border-dashed border-indigo-500",
                                        "hover:bg-indigo-50/30"
                                      )}
                                      title={L(
                                        `${col.label} (Step ${sIdx + 1}) - ダブルクリックでタスク追加 / ドラッグして配置`, 
                                        `${col.label} (Step ${sIdx + 1}) - Double-click to add task / Drag to place`,
                                        `${col.label} (Step ${sIdx + 1}) - Double-clic pour ajouter / Glisser pour placer`
                                      )}
                                    />
                                  );
                                })}
                              </div>
                            );
                          })}

                          {/* End of columns Add Button Filler in Lane */}
                          <div 
                            onClick={handleAddColumn}
                            className="w-12 shrink-0 border-r border-slate-200/60 bg-slate-50/20 hover:bg-indigo-50/40 cursor-pointer flex items-center justify-center text-slate-300 hover:text-indigo-600 transition-colors h-full"
                            title={L("新しいPhase列を追加", "Add new Phase column", "Ajouter une colonne de phase")}
                          >
                            <Plus size={13} />
                          </div>
                        </div>

                        {/* Placed Task Chips on Custom Stages Grid */}
                        <div className="absolute inset-0 pointer-events-none">
                          {customPlaced.map(({ task, startPx, widthPx, topPx }) => (
                            <div
                              key={task.id}
                              style={{
                                position: 'absolute',
                                left: `${startPx}px`,
                                top: `${topPx}px`,
                                width: `${widthPx}px`,
                                pointerEvents: 'auto'
                              }}
                            >
                              {renderTaskChip(task)}
                            </div>
                          ))}
                        </div>

                        {/* Quick Add Form in clicked custom grid slot */}
                        {quickAddCell?.project === project.fullPath && quickAddCell?.type === 'custom' && (() => {
                          let offsetLeft = 0;
                          const targetIdx = customColumns.findIndex(c => c.id === quickAddCell.columnId);
                          if (targetIdx !== -1) {
                            for (let i = 0; i < targetIdx; i++) {
                              offsetLeft += getCustomColWidth(customColumns[i].id);
                            }
                            const targetColWidth = getCustomColWidth(quickAddCell.columnId!);
                            const targetSubs = isGridEnabled ? stageSubdivisions : 1;
                            offsetLeft += (quickAddCell.stepIdx ?? 0) * (targetColWidth / targetSubs);
                          }

                          return (
                            <div
                              style={{
                                position: 'absolute',
                                left: `${Math.min(Math.max(0, totalCustomGridWidth - 220), offsetLeft)}px`,
                                top: '4px',
                                width: '210px',
                                zIndex: 40
                              }}
                              className="bg-white p-1 rounded-lg shadow-xl border border-indigo-400 pointer-events-auto"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <form onSubmit={handleQuickAddSubmit}>
                                <input
                                  autoFocus
                                  type="text"
                                  placeholder={L("タスク名を入力...", "Task name...", "Nom de la tâche...")}
                                  value={quickAddTitle}
                                  onChange={(e) => setQuickAddTitle(e.target.value)}
                                  onKeyDown={(e) => {
                                    e.stopPropagation();
                                    if (e.key === 'Escape') {
                                      setQuickAddCell(null);
                                      setQuickAddTitle('');
                                    }
                                  }}
                                  onBlur={() => {
                                    if (isSubmittingQuickAddRef.current) return;
                                    if (quickAddTitle.trim()) {
                                      handleQuickAddSubmit();
                                    } else {
                                      setQuickAddCell(null);
                                    }
                                  }}
                                  className="w-full bg-white border border-indigo-300 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-indigo-500 shadow-2xs"
                                />
                              </form>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </>
                ) : (
                  /* Collapsed Placeholder Lane */
                  <div className={cn(
                    "flex-1 py-1.5 text-xs text-slate-400 italic bg-slate-50/50 flex items-center gap-2",
                    hideSideColumns ? "pl-36 pr-4 min-h-[30px]" : "px-4"
                  )}>
                    <span>
                      {totalDescendantTasks} {L('件のタスクが折りたたまれています', 'tasks collapsed', 'tâches réduites')}
                    </span>
                    <button
                      onClick={() => toggleProjectCollapse(project.fullPath)}
                      className="text-[11px] font-sans font-medium text-indigo-600 hover:underline not-italic cursor-pointer"
                    >
                      {L('展開する', 'Expand', 'Développer')}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating Fullscreen / Overall View Control Pill */}
      {onToggleFullscreen && (
        isFullscreen ? (
          <div className="fixed bottom-[calc(0.625rem+env(safe-area-inset-bottom,0px))] left-2 right-2 sm:left-auto sm:right-2.5 z-[95] max-w-[calc(100vw-1rem)] flex items-center gap-1 bg-slate-900/90 backdrop-blur-md text-white px-2 py-1 rounded-xl shadow-xl border border-white/15 select-none overflow-x-auto overscroll-contain custom-scrollbar-none">
            {/* 3-Horizontal-Lines Menu Button in Floating Bar */}
            <div className="relative inline-flex items-center shrink-0">
              <button
                type="button"
                data-dropdown-trigger="quick-menu"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setQuickMenuTriggerRect(rect);
                  setQuickMenuOrigin('floating');
                  setIsQuickMenuOpen(prev => !prev);
                }}
                className={cn(
                  "px-2.5 py-1.5 rounded-lg text-slate-200 hover:text-white hover:bg-white/15 transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 min-h-[32px]",
                  isQuickMenuOpen && quickMenuOrigin === 'floating' && "bg-white/20 text-white"
                )}
                title={L('メニュー（全機能の操作・設定）', 'Menu (All functions & settings)', 'Menu')}
              >
                <Menu size={15} className="shrink-0" />
                <span className="text-xs font-bold shrink-0">{L('メニュー', 'Menu', 'Menu')}</span>
              </button>
              {isFullscreen && isQuickMenuOpen && quickMenuOrigin === 'floating' && renderQuickMenuDropdown('floating')}
            </div>


            {timelineMode === 'calendar' && (
              <div className="flex items-center gap-0.5 pr-1 border-r border-white/20 shrink-0">
                <button
                  type="button"
                  onClick={() => handleNavigate('prev')}
                  className="p-1 hover:bg-white/15 rounded text-slate-200 hover:text-white transition-colors shrink-0"
                  title={L('前の週へ', 'Previous week', 'Semaine précédente')}
                >
                  <ChevronLeft size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => handleNavigate('today')}
                  className="px-1.5 py-0.5 text-[10px] font-bold text-indigo-300 hover:text-white hover:bg-white/15 rounded transition-colors shrink-0"
                >
                  {L('今日', 'Today', 'Auj.')}
                </button>
                <button
                  type="button"
                  onClick={() => handleNavigate('next')}
                  className="p-1 hover:bg-white/15 rounded text-slate-200 hover:text-white transition-colors shrink-0"
                  title={L('次の週へ', 'Next week', 'Semaine suivante')}
                >
                  <ChevronRight size={13} />
                </button>
              </div>
            )}

            {timelineMode === 'custom' && (
              <div className="relative inline-flex items-center shrink-0">
                <button
                  type="button"
                  data-dropdown-trigger="pattern"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setPatternMenuTriggerRect(rect);
                    setIsPatternMenuOpen(prev => !prev);
                  }}
                  className="px-2 py-1 rounded-lg text-[10px] font-bold bg-indigo-600/90 hover:bg-indigo-600 text-white flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                  title={L('Phaseパターン切り替え・管理', 'Switch & manage phase patterns', 'Gérer les modèles')}
                >
                  <Workflow size={11} className="shrink-0" />
                  <span className="max-w-[70px] sm:max-w-[100px] truncate">{activePattern.name}</span>
                  <ChevronDown size={10} className={cn("transition-transform duration-150 shrink-0", isPatternMenuOpen && "rotate-180")} />
                </button>

                <button
                  type="button"
                  onClick={handleAddColumn}
                  className="p-1 hover:bg-white/15 rounded text-slate-200 hover:text-white transition-colors cursor-pointer ml-0.5 shrink-0"
                  title={L(`「${activePattern.name}」にPhase列を追加`, `Add Phase column to "${activePattern.name}"`, `Ajouter une colonne`)}
                >
                  <Plus size={12} />
                </button>

                <button
                  type="button"
                  onClick={() => handleResetCustomColumns('names_only')}
                  className="p-1 hover:bg-white/15 rounded text-slate-200 hover:text-white transition-colors cursor-pointer shrink-0"
                  title={L(`「${activePattern.name}」のPhase列名をデフォルト（Phase 1, 2, 3...）に再設定`, `Reset Phase column names to default (Phase 1, 2, 3...)`, `Réinitialiser les phases`)}
                >
                  <RefreshCw size={11} />
                </button>

                {isFullscreen && isPatternMenuOpen && renderPatternMenuDropdown()}
              </div>
            )}

            {/* Time Filter Button in Fullscreen Toolbar */}
            <div className="relative inline-flex items-center shrink-0">
              <button
                type="button"
                data-dropdown-trigger="time-filter"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setTimeFilterTriggerRect(rect);
                  setIsTimeFilterOpen(prev => !prev);
                }}
                className={cn(
                  "px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 min-h-[32px]",
                  timeFilter.enabled
                    ? "bg-indigo-600 text-white shadow-2xs"
                    : "text-slate-300 hover:text-white hover:bg-white/15"
                )}
                title={L('Time filter（更新日時でタスクを絞り込み）', 'Time filter (Filter tasks by updated date)', 'Filtre temporel')}
              >
                <Clock size={13} className="shrink-0" />
                <span className="shrink-0 font-bold">{timeFilter.enabled ? getTimeFilterLabel(timeFilter) : 'Time filter'}</span>
                {timeFilter.enabled && (
                  <span className="text-[10px] bg-white/20 px-1 py-0.2 rounded font-mono font-bold shrink-0">
                    {activeTasks.length}/{allActiveTasks.length}
                  </span>
                )}
              </button>
              {isFullscreen && isTimeFilterOpen && renderTimeFilterDropdown()}
            </div>

            <button
              type="button"
              onClick={() => setShowUnscheduledColumn(prev => !prev)}
              className={cn(
                "px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 min-h-[32px]",
                showUnscheduledColumn
                  ? "bg-amber-600 text-white shadow-2xs"
                  : "text-slate-300 hover:text-white hover:bg-white/15"
              )}
              title={L('ToDoリスト列を表示/非表示', 'Toggle ToDo List column', 'Afficher/masquer la colonne Liste de tâches')}
            >
              <ListTodo size={13} className="shrink-0" />
              <span className="shrink-0">ToDo</span>
            </button>

            <button
              type="button"
              onClick={onToggleFullscreen}
              className="px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer shrink-0 min-h-[32px]"
              title={L('全画面を終了して通常表示に戻す', 'Exit Full View', 'Quitter la vue plein écran')}
            >
              <Minimize2 size={13} className="shrink-0" />
              <span className="shrink-0 hidden xs:inline">{L('全画面終了', 'Exit Full View', 'Quitter')}</span>
              <span className="shrink-0 xs:hidden">{L('終了', 'Exit', 'Quitter')}</span>
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onToggleFullscreen}
            className={cn(
              "lg:hidden fixed bottom-18 right-2.5 z-[65] flex items-center gap-1.5 bg-slate-900/85 hover:bg-indigo-600 backdrop-blur-md text-white px-3.5 py-2 rounded-xl shadow-lg border border-white/15 text-xs font-bold transition-all cursor-pointer select-none min-h-[36px]",
              (isQuickMenuOpen || isPatternMenuOpen || isTimeFilterOpen) && "hidden"
            )}
            title={L('タイムラインを全画面で表示 (Full view)', 'Fullscreen Timeline (Full view)', 'Chronologie plein écran')}
          >
            <Maximize2 size={15} />
            <span>{L('Full view', 'Full view', 'Plein écran')}</span>
          </button>
        )
      )}

      {/* Floating Circular Add Task Button (Bottom-Right of Timeline on PC & Mobile) */}
      {onOpenCreateTaskModal && (
        <button
          type="button"
          onClick={() => {
            const activeTaskObj = activeTaskId && !activeTaskId.startsWith('folder:')
              ? tasks.find(t => t.id === activeTaskId)
              : null;
            const folderFromActiveTab = activeTaskId?.startsWith('folder:')
              ? activeTaskId.slice(7)
              : '';
            const targetFolder =
              selectedFolderPath ||
              (selectedKey?.startsWith('folder:') ? selectedKey.slice(7) : '') ||
              folderFromActiveTab ||
              activeTaskObj?.project ||
              'General';
            onOpenCreateTaskModal(targetFolder);
          }}
          className={cn(
            "w-12 h-12 rounded-full bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white shadow-xl shadow-indigo-600/30 border border-indigo-400/30 flex items-center justify-center transition-all cursor-pointer select-none",
            isFullscreen
              ? "fixed bottom-[calc(3.85rem+env(safe-area-inset-bottom,0px))] right-3.5 z-[95]"
              : "fixed bottom-29 right-3.5 z-[66] lg:absolute lg:bottom-4 lg:right-4 lg:z-40",
            (isQuickMenuOpen || isPatternMenuOpen || isTimeFilterOpen) && (isFullscreen ? "hidden" : "max-lg:hidden")
          )}
          title={L('新規タスクを追加', 'Add New Task', 'Ajouter une nouvelle tâche')}
          aria-label={L('新規タスクを追加', 'Add New Task', 'Ajouter une nouvelle tâche')}
        >
          <Plus size={22} strokeWidth={2.5} />
        </button>
      )}

      {/* Folder Creation Modal */}
      {isCreateFolderOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4"
          onClick={() => {
            setIsCreateFolderOpen(false);
            setTargetParentFolder(null);
            setNewFolderName('');
          }}
        >
          <div 
            className="bg-white rounded-xl shadow-2xl border border-slate-200 p-5 w-full max-w-sm animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-3 text-slate-800">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <FolderPlus size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold">
                  {targetParentFolder 
                    ? L('サブフォルダを作成', 'New Subfolder', 'Nouveau sous-dossier') 
                    : L('新規プロジェクトフォルダ', 'New Project Folder', 'Nouveau dossier de projet')}
                </h3>
                {targetParentFolder && (
                  <p className="text-[11px] text-slate-500 font-mono truncate max-w-[220px]">
                    {targetParentFolder} /
                  </p>
                )}
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const name = newFolderName.trim();
                if (!name) return;
                const fullPath = targetParentFolder ? `${targetParentFolder}/${name}` : name;
                // Set folder metadata to Focus (reviving if it was in Trash) - called before saveCustomFolders so history snapshot captures prior state!
                onUpdateFolderMeta?.(fullPath, {
                  category: 'Focus',
                  createdAt: Date.now(),
                  updatedAt: Date.now()
                });

                // Auto revive parent and all its ancestors if any were in Trash
                const parts = fullPath.split('/').filter(Boolean);
                let cur = '';
                parts.forEach(p => {
                  cur = cur ? `${cur}/${p}` : p;
                  if (folderMetas?.[cur]?.category === 'Trash' || folderMetas?.[cur]?.category === 'Archive') {
                    onUpdateFolderMeta?.(cur, { category: 'Focus', updatedAt: Date.now() }, { skipHistory: true });
                  }
                });

                const nextCustom = customFolders.includes(fullPath)
                  ? customFolders
                  : [...customFolders, fullPath];
                saveCustomFolders(nextCustom);

                // Auto expand parent and all its ancestors if collapsed
                if (targetParentFolder) {
                  setCollapsedProjectPaths(prev => {
                    const next = new Set(prev);
                    const pParts = targetParentFolder.split('/');
                    let curP = '';
                    pParts.forEach(p => {
                      curP = curP ? `${curP}/${p}` : p;
                      next.delete(curP);
                    });
                    return next;
                  });
                }
                setSelectedFolderPath(fullPath);
                setSelectedKey(`folder:${fullPath}`);
                setIsCreateFolderOpen(false);
                setTargetParentFolder(null);
                setNewFolderName('');
              }}
            >
              <input
                autoFocus
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder={L("フォルダ名 (例: ProjectA, UI...)", "Folder name (e.g. ProjectA, UI...)", "Nom du dossier (ex: ProjetA, UI...)")}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white"
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Escape') {
                    setIsCreateFolderOpen(false);
                    setTargetParentFolder(null);
                    setNewFolderName('');
                  }
                }}
              />

              <div className="flex justify-end gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateFolderOpen(false);
                    setTargetParentFolder(null);
                    setNewFolderName('');
                  }}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg transition-colors font-medium"
                >
                  {L('キャンセル', 'Cancel', 'Annuler')}
                </button>
                <button
                  type="submit"
                  disabled={!newFolderName.trim()}
                  className="px-3.5 py-1.5 text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 rounded-lg shadow-xs transition-colors"
                >
                  {L('作成', 'Create', 'Créer')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3-dots Context Menu Popover for Folder & Task File in Timeline */}
      {activeMenu && (
        <div
          style={{
            top: `${Math.max(8, Math.min(activeMenu.y + 4, window.innerHeight - 250))}px`,
            left: `${Math.max(8, Math.min(activeMenu.x - 140, window.innerWidth - 185))}px`
          }}
          className="fixed z-50 bg-white border border-slate-200 rounded-lg shadow-xl py-1 min-w-[165px] text-xs font-medium text-slate-700 animate-in fade-in zoom-in-95 duration-100"
          onClick={(e) => e.stopPropagation()}
        >
          {activeMenu.type === 'folder' ? (
            (() => {
              const folderPath = activeMenu.idOrPath;
              const fMeta = folderMetas?.[folderPath];
              const parts = folderPath.split('/');
              const folderName = parts[parts.length - 1];
              return (
                <>
                  <button
                    type="button"
                    onClick={() => startRenaming('folder', folderPath, folderName)}
                    className="w-full px-3 py-1.5 text-left hover:bg-slate-100 flex items-center gap-2"
                  >
                    <Edit2 size={13} className="text-slate-400 shrink-0" />
                    <span>{L("名前を変更", "Rename", "Renommer")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (collapsedProjectPaths.has(folderPath)) {
                        toggleProjectCollapse(folderPath);
                      }
                      if (!showUnscheduledColumn) {
                        setShowUnscheduledColumn(true);
                      }
                      setQuickAddCell({
                        project: folderPath,
                        slotKey: 'backlog',
                        type: 'backlog'
                      });
                      setQuickAddTitle('');
                      setActiveMenu(null);
                    }}
                    className="w-full px-3 py-1.5 text-left hover:bg-slate-100 flex items-center gap-2"
                  >
                    <FilePlus size={13} className="text-indigo-600 shrink-0" />
                    <span>{L("新規タスク作成", "New Task", "Nouvelle tâche")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTargetParentFolder(folderPath);
                      setNewFolderName('');
                      setIsCreateFolderOpen(true);
                      setActiveMenu(null);
                    }}
                    className="w-full px-3 py-1.5 text-left hover:bg-slate-100 flex items-center gap-2"
                  >
                    <FolderPlus size={13} className="text-amber-500 shrink-0" />
                    <span>{L("サブフォルダ作成", "New Subfolder", "Nouveau sous-dossier")}</span>
                  </button>
                  <div className="h-px bg-slate-100 my-1" />
                  {onToggleFolderStar && (
                    <button
                      type="button"
                      onClick={() => {
                        onToggleFolderStar(folderPath);
                        setActiveMenu(null);
                      }}
                      className="w-full px-3 py-1.5 text-left hover:bg-slate-100 flex items-center gap-2"
                    >
                      <Star size={13} className={cn("shrink-0", fMeta?.isStarred ? "text-amber-400 fill-amber-400" : "text-slate-400")} />
                      <span>{fMeta?.isStarred ? L("スター解除", "Unstar", "Retirer des favoris") : L("スター", "Star", "Favori")}</span>
                    </button>
                  )}
                  {onToggleFolderPin && (
                    <button
                      type="button"
                      onClick={() => {
                        onToggleFolderPin(folderPath);
                        setActiveMenu(null);
                      }}
                      className="w-full px-3 py-1.5 text-left hover:bg-slate-100 flex items-center gap-2"
                    >
                      <Pin size={13} className={cn("shrink-0", fMeta?.isPinned ? "text-indigo-600 fill-indigo-600" : "text-slate-400")} />
                      <span>{fMeta?.isPinned ? L("ピン解除", "Unpin", "Désépingler") : L("ピン留め", "Pin", "Épingler")}</span>
                    </button>
                  )}
                  {onDuplicateFolder && (
                    <button
                      type="button"
                      onClick={() => {
                        onDuplicateFolder(folderPath);
                        setActiveMenu(null);
                      }}
                      className="w-full px-3 py-1.5 text-left hover:bg-slate-100 flex items-center gap-2"
                    >
                      <Copy size={13} className="text-slate-400 shrink-0" />
                      <span>{L("複製", "Duplicate", "Dupliquer")}</span>
                    </button>
                  )}
                  <div className="h-px bg-slate-100 my-1" />
                  <button
                    type="button"
                    onClick={() => handleDeleteFolderAction(folderPath)}
                    className="w-full px-3 py-1.5 text-left hover:bg-red-50 text-red-600 flex items-center gap-2"
                  >
                    <Trash2 size={13} className="shrink-0" />
                    <span>{L("削除", "Delete", "Supprimer")}</span>
                  </button>
                </>
              );
            })()
          ) : (
            (() => {
              const task = tasks.find(t => t.id === activeMenu.idOrPath);
              if (!task) return null;
              const isUrgent = task.category === 'Urgent';
              return (
                <>
                  <button
                    type="button"
                    onClick={() => startRenaming('task', task.id, task.title)}
                    className="w-full px-3 py-1.5 text-left hover:bg-slate-100 flex items-center gap-2"
                  >
                    <Edit2 size={13} className="text-slate-400 shrink-0" />
                    <span>{L("名前を変更", "Rename", "Renommer")}</span>
                  </button>
                  {onMoveTask && (
                    <button
                      type="button"
                      onClick={() => {
                        onMoveTask(task.id, isUrgent ? 'Focus' : 'Urgent');
                        setActiveMenu(null);
                      }}
                      className="w-full px-3 py-1.5 text-left hover:bg-slate-100 flex items-center gap-2"
                    >
                      <Zap size={13} className={cn("shrink-0", isUrgent ? "text-slate-400" : "text-red-500 fill-red-500")} />
                      <span>{isUrgent ? L("Focus解除", "Remove Focus", "Retirer du Focus") : L("Focusへ移動", "Move to Focus", "Déplacer vers Focus")}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      onToggleStar(task.id);
                      setActiveMenu(null);
                    }}
                    className="w-full px-3 py-1.5 text-left hover:bg-slate-100 flex items-center gap-2"
                  >
                    <Star size={13} className={cn("shrink-0", task.isStarred ? "text-amber-400 fill-amber-400" : "text-slate-400")} />
                    <span>{task.isStarred ? L("スター解除", "Unstar", "Retirer des favoris") : L("スター", "Star", "Favori")}</span>
                  </button>
                  {onTogglePin && (
                    <button
                      type="button"
                      onClick={() => {
                        onTogglePin(task.id);
                        setActiveMenu(null);
                      }}
                      className="w-full px-3 py-1.5 text-left hover:bg-slate-100 flex items-center gap-2"
                    >
                      <Pin size={13} className={cn("shrink-0", task.isPinned ? "text-indigo-600 fill-indigo-600" : "text-slate-400")} />
                      <span>{task.isPinned ? L("ピン解除", "Unpin", "Désépingler") : L("ピン留め", "Pin", "Épingler")}</span>
                    </button>
                  )}
                  {onDuplicateTask && (
                    <button
                      type="button"
                      onClick={() => {
                        onDuplicateTask(task);
                        setActiveMenu(null);
                      }}
                      className="w-full px-3 py-1.5 text-left hover:bg-slate-100 flex items-center gap-2"
                    >
                      <Copy size={13} className="text-slate-400 shrink-0" />
                      <span>{L("複製", "Duplicate", "Dupliquer")}</span>
                    </button>
                  )}
                  <div className="h-px bg-slate-100 my-1" />
                  <button
                    type="button"
                    onClick={() => handleDeleteTaskAction(task.id)}
                    className="w-full px-3 py-1.5 text-left hover:bg-red-50 text-red-600 flex items-center gap-2"
                  >
                    <Trash2 size={13} className="shrink-0" />
                    <span>{L("削除 (ゴミ箱へ)", "Delete", "Supprimer")}</span>
                  </button>
                </>
              );
            })()
          )}
        </div>
      )}

      {/* Create New Phase Pattern Modal */}
      {isCreatePatternModalOpen && (
        <div 
          className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setIsCreatePatternModalOpen(false)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
                  <Workflow size={20} />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-sm">
                    {L('新規Phaseパターンの作成', 'Create New Phase Pattern', 'Créer un nouveau modèle de phase')}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {L('独立した列構成とタスク配置を持つ新しいパターンを作成します', 'Create a new pattern with independent columns and task placements', 'Créer un modèle avec des colonnes et des tâches distinctes')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreatePatternModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Pattern Name Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                {L('パターンタイトル (名前)', 'Pattern Title (Name)', 'Titre du modèle (Nom)')}
              </label>
              <input
                autoFocus
                type="text"
                value={newPatternName}
                onChange={(e) => setNewPatternName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (newPatternName.trim()) {
                      handleCreatePattern(newPatternName, newPatternCopyCols, newPatternCopyTasks);
                    }
                  }
                  if (e.key === 'Escape') setIsCreatePatternModalOpen(false);
                }}
                placeholder={L('例: 開発パイプライン, 採用プロセス, イベント企画', 'e.g. Development Pipeline, Hiring Process', 'ex. Pipeline de développement')}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 font-medium text-slate-800"
              />
            </div>

            {/* Column Options */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                {L('列の構成 (Columns)', 'Column Structure', 'Structure des colonnes')}
              </label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setNewPatternCopyCols(true)}
                  className={cn(
                    "p-2.5 rounded-xl border text-left transition-all cursor-pointer",
                    newPatternCopyCols
                      ? "border-indigo-500 bg-indigo-50/70 text-indigo-900 font-bold ring-1 ring-indigo-500"
                      : "border-slate-200 hover:bg-slate-50 text-slate-600"
                  )}
                >
                  <div className="text-[11px] font-bold">{L('現在の列構成を引き継ぐ', 'Copy Current Columns', 'Copier colonnes actuelles')}</div>
                  <div className="text-[10px] text-slate-400 font-normal truncate mt-0.5">
                    {activePattern.name} ({activePattern.columns.length}{L('列', 'cols', 'cols')})
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setNewPatternCopyCols(false)}
                  className={cn(
                    "p-2.5 rounded-xl border text-left transition-all cursor-pointer",
                    !newPatternCopyCols
                      ? "border-indigo-500 bg-indigo-50/70 text-indigo-900 font-bold ring-1 ring-indigo-500"
                      : "border-slate-200 hover:bg-slate-50 text-slate-600"
                  )}
                >
                  <div className="text-[11px] font-bold">{L('初期値（Phase 1〜5）', 'Default (Phase 1-5)', 'Par défaut (Phase 1-5)')}</div>
                  <div className="text-[10px] text-slate-400 font-normal mt-0.5">
                    {L('Phase 1〜Phase 5 の5列', '5 default phase columns', '5 colonnes de phases par défaut')}
                  </div>
                </button>
              </div>
            </div>

            {/* Task Placement Options */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={newPatternCopyTasks}
                  onChange={(e) => setNewPatternCopyTasks(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                />
                <span className="text-xs font-bold text-slate-700">
                  {L('現在のパターンのタスク配置も引き継ぐ', 'Copy current task assignments to this pattern', 'Copier les assignations de tâches vers ce modèle')}
                </span>
              </label>
              <p className="text-[10px] text-slate-500 pl-6 leading-relaxed">
                {newPatternCopyTasks 
                  ? L('現在配置されているタスクの列・ステップをそのまま新しいパターンにもコピーします', 'Copies current column placements so you can tweak them without starting over', 'Copie les positions actuelles pour vous permettre de les ajuster')
                  : L('チェックを外すと、タスクはすべて未配置（ToDoリスト）からスタートし、まっさらな状態で配置できます', 'Starts with all tasks unscheduled in ToDo list for a clean slate', 'Démarre avec toutes les tâches non planifiées')
                }
              </p>
            </div>

            {/* Dialog Footer Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsCreatePatternModalOpen(false)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                {L('キャンセル', 'Cancel', 'Annuler')}
              </button>
              <button
                type="button"
                disabled={!newPatternName.trim()}
                onClick={() => {
                  if (newPatternName.trim()) {
                    handleCreatePattern(newPatternName, newPatternCopyCols, newPatternCopyTasks);
                  }
                }}
                className={cn(
                  "px-4 py-1.5 text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer",
                  newPatternName.trim()
                    ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                    : "bg-slate-200 text-slate-400 cursor-not-allowed"
                )}
              >
                {L('パターンを作成', 'Create Pattern', 'Créer le modèle')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Helper to render a compact, draggable & reorderable task chip
  function renderTaskChip(task: Task) {
    const isSelected = activeTaskId === task.id;
    const isUrgent = task.category === 'Urgent';
    const isDragTarget = dragOverTask?.taskId === task.id;
    const deadlineAlert = getTaskDeadlineAlert(task.deadline, task.isDone, language, task.isAllDay);

    return (
      <div
        key={task.id}
        id={`timeline-task-${task.id}`}
        tabIndex={0}
        draggable={true}
        onDragStart={(e) => handleTaskDragStart(e, task)}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const rect = e.currentTarget.getBoundingClientRect();
          const midY = rect.top + rect.height / 2;
          const pos = e.clientY < midY ? 'before' : 'after';
          setDragOverTask({ taskId: task.id, position: pos });
        }}
        onDragLeave={() => {
          if (dragOverTask?.taskId === task.id) setDragOverTask(null);
        }}
        onDrop={(e) => {
          const pos = dragOverTask?.position || 'after';
          handleTaskDropOnTask(e, task, pos);
        }}
        onFocus={() => {
          (window as any).__navforActivePane = 'timeline';
        }}
        onClick={(e) => {
          e.stopPropagation();
          (window as any).__navforActivePane = 'timeline';
          setSelectedKey(`task:${task.id}`);
          setSelectedFolderPath(null);
          onSelectTask(task.id, false);
          e.currentTarget.focus();
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          (window as any).__navforActivePane = 'timeline';
          setSelectedKey(`task:${task.id}`);
          setSelectedFolderPath(null);
          onSelectTask(task.id, true);
        }}
        className={cn(
          "group/chip relative flex items-center gap-1.5 px-2.5 py-1.5 sm:px-2 sm:py-1 rounded-lg sm:rounded-md text-xs sm:text-xs min-h-[34px] sm:min-h-[28px] cursor-grab active:cursor-grabbing transition-all shadow-2xs border select-none outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
          isSelected 
            ? (task.isDone
                ? "bg-slate-800 text-slate-200 border-slate-700 shadow-xs ring-2 ring-indigo-400/60"
                : "bg-indigo-600 text-white border-indigo-700 shadow-xs font-semibold ring-2 ring-indigo-400/40")
            : (isUrgent 
                ? "bg-red-50 text-red-950 border-red-200 hover:bg-red-100 hover:border-red-300"
                : "bg-white text-slate-800 border-slate-200/90 hover:bg-slate-50 hover:border-slate-300"),
          task.isDone && !isSelected && "opacity-60 bg-slate-100 text-slate-400 border-slate-200",
          isDragTarget && dragOverTask?.position === 'before' && "border-t-2 border-t-indigo-600 shadow-md",
          isDragTarget && dragOverTask?.position === 'after' && "border-b-2 border-b-indigo-600 shadow-md"
        )}
      >
        {/* Checkbox - iPhone Reminders style spacious touch target & clear circle */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleDone(task.id);
          }}
          className={cn(
            "shrink-0 w-6 h-6 -ml-0.5 sm:-ml-0.5 flex items-center justify-center rounded-full transition-transform active:scale-90 cursor-pointer touch-manipulation",
            isSelected ? (task.isDone ? "text-emerald-400" : "text-white/85 hover:text-white") : "text-slate-400 hover:text-indigo-600"
          )}
          title={task.isDone ? L("未完了に戻す", "Mark undone", "Marquer non terminé") : L("完了にする", "Mark done", "Marquer terminé")}
        >
          {task.isDone ? (
            <CheckCircle2 size={16} className="text-emerald-500 shrink-0" strokeWidth={2.2} />
          ) : (
            <Circle size={16} className={isUrgent ? "text-red-500" : (isSelected && !task.isDone ? "text-white/75" : "text-slate-300 hover:text-slate-400")} strokeWidth={1.8} />
          )}
        </button>

        {/* Priority Dot */}
        {isUrgent && !task.isDone && (
          <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" title="Focus" />
        )}

        {/* Task Title or Inline Rename Input */}
        {renamingItem?.type === 'task' && renamingItem.idOrPath === task.id ? (
          <form 
            onSubmit={handleRenameSubmit} 
            onClick={(e) => e.stopPropagation()} 
            className="flex-1 min-w-0 my-[-2px]"
          >
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
              className="w-full bg-white text-slate-900 border border-indigo-400 rounded px-1.5 py-0.5 text-xs sm:text-[11px] leading-snug outline-none shadow-xs font-sans font-normal focus:ring-1 focus:ring-indigo-400"
            />
          </form>
        ) : (
          <span 
            onDoubleClick={(e) => {
              e.stopPropagation();
              startRenaming('task', task.id, task.title);
            }}
            className={cn(
              "truncate flex-1 text-xs sm:text-[11.5px] font-medium leading-snug cursor-text tracking-normal",
              task.isDone && "line-through opacity-75"
            )}
            title={L(`${task.title} (選択してEnterまたはダブルクリックで名前変更)`, `${task.title} (Select & Enter or double-click to rename)`, `${task.title} (Entrée ou double-clic pour renommer)`)}
          >
            {task.title}
          </span>
        )}

        {/* Approaching Deadline Highlight (Yellow clock mark, Red if overdue) */}
        {!task.isDone && deadlineAlert && (
          <span
            className="shrink-0 inline-flex items-center justify-center ml-0.5"
            title={deadlineAlert.tooltip}
          >
            <Clock 
              size={13} 
              className={cn(
                "shrink-0",
                isSelected
                  ? (deadlineAlert.isOverdue ? "text-red-300" : "text-amber-300")
                  : (deadlineAlert.isOverdue ? "text-red-500" : "text-amber-500")
              )} 
            />
          </span>
        )}

        {/* Recurrence icon badge */}
        {task.recurrence && task.recurrence.type !== 'none' && (
          <span
            className="shrink-0 inline-flex items-center justify-center ml-0.5"
            title={L(
              `繰り返し (${task.recurrence.type === 'daily' ? '毎日' : task.recurrence.type === 'every_x_days' ? `${task.recurrence.interval || 1}日ごと` : task.recurrence.type === 'weekly' ? '毎週' : `${task.recurrence.interval || 1}週ごと`})`,
              `Repeats: ${task.recurrence.type}`,
              `Répétition : ${task.recurrence.type === 'daily' ? 'Quotidien' : task.recurrence.type === 'every_x_days' ? `Tous les ${task.recurrence.interval || 1} j` : task.recurrence.type === 'weekly' ? 'Hebdo' : `Toutes les ${task.recurrence.interval || 1} sem`}`
            )}
          >
            <Repeat
              size={13}
              className={cn(
                "shrink-0",
                isSelected && !task.isDone ? "text-indigo-200" : "text-indigo-600"
              )}
            />
          </span>
        )}

        {/* Star */}
        {task.isStarred && (
          <Star size={13} fill="currentColor" className={isSelected && !task.isDone ? "text-amber-300 shrink-0" : "text-amber-400 shrink-0"} />
        )}

        {/* Pin */}
        {task.isPinned && (
          <Pin size={13} fill="currentColor" className={isSelected && !task.isDone ? "text-indigo-200 shrink-0" : "text-indigo-500 shrink-0"} />
        )}

        {/* 3-dots Menu Button right of task file name */}
        {!(renamingItem?.type === 'task' && renamingItem.idOrPath === task.id) && (
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
            className={cn(
              "w-6 h-6 flex items-center justify-center rounded-md p-0.5 transition-opacity shrink-0 ml-auto cursor-pointer touch-manipulation",
              isSelected && !task.isDone
                ? "text-white/85 hover:text-white hover:bg-white/20 active:bg-white/30"
                : "text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 active:bg-slate-200",
              (activeMenu?.type === 'task' && activeMenu.idOrPath === task.id) || isSelected
                ? "opacity-100"
                : "opacity-70 group-hover/chip:opacity-100"
            )}
            title={L("タスクオプション", "Task options", "Options de la tâche")}
          >
            <MoreHorizontal size={14} />
          </button>
        )}
      </div>
    );
  }
};
