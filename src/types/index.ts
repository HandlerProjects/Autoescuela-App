export type PracticeType = 'car' | 'truck'
export type PracticeSubtype = 'pista' | 'circulacion'
export type BookingStatus = 'confirmed' | 'cancelled' | 'completed'
export type ExamType = 'theory' | 'practical'
export type ExamResult = 'passed' | 'failed' | 'pending'
export type PaymentStatus = 'pending' | 'paid'

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
  email: string | null
  is_active: boolean
  max_concurrent_bookings: number
  alert_days_inactive: number
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
  confirmed_by_student: boolean
  no_show: boolean
  notes: string | null
  calendar_event_id: string | null
  created_at: string
  student?: Student
}

export interface BlockedDay {
  id: string
  instructor_id: string
  date: string
  reason: string | null
  created_at: string
}

export interface Exam {
  id: string
  student_id: string
  instructor_id: string
  exam_type: ExamType
  exam_date: string
  result: ExamResult
  attempt_number: number
  notes: string | null
  created_at: string
  student?: Student
}

export interface Payment {
  id: string
  student_id: string
  instructor_id: string
  amount: number
  concept: string
  status: PaymentStatus
  due_date: string | null
  paid_at: string | null
  notes: string | null
  created_at: string
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