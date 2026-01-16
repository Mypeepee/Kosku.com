export const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };
  
  export const getFacilityIcon = (fac: string) => {
    const f = fac.toLowerCase();
    if (f.includes("wifi")) return "solar:wi-fi-router-bold";
    if (f.includes("ac")) return "solar:snowflake-bold";
    if (f.includes("bath")) return "solar:bath-bold";
    if (f.includes("pool")) return "solar:waterdrops-bold";
    if (f.includes("gym")) return "solar:dumbbell-large-bold";
    if (f.includes("tv")) return "solar:tv-bold";
    if (f.includes("kitchen")) return "solar:chef-hat-bold";
    if (f.includes("desk")) return "solar:chair-2-bold";
    return "solar:box-bold";
  };
  
  export const getTypeColor = (type: string) => {
    if (type === "Studio") return "bg-blue-500/20 text-blue-300 border-blue-500/30";
    if (type === "2BR") return "bg-purple-500/20 text-purple-300 border-purple-500/30";
    if (type === "3BR") return "bg-yellow-500/20 text-yellow-300 border-yellow-500/30";
    return "bg-green-500/20 text-green-300 border-green-500/30";
  };
  
  // Date Helpers
  export const daysInMonth = (month: number, year: number) => new Date(year, month + 1, 0).getDate();
  export const firstDayOfMonth = (month: number, year: number) => new Date(year, month, 1).getDay(); 
  export const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];