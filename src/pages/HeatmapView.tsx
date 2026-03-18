import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../stores/useAppStore';
import { Heatmap } from '../components/Heatmap';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Slider } from '../components/ui/slider';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Search, Download, LayoutGrid, BarChart2, Layout, FileImage, FileCode, FileText, FileSpreadsheet, RefreshCw, TrendingUp, TrendingDown, AlertTriangle, Hash, ArrowUpDown } from 'lucide-react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Treemap, Legend } from 'recharts';
import * as htmlToImage from 'html-to-image';
import { jsPDF } from 'jspdf';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { Switch } from '../components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { fetchSampleData, calculateDensity, analyzeNullPatterns } from '../services/graphql';
import { useToast } from '../components/ui/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip';

export function HeatmapView() {
  const navigate = useNavigate();
  const store = useAppStore();
  const { toast } = useToast();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [minDensity, setMinDensity] = useState([0]);
  const [viewMode, setViewMode] = useState<'heatmap' | 'bar' | 'treemap'>('heatmap');
  const [selectedCell, setSelectedCell] = useState<{type: string, field: string} | null>(null);
  const [drillDownTab, setDrillDownTab] = useState<'data' | 'histogram' | 'json' | 'analysis'>('data');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  const [compareMode, setCompareMode] = useState(false);
  const [compareEndpoint, setCompareEndpoint] = useState<string>('');
  const [compareDensityData, setCompareDensityData] = useState<Record<string, Record<string, number>>>({});
  const [compareSampleData, setCompareSampleData] = useState<Record<string, any[]>>({});
  const [isFetchingCompare, setIsFetchingCompare] = useState(false);

  useKeyboardShortcuts([
    { key: 'k', ctrlKey: true, action: () => searchInputRef.current?.focus() },
    { key: 'k', metaKey: true, action: () => searchInputRef.current?.focus() },
  ]);

  const refreshData = async () => {
    if (isRefreshing || store.selectedTypes.length === 0) return;
    setIsRefreshing(true);
    try {
      const newDensityData: Record<string, Record<string, number>> = {};
      const newSampleData: Record<string, any[]> = {};

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
      toast({ title: 'Data Refreshed', description: 'Latest data fetched from endpoint.' });
    } catch (error: any) {
      toast({ title: 'Refresh Failed', description: error.message, variant: 'destructive' });
      setAutoRefresh(false);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    let interval: any;
    if (autoRefresh) {
      interval = setInterval(refreshData, store.refreshInterval * 1000);
    }
    return () => clearInterval(interval);
  }, [autoRefresh, store.selectedTypes, store.endpoint, store.headers, store.refreshInterval]);

  useEffect(() => {
    if (compareMode && compareEndpoint) {
      const fetchCompareData = async () => {
        setIsFetchingCompare(true);
        try {
          const saved = store.savedEndpoints.find(e => e.url === compareEndpoint);
          const headers = saved ? saved.headers : {};
          const newDensityData: Record<string, Record<string, number>> = {};
          const newSampleData: Record<string, any[]> = {};
          
          const fetchPromises = store.selectedTypes.map(async (typeName) => {
            const typeDef = store.schema.find(t => t.name === typeName);
            if (!typeDef) return;
            try {
              const data = await fetchSampleData(compareEndpoint, headers, typeDef, store.sampleSize);
              newSampleData[typeName] = data;
              newDensityData[typeName] = calculateDensity(data, typeDef.fields);
            } catch (err: any) {
              console.warn(`Skipping compare ${typeName}: ${err.message}`);
              newSampleData[typeName] = [];
              newDensityData[typeName] = calculateDensity([], typeDef.fields);
            }
          });
          
          await Promise.all(fetchPromises);
          setCompareSampleData(newSampleData);
          setCompareDensityData(newDensityData);
        } catch (error: any) {
          toast({ title: 'Compare Fetch Failed', description: error.message, variant: 'destructive' });
        } finally {
          setIsFetchingCompare(false);
        }
      };
      fetchCompareData();
    }
  }, [compareMode, compareEndpoint, store.selectedTypes, store.sampleSize, store.schema, store.savedEndpoints]);

  const filteredData = useMemo(() => {
    const result: Record<string, Record<string, number>> = {};
    Object.keys(store.densityData).forEach(type => {
      const fields = store.densityData[type];
      const filteredFields: Record<string, number> = {};
      Object.keys(fields).forEach(field => {
        const density = fields[field];
        if (density >= minDensity[0] && (field.toLowerCase().includes(searchQuery.toLowerCase()) || type.toLowerCase().includes(searchQuery.toLowerCase()))) {
          filteredFields[field] = density;
        }
      });
      if (Object.keys(filteredFields).length > 0) {
        result[type] = filteredFields;
      }
    });
    return result;
  }, [store.densityData, searchQuery, minDensity]);

  const overallQualityScore = useMemo(() => {
    let sum = 0, count = 0;
    Object.keys(filteredData).forEach(type => {
      Object.keys(filteredData[type]).forEach(field => {
        sum += filteredData[type][field];
        count++;
      });
    });
    return count > 0 ? sum / count : 0;
  }, [filteredData]);

  // Comprehensive statistics
  const stats = useMemo(() => {
    const allDensities: { type: string; field: string; density: number }[] = [];
    let totalRecords = 0;
    
    Object.keys(store.densityData).forEach(type => {
      if (store.sampleData[type]) {
        totalRecords += store.sampleData[type].length;
      }
      Object.keys(store.densityData[type]).forEach(field => {
        allDensities.push({ type, field, density: store.densityData[type][field] });
      });
    });

    allDensities.sort((a, b) => b.density - a.density);
    const best = allDensities.slice(0, 3);
    const worst = [...allDensities].sort((a, b) => a.density - b.density).slice(0, 3);
    const fullFields = allDensities.filter(d => d.density === 100).length;
    const emptyFields = allDensities.filter(d => d.density === 0).length;
    const anomalies = allDensities.filter(d => d.density === 0 || d.density === 100);

    return { totalRecords, totalFields: allDensities.length, best, worst, fullFields, emptyFields, anomalyCount: anomalies.length };
  }, [store.densityData, store.sampleData]);

  const filteredCompareData = useMemo(() => {
    const result: Record<string, Record<string, number>> = {};
    Object.keys(compareDensityData).forEach(type => {
      const fields = compareDensityData[type];
      const filteredFields: Record<string, number> = {};
      Object.keys(fields).forEach(field => {
        const density = fields[field];
        if (density >= minDensity[0] && (field.toLowerCase().includes(searchQuery.toLowerCase()) || type.toLowerCase().includes(searchQuery.toLowerCase()))) {
          filteredFields[field] = density;
        }
      });
      if (Object.keys(filteredFields).length > 0) {
        result[type] = filteredFields;
      }
    });
    return result;
  }, [compareDensityData, searchQuery, minDensity]);

  const barChartData = useMemo(() => {
    const data: any[] = [];
    Object.keys(filteredData).forEach(type => {
      Object.keys(filteredData[type]).forEach(field => {
        data.push({ name: `${type}.${field}`, type, field, density: filteredData[type][field] });
      });
    });
    return data.sort((a, b) => b.density - a.density).slice(0, 50);
  }, [filteredData]);

  const treemapData = useMemo(() => {
    return Object.keys(filteredData).map(type => ({
      name: type,
      children: Object.keys(filteredData[type]).map(field => ({
        name: field, type, field,
        size: filteredData[type][field] || 1,
        density: filteredData[type][field]
      }))
    }));
  }, [filteredData]);

  const distributionData = useMemo(() => {
    if (!selectedCell) return [];
    const data = store.sampleData[selectedCell.type] || [];
    const counts: Record<string, number> = {};
    data.forEach(item => {
      const val = item[selectedCell.field];
      if (val === null || val === undefined || val === '') {
        counts['(null/empty)'] = (counts['(null/empty)'] || 0) + 1;
      } else {
        const strVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
        const displayVal = strVal.length > 25 ? strVal.substring(0, 25) + '…' : strVal;
        counts[displayVal] = (counts[displayVal] || 0) + 1;
      }
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 15);
  }, [selectedCell, store.sampleData]);

  const nullAnalysis = useMemo(() => {
    if (!selectedCell || !store.sampleData[selectedCell.type]) return null;
    return analyzeNullPatterns(store.sampleData[selectedCell.type], selectedCell.field);
  }, [selectedCell, store.sampleData]);

  const rawJsonData = useMemo(() => {
    if (!selectedCell || !store.sampleData[selectedCell.type]) return '[]';
    const data = store.sampleData[selectedCell.type].slice(0, 20).map(item => ({
      [selectedCell.field]: item[selectedCell.field]
    }));
    return JSON.stringify(data, null, 2);
  }, [selectedCell, store.sampleData]);

  const handleCellClick = (type: string, field: string) => {
    setSelectedCell({ type, field });
    setDrillDownTab('data');
  };

  // Export functions
  const exportCSV = () => {
    const rows = [['Type', 'Field', 'Density (%)']];
    Object.keys(filteredData).forEach(type => {
      Object.keys(filteredData[type]).forEach(field => {
        rows.push([type, field, filteredData[type][field].toFixed(2)]);
      });
    });
    const csvContent = rows.map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "data_density.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: 'Export Successful', description: 'CSV file has been downloaded.' });
  };

  const exportPNG = async () => {
    const element = document.getElementById('visualization-container');
    if (!element) { toast({ title: 'Export Failed', description: 'Could not find visualization container.', variant: 'destructive' }); return; }
    try {
      toast({ title: 'Exporting...', description: 'Generating PNG image.' });
      const dataUrl = await htmlToImage.toPng(element, {
        backgroundColor: document.documentElement.classList.contains('dark') ? '#09090b' : '#ffffff',
        pixelRatio: 2,
      });
      const link = document.createElement('a');
      link.download = 'data_density.png';
      link.href = dataUrl;
      link.click();
      toast({ title: 'Export Successful', description: 'PNG file has been downloaded.' });
    } catch (error) {
      console.error('PNG Export Error:', error);
      toast({ title: 'Export Failed', description: 'An error occurred while generating the PNG.', variant: 'destructive' });
    }
  };

  const exportPDF = async () => {
    const element = document.getElementById('visualization-container');
    if (!element) { toast({ title: 'Export Failed', description: 'Could not find visualization container.', variant: 'destructive' }); return; }
    try {
      toast({ title: 'Exporting...', description: 'Generating PDF document.' });
      const canvas = await htmlToImage.toCanvas(element, {
        backgroundColor: document.documentElement.classList.contains('dark') ? '#09090b' : '#ffffff',
        pixelRatio: 2,
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [canvas.width, canvas.height]
      });
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save('data_density.pdf');
      toast({ title: 'Export Successful', description: 'PDF file has been downloaded.' });
    } catch (error) {
      console.error('PDF Export Error:', error);
      toast({ title: 'Export Failed', description: 'An error occurred while generating the PDF.', variant: 'destructive' });
    }
  };

  const exportSVG = () => {
    if (viewMode !== 'heatmap') {
      toast({ title: 'Export Failed', description: 'SVG export is only supported for the Heatmap view.', variant: 'destructive' });
      return;
    }
    const svgElement = document.querySelector('#visualization-container svg');
    if (!svgElement) { toast({ title: 'Export Failed', description: 'Could not find SVG element.', variant: 'destructive' }); return; }
    try {
      const serializer = new XMLSerializer();
      let source = serializer.serializeToString(svgElement);
      if (!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
        source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
      }
      source = '<?xml version="1.0" standalone="no"?>\r\n' + source;
      const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(source);
      const link = document.createElement("a");
      link.href = url;
      link.download = "data_density.svg";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast({ title: 'Export Successful', description: 'SVG file has been downloaded.' });
    } catch (error) {
      console.error('SVG Export Error:', error);
      toast({ title: 'Export Failed', description: 'An error occurred.', variant: 'destructive' });
    }
  };

  if (Object.keys(store.densityData).length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <LayoutGrid className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mb-4" />
        <h2 className="text-2xl font-bold mb-2">No Data Analyzed</h2>
        <p className="text-zinc-500 mb-6">Go to the Schema Explorer to select types and calculate density.</p>
        <Button onClick={() => navigate('/schema')} className="bg-indigo-600 hover:bg-indigo-700">Go to Schema Explorer</Button>
      </div>
    );
  }

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16'];

  const CustomTreemapContent = (props: any) => {
    const { depth, x, y, width, height, index, name, density, type, field } = props;
    if (depth === 2) {
      return (
        <g>
          <rect x={x} y={y} width={width} height={height}
            style={{ fill: COLORS[index % COLORS.length], stroke: '#fff', strokeWidth: 2, strokeOpacity: 0.5, opacity: 0.8, cursor: 'pointer' }}
            onClick={() => handleCellClick(type, field)}
          />
          {width > 50 && height > 30 && (
            <text x={x + 4} y={y + 18} fill="#fff" fontSize={12} className="font-medium pointer-events-none">{name}</text>
          )}
          {width > 50 && height > 45 && (
            <text x={x + 4} y={y + 34} fill="#fff" fontSize={10} className="opacity-80 pointer-events-none">{density?.toFixed(1)}%</text>
          )}
        </g>
      );
    }
    return null;
  };

  const fieldDef = selectedCell ? store.schema.find(t => t.name === selectedCell.type)?.fields.find(f => f.name === selectedCell.field) : null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-full mx-auto p-4 md:p-6 flex flex-col h-full"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 shrink-0">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold tracking-tight">Data Density Heatmap</h1>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={`px-3 py-1 rounded-full text-sm font-semibold cursor-help ${
                    overallQualityScore >= 80 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                    overallQualityScore >= 50 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  }`}>
                    {overallQualityScore.toFixed(1)}%
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="w-56 text-sm">Average data completeness across all analyzed fields and types.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p className="text-zinc-500 text-sm">
            {stats.totalRecords.toLocaleString()} records · {stats.totalFields} fields · {stats.fullFields} complete · {stats.emptyFields} empty
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg">
            {(['heatmap', 'bar', 'treemap'] as const).map(mode => {
              const icons = { heatmap: LayoutGrid, bar: BarChart2, treemap: Layout };
              const labels = { heatmap: 'Heatmap', bar: 'Bar Chart', treemap: 'Treemap' };
              const Icon = icons[mode];
              return (
                <Button key={mode} variant={viewMode === mode ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode(mode)} className="h-8 px-3">
                  <Icon className="h-4 w-4 mr-1.5" /> {labels[mode]}
                </Button>
              );
            })}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="mr-1.5 h-3.5 w-3.5" /> Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={exportCSV}><FileSpreadsheet className="mr-2 h-4 w-4" /> CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={exportPNG}><FileImage className="mr-2 h-4 w-4" /> PNG</DropdownMenuItem>
              <DropdownMenuItem onClick={exportPDF}><FileText className="mr-2 h-4 w-4" /> PDF</DropdownMenuItem>
              <DropdownMenuItem onClick={exportSVG} disabled={viewMode !== 'heatmap'}><FileCode className="mr-2 h-4 w-4" /> SVG</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 shrink-0">
        <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/30">
          <div className="flex items-center gap-1.5 text-green-700 dark:text-green-400 mb-1">
            <TrendingUp className="w-3.5 h-3.5" />
            <span className="text-[10px] font-semibold uppercase tracking-wider">Best Fields</span>
          </div>
          <div className="space-y-0.5">
            {stats.best.map(d => (
              <div key={`${d.type}.${d.field}`} className="text-xs">
                <span className="font-mono font-medium">{d.type}.{d.field}</span>
                <span className="text-green-600 dark:text-green-500 ml-1">{d.density.toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30">
          <div className="flex items-center gap-1.5 text-red-700 dark:text-red-400 mb-1">
            <TrendingDown className="w-3.5 h-3.5" />
            <span className="text-[10px] font-semibold uppercase tracking-wider">Worst Fields</span>
          </div>
          <div className="space-y-0.5">
            {stats.worst.map(d => (
              <div key={`${d.type}.${d.field}`} className="text-xs">
                <span className="font-mono font-medium">{d.type}.{d.field}</span>
                <span className="text-red-600 dark:text-red-500 ml-1">{d.density.toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>
        <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/30">
          <div className="flex items-center gap-1.5 text-blue-700 dark:text-blue-400 mb-1">
            <Hash className="w-3.5 h-3.5" />
            <span className="text-[10px] font-semibold uppercase tracking-wider">Summary</span>
          </div>
          <div className="text-xs space-y-0.5">
            <div><span className="font-medium">{stats.totalRecords.toLocaleString()}</span> total records</div>
            <div><span className="font-medium">{stats.totalFields}</span> fields analyzed</div>
            <div><span className="font-medium">{Object.keys(store.densityData).length}</span> types</div>
          </div>
        </div>
        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30">
          <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 mb-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span className="text-[10px] font-semibold uppercase tracking-wider">Anomalies</span>
          </div>
          <div className="text-xs space-y-0.5">
            <div><span className="font-medium text-green-600">{stats.fullFields}</span> fields at 100%</div>
            <div><span className="font-medium text-red-600">{stats.emptyFields}</span> fields at 0%</div>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col gap-4 flex-1 min-h-0">
        <Card className="w-full shrink-0">
          <CardContent className="p-3">
            <div className="flex flex-wrap items-center gap-5">
              <div className="space-y-1.5 flex-1 min-w-[180px]">
                <Label className="text-xs">Search</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
                  <Input ref={searchInputRef} placeholder="Filter... (⌘K)" value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)} className="pl-8 h-8 text-sm" />
                </div>
              </div>
              
              <div className="space-y-1.5 flex-1 min-w-[180px]">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Min Density</Label>
                  <span className="text-xs font-mono font-medium">{minDensity[0]}%</span>
                </div>
                <Slider value={minDensity} onValueChange={setMinDensity} max={100} step={1} />
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch checked={compareMode} onCheckedChange={setCompareMode} />
                  <Label className="text-xs">Compare</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} disabled={isRefreshing} />
                  <Label className="text-xs">Auto-Refresh</Label>
                  {isRefreshing && <RefreshCw className="w-3 h-3 animate-spin text-zinc-500" />}
                </div>
              </div>

              {compareMode && (
                <div className="space-y-1.5 flex-1 min-w-[180px]">
                  <Label className="text-xs">Compare With</Label>
                  <Select value={compareEndpoint} onValueChange={setCompareEndpoint}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select endpoint" /></SelectTrigger>
                    <SelectContent>
                      {store.savedEndpoints.filter(e => e.url !== store.endpoint).map(e => (
                        <SelectItem key={e.url} value={e.url}>{e.name || e.url}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex-1 min-w-[150px] border-l border-zinc-200 dark:border-zinc-800 pl-4">
                <div className="flex items-center justify-between text-[10px] text-zinc-500 mb-1">
                  <span>0%</span><span>100%</span>
                </div>
                <div className="h-2.5 w-full rounded-full" 
                  style={{ background: `linear-gradient(to right, ${store.heatmapColors.low}, ${store.heatmapColors.medium}, ${store.heatmapColors.high})` }} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Visualization */}
        <div className="w-full flex-1 min-h-0 flex flex-col" id="visualization-container">
          {compareMode ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 flex-1 min-h-0">
              <div className="space-y-2 flex flex-col min-h-0">
                <h3 className="font-semibold text-sm text-zinc-500 shrink-0">Primary: {store.endpoint}</h3>
                <Heatmap data={filteredData} sampleData={store.sampleData} onCellClick={handleCellClick} />
              </div>
              <div className="space-y-2 flex flex-col min-h-0">
                <h3 className="font-semibold text-sm text-zinc-500 shrink-0">Compare: {compareEndpoint || 'Select endpoint'}</h3>
                {isFetchingCompare ? (
                  <div className="flex flex-1 items-center justify-center text-zinc-500">
                    <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Fetching...
                  </div>
                ) : (
                  <Heatmap data={filteredCompareData} sampleData={compareSampleData} onCellClick={handleCellClick} />
                )}
              </div>
            </div>
          ) : viewMode === 'heatmap' ? (
            <Heatmap data={filteredData} sampleData={store.sampleData} onCellClick={handleCellClick} />
          ) : viewMode === 'bar' ? (
            <Card className="p-4 flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barChartData} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.1)" />
                  <XAxis type="number" domain={[0, 100]} />
                  <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 11 }} />
                  <RechartsTooltip formatter={(value: number) => [`${value.toFixed(1)}%`, 'Density']}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="density" fill="#6366f1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          ) : (
            <Card className="p-4 flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <Treemap data={treemapData} dataKey="size" aspectRatio={4 / 3} stroke="#fff" fill="#8884d8" content={<CustomTreemapContent />}>
                  <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number, name: string, props: any) => [`${props.payload.density?.toFixed(1)}%`, `${props.payload.type}.${props.payload.field}`]} />
                </Treemap>
              </ResponsiveContainer>
            </Card>
          )}
        </div>
      </div>

      {/* Enhanced Drill-Down Dialog */}
      <Dialog open={!!selectedCell} onOpenChange={(open) => !open && setSelectedCell(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <DialogTitle className="text-xl font-bold">
                <span className="text-indigo-600 dark:text-indigo-400">{selectedCell?.type}</span>
                <span className="text-zinc-400 mx-1">.</span>
                <span>{selectedCell?.field}</span>
              </DialogTitle>
            </div>
            <DialogDescription className="flex items-center gap-4">
              <span>
                Density: <span className="font-bold text-zinc-900 dark:text-zinc-50">
                  {selectedCell && store.densityData[selectedCell.type]?.[selectedCell.field]?.toFixed(1)}%
                </span>
              </span>
              {fieldDef && (
                <>
                  <span className="text-zinc-300 dark:text-zinc-700">|</span>
                  <span>Type: <span className="font-mono text-xs">{fieldDef.isList ? `[${fieldDef.type}]` : fieldDef.type}{fieldDef.isRequired ? '!' : ''}</span></span>
                  <span className="text-zinc-300 dark:text-zinc-700">|</span>
                  <span>Kind: <span className="font-mono text-xs">{fieldDef.kind}</span></span>
                </>
              )}
              {fieldDef?.description && (
                <>
                  <span className="text-zinc-300 dark:text-zinc-700">|</span>
                  <span className="text-xs italic">{fieldDef.description}</span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {/* Drill-Down Tabs */}
          <div className="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-lg shrink-0">
            {([
              { key: 'data', label: 'Sample Data' },
              { key: 'histogram', label: 'Distribution' },
              { key: 'json', label: 'Raw JSON' },
              { key: 'analysis', label: 'Null Analysis' },
            ] as const).map(tab => (
              <button key={tab.key} onClick={() => setDrillDownTab(tab.key)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  drillDownTab === tab.key
                    ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}>
                {tab.label}
              </button>
            ))}
          </div>
          
          <div className="flex-1 overflow-hidden mt-3">
            {drillDownTab === 'data' && (
              <div className="h-full overflow-auto border rounded-md">
                <Table>
                  <TableHeader className="sticky top-0 bg-white dark:bg-zinc-950 z-10 shadow-sm">
                    <TableRow>
                      <TableHead className="w-14">#</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead className="w-20 text-right">Type</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedCell && store.sampleData[selectedCell.type]?.slice(0, 100).map((item, idx) => {
                      const val = item[selectedCell.field];
                      const isNull = val === null || val === undefined || val === '';
                      return (
                        <TableRow key={idx}>
                          <TableCell className="text-zinc-400 text-xs">{idx + 1}</TableCell>
                          <TableCell className="font-mono text-sm max-w-[400px] truncate" title={typeof val === 'object' ? JSON.stringify(val) : String(val)}>
                            {isNull ? (
                              <span className="text-red-500 italic">null</span>
                            ) : typeof val === 'object' ? (
                              <span className="text-indigo-600 dark:text-indigo-400">{JSON.stringify(val)}</span>
                            ) : (
                              String(val)
                            )}
                          </TableCell>
                          <TableCell className="text-right text-zinc-400 text-xs">{isNull ? '—' : typeof val}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            {drillDownTab === 'histogram' && (
              <div className="h-full flex flex-col gap-4">
                <div className="flex-1 min-h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={distributionData} margin={{ top: 10, right: 20, left: 0, bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <RechartsTooltip 
                        formatter={(value: number) => [value, 'Count']}
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {distributionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.name === '(null/empty)' ? '#ef4444' : COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {drillDownTab === 'json' && (
              <div className="h-full overflow-auto border rounded-md bg-zinc-50 dark:bg-zinc-900/50 p-4">
                <pre className="text-xs font-mono text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap break-words">
                  {rawJsonData}
                </pre>
              </div>
            )}

            {drillDownTab === 'analysis' && nullAnalysis && (
              <div className="h-full overflow-auto space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800">
                    <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">Total Records</div>
                    <div className="text-2xl font-bold">{nullAnalysis.totalRecords}</div>
                  </div>
                  <div className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800">
                    <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">Non-Null</div>
                    <div className="text-2xl font-bold text-green-600">{nullAnalysis.nonNullCount}</div>
                  </div>
                  <div className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800">
                    <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">Null/Empty</div>
                    <div className="text-2xl font-bold text-red-600">{nullAnalysis.nullCount}</div>
                  </div>
                  <div className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800">
                    <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">Null Rate</div>
                    <div className="text-2xl font-bold">{nullAnalysis.nullPercentage.toFixed(1)}%</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-800">
                    <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">Null Pattern</div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded text-sm font-semibold ${
                        nullAnalysis.pattern === 'all_filled' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                        nullAnalysis.pattern === 'all_null' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                        nullAnalysis.pattern === 'random' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                        nullAnalysis.pattern === 'clustered' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                        'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                      }`}>
                        {nullAnalysis.pattern.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 mt-2">
                      {nullAnalysis.pattern === 'all_filled' && 'Every record has a value for this field.'}
                      {nullAnalysis.pattern === 'all_null' && 'No records have a value for this field.'}
                      {nullAnalysis.pattern === 'random' && 'Null values are distributed randomly throughout the dataset.'}
                      {nullAnalysis.pattern === 'clustered' && 'Null values appear in large consecutive clusters.'}
                      {nullAnalysis.pattern === 'leading' && 'Null values appear at the beginning of the dataset.'}
                      {nullAnalysis.pattern === 'trailing' && 'Null values appear at the end of the dataset.'}
                    </p>
                  </div>

                  <div className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-800">
                    <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">Streak Analysis</div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Longest null streak</span>
                        <span className="font-mono font-medium">{nullAnalysis.longestNullStreak} records</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Longest valid streak</span>
                        <span className="font-mono font-medium">{nullAnalysis.longestNonNullStreak} records</span>
                      </div>
                    </div>

                    {/* Visual bar */}
                    <div className="mt-3 h-3 rounded-full overflow-hidden bg-zinc-200 dark:bg-zinc-800 relative">
                      <div 
                        className="h-full bg-green-500 rounded-full transition-all"
                        style={{ width: `${100 - nullAnalysis.nullPercentage}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-zinc-400 mt-1">
                      <span>{(100 - nullAnalysis.nullPercentage).toFixed(1)}% filled</span>
                      <span>{nullAnalysis.nullPercentage.toFixed(1)}% null</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
