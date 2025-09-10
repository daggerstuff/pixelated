export interface TherapistSession {
  id: string;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  startTime: Date;
  endTime?: Date;
}
