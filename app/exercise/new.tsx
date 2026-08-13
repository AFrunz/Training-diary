import { router } from 'expo-router'
import { Screen } from '../../src/ui/components/Screen'
import { NewExerciseScreen } from '../../src/ui/screens/library/NewExerciseScreen'

export default function NewExerciseRoute() {
  return (
    <Screen>
      <NewExerciseScreen onBack={() => router.back()} onCreated={() => router.back()} />
    </Screen>
  )
}
