import { useCallback, useMemo, useState } from 'react';
import type { DragEndEvent } from '@dnd-kit/core';
import { SeatType } from '../types/booking';
import { adminService } from '../services/adminService';
import {
  SeatCell,
  getRowLabel,
  buildGrid,
  mapSeatsToGrid,
} from '../utils/seatGridUtils';

export const DEFAULT_ROWS = 10;
export const DEFAULT_COLUMNS = 14;
export const MIN_GRID = 4;
export const MAX_GRID = 26;

export type { SeatCell };
export { getRowLabel };

export type SeatCounts = {
  standard: number;
  vip: number;
  couple: number;
  total: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export const useSeatConfigurator = (
  cinemaId?: string, 
  roomId?: string,
  initialRows?: number,
  initialColumns?: number
) => {
  const [rows, setRows] = useState(initialRows || DEFAULT_ROWS);
  const [columns, setColumns] = useState(initialColumns || DEFAULT_COLUMNS);
  const [activeTool, setActiveTool] = useState<SeatType>('standard');
  const [grid, setGrid] = useState<SeatCell[][]>(() => buildGrid(initialRows || DEFAULT_ROWS, initialColumns || DEFAULT_COLUMNS));
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const loadGrid = useCallback(async () => {
    if (!cinemaId || !roomId) return;
    setIsLoading(true);
    try {
      const seats = await adminService.getRoomSeatMap(cinemaId, roomId);
      const { rows: newRows, columns: newCols, grid: newGrid } = mapSeatsToGrid(
        seats,
        initialRows,
        initialColumns,
        DEFAULT_ROWS,
        DEFAULT_COLUMNS
      );
      setRows(newRows);
      setColumns(newCols);
      setGrid(newGrid);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [cinemaId, roomId, initialRows, initialColumns]);

  const saveGrid = useCallback(async () => {
    if (!cinemaId || !roomId) return;
    setIsSaving(true);
    try {
      const seatsToSave: any[] = [];
      grid.forEach((row, rIndex) => {
        row.forEach((cell, cIndex) => {
          if (cell.type) {
            seatsToSave.push({
              rowLabel: getRowLabel(rIndex),
              columnNumber: cIndex + 1,
              seatTypeCode: cell.type.toUpperCase()
            });
          }
        });
      });
      await adminService.updateRoomSeatMap(cinemaId, roomId, {
        rows,
        columns,
        seats: seatsToSave
      });
      alert('Seat configuration saved successfully!');
    } catch (e) {
      console.error(e);
      alert('Failed to save configuration.');
    } finally {
      setIsSaving(false);
    }
  }, [cinemaId, roomId, grid, rows, columns]);

  const seatCounts = useMemo<SeatCounts>(() => {
    let standard = 0, vip = 0, couple = 0;
    grid.forEach((row) =>
      row.forEach((cell) => {
        if (cell.type === 'standard') standard += 1;
        else if (cell.type === 'vip') vip += 1;
        else if (cell.type === 'couple') couple += 1;
      })
    );
    return { standard, vip, couple, total: standard + vip + couple };
  }, [grid]);

  const updateGridSize = (nextRows: number, nextColumns: number) => {
    const safeRows = clamp(nextRows, MIN_GRID, MAX_GRID);
    const safeColumns = clamp(nextColumns, MIN_GRID, MAX_GRID);
    setRows(safeRows);
    setColumns(safeColumns);
    setGrid((prev) => buildGrid(safeRows, safeColumns, prev));
  };

  const applyToolToCell = (rowIndex: number, colIndex: number, tool: SeatType, currentGrid: SeatCell[][]) => {
    const nextGrid = currentGrid.map((row) => row.map((cell) => ({ ...cell })));
    const cell = nextGrid[rowIndex][colIndex];
    
    if (cell.type === 'couple' && colIndex + 1 < columns) {
      nextGrid[rowIndex][colIndex + 1].coveredByLeft = false;
    }
    if (cell.coveredByLeft && colIndex > 0) {
      nextGrid[rowIndex][colIndex - 1].type = null;
      cell.coveredByLeft = false;
    }

    if (cell.type === tool) {
      cell.type = null;
      return nextGrid;
    }

    if (tool === 'couple') {
      if (colIndex + 1 >= columns) return currentGrid; 
      const rightCell = nextGrid[rowIndex][colIndex + 1];
      if (rightCell.type === 'couple') {
         if (colIndex + 2 < columns) {
           nextGrid[rowIndex][colIndex + 2].coveredByLeft = false;
         }
      }
      rightCell.type = null;
      rightCell.coveredByLeft = true;
    }

    cell.type = tool;
    return nextGrid;
  };

  const handleCellUpdate = (rowIndex: number, colIndex: number, nextType: SeatType) => {
    setGrid(prev => applyToolToCell(rowIndex, colIndex, nextType, prev));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    
    const tool = active.id as SeatType;
    if (tool !== 'standard' && tool !== 'vip' && tool !== 'couple') return;
    
    const [rowStr, colStr] = String(over.id).split('-');
    const rowIndex = parseInt(rowStr, 10);
    const colIndex = parseInt(colStr, 10);
    
    if (!isNaN(rowIndex) && !isNaN(colIndex)) {
      setGrid(prev => applyToolToCell(rowIndex, colIndex, tool, prev));
    }
  };

  const clearGrid = () => {
    setGrid((prev) => prev.map((row) => row.map((cell) => ({ ...cell, type: null, coveredByLeft: false }))));
  };

  return {
    rows,
    columns,
    activeTool,
    grid,
    seatCounts,
    isLoading,
    isSaving,
    setActiveTool,
    updateGridSize,
    handleCellUpdate,
    handleDragEnd,
    clearGrid,
    loadGrid,
    saveGrid,
  };
};
