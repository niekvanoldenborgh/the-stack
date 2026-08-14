import { Display, EmptyState, Screen } from '../../src/ui/components';

export default function CalendarScreen() {
  return (
    <Screen>
      <Display>Calendar</Display>
      <EmptyState title="Nothing here yet" body="Your schedule will live here." />
    </Screen>
  );
}
