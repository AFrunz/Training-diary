import { router, useLocalSearchParams } from 'expo-router'
import { localDate } from '../../src/domain/model/types'
import { NewWorkoutScreen } from '../../src/ui/screens/workout/NewWorkoutScreen'

/** Дату можно передать параметром: календарь ведёт сюда с выбранным днём. */
const today = () => localDate(new Date().toISOString().slice(0, 10))

export default function NewWorkoutRoute() {
  const { date } = useLocalSearchParams<{ date?: string }>()
  return (
    <NewWorkoutScreen
      date={date ? localDate(date) : today()}
      onBack={() => router.back()}
      onCreated={(workoutId) => router.replace(`/workout/${workoutId}`)}
      onOpenExisting={(workoutId) => router.replace(`/workout/${workoutId}`)}
    />
  )
}
