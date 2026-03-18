import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { useAppStore } from '../stores/useAppStore';
import { Card } from './ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Label } from './ui/label';

interface HeatmapProps {
  data: Record<string, Record<string, number>>;
  sampleData?: Record<string, any[]>;
  onCellClick: (type: string, field: string) => void;
}

type SortOption = 'name-asc' | 'name-desc' | 'density-asc' | 'density-desc';

export function Heatmap({ data, sampleData, onCellClick }: HeatmapProps) {
  const store = useAppStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [rowSort, setRowSort] = useState<SortOption>('name-asc');
  const [colSort, setColSort] = useState<SortOption>('name-asc');
  const [containerWidth, setContainerWidth] = useState(0);
  const [tooltipInfo, setTooltipInfo] = useState<{
    x: number;
    y: number;
    type: string;
    field: string;
    density: number;
    fieldImportance?: number;
    validCount?: number;
    totalCount?: number;
    visible: boolean;
  }>({ x: 0, y: 0, type: '', field: '', density: 0, visible: false });

  useEffect(() => {
    if (!containerRef.current || !containerRef.current.parentElement) return;
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        setContainerWidth(entries[0].contentRect.width);
      }
    });
    observer.observe(containerRef.current.parentElement);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!containerRef.current || Object.keys(data).length === 0) return;

    const types = Object.keys(data);
    const fieldsSet = new Set<string>();
    
    const rowDensities: Record<string, number> = {};
    const colDensities: Record<string, number> = {};
    const colCounts: Record<string, number> = {};

    types.forEach(t => {
      let sum = 0;
      let count = 0;
      Object.keys(data[t]).forEach(f => {
        fieldsSet.add(f);
        sum += data[t][f];
        count++;
        colDensities[f] = (colDensities[f] || 0) + data[t][f];
        colCounts[f] = (colCounts[f] || 0) + 1;
      });
      rowDensities[t] = count > 0 ? sum / count : 0;
    });

    const fieldImportance: Record<string, number> = {};
    Object.keys(colDensities).forEach(f => {
      fieldImportance[f] = colDensities[f] / colCounts[f];
    });

    types.sort((a, b) => {
      if (rowSort === 'name-asc') return a.localeCompare(b);
      if (rowSort === 'name-desc') return b.localeCompare(a);
      if (rowSort === 'density-asc') return rowDensities[a] - rowDensities[b];
      if (rowSort === 'density-desc') return rowDensities[b] - rowDensities[a];
      return 0;
    });

    const fields = Array.from(fieldsSet).sort((a, b) => {
      if (colSort === 'name-asc') return a.localeCompare(b);
      if (colSort === 'name-desc') return b.localeCompare(a);
      if (colSort === 'density-asc') return fieldImportance[a] - fieldImportance[b];
      if (colSort === 'density-desc') return fieldImportance[b] - fieldImportance[a];
      return 0;
    });

    const margin = { top: 120, right: 30, bottom: 30, left: 150 };
    const minCellSize = 30;
    const minWidth = fields.length * minCellSize;
    
    // Calculate available width for the grid
    const availableWidth = containerWidth > 0 ? containerWidth - margin.left - margin.right - 32 : minWidth; // -32 for padding
    
    // Use the larger of minWidth or availableWidth
    const width = Math.max(minWidth, availableWidth);
    
    // Calculate actual cell sizes based on the final width
    const cellWidth = width / Math.max(1, fields.length);
    const cellHeight = Math.max(30, Math.min(60, cellWidth)); // Keep height reasonable
    
    const height = types.length * cellHeight;

    const container = d3.select(containerRef.current);
    container.selectAll('*').remove();

    const svg = container
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom);

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 5])
      .on('zoom', (event) => {
        g.attr('transform', `translate(${margin.left + event.transform.x},${margin.top + event.transform.y}) scale(${event.transform.k})`);
      });

    svg.call(zoom);

    const x = d3.scaleBand()
      .range([0, width])
      .domain(fields)
      .padding(0.05);

    const y = d3.scaleBand()
      .range([0, height])
      .domain(types)
      .padding(0.05);

    const colorScale = d3.scaleLinear<string>()
      .domain([0, 50, 100])
      .range([store.heatmapColors.low, store.heatmapColors.medium, store.heatmapColors.high]);

    // Add X axis
    g.append('g')
      .attr('transform', `translate(0, -10)`)
      .call(d3.axisTop(x).tickSize(0))
      .selectAll('text')
      .attr('transform', 'rotate(-45)')
      .style('text-anchor', 'start')
      .style('font-size', '12px')
      .style('fill', 'currentColor')
      .attr('class', 'text-zinc-600 dark:text-zinc-400')
      .text((d: any) => d.length > 15 ? d.substring(0, 15) + '...' : d);

    // Add Y axis
    g.append('g')
      .call(d3.axisLeft(y).tickSize(0))
      .selectAll('text')
      .style('font-size', '12px')
      .style('fill', 'currentColor')
      .attr('class', 'text-zinc-600 dark:text-zinc-400')
      .text((d: any) => d.length > 20 ? d.substring(0, 20) + '...' : d);

    g.select('.domain').remove();
    g.selectAll('.tick line').remove();

    // Add cells
    types.forEach(type => {
      fields.forEach(field => {
        const density = data[type][field];
        if (density === undefined) return;

        g.append('rect')
          .attr('x', x(field)!)
          .attr('y', y(type)!)
          .attr('width', x.bandwidth())
          .attr('height', y.bandwidth())
          .style('fill', colorScale(density))
          .style('stroke', 'rgba(0,0,0,0.1)')
          .style('stroke-width', 1)
          .attr('rx', 4)
          .attr('ry', 4)
          .style('cursor', 'pointer')
          .on('mouseover', (event) => {
            d3.select(event.currentTarget)
              .style('stroke', '#000')
              .style('stroke-width', 2);
              
            let validCount = 0;
            let totalCount = 0;
            if (sampleData && sampleData[type]) {
              totalCount = sampleData[type].length;
              validCount = sampleData[type].filter(item => {
                const val = item[field];
                if (val !== null && val !== undefined && val !== '') {
                  if (Array.isArray(val) && val.length === 0) return false;
                  return true;
                }
                return false;
              }).length;
            }

            setTooltipInfo({
              x: event.clientX,
              y: event.clientY,
              type,
              field,
              density,
              fieldImportance: fieldImportance[field],
              validCount: sampleData ? validCount : undefined,
              totalCount: sampleData ? totalCount : undefined,
              visible: true,
            });
          })
          .on('mousemove', (event) => {
            setTooltipInfo(prev => ({
              ...prev,
              x: event.clientX,
              y: event.clientY,
            }));
          })
          .on('mouseleave', (event) => {
            d3.select(event.currentTarget)
              .style('stroke', 'rgba(0,0,0,0.1)')
              .style('stroke-width', 1);
            setTooltipInfo(prev => ({ ...prev, visible: false }));
          })
          .on('click', () => {
            onCellClick(type, field);
          });
      });
    });

  }, [data, onCellClick, rowSort, colSort, store.heatmapColors, containerWidth]);

  if (Object.keys(data).length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-zinc-500">
        No data to display. Select types and fetch data.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 h-full min-h-0">
      <div className="flex items-center gap-4 bg-zinc-50 dark:bg-zinc-900 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 shrink-0">
        <div className="flex items-center gap-2">
          <Label className="text-xs text-zinc-500 whitespace-nowrap">Sort Rows (Types):</Label>
          <Select value={rowSort} onValueChange={(v: any) => setRowSort(v)}>
            <SelectTrigger className="h-8 w-[140px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name-asc">Name (A-Z)</SelectItem>
              <SelectItem value="name-desc">Name (Z-A)</SelectItem>
              <SelectItem value="density-desc">Density (High-Low)</SelectItem>
              <SelectItem value="density-asc">Density (Low-High)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-zinc-500 whitespace-nowrap">Sort Cols (Fields):</Label>
          <Select value={colSort} onValueChange={(v: any) => setColSort(v)}>
            <SelectTrigger className="h-8 w-[140px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name-asc">Name (A-Z)</SelectItem>
              <SelectItem value="name-desc">Name (Z-A)</SelectItem>
              <SelectItem value="density-desc">Importance (High-Low)</SelectItem>
              <SelectItem value="density-asc">Importance (Low-High)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="relative overflow-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 p-4 flex-1 min-h-0">
        <div ref={containerRef} className="min-w-max min-h-max" />
        
        {tooltipInfo.visible && (
          <div
            className="pointer-events-none fixed z-50 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm shadow-md dark:border-zinc-800 dark:bg-zinc-950"
            style={{
              left: tooltipInfo.x + 15 > window.innerWidth - 250 ? tooltipInfo.x - 250 : tooltipInfo.x + 15,
              top: tooltipInfo.y + 15 > window.innerHeight - 150 ? tooltipInfo.y - 150 : tooltipInfo.y + 15,
            }}
          >
            <div className="font-semibold">{tooltipInfo.type} . {tooltipInfo.field}</div>
            <div className="text-zinc-500 dark:text-zinc-400 mt-1">
              Density: <span className="font-medium text-zinc-900 dark:text-zinc-50">{tooltipInfo.density.toFixed(1)}%</span>
            </div>
            {tooltipInfo.fieldImportance !== undefined && (
              <div className="text-zinc-500 dark:text-zinc-400">
                Field Importance: <span className="font-medium text-zinc-900 dark:text-zinc-50">{tooltipInfo.fieldImportance.toFixed(1)}%</span>
              </div>
            )}
            {tooltipInfo.totalCount !== undefined && (
              <div className="text-zinc-500 dark:text-zinc-400 mt-1 pt-1 border-t border-zinc-200 dark:border-zinc-800">
                Valid Samples: <span className="font-medium text-zinc-900 dark:text-zinc-50">{tooltipInfo.validCount} / {tooltipInfo.totalCount}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
