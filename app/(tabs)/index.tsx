import { Screen } from "../../src/ui/components/Screen";
import { router } from "expo-router";
import { CalendarScreen } from "../../src/ui/screens/calendar/CalendarScreen";

export default function CalendarTab() {
  return (
    <Screen withBottomInset={false}>
      <CalendarScreen
        onContinueWorkout={(workoutId) => router.push(`/workout/${workoutId}`)}
        onOpenDay={(date) => router.push(`/workout/new?date=${date}`)}
        onAddAbsence={(date) => router.push(`/absence/new?date=${date}`)}
        onCreateWorkout={(date) => router.push(`/workout/new?date=${date}`)}
      />
    </Screen>
  );
}
