import { PricingTable } from "@resonant-projects/clerk-solidjs";

export default function Pricing() {
  return (
    <main>
      <PricingTable fallback={<p>Loading plans...</p>} />
    </main>
  );
}
