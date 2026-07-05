import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { getProjectFundDetail } from "./lib/get-project-fund-detail";
import ManageFundScreen from "./components/manage-fund-screen";

export default async function ManageFundPage({
  params,
}: {
  params: { id_project: string };
}) {
  const session = await getServerSession(authOptions);
  const currentAgentId = (session?.user as any)?.agentId ?? null;

  const data = await getProjectFundDetail(params.id_project, currentAgentId);

  if (!data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-slate-400">
        Project tidak ditemukan.
      </div>
    );
  }

  const isCreator = Boolean(
    currentAgentId && data.project.dibuat_oleh === currentAgentId
  );

  return <ManageFundScreen data={data} isCreator={isCreator} />;
}
