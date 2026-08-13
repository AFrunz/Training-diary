import { router, useLocalSearchParams } from 'expo-router'
import { id as makeId } from '../../src/domain/model/types'
import { Screen } from '../../src/ui/components/Screen'
import { ExerciseHistoryScreen } from '../../src/ui/screens/exerciseHistory/ExerciseHistoryScreen'

export default function ExerciseHistoryRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return (
    <Screen>
      <ExerciseHistoryScreen exerciseId={makeId(id)} onBack={() => router.back()} />
    </Screen>
  )
}
