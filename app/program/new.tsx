import { router } from 'expo-router'
import { NewProgramScreen } from '../../src/ui/screens/library/NewProgramScreen'

export default function NewProgramRoute() {
  return (
    <NewProgramScreen
      onBack={() => router.back()}
      onCreated={(programId) => router.replace(`/program/${programId}`)}
      onCreateExercise={() => router.push('/exercise/new')}
    />
  )
}
