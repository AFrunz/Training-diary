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
  renameProgram,
  setProgramItems,
  suggestProgramColor,
} from './usecases/library'
import { seedPresetExercises } from './usecases/seed'
import { monthStats, yearStats } from './usecases/stats'
import {
  addAdHocExercise,
  addSet,
  createWorkout,
  deleteSet,
  deleteWorkout,
  editSet,
  editWorkoutTimes,
  previousSets,
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
  editSet: editSet(ports),
  deleteSet: deleteSet(ports),
  toggleItemDone: toggleItemDone(ports),
  addAdHocExercise: addAdHocExercise(ports),
  editWorkoutTimes: editWorkoutTimes(ports),
  deleteWorkout: deleteWorkout(ports),
  suggestNextSet: suggestNextSet(ports),
  previousSets: previousSets(ports),

  createExercise: createExercise(ports),
  removeExercise: removeExercise(ports),
  createProgram: createProgram(ports),
  duplicateProgram: duplicateProgram(ports),
  renameProgram: renameProgram(ports),
  setProgramItems: setProgramItems(ports),
  archiveProgram: archiveProgram(ports),
  suggestProgramColor: suggestProgramColor(ports),

  seedPresetExercises: seedPresetExercises(ports),

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
