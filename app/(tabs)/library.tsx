import { router } from 'expo-router'
import { LibraryScreen } from '../../src/ui/screens/library/LibraryScreen'

export default function LibraryTab() {
  return (
    <LibraryScreen
      onCreateExercise={() => router.push('/exercise/new')}
      onCreateProgram={() => router.push('/program/new')}
      onOpenExercise={(id) => router.push(`/exercise/${id}`)}
      onOpenProgram={(id) => router.push(`/program/${id}`)}
    />
  )
}
