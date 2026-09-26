import React, { useState } from 'react';
import { 
  Zap, 
  CheckCircle2, 
  Circle, 
  Star, 
  ChevronDown, 
  ChevronUp, 
  Clock, 
  AlertCircle, 
  AlertTriangle,
  ExternalLink,
  ArrowDown
} from 'lucide-react';
import { Task, Category } from '../types';
import { cn, tr } from '../lib/utils';
import { format } from 'date-fns';

interface FocusHeaderSectionProps {
  urgentTasks: Task[];
  urgentLimit: number;
  onSelectTask: (taskId: string) => void;
  onToggleDone: (taskId: string) => void;
  onToggleStar: (taskId: string) => void;
  onMoveTask: (taskId: string, category: Category) => void;
  onOpenDailyPick: () => void;
  activeTaskId: string | null;
  deadlineThresholdDays?: number;
  language?: string;
  t: (key: string) => string;
}

export const FocusHeaderSection: React.FC<FocusHeaderSectionProps> = ({
  urgentTasks,
  urgentLimit,
  onSelectTask,
  onToggleDone,
  onToggleStar,
  onMoveTask,
  onOpenDailyPick,
  activeTaskId,
  deadlineThresholdDays = 3,
  language = 'en',
  t
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const now = Date.now();
  const L = (ja: string, en: string, fr: string) => tr(language, ja, en, fr);

  const activeUrgentTasks = urgentTasks.filter(t => !t.isDone);
  const doneUrgentTasks = urgentTasks.filter(t => t.isDone);
  const sortedUrgent = [...activeUrgentTasks, ...doneUrgentTasks];

  return (
    <div className="bg-white border border-red-100 rounded-xl overflow-hidden shadow-xs shrink-0 transition-all">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-red-50/80 to-amber-50/40 border-b border-red-100/80 select-none">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-lg bg-red-500 text-white flex items-center justify-center shadow-xs">
            <Zap size={13} fill="currentColor" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-red-800">
                {L('Focus スロット', 'Focus Slots', 'Slots Focus')}
              </h3>
              <span className={cn(
                "text-[10px] font-mono font-bold px-1.5 py-0.2 rounded border",
                activeUrgentTasks.length >= urgentLimit
                  ? "bg-red-500 text-white border-red-600"
                  : "bg-white text-red-600 border-red-200"
              )}>
                {activeUrgentTasks.length} / {urgentLimit} Slots
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenDailyPick}
            className="text-[11px] font-bold text-red-700 hover:text-red-900 bg-white/80 hover:bg-white border border-red-200/80 px-2.5 py-1 rounded-lg transition-all shadow-xs flex items-center gap-1.5"
            title={L('ToDoから今日の最優先タスクを抽出', 'Extract top priority tasks from ToDo', 'Extraire les tâches prioritaires depuis ToDo')}
          >
            <Zap size={12} className="text-amber-500" />
            <span>{t('DailyChoice')}</span>
          </button>

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors"
            title={isCollapsed ? L('展開', 'Expand', 'Développer') : L('折りたたむ', 'Collapse', 'Réduire')}
          >
            {isCollapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
          </button>
        </div>
      </div>

      {/* Focus Task Cards Grid */}
      {!isCollapsed && (
        <div className="p-3 bg-red-50/20">
          {sortedUrgent.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {sortedUrgent.map(task => {
                const isActive = task.id === activeTaskId;

                // Deadline
                let deadlineBadge = null;
                if (task.deadline && !task.isDone) {
                  const diff = task.deadline - now;
                  if (diff < 0) {
                    deadlineBadge = <span className="text-[9px] bg-red-100 text-red-700 px-1 py-0.2 rounded border border-red-200 font-mono font-bold">{L('期限切', 'Overdue', 'Expiré')}</span>;
                  } else if (diff <= deadlineThresholdDays * 86400000) {
                    const days = Math.ceil(diff / 86400000);
                    deadlineBadge = <span className="text-[9px] bg-amber-100 text-amber-800 px-1 py-0.2 rounded border border-amber-200 font-mono font-bold">{days <= 0 ? L('本日', 'Today', "Auj.") : L(`${days}日後`, `In ${days}d`, `Dans ${days}j`)}</span>;
                  }
                }

                return (
                  <div
                    key={task.id}
                    onClick={() => onSelectTask(task.id)}
                    className={cn(
                      "group relative flex items-start gap-2.5 p-2.5 rounded-xl border bg-white transition-all cursor-pointer shadow-xs hover:border-red-300 hover:shadow-sm",
                      isActive ? "border-red-500 ring-2 ring-red-500/20" : "border-slate-200/80",
                      task.isDone && "opacity-50 grayscale"
                    )}
                  >
                    {/* Done Checkbox */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleDone(task.id);
                      }}
                      className="mt-0.5 text-slate-300 hover:text-emerald-500 transition-colors shrink-0"
                    >
                      {task.isDone ? (
                        <CheckCircle2 size={16} className="text-emerald-500" />
                      ) : (
                        <Circle size={16} className="hover:text-red-500 text-red-300" />
                      )}
                    </button>

                    {/* Task Info */}
                    <div className="flex-1 min-w-0 pr-1">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[9px] font-bold text-red-600 bg-red-50 px-1.5 py-0.2 rounded border border-red-100 truncate max-w-[120px]">
                          {task.project || 'General'}
                        </span>
                        {deadlineBadge}
                      </div>
                      <h4 className={cn(
                        "text-xs font-bold text-slate-800 leading-snug line-clamp-2",
                        task.isDone && "line-through text-slate-400"
                      )}>
                        {task.title}
                      </h4>
                    </div>

                    {/* Actions on hover */}
                    <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => onToggleStar(task.id)}
                        className={cn(
                          "p-1 rounded transition-colors",
                          task.isStarred ? "text-amber-400" : "text-slate-300 opacity-0 group-hover:opacity-100 hover:text-amber-400"
                        )}
                        title={L('重要', 'Star', 'Favori')}
                      >
                        <Star size={12} fill={task.isStarred ? "currentColor" : "none"} />
                      </button>
                      <button
                        onClick={() => onMoveTask(task.id, 'Focus')}
                        className="p-1 rounded text-slate-300 opacity-0 group-hover:opacity-100 hover:text-indigo-600 hover:bg-slate-100 transition-all"
                        title={L('ToDoに戻す', 'Return to ToDo', 'Remettre dans ToDo')}
                      >
                        <ArrowDown size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-4 px-3 flex items-center justify-between bg-white rounded-lg border border-dashed border-red-200 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <Zap size={14} className="text-amber-400" />
                <span>{L(`現在Focusスロットに設定されたタスクはありません（最大 ${urgentLimit} 件）`, `No tasks currently in Focus slots (Max ${urgentLimit})`, `Aucune tâche dans les slots Focus (Max ${urgentLimit})`)}</span>
              </div>
              <button
                onClick={onOpenDailyPick}
                className="text-[11px] font-bold text-indigo-600 hover:underline shrink-0"
              >
                {L('ToDoから抽出 →', 'Extract from ToDo →', 'Extraire de ToDo →')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
