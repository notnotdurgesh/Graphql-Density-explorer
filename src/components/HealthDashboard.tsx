import React, { useMemo } from 'react';
import { Card, CardContent } from './ui/card';
import {
  Zap,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Info,
  Hash,
  Layers,
  Database,
} from 'lucide-react';
import { motion } from 'framer-motion';

interface HealthDashboardProps {
  overallScore: number;
  stats: {
    totalRecords: number;
    totalFields: number;
    typeCount: number;
    fullFields: number;
    emptyFields: number;
    anomalyCount: number;
  };
}

export function HealthDashboard({ overallScore, stats }: HealthDashboardProps) {
  const healthStatus = useMemo(() => {
    if (stats.totalRecords === 0) return { label: 'Pending', color: 'text-zinc-400', icon: Info };
    if (overallScore >= 90)
      return { label: 'Excellent', color: 'text-green-500', icon: CheckCircle2 };
    if (overallScore >= 70) return { label: 'Good', color: 'text-blue-500', icon: Zap };
    if (overallScore >= 40) return { label: 'Average', color: 'text-yellow-500', icon: Info };
    return { label: 'Action!', color: 'text-red-500', icon: AlertCircle };
  }, [overallScore, stats.totalRecords]);

  const insights = useMemo(() => {
    const list = [];
    if (stats.emptyFields > 0) {
      list.push({
        label: `${stats.emptyFields} Redundant`,
        icon: AlertCircle,
        color: 'text-red-500',
      });
    }
    if (overallScore < 80) {
      list.push({ label: 'Data Gaps', icon: TrendingDown, color: 'text-yellow-500' });
    }
    if (stats.fullFields / stats.totalFields > 0.5) {
      list.push({ label: 'Stable', icon: TrendingUp, color: 'text-green-500' });
    }
    return list;
  }, [stats, overallScore]);

  const StatusIcon = healthStatus.icon;

  return (
    <Card className="overflow-hidden border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 mb-6">
      <CardContent className="p-3 flex flex-wrap items-center justify-between gap-6">
        {/* Compact Health Gauge */}
        <div className="flex items-center gap-4 border-r border-zinc-200 dark:border-zinc-800 pr-6">
          <div className="relative w-12 h-12">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="24"
                cy="24"
                r="20"
                fill="transparent"
                stroke="currentColor"
                strokeWidth="4"
                className="text-zinc-200 dark:text-zinc-800"
              />
              <motion.circle
                initial={{ strokeDashoffset: 125.66 }}
                animate={{ strokeDashoffset: 125.66 - (125.66 * overallScore) / 100 }}
                transition={{ duration: 1.5, ease: 'easeOut' }}
                cx="24"
                cy="24"
                r="20"
                fill="transparent"
                stroke="currentColor"
                strokeWidth="4"
                strokeDasharray="125.66"
                className={healthStatus.color}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-xs font-bold">
              {overallScore.toFixed(0)}%
            </div>
          </div>
          <div>
            <div className={`text-[10px] font-bold uppercase tracking-wider ${healthStatus.color}`}>
              {healthStatus.label}
            </div>
            <div className="text-[10px] text-zinc-500 flex items-center gap-1">
              <StatusIcon className="w-3 h-3" /> Schema Health
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="flex items-center gap-8 flex-1">
          <div className="flex flex-col">
            <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">
              Records
            </span>
            <div className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-zinc-400" />
              <span className="text-sm font-bold">{stats.totalRecords.toLocaleString()}</span>
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">
              Fields
            </span>
            <div className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-zinc-400" />
              <span className="text-sm font-bold">{stats.totalFields}</span>
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">
              Types
            </span>
            <div className="flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5 text-zinc-400" />
              <span className="text-sm font-bold">{stats.typeCount}</span>
            </div>
          </div>
        </div>

        {/* Insights Pills */}
        <div className="flex items-center gap-2">
          {insights.map((insight, idx) => (
            <div
              key={idx}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-full bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 shadow-sm text-[10px] font-medium ${insight.color}`}
            >
              <insight.icon className="w-3 h-3" />
              {insight.label}
            </div>
          ))}
          {insights.length === 0 && (
            <div className="text-[10px] text-green-600 font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Schema Optimal
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
