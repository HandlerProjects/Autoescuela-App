export type PracticeType = 'car' | 'truck'
export type PracticeSubtype = 'pista' | 'circulacion'
export type BookingStatus = 'confirmed' | 'cancelled' | 'completed'

export interface Instructor {
  id: string
  email: string
  name: string
  created_at: string
}

export interface Student {
  id: string
  instructor_id: string
  dni: string
  full_name: string
  order_number: number
  token: string
  practice_types: PracticeType[]
  phone: string | null
  is_active: boolean
  created_at: string
}

export interface Booking {
  id: string
  student_id: string
  instructor_id: string
  practice_date: string
  start_time: string
  end_time: string
  practice_type: PracticeType
  practice_subtype: PracticeSubtype | null
  status: BookingStatus
  notes: string | null
  created_at: string
  // join
  student?: Student
}

export interface TimeSlot {
  start: string
  end: string
  available: boolean
}

export interface WaitlistEntry {
  id: string
  student_id: string
  instructor_id: string
  practice_type: PracticeType
  requested_at: string
  position: number
  student?: Student
}