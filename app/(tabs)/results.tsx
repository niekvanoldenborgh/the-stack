import { Display, EmptyState, Screen } from '../../src/ui/components';

export default function ResultsScreen() {
  return (
    <Screen>
      <Display>Results</Display>
      <EmptyState title="Nothing here yet" body="Goal tracking will live here." />
    </Screen>
  );
}
