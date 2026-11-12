import { v } from './physics'
import type { Board, Vec } from './physics'

export const CELL_SIZE = 112
export const WALL_RADIUS = 12

interface Cell {
  center: Vec
  neighbors: readonly number[]
}

export interface Maze {
  columns: number
  cells: readonly Cell[]
  chaseRange: number
}

// A space between cells is a doorway. The same boundaries define the
// navigation links and the collision walls, including closed junctions.
export function buildMaze(layout: readonly string[], chaseRange: number) {
  const columns = (layout[0].length - 1) / 4
  const rows = (layout.length - 1) / 2
  const horizontal = (x: number, y: number) => layout[2 * y][4 * x + 2] === '-'
  const vertical = (x: number, y: number) => layout[2 * y + 1][4 * x] === '|'
  const cells: Cell[] = []
  const boards: Board[] = []
  const markers = new Map<string, Vec[]>()

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
      const index = y * columns + x
      const center = v((x + .5) * CELL_SIZE, (y + .5) * CELL_SIZE)
      const neighbors: number[] = []
      if (!horizontal(x, y)) neighbors.push(index - columns)
      if (!vertical(x + 1, y)) neighbors.push(index + 1)
      if (!horizontal(x, y + 1)) neighbors.push(index + columns)
      if (!vertical(x, y)) neighbors.push(index - 1)
      cells.push({ center, neighbors })

      const marker = layout[2 * y + 1][4 * x + 2]
      if (marker !== ' ') {
        const points = markers.get(marker) ?? []
        points.push(center)
        markers.set(marker, points)
      }
    }
  }

  const addWalls = (count: number, closed: (i: number) => boolean, point: (i: number) => Vec) => {
    for (let start = 0; start < count;) {
      if (!closed(start)) {
        start++
        continue
      }
      let end = start + 1
      while (end < count && closed(end)) end++
      boards.push({ a: point(start), b: point(end), radius: WALL_RADIUS, tone: 0 })
      start = end
    }
  }

  for (let y = 0; y <= rows; y++) {
    addWalls(columns, x => horizontal(x, y), x => v(x * CELL_SIZE, y * CELL_SIZE))
  }
  for (let x = 0; x <= columns; x++) {
    addWalls(rows, y => vertical(x, y), y => v(x * CELL_SIZE, y * CELL_SIZE))
  }
  const maze: Maze = { columns, cells, chaseRange }
  return { maze, boards, markers }
}

export function cellAt(maze: Maze, position: Vec) {
  return Math.floor(position.y / CELL_SIZE) * maze.columns + Math.floor(position.x / CELL_SIZE)
}

export function mazeDistances(maze: Maze, target: number, limit = Infinity) {
  const distance = Array<number>(maze.cells.length).fill(-1)
  distance[target] = 0
  const queue = [target]
  for (const index of queue) {
    if (distance[index] >= limit) continue
    for (const neighbor of maze.cells[index].neighbors) {
      if (distance[neighbor] >= 0) continue
      distance[neighbor] = distance[index] + 1
      queue.push(neighbor)
    }
  }
  return distance
}
