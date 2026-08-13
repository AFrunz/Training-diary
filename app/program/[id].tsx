import { Screen } from "../../src/ui/components/Screen";
import { router, useLocalSearchParams } from "expo-router";
import { id as makeId } from "../../src/domain/model/types";
import { ProgramScreen } from "../../src/ui/screens/program/ProgramScreen";

export default function ProgramRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <Screen>
      <ProgramScreen
        programId={makeId(id)}
        onBack={() => router.back()}
        onDuplicate={() => router.push(`/program/new?from=${id}`)}
        onArchived={() => router.back()}
      />
    </Screen>
  );
}
