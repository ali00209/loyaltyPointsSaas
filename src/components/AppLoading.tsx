import { Center, Spinner } from "@astryxdesign/core";

export default function AppLoading({ label }: { label: string }) {
  return (
    <Center axis="both" className="min-h-dvh">
      <Spinner size="lg" label={label} />
    </Center>
  );
}
