import { Screen } from "../../src/ui/components/Screen";
import { router, useLocalSearchParams } from "expo-router";
import { localDate } from "../../src/domain/model/types";
import { NewAbsenceScreen } from "../../src/ui/screens/absence/NewAbsenceScreen";

const today = () => localDate(new Date().toISOString().slice(0, 10));

export default function NewAbsenceRoute() {
  const { date } = useLocalSearchParams<{ date?: string }>();
  return (
    <Screen>
      <NewAbsenceScreen
        date={date ? localDate(date) : today()}
        onBack={() => router.back()}
        onCreated={() => router.back()}
      />
    </Screen>
  );
}
