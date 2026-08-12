import { Screen } from "../../src/ui/components/Screen";
import { router } from "expo-router";
import { NewExerciseScreen } from "../../src/ui/screens/library/NewExerciseScreen";

export default function NewExerciseRoute() {
  return (
    <NewExerciseScreen
      onBack={() => router.back()}
      onCreated={() => router.back()}
    />
  );
}
