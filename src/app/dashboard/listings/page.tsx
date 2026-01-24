// app/dashboard/listings/page.tsx
import ListingsPage from "./components/listings-page";
import { fetchListingHeaderStats } from "./lib/property-stats";

// TODO: nanti ambil dari session (id_agent dari user yang login)
const MOCK_AGENT_ID = "AGT-001";

export default async function DashboardListingsPage() {
  const headerStats = await fetchListingHeaderStats(MOCK_AGENT_ID);

  return <ListingsPage headerStats={headerStats} />;
}
