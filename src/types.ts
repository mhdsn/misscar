export interface InsurancePolicy {
  id: string;
  ownerName: string;
  carBrand: string;
  carModel: string;
  licensePlate: string;
  startDate: string;
  endDate: string;
  reminderDays?: number;
  clientEmail?: string;
  notificationSent?: boolean;
  createdAt: number;
  userId: string;
}
