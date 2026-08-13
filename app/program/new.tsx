import { Screen } from "../../src/ui/components/Screen";
import { router, useLocalSearchParams } from "expo-router";
import { id as makeId } from "../../src/domain/model/types";
import { NewProgramScreen } from "../../src/ui/screens/library/NewProgramScreen";

/** `from` приходит с экрана программы: это дублирование, а не пустая форма. */
export default function NewProgramRoute() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  return (
    <Screen>
      <NewProgramScreen
        {...(from ? { sourceProgramId: makeId(from) } : {})}
        onBack={() => router.back()}
        onCreated={(programId) => router.replace(`/program/${programId}`)}
        onCreateExercise={() => router.push("/exercise/new")}
      />
    </Screen>
  );
}
