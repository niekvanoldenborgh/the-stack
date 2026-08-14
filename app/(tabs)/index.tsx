import { Display, EmptyState, Screen } from '../../src/ui/components';

export default function SummaryScreen() {
  return (
    <Screen>
      <Display>Summary</Display>
      <EmptyState title="Nothing here yet" body="Your daily overview will live here." />
    </Screen>
  );
}
