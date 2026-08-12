import { router, useLocalSearchParams } from 'expo-router'
import { id as makeId } from '../../src/domain/model/types'
import { WorkoutScreen } from '../../src/ui/screens/workout/WorkoutScreen'

export default function WorkoutRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return (
    <WorkoutScreen
      workoutId={makeId(id)}
      onBack={() => router.back()}
      onOpenHistory={(exerciseId) => router.push(`/exercise/${exerciseId}`)}
    />
  )
}
