import { useMemo, useState } from 'react';
import type { DragEvent } from 'react';
import { SeatType } from '../types/booking';

export const DEFAULT_ROWS = 10;
export const DEFAULT_COLUMNS = 14;
export const MIN_GRID = 4;
export const MAX_GRID = 26;

type SeatCell = {
  id: string;
  type: SeatType | null;
};

type SeatCounts = {
  normal: number;
  vip: number;
  total: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export const getRowLabel = (index: number) => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (index < alphabet.length) {
    return alphabet[index];
  }
  const first = Math.floor(index / alphabet.length) - 1;
  const second = index % alphabet.length;
  return `${alphabet[first]}${alphabet[second]}`;
};

const buildGrid = (rows: number, columns: number, previous?: SeatCell[][]): SeatCell[][] =>
  Array.from({ length: rows }, (_, rowIndex) =>
    Array.from({ length: columns }, (_, colIndex) => {
      const existing = previous?.[rowIndex]?.[colIndex];
      return {
        id: existing?.id ?? `seat-${rowIndex}-${colIndex}`,
        type: existing?.type ?? null,
      };
    })
  );

export const useSeatConfigurator = () => {
  const [rows, setRows] = useState(DEFAULT_ROWS);
  const [columns, setColumns] = useState(DEFAULT_COLUMNS);
  const [activeTool, setActiveTool] = useState<SeatType>('normal');
  const [grid, setGrid] = useState<SeatCell[][]>(() => buildGrid(DEFAULT_ROWS, DEFAULT_COLUMNS));

  const seatCounts = useMemo<SeatCounts>(() => {
    let normal = 0;
    let vip = 0;
    grid.forEach((row) =>
      row.forEach((cell) => {
        if (cell.type === 'normal') {
          normal += 1;
        } else if (cell.type === 'vip') {
          vip += 1;
        }
      })
    );
    return { normal, vip, total: normal + vip };
  }, [grid]);

  const updateGridSize = (nextRows: number, nextColumns: number) => {
    const safeRows = clamp(nextRows, MIN_GRID, MAX_GRID);
    const safeColumns = clamp(nextColumns, MIN_GRID, MAX_GRID);
    setRows(safeRows);
    setColumns(safeColumns);
    setGrid((prev) => buildGrid(safeRows, safeColumns, prev));
  };

  const handleCellUpdate = (rowIndex: number, colIndex: number, nextType: SeatType) => {
    setGrid((prev) => {
      const nextGrid = prev.map((row) => row.map((cell) => ({ ...cell })));
      const cell = nextGrid[rowIndex][colIndex];
      cell.type = cell.type === nextType ? null : nextType;
      return nextGrid;
    });
  };

  const handleDrop = (rowIndex: number, colIndex: number, event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const data = event.dataTransfer.getData('seat-type');
    if (data === 'normal' || data === 'vip') {
      setGrid((prev) => {
        const nextGrid = prev.map((row) => row.map((cell) => ({ ...cell })));
        nextGrid[rowIndex][colIndex].type = data;
        return nextGrid;
      });
    }
  };

  const handleDragOver = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
  };

  const clearGrid = () => {
    setGrid((prev) => prev.map((row) => row.map((cell) => ({ ...cell, type: null }))));
  };

  return {
    rows,
    columns,
    activeTool,
    grid,
    seatCounts,
    setActiveTool,
    updateGridSize,
    handleCellUpdate,
    handleDrop,
    handleDragOver,
    clearGrid,
  };
};

export type { SeatCell, SeatCounts };
