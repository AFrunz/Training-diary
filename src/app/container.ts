import type { Ports } from './ports'
import { createAbsence, deleteAbsence } from './usecases/absences'
import { exportToFile, importFromFile, restoreBackup, runBackup, wipeAllData } from './usecases/backup'
import { exportAll, importAll } from './usecases/data'
import {
  archiveProgram,
  createExercise,
  createProgram,
  duplicateProgram,
  removeExercise,
  setProgramItems,
  suggestProgramColor,
} from './usecases/library'
import { monthStats, yearStats } from './usecases/stats'
import {
  addAdHocExercise,
  addSet,
  createWorkout,
  deleteWorkout,
  editWorkoutTimes,
  suggestNextSet,
  toggleItemDone,
} from './usecases/workouts'

/**
 * Композиционный корень: связывает порты со сценариями. Интерфейс получает
 * готовый набор функций и не знает ни про SQLite, ни про то, как устроены порты.
 */
export const createServices = (ports: Ports) => ({
  ports,

  createWorkout: createWorkout(ports),
  addSet: addSet(ports),
  toggleItemDone: toggleItemDone(ports),
  addAdHocExercise: addAdHocExercise(ports),
  editWorkoutTimes: editWorkoutTimes(ports),
  deleteWorkout: deleteWorkout(ports),
  suggestNextSet: suggestNextSet(ports),

  createExercise: createExercise(ports),
  removeExercise: removeExercise(ports),
  createProgram: createProgram(ports),
  duplicateProgram: duplicateProgram(ports),
  setProgramItems: setProgramItems(ports),
  archiveProgram: archiveProgram(ports),
  suggestProgramColor: suggestProgramColor(ports),

  createAbsence: createAbsence(ports),
  deleteAbsence: deleteAbsence(ports),

  monthStats: monthStats(ports),
  yearStats: yearStats(ports),
  exportAll: exportAll(ports),
  importAll: importAll(ports),
  exportToFile: exportToFile(ports),
  importFromFile: importFromFile(ports),
  runBackup: runBackup(ports),
  restoreBackup: restoreBackup(ports),
  wipeAllData: wipeAllData(ports),
})

export type Services = ReturnType<typeof createServices>
