import { PricingTable } from "@resonant-projects/clerk-solidjs";

export default function Pricing() {
  return (
    <div class="flex w-screen h-screen items-center justify-center">
      <PricingTable fallback={<p>Loading plans...</p>} />
    </div>
  );
}
