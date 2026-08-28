import type { WalletKey, WalletSummary } from "../types";
import WalletCard from "./wallet-card";

/**
 * Deretan kartu saldo dompet — tanpa judul sendiri: header halaman ("Arus kas"
 * + nama project) sudah menjadi judul bagian ini, jadi menambah heading kedua
 * hanya mengulang hal yang sama.
 */
export default function WalletGrid({
  wallets,
  selectedWallet,
  onSelectWallet,
}: {
  wallets: WalletSummary[];
  selectedWallet: WalletKey | "all";
  onSelectWallet: (value: WalletKey | "all") => void;
}) {
  return (
    <div className="-mx-1 overflow-x-auto pb-2 scroll-smooth overscroll-x-contain snap-x snap-mandatory scroll-px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="grid min-w-full grid-flow-col auto-cols-[min(92vw,430px)] gap-4 px-1 sm:auto-cols-[450px] xl:auto-cols-[470px]">
        {wallets.map((wallet) => (
          <WalletCard
            key={wallet.walletKey}
            wallet={wallet}
            active={selectedWallet === wallet.walletKey}
            onClick={() =>
              onSelectWallet(
                selectedWallet === wallet.walletKey ? "all" : wallet.walletKey
              )
            }
          />
        ))}
      </div>
    </div>
  );
}
