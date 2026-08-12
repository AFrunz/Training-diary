import { router, useLocalSearchParams } from 'expo-router'
import { id as makeId } from '../../src/domain/model/types'
import { ExerciseHistoryScreen } from '../../src/ui/screens/exerciseHistory/ExerciseHistoryScreen'

export default function ExerciseHistoryRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <ExerciseHistoryScreen exerciseId={makeId(id)} onBack={() => router.back()} />
}
