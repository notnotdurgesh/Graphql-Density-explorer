import { useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../stores/useAppStore';
import { fetchSampleData, calculateDensity } from '../services/graphql';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Checkbox } from '../components/ui/checkbox';
import { useToast } from '../components/ui/use-toast';
import { Loader2, Search, Play, ChevronDown, ChevronRight, Database, Hash, Boxes, GitFork, FileInput, AlertTriangle, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '../components/ui/badge';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip';

type SchemaTab = 'OBJECT' | 'ENUM' | 'INTERFACE' | 'UNION' | 'INPUT';

const KIND_BADGE_COLORS: Record<string, string> = {
  SCALAR: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 border-blue-200 dark:border-blue-800',
  OBJECT: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800',
  LIST: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400 border-purple-200 dark:border-purple-800',
  ENUM: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  INTERFACE: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 border-green-200 dark:border-green-800',
  UNION: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400 border-rose-200 dark:border-rose-800',
  INPUT_OBJECT: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800',
  NON_NULL: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 border-red-200 dark:border-red-800',
};

function KindBadge({ kind, isList, isRequired }: { kind: string; isList?: boolean; isRequired?: boolean }) {
  const label = isList ? `[${kind}]` : kind;
  const finalLabel = isRequired ? `${label}!` : label;
  const color = KIND_BADGE_COLORS[kind] || KIND_BADGE_COLORS.SCALAR;
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold rounded border ${color}`}>
      {finalLabel}
    </span>
  );
}

export function SchemaExplorer() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const store = useAppStore();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<SchemaTab>('OBJECT');
  const searchInputRef = useRef<HTMLInputElement>(null);

  useKeyboardShortcuts([
    { key: 'k', ctrlKey: true, action: () => searchInputRef.current?.focus() },
    { key: 'k', metaKey: true, action: () => searchInputRef.current?.focus() },
  ]);

  const filteredSchema = store.schema.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.fields.some(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredEnums = store.fullSchema.enums.filter(e =>
    e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredInterfaces = store.fullSchema.interfaces.filter(i =>
    i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    i.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredUnions = store.fullSchema.unions.filter(u =>
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredInputTypes = store.fullSchema.inputTypes.filter(i =>
    i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    i.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const allFilteredSelected = filteredSchema.length > 0 && filteredSchema.every(t => store.selectedTypes.includes(t.name));

  const handleSelectAll = (checked: boolean | 'indeterminate') => {
    if (checked === true) {
      const newSelected = new Set(store.selectedTypes);
      filteredSchema.forEach(t => newSelected.add(t.name));
      store.setSelectedTypes(Array.from(newSelected));
    } else {
      const filteredNames = new Set(filteredSchema.map(t => t.name));
      store.setSelectedTypes(store.selectedTypes.filter(t => !filteredNames.has(t)));
    }
  };

  const handleSelectRow = (name: string, checked: boolean | 'indeterminate') => {
    if (checked === true) {
      store.setSelectedTypes([...store.selectedTypes, name]);
    } else {
      store.setSelectedTypes(store.selectedTypes.filter(t => t !== name));
    }
  };

  const toggleExpand = (name: string) => {
    setExpandedTypes(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleCalculateDensity = async () => {
    if (store.selectedTypes.length === 0) {
      toast({ title: 'No types selected', description: 'Please select at least one type to analyze.', variant: 'destructive' });
      return;
    }

    setIsFetching(true);
    store.setStatus('fetching');

    const newDensityData: Record<string, Record<string, number>> = {};
    const newSampleData: Record<string, any[]> = {};

    try {
      const fetchPromises = store.selectedTypes.map(async (typeName) => {
        const typeDef = store.schema.find(t => t.name === typeName);
        if (!typeDef) return;

        try {
          const data = await fetchSampleData(store.endpoint, store.headers, typeDef, store.sampleSize);
          const density = calculateDensity(data, typeDef.fields);
          newSampleData[typeName] = data;
          newDensityData[typeName] = density;
        } catch (err: any) {
          console.warn(`Skipping ${typeName}: ${err.message}`);
          newSampleData[typeName] = [];
          newDensityData[typeName] = calculateDensity([], typeDef.fields);
        }
      });

      await Promise.all(fetchPromises);

      store.setSampleData(newSampleData);
      store.setDensityData(newDensityData);
      store.setStatus('connected');
      
      toast({ title: 'Analysis Complete', description: `Calculated density for ${store.selectedTypes.length} types.` });
      navigate('/heatmap');
    } catch (error: any) {
      toast({ title: 'Analysis Failed', description: error.message, variant: 'destructive' });
      store.setStatus('error');
    } finally {
      setIsFetching(false);
    }
  };

  const tabs: { key: SchemaTab; label: string; icon: React.ReactNode; count: number }[] = [
    { key: 'OBJECT', label: 'Objects', icon: <Database className="w-3.5 h-3.5" />, count: store.schema.length },
    { key: 'ENUM', label: 'Enums', icon: <Boxes className="w-3.5 h-3.5" />, count: store.fullSchema.enums.length },
    { key: 'INTERFACE', label: 'Interfaces', icon: <GitFork className="w-3.5 h-3.5" />, count: store.fullSchema.interfaces.length },
    { key: 'UNION', label: 'Unions', icon: <Hash className="w-3.5 h-3.5" />, count: store.fullSchema.unions.length },
    { key: 'INPUT', label: 'Inputs', icon: <FileInput className="w-3.5 h-3.5" />, count: store.fullSchema.inputTypes.length },
  ];

  if (store.schema.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <Database className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mb-4" />
        <h2 className="text-2xl font-bold mb-2">No Schema Loaded</h2>
        <p className="text-zinc-500 mb-6">Connect to a GraphQL endpoint first to explore its schema.</p>
        <Button onClick={() => navigate('/')} className="bg-indigo-600 hover:bg-indigo-700">Go to Dashboard</Button>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-6xl mx-auto p-4 md:p-8 flex flex-col h-full"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5 shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">Schema Explorer</h1>
          <p className="text-zinc-500">
            {store.schemaStats && (
              <span className="font-mono text-xs">
                {store.schemaStats.objectTypeCount} types · {store.schemaStats.totalFields} fields · {store.schemaStats.enumTypeCount} enums · {store.schemaStats.queryFields.length} queries
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <Input 
              ref={searchInputRef}
              placeholder="Search... (⌘K)" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
          <Button onClick={handleCalculateDensity} disabled={isFetching || store.selectedTypes.length === 0} className="bg-indigo-600 hover:bg-indigo-700">
            {isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
            Analyze ({store.selectedTypes.length})
          </Button>
        </div>
      </div>

      {/* Kind Filter Tabs */}
      <div className="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-lg mb-4 shrink-0 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === tab.key
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            {tab.icon}
            {tab.label}
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
              activeTab === tab.key 
                ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400'
                : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-500'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Content Area */}
      <Card className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="overflow-auto flex-1">
          {activeTab === 'OBJECT' && (
            <Table>
              <TableHeader className="sticky top-0 bg-white dark:bg-zinc-950 z-10 shadow-sm">
                <TableRow>
                  <TableHead className="w-10 text-center">
                    <Checkbox 
                      checked={allFilteredSelected}
                      onCheckedChange={handleSelectAll}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Type Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right w-24">Fields</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSchema.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-zinc-500">
                      No types found matching your search.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSchema.map((type) => (
                    <TooltipProvider key={type.name}>
                      <>
                        <TableRow 
                          data-state={store.selectedTypes.includes(type.name) ? "selected" : undefined}
                          className="group cursor-pointer"
                          onClick={() => toggleExpand(type.name)}
                        >
                          <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                            <Checkbox 
                              checked={store.selectedTypes.includes(type.name)}
                              onCheckedChange={(checked) => handleSelectRow(type.name, checked)}
                              aria-label={`Select ${type.name}`}
                            />
                          </TableCell>
                          <TableCell className="w-8">
                            {expandedTypes.has(type.name) ? (
                              <ChevronDown className="w-4 h-4 text-zinc-400" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-zinc-400" />
                            )}
                          </TableCell>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{type.name}</span>
                              <KindBadge kind="OBJECT" />
                            </div>
                          </TableCell>
                          <TableCell className="text-zinc-500 max-w-md truncate" title={type.description}>
                            {type.description || '—'}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {type.fields.length}
                          </TableCell>
                        </TableRow>
                        {/* Expanded field details */}
                        <AnimatePresence>
                          {expandedTypes.has(type.name) && (
                            <TableRow>
                              <TableCell colSpan={5} className="p-0 bg-zinc-50 dark:bg-zinc-900/50">
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="overflow-hidden"
                                >
                                  <div className="p-4 pl-16 space-y-1">
                                    <div className="grid grid-cols-[1fr_auto_auto_1fr] gap-x-4 gap-y-1 text-sm">
                                      <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider pb-1">Field</div>
                                      <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider pb-1">Type</div>
                                      <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider pb-1">Kind</div>
                                      <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider pb-1">Description</div>
                                      {type.fields.map(field => (
                                        <React.Fragment key={field.name}>
                                          <div className="font-mono text-sm font-medium flex items-center gap-1.5">
                                            {field.name}
                                            {field.isRequired && <span className="text-red-500 text-xs">*</span>}
                                          </div>
                                          <div className="font-mono text-xs text-zinc-500">
                                            {field.isList ? `[${field.type}]` : field.type}
                                          </div>
                                          <div>
                                            <KindBadge kind={field.kind} isList={field.isList} isRequired={field.isRequired} />
                                          </div>
                                          <div className="text-zinc-500 text-xs truncate" title={field.description}>
                                            {field.description || '—'}
                                          </div>
                                        </React.Fragment>
                                      ))}
                                    </div>
                                  </div>
                                </motion.div>
                              </TableCell>
                            </TableRow>
                          )}
                        </AnimatePresence>
                      </>
                    </TooltipProvider>
                  ))
                )}
              </TableBody>
            </Table>
          )}

          {activeTab === 'ENUM' && (
            <div className="p-4 space-y-3">
              {filteredEnums.length === 0 ? (
                <p className="text-center text-zinc-500 py-8">No enums found.</p>
              ) : filteredEnums.map(enumType => (
                <Card key={enumType.name} className="overflow-hidden">
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold">{enumType.name}</span>
                      <KindBadge kind="ENUM" />
                    </div>
                    {enumType.description && (
                      <p className="text-sm text-zinc-500 mb-3">{enumType.description}</p>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      {enumType.values.map(v => (
                        <Tooltip key={v.name}>
                          <TooltipTrigger asChild>
                            <span className={`px-2 py-1 rounded text-xs font-mono ${
                              v.isDeprecated 
                                ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 line-through' 
                                : 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
                            }`}>
                              {v.name}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{v.description || 'No description'}</p>
                            {v.isDeprecated && (
                              <p className="text-red-500 flex items-center gap-1 mt-1">
                                <AlertTriangle className="w-3 h-3" /> {v.deprecationReason || 'Deprecated'}
                              </p>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      ))}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {activeTab === 'INTERFACE' && (
            <div className="p-4 space-y-3">
              {filteredInterfaces.length === 0 ? (
                <p className="text-center text-zinc-500 py-8">No interfaces found.</p>
              ) : filteredInterfaces.map(iface => (
                <Card key={iface.name} className="overflow-hidden">
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold">{iface.name}</span>
                      <KindBadge kind="INTERFACE" />
                    </div>
                    {iface.description && (
                      <p className="text-sm text-zinc-500 mb-3">{iface.description}</p>
                    )}
                    <div className="mb-3">
                      <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Fields</span>
                      <div className="mt-1 space-y-1">
                        {iface.fields.map(f => (
                          <div key={f.name} className="flex items-center gap-2 text-sm">
                            <span className="font-mono font-medium">{f.name}</span>
                            <span className="text-zinc-400">:</span>
                            <span className="font-mono text-xs text-zinc-500">{f.isList ? `[${f.type}]` : f.type}</span>
                            <KindBadge kind={f.kind} />
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Implemented By</span>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {iface.possibleTypes.map(pt => (
                          <span key={pt} className="px-2 py-0.5 rounded text-xs font-mono bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400">
                            {pt}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {activeTab === 'UNION' && (
            <div className="p-4 space-y-3">
              {filteredUnions.length === 0 ? (
                <p className="text-center text-zinc-500 py-8">No unions found.</p>
              ) : filteredUnions.map(union => (
                <Card key={union.name} className="overflow-hidden">
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold">{union.name}</span>
                      <KindBadge kind="UNION" />
                    </div>
                    {union.description && (
                      <p className="text-sm text-zinc-500 mb-3">{union.description}</p>
                    )}
                    <div>
                      <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Possible Types</span>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {union.possibleTypes.map((pt, idx) => (
                          <span key={pt} className="flex items-center gap-1">
                            <span className="px-2 py-0.5 rounded text-xs font-mono bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400">
                              {pt}
                            </span>
                            {idx < union.possibleTypes.length - 1 && (
                              <span className="text-zinc-300 dark:text-zinc-700">|</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {activeTab === 'INPUT' && (
            <div className="p-4 space-y-3">
              {filteredInputTypes.length === 0 ? (
                <p className="text-center text-zinc-500 py-8">No input types found.</p>
              ) : filteredInputTypes.map(inputType => (
                <Card key={inputType.name} className="overflow-hidden">
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold">{inputType.name}</span>
                      <KindBadge kind="INPUT_OBJECT" />
                    </div>
                    {inputType.description && (
                      <p className="text-sm text-zinc-500 mb-3">{inputType.description}</p>
                    )}
                    <div className="space-y-1">
                      {inputType.fields.map(f => (
                        <div key={f.name} className="flex items-center gap-2 text-sm">
                          <span className="font-mono font-medium">{f.name}</span>
                          {f.isRequired && <span className="text-red-500 text-xs">*</span>}
                          <span className="text-zinc-400">:</span>
                          <span className="font-mono text-xs text-zinc-500">{f.isList ? `[${f.type}]` : f.type}</span>
                          {f.description && (
                            <span className="text-zinc-400 text-xs ml-2">— {f.description}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}

// Need this for the React.Fragment usage
import React from 'react';
