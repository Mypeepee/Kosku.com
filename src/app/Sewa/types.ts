export interface Apartment {
    id: number;
    name: string;
    location: string;
    price: number;
    period: string;
    rating: number;
    reviews: number;
    type: string;
    furnish: string;
    provider: "Kosku Managed" | "Direct Owner";
    image: string;
    isVerified: boolean;
    isPromo?: boolean;
    sisaKamar: number;
    facilities: string[];
  }
  
  export interface DateRange {
    startDate: number | null;
    endDate: number | null;
    startMonth: string;
    endMonth: string;
  }