import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import {
  Database,
  LayoutGrid,
  Settings,
  Zap,
  Moon,
  Sun,
  Monitor,
  Activity,
  ArrowRight,
  Info,
  Terminal,
  ChevronRight,
} from 'lucide-react';
import { Dashboard } from './pages/Dashboard';
import { SchemaExplorer } from './pages/SchemaExplorer';
import { HeatmapView } from './pages/HeatmapView';
import { QueryPlayground } from './pages/QueryPlayground';
import { Toaster } from './components/ui/toaster';
import { useAppStore } from './stores/useAppStore';
import { cn } from './lib/utils';
import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from './components/ui/dialog';
import { Label } from './components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './components/ui/select';
import { Button } from './components/ui/button';

function Breadcrumbs() {
  const location = useLocation();
  const pathMap: Record<string, string> = {
    '/': 'Connect',
    '/schema': 'Schema Explorer',
    '/heatmap': 'Heatmap',
    '/playground': 'Query Playground',
  };
  const currentPage = pathMap[location.pathname] || 'Unknown';

  return (
    <div className="flex items-center gap-1.5 text-sm text-zinc-500 px-6 pt-4 pb-2 shrink-0">
      <span className="text-zinc-400">Data Density</span>
      <ChevronRight className="w-3.5 h-3.5 text-zinc-300 dark:text-zinc-700" />
      <span className="font-medium text-zinc-700 dark:text-zinc-300">{currentPage}</span>
    </div>
  );
}

function Navigation() {
  const location = useLocation();
  const store = useAppStore();
  const status = store.status;
  const isConnected = status === 'connected' || status === 'fetching';
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);

  const navItems = [
    { path: '/', label: 'Connect', icon: Zap },
    { path: '/schema', label: 'Schema', icon: Database, disabled: !isConnected },
    { path: '/heatmap', label: 'Heatmap', icon: LayoutGrid, disabled: !isConnected },
    { path: '/playground', label: 'Playground', icon: Terminal, disabled: !isConnected },
  ];

  return (
    <nav className="flex flex-col gap-1.5 p-4 w-60 border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 h-screen sticky top-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-2 py-3 mb-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-indigo-500/20">
          D
        </div>
        <div>
          <span className="font-bold text-base tracking-tight block leading-none">
            Data Density
          </span>
          <span className="text-[10px] text-zinc-400 font-medium">GraphQL Inspector</span>
        </div>
      </div>

      {/* Connection Status */}
      {isConnected && (
        <div className="mx-2 mb-2 px-2.5 py-1.5 rounded-md bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/30 flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[10px] text-green-700 dark:text-green-400 font-medium truncate">
            {store.endpoint ? new URL(store.endpoint).hostname : 'Disconnected'}
          </span>
          {store.connectionHealth && (
            <span className="text-[9px] text-green-600 dark:text-green-500 ml-auto font-mono">
              {store.connectionHealth.latencyMs}ms
            </span>
          )}
        </div>
      )}

      {/* Nav Items */}
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.path;

        if (item.disabled) {
          return (
            <div
              key={item.path}
              className="flex items-center gap-2.5 px-3 py-2 rounded-md text-zinc-400 dark:text-zinc-600 cursor-not-allowed text-sm"
            >
              <Icon size={16} />
              <span className="font-medium">{item.label}</span>
            </div>
          );
        }

        return (
          <Link
            key={item.path}
            to={item.path}
            className={cn(
              'flex items-center gap-2.5 px-3 py-2 rounded-md transition-all text-sm',
              isActive
                ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-semibold shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-50'
            )}
          >
            <Icon size={16} />
            <span className="font-medium">{item.label}</span>
          </Link>
        );
      })}

      {/* Bottom Actions */}
      <div className="mt-auto flex flex-col gap-1">
        <Dialog open={isAboutOpen} onOpenChange={setIsAboutOpen}>
          <DialogTrigger asChild>
            <button className="flex items-center gap-2.5 px-3 py-2 rounded-md transition-colors text-zinc-500 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 hover:text-zinc-700 dark:hover:text-zinc-300 w-full text-sm">
              <Info size={16} />
              <span className="font-medium">About</span>
            </button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[550px]">
            <DialogHeader>
              <DialogTitle>Data Density — GraphQL Inspection Suite</DialogTitle>
              <DialogDescription>
                Professional data quality analysis for GraphQL APIs
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4 text-sm text-zinc-700 dark:text-zinc-300">
              <p>
                A web-based visualization tool that represents the completeness and distribution of
                data across an entire GraphQL dataset.
              </p>
              <ul className="list-disc pl-5 space-y-1 text-xs">
                <li>
                  Deep schema introspection (objects, enums, interfaces, unions, inputs, directives)
                </li>
                <li>Interactive D3.js heatmap with zoom, pan, and drill-down</li>
                <li>Null pattern analysis and anomaly detection</li>
                <li>Live query playground with auto-generation and history</li>
                <li>Side-by-side endpoint comparison</li>
                <li>Export to CSV, PNG, PDF, SVG</li>
                <li>Import/Export workspace configuration</li>
              </ul>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
          <DialogTrigger asChild>
            <button className="flex items-center gap-2.5 px-3 py-2 rounded-md transition-colors text-zinc-500 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 hover:text-zinc-700 dark:hover:text-zinc-300 w-full text-sm">
              <Settings size={16} />
              <span className="font-medium">Settings</span>
            </button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Settings</DialogTitle>
              <DialogDescription>Manage your application preferences.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Theme</Label>
                <Select
                  value={store.theme}
                  onValueChange={(v: 'light' | 'dark' | 'system') => store.setTheme(v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select theme" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">
                      <div className="flex items-center gap-2">
                        <Sun className="w-4 h-4" /> Light
                      </div>
                    </SelectItem>
                    <SelectItem value="dark">
                      <div className="flex items-center gap-2">
                        <Moon className="w-4 h-4" /> Dark
                      </div>
                    </SelectItem>
                    <SelectItem value="system">
                      <div className="flex items-center gap-2">
                        <Monitor className="w-4 h-4" /> System
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Default Sample Size</Label>
                <Select
                  value={store.sampleSize.toString()}
                  onValueChange={(v: string) => store.setSampleSize(parseInt(v, 10))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select sample size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="50">50 items</SelectItem>
                    <SelectItem value="100">100 items</SelectItem>
                    <SelectItem value="200">200 items</SelectItem>
                    <SelectItem value="500">500 items</SelectItem>
                    <SelectItem value="1000">1000 items</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-zinc-500">
                  Records to fetch per type for density calculation.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Auto-Refresh Interval</Label>
                <Select
                  value={store.refreshInterval.toString()}
                  onValueChange={(v: string) => store.setRefreshInterval(parseInt(v, 10))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select interval" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">Every 10 seconds</SelectItem>
                    <SelectItem value="30">Every 30 seconds</SelectItem>
                    <SelectItem value="60">Every 1 minute</SelectItem>
                    <SelectItem value="300">Every 5 minutes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Heatmap Colors</Label>
                <div className="flex items-center gap-4">
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs text-zinc-500">Low (0%)</Label>
                    <input
                      type="color"
                      value={store.heatmapColors.low}
                      onChange={(e) =>
                        store.setHeatmapColors({ ...store.heatmapColors, low: e.target.value })
                      }
                      className="w-8 h-8 rounded cursor-pointer border-0 p-0"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs text-zinc-500">Medium (50%)</Label>
                    <input
                      type="color"
                      value={store.heatmapColors.medium}
                      onChange={(e) =>
                        store.setHeatmapColors({ ...store.heatmapColors, medium: e.target.value })
                      }
                      className="w-8 h-8 rounded cursor-pointer border-0 p-0"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs text-zinc-500">High (100%)</Label>
                    <input
                      type="color"
                      value={store.heatmapColors.high}
                      onChange={(e) =>
                        store.setHeatmapColors({ ...store.heatmapColors, high: e.target.value })
                      }
                      className="w-8 h-8 rounded cursor-pointer border-0 p-0"
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-2 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => {
                    store.reset();
                    setIsSettingsOpen(false);
                    window.location.href = '/';
                  }}
                >
                  Clear Workspace
                </Button>
                <p className="text-xs text-zinc-500 text-center">
                  This will remove all fetched data and reset the app state.
                </p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </nav>
  );
}

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useAppStore((state) => state.theme);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
  }, [theme]);

  return <>{children}</>;
}

function Onboarding() {
  const store = useAppStore();
  const [step, setStep] = useState(1);

  if (store.hasSeenOnboarding) return null;

  return (
    <Dialog
      open={!store.hasSeenOnboarding}
      onOpenChange={(open) => {
        if (!open) store.setHasSeenOnboarding(true);
      }}
    >
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Welcome to Data Density</DialogTitle>
          <DialogDescription>
            Your professional GraphQL data inspection suite. Let's get started.
          </DialogDescription>
        </DialogHeader>

        <div className="py-6">
          {step === 1 && (
            <div className="space-y-4 animate-fade-in-up">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 mb-4">
                <Database className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold">1. Connect to Endpoint</h3>
              <p className="text-zinc-500">
                Enter your GraphQL endpoint URL and headers. We'll deep-introspect the schema —
                fetching all types, enums, interfaces, unions, and directives.
              </p>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-4 animate-fade-in-up">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400 mb-4">
                <Activity className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold">2. Explore & Analyze</h3>
              <p className="text-zinc-500">
                Browse fields with type badges, expand type details, and select which types to
                analyze. Then calculate density to see data completeness at a glance.
              </p>
            </div>
          )}
          {step === 3 && (
            <div className="space-y-4 animate-fade-in-up">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 mb-4">
                <LayoutGrid className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold">3. Inspect & Visualize</h3>
              <p className="text-zinc-500">
                Explore the interactive heatmap. Click any cell to drill into sample data,
                distributions, null pattern analysis, and raw JSON. Export as CSV, PNG, PDF, or SVG.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <div className="flex gap-1">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={cn(
                  'w-2 h-2 rounded-full transition-colors',
                  s === step ? 'bg-indigo-600' : 'bg-zinc-200 dark:bg-zinc-800'
                )}
              />
            ))}
          </div>
          <div className="flex gap-2">
            {step < 3 ? (
              <Button
                onClick={() => setStep(step + 1)}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                Next <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={() => store.setHasSeenOnboarding(true)}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                Get Started
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <Router>
        <div className="flex h-screen bg-white dark:bg-zinc-950 text-zinc-950 dark:text-zinc-50 overflow-hidden">
          <Navigation />
          <main className="flex-1 overflow-auto flex flex-col">
            <Breadcrumbs />
            <div className="flex-1 min-h-0">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/schema" element={<SchemaExplorer />} />
                <Route path="/heatmap" element={<HeatmapView />} />
                <Route path="/playground" element={<QueryPlayground />} />
              </Routes>
            </div>
          </main>
          <Toaster />
          <Onboarding />
        </div>
      </Router>
    </ThemeProvider>
  );
}
