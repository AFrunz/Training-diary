import { router } from 'expo-router'
import { WorkoutsScreen } from '../../src/ui/screens/workouts/WorkoutsScreen'

export default function WorkoutsTab() {
  return (
    <WorkoutsScreen
      onOpenWorkout={(workoutId) => router.push(`/workout/${workoutId}`)}
      onCreateWorkout={() => router.push('/workout/new')}
    />
  )
}
