import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../stores/useAppStore';
import { introspectFullSchema } from '../services/graphql';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { useToast } from '../components/ui/use-toast';
import { Loader2, Trash2, DatabaseZap, Clock, Wifi, WifiOff, Download, Upload, Database, Boxes, GitFork, Hash, FileInput, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';

const PUBLIC_ENDPOINTS = [
  { name: 'Rick and Morty', url: 'https://rickandmortyapi.com/graphql', icon: '🪐', desc: 'Characters, episodes, locations' },
  { name: 'SpaceX', url: 'https://spacex-production.up.railway.app/', icon: '🚀', desc: 'Launches, rockets, missions' },
  { name: 'Countries', url: 'https://countries.trevorblades.com', icon: '🌍', desc: 'Countries, languages, continents' },
  { name: 'Pokemon', url: 'https://graphql-pokemon2.vercel.app/', icon: '⚡', desc: 'Pokemon data and stats' },
];

export function Dashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const store = useAppStore();
  
  const [url, setUrl] = useState(store.endpoint || '');
  const [headersStr, setHeadersStr] = useState(
    Object.keys(store.headers).length > 0
      ? JSON.stringify(store.headers, null, 2)
      : '{\n  "Authorization": "Bearer YOUR_TOKEN"\n}'
  );
  const [isConnecting, setIsConnecting] = useState(false);
  const [schemaPreview, setSchemaPreview] = useState<{
    show: boolean;
    stats: any;
    latency: number;
  }>({ show: false, stats: null, latency: 0 });

  const handleConnect = async (endpointToConnect: string, headersToUse: Record<string, string>) => {
    if (!endpointToConnect) {
      toast({ title: 'Error', description: 'Please enter a GraphQL endpoint URL', variant: 'destructive' });
      return;
    }

    // Basic URL validation
    if (!endpointToConnect.startsWith('http')) {
      toast({ title: 'Invalid URL', description: 'URL must start with http:// or https://', variant: 'destructive' });
      return;
    }

    setIsConnecting(true);
    store.setStatus('connecting');

    const startTime = performance.now();

    try {
      const result = await introspectFullSchema(endpointToConnect, headersToUse);
      const latency = Math.round(performance.now() - startTime);

      store.setEndpoint(endpointToConnect);
      store.setHeaders(headersToUse);
      store.setSchema(result.objectTypes);
      store.setFullSchema({
        enums: result.enums,
        interfaces: result.interfaces,
        unions: result.unions,
        inputTypes: result.inputTypes,
        directives: result.directives,
      });
      store.setSchemaStats(result.stats);
      store.setConnectionHealth({
        latencyMs: latency,
        lastChecked: Date.now(),
        schemaSize: JSON.stringify(result).length,
      });
      
      store.addSavedEndpoint({ url: endpointToConnect, headers: headersToUse });
      
      // Show schema preview before navigating
      setSchemaPreview({ show: true, stats: result.stats, latency });
    } catch (error: any) {
      store.setError(error.message);
      toast({ title: 'Connection Failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsConnecting(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let parsedHeaders = {};
    try {
      if (headersStr.trim() && headersStr !== '{\n  "Authorization": "Bearer YOUR_TOKEN"\n}') {
        parsedHeaders = JSON.parse(headersStr);
      }
    } catch (err) {
      toast({ title: 'Invalid Headers', description: 'Headers must be valid JSON', variant: 'destructive' });
      return;
    }
    handleConnect(url, parsedHeaders);
  };

  const handleExportConfig = () => {
    const config = {
      endpoint: store.endpoint,
      headers: store.headers,
      selectedTypes: store.selectedTypes,
      sampleSize: store.sampleSize,
      heatmapColors: store.heatmapColors,
      savedEndpoints: store.savedEndpoints,
    };
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'density-workspace.json';
    link.click();
    URL.revokeObjectURL(link.href);
    toast({ title: 'Exported', description: 'Workspace configuration saved.' });
  };

  const handleImportConfig = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e: any) => {
      const file = e.target?.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const config = JSON.parse(text);
        if (config.endpoint) setUrl(config.endpoint);
        if (config.headers) setHeadersStr(JSON.stringify(config.headers, null, 2));
        if (config.sampleSize) store.setSampleSize(config.sampleSize);
        if (config.heatmapColors) store.setHeatmapColors(config.heatmapColors);
        if (config.savedEndpoints) {
          config.savedEndpoints.forEach((ep: any) => store.addSavedEndpoint(ep));
        }
        toast({ title: 'Imported', description: 'Workspace configuration loaded.' });
      } catch {
        toast({ title: 'Import Failed', description: 'Invalid configuration file.', variant: 'destructive' });
      }
    };
    input.click();
  };

  const formatTimeAgo = (ts?: number) => {
    if (!ts) return '';
    const seconds = Math.floor((Date.now() - ts) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-5xl mx-auto p-6 md:p-8"
    >
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight mb-2">Connect to GraphQL</h1>
        <p className="text-zinc-500 text-lg">Enter your endpoint to introspect the schema and analyze data density.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DatabaseZap className="w-5 h-5 text-indigo-500" />
              Endpoint Configuration
            </CardTitle>
            <CardDescription>Provide the URL and optional headers to connect.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="url">GraphQL Endpoint URL</Label>
                <div className="flex gap-2">
                  <Input 
                    id="url" 
                    placeholder="https://api.example.com/graphql" 
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="flex-1 font-mono text-sm"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="headers">Headers (JSON)</Label>
                <textarea
                  id="headers"
                  className="flex min-h-[100px] w-full rounded-md border border-zinc-200 bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:placeholder:text-zinc-400 font-mono"
                  value={headersStr}
                  onChange={(e) => setHeadersStr(e.target.value)}
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-700" disabled={isConnecting}>
                  {isConnecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <DatabaseZap className="mr-2 h-4 w-4" />}
                  Connect & Introspect
                </Button>
                <Button type="button" variant="outline" size="icon" onClick={handleImportConfig} title="Import Config">
                  <Upload className="h-4 w-4" />
                </Button>
                <Button type="button" variant="outline" size="icon" onClick={handleExportConfig} title="Export Config">
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Quick Connect</CardTitle>
              <CardDescription>Try these public GraphQL endpoints.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-2">
                {PUBLIC_ENDPOINTS.map((ep) => (
                  <button 
                    key={ep.url} 
                    className="flex items-center gap-3 w-full text-left p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:border-indigo-400 dark:hover:border-indigo-600 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 transition-all group"
                    onClick={() => {
                      setUrl(ep.url);
                      setHeadersStr('{}');
                      handleConnect(ep.url, {});
                    }}
                    disabled={isConnecting}
                  >
                    <span className="text-2xl group-hover:scale-110 transition-transform">{ep.icon}</span>
                    <div>
                      <p className="font-semibold text-sm">{ep.name}</p>
                      <p className="text-[11px] text-zinc-500">{ep.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Saved Endpoints</CardTitle>
              <CardDescription>Reconnect to previous endpoints.</CardDescription>
            </CardHeader>
            <CardContent>
              {store.savedEndpoints.length === 0 ? (
                <p className="text-sm text-zinc-500 text-center py-4">No saved endpoints yet.</p>
              ) : (
                <div className="space-y-2">
                  {store.savedEndpoints.map((ep) => (
                    <div key={ep.url} className="flex items-center justify-between p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors group">
                      <div 
                        className="flex-1 overflow-hidden cursor-pointer" 
                        onClick={() => {
                          setUrl(ep.url);
                          setHeadersStr(JSON.stringify(ep.headers, null, 2));
                        }}
                      >
                        <p className="text-sm font-medium truncate">{ep.name || ep.url}</p>
                        {ep.lastUsed && (
                          <p className="text-[10px] text-zinc-500 flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3" /> {formatTimeAgo(ep.lastUsed)}
                          </p>
                        )}
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                        onClick={() => store.removeSavedEndpoint(ep.url)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Connection Health (if connected) */}
      {store.connectionHealth && store.status !== 'idle' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6"
        >
          <Card className="border-green-200 dark:border-green-900/50 bg-green-50/50 dark:bg-green-950/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-6 flex-wrap">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                  <Wifi className="w-4 h-4" />
                  <span className="text-sm font-medium">Connected</span>
                </div>
                <div className="text-sm text-zinc-600 dark:text-zinc-400">
                  Latency: <span className="font-mono font-medium text-zinc-900 dark:text-zinc-50">{store.connectionHealth.latencyMs}ms</span>
                </div>
                <div className="text-sm text-zinc-600 dark:text-zinc-400">
                  Schema Size: <span className="font-mono font-medium text-zinc-900 dark:text-zinc-50">{(store.connectionHealth.schemaSize / 1024).toFixed(1)} KB</span>
                </div>
                {store.schemaStats && (
                  <div className="text-sm text-zinc-600 dark:text-zinc-400">
                    Types: <span className="font-mono font-medium text-zinc-900 dark:text-zinc-50">{store.schemaStats.objectTypeCount}</span>
                    {' · '}Fields: <span className="font-mono font-medium text-zinc-900 dark:text-zinc-50">{store.schemaStats.totalFields}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Schema Preview Dialog */}
      <Dialog open={schemaPreview.show} onOpenChange={(open) => !open && setSchemaPreview(p => ({...p, show: false}))}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <Wifi className="w-5 h-5" /> Schema Introspected Successfully
            </DialogTitle>
            <DialogDescription>
              Connected in <span className="font-mono font-semibold">{schemaPreview.latency}ms</span>. Here's what we found:
            </DialogDescription>
          </DialogHeader>
          {schemaPreview.stats && (
            <div className="grid grid-cols-3 gap-3 py-4">
              <StatCard icon={<Database className="w-4 h-4" />} label="Object Types" value={schemaPreview.stats.objectTypeCount} color="indigo" />
              <StatCard icon={<Hash className="w-4 h-4" />} label="Total Fields" value={schemaPreview.stats.totalFields} color="blue" />
              <StatCard icon={<Boxes className="w-4 h-4" />} label="Enums" value={schemaPreview.stats.enumTypeCount} color="amber" />
              <StatCard icon={<GitFork className="w-4 h-4" />} label="Interfaces" value={schemaPreview.stats.interfaceTypeCount} color="green" />
              <StatCard icon={<FileInput className="w-4 h-4" />} label="Input Types" value={schemaPreview.stats.inputTypeCount} color="purple" />
              <StatCard icon={<Zap className="w-4 h-4" />} label="Queries" value={schemaPreview.stats.queryFields.length} color="rose" />
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <Button className="flex-1 bg-indigo-600 hover:bg-indigo-700" onClick={() => {
              setSchemaPreview(p => ({...p, show: false}));
              navigate('/schema');
            }}>
              Explore Schema →
            </Button>
            <Button variant="outline" onClick={() => {
              setSchemaPreview(p => ({...p, show: false}));
              navigate('/heatmap');
            }}>
              Go to Heatmap
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    indigo: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
    blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    green: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    rose: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  };

  return (
    <div className={`rounded-lg p-3 ${colorMap[color] || colorMap.indigo}`}>
      <div className="flex items-center gap-1.5 mb-1">{icon}<span className="text-[11px] font-medium">{label}</span></div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}
