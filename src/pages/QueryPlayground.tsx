import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore, QueryHistoryItem } from '../stores/useAppStore';
import { executeQuery, generateQueryForType } from '../services/graphql';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { useToast } from '../components/ui/use-toast';
import {
  Play,
  Loader2,
  Clock,
  Copy,
  Wand2,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Terminal,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';

export function QueryPlayground() {
  const navigate = useNavigate();
  const store = useAppStore();
  const { toast } = useToast();

  const [query, setQuery] = useState('{\n  __schema {\n    queryType {\n      name\n    }\n  }\n}');
  const [variables, setVariables] = useState('{}');
  const [result, setResult] = useState<string>('');
  const [errors, setErrors] = useState<Record<string, unknown>[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [lastDuration, setLastDuration] = useState<number | null>(null);
  const [showVariables, setShowVariables] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const queryRef = useRef<HTMLTextAreaElement>(null);

  const handleExecute = useCallback(async () => {
    if (!query.trim()) {
      toast({
        title: 'Empty Query',
        description: 'Please enter a GraphQL query.',
        variant: 'destructive',
      });
      return;
    }

    if (!store.endpoint) {
      toast({
        title: 'No Endpoint',
        description: 'Connect to an endpoint first.',
        variant: 'destructive',
      });
      return;
    }

    setIsExecuting(true);
    setErrors([]);
    const startTime = performance.now();

    try {
      let parsedVars = {};
      try {
        if (variables.trim() && variables.trim() !== '{}') {
          parsedVars = JSON.parse(variables);
        }
      } catch {
        toast({
          title: 'Invalid Variables',
          description: 'Variables must be valid JSON.',
          variant: 'destructive',
        });
        setIsExecuting(false);
        return;
      }

      const response = await executeQuery(store.endpoint, store.headers, query, parsedVars);
      const duration = Math.round(performance.now() - startTime);
      setLastDuration(duration);

      if (response.errors && response.errors.length > 0) {
        setErrors(response.errors);
      }

      const resultStr = JSON.stringify(response.data, null, 2);
      setResult(resultStr);

      // Save to history
      store.addQueryHistory({
        id: crypto.randomUUID(),
        query,
        variables,
        result: resultStr,
        error: response.errors ? JSON.stringify(response.errors) : undefined,
        timestamp: Date.now(),
        durationMs: duration,
      });
    } catch (err) {
      const error = err as Error;
      setErrors([{ message: error.message }]);
      setResult('');
    } finally {
      setIsExecuting(false);
    }
  }, [query, variables, store, toast]);

  const handleGenerateQuery = (typeName: string) => {
    const typeDef = store.schema.find((t) => t.name === typeName);
    if (!typeDef) return;
    const generated = generateQueryForType(typeDef, store.sampleSize);
    setQuery(generated);
    toast({ title: 'Query Generated', description: `Generated query for ${typeName}` });
  };

  const handleCopyResult = () => {
    navigator.clipboard.writeText(result);
    toast({ title: 'Copied', description: 'Result copied to clipboard.' });
  };

  const handleLoadHistory = (item: QueryHistoryItem) => {
    setQuery(item.query);
    setVariables(item.variables);
    setResult(item.result);
    if (item.error) setErrors(JSON.parse(item.error));
    else setErrors([]);
    setShowHistory(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl+Enter to execute
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleExecute();
    }
    // Tab support
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.target as HTMLTextAreaElement;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const newValue = query.substring(0, start) + '  ' + query.substring(end);
      setQuery(newValue);
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 2;
      }, 0);
    }
  };

  const formatTimeAgo = (ts: number) => {
    const seconds = Math.floor((Date.now() - ts) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };

  if (!store.endpoint || store.status === 'idle') {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <Terminal className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mb-4" />
        <h2 className="text-2xl font-bold mb-2">No Endpoint Connected</h2>
        <p className="text-zinc-500 mb-6">
          Connect to a GraphQL endpoint to use the query playground.
        </p>
        <Button onClick={() => navigate('/')} className="bg-indigo-600 hover:bg-indigo-700">
          Go to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col h-full p-4 md:p-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Query Playground</h1>
          <p className="text-zinc-500 text-sm font-mono truncate max-w-lg">{store.endpoint}</p>
        </div>
        <div className="flex items-center gap-2">
          {store.schema.length > 0 && (
            <Select onValueChange={handleGenerateQuery}>
              <SelectTrigger className="w-[180px] h-9 text-sm">
                <Wand2 className="w-3.5 h-3.5 mr-1.5" />
                <SelectValue placeholder="Generate query..." />
              </SelectTrigger>
              <SelectContent>
                {store.schema.map((t) => (
                  <SelectItem key={t.name} value={t.name}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowHistory(!showHistory)}
            className={showHistory ? 'bg-zinc-100 dark:bg-zinc-800' : ''}
          >
            <Clock className="w-3.5 h-3.5 mr-1.5" /> History ({store.queryHistory.length})
          </Button>
          <Button
            onClick={handleExecute}
            disabled={isExecuting}
            className="bg-indigo-600 hover:bg-indigo-700"
            size="sm"
          >
            {isExecuting ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 mr-1.5" />
            )}
            Run (Ctrl+↵)
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex gap-4">
        {/* Left: Editor + Variables */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          <Card className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Query Editor
                </span>
                {lastDuration !== null && (
                  <span className="text-[10px] font-mono text-zinc-400">{lastDuration}ms</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShowVariables(!showVariables)}
                  className={`text-[11px] px-2 py-0.5 rounded transition-colors ${
                    showVariables
                      ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400'
                      : 'text-zinc-500 hover:text-zinc-700'
                  }`}
                >
                  Variables
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0 flex flex-col">
              <textarea
                ref={queryRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                className="query-editor flex-1 min-h-0 w-full resize-none bg-transparent p-4 text-sm font-mono focus:outline-none"
                spellCheck={false}
                placeholder="Enter your GraphQL query here..."
              />
              <AnimatePresence>
                {showVariables && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: 120 }}
                    exit={{ height: 0 }}
                    className="overflow-hidden border-t border-zinc-200 dark:border-zinc-800"
                  >
                    <div className="px-3 py-1.5 bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800">
                      <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                        Variables (JSON)
                      </span>
                    </div>
                    <textarea
                      value={variables}
                      onChange={(e) => setVariables(e.target.value)}
                      className="w-full h-[80px] resize-none bg-transparent p-3 text-sm font-mono focus:outline-none"
                      spellCheck={false}
                      placeholder='{ "id": "123" }'
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </Card>
        </div>

        {/* Right: Results + History */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          {showHistory ? (
            <Card className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 shrink-0">
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Query History
                </span>
                {store.queryHistory.length > 0 && (
                  <button
                    onClick={() => store.clearQueryHistory()}
                    className="text-[11px] text-red-500 hover:text-red-600"
                  >
                    Clear All
                  </button>
                )}
              </div>
              <div className="flex-1 overflow-auto">
                {store.queryHistory.length === 0 ? (
                  <p className="text-center text-zinc-500 text-sm py-8">No query history yet.</p>
                ) : (
                  <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {store.queryHistory.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => handleLoadHistory(item)}
                        className="w-full text-left p-3 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5">
                            {item.error ? (
                              <AlertCircle className="w-3 h-3 text-red-500" />
                            ) : (
                              <CheckCircle2 className="w-3 h-3 text-green-500" />
                            )}
                            <span className="font-mono text-xs text-zinc-500">
                              {item.durationMs}ms
                            </span>
                          </div>
                          <span className="text-[10px] text-zinc-400">
                            {formatTimeAgo(item.timestamp)}
                          </span>
                        </div>
                        <p className="text-xs font-mono text-zinc-700 dark:text-zinc-300 truncate">
                          {item.query.trim().substring(0, 80)}...
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          ) : (
            <Card className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 shrink-0">
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Result
                </span>
                {result && (
                  <button
                    onClick={handleCopyResult}
                    className="text-[11px] text-zinc-500 hover:text-zinc-700 flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" /> Copy
                  </button>
                )}
              </div>

              {errors.length > 0 && (
                <div className="px-3 py-2 bg-red-50 dark:bg-red-950/30 border-b border-red-200 dark:border-red-900/50 shrink-0">
                  {errors.map((err: Record<string, unknown>, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2 text-sm text-red-700 dark:text-red-400"
                    >
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>
                        {String((err as { message?: string })?.message || 'Unknown error')}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex-1 overflow-auto p-4">
                {result ? (
                  <pre className="text-sm font-mono text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap break-words">
                    {result}
                  </pre>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-zinc-400">
                    <ChevronRight className="w-8 h-8 mb-2" />
                    <p className="text-sm">Run a query to see results</p>
                    <p className="text-xs mt-1">
                      Press{' '}
                      <kbd className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-[10px] border border-zinc-200 dark:border-zinc-700">
                        Ctrl
                      </kbd>{' '}
                      +{' '}
                      <kbd className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-[10px] border border-zinc-200 dark:border-zinc-700">
                        ↵
                      </kbd>
                    </p>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </motion.div>
  );
}
