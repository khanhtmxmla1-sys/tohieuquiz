/**
 * Live Exam Types
 * 
 * Types for Live Exam Session feature - synchronized real-time exams.
 * Related: CONTEXT.md, ADR-0001 (Polling), ADR-0002 (Question Order)
 */

/**
 * Live Exam Session Status
 * State machine: scheduled → waiting → active → scoring → closed
 */
export enum LiveExamStatus {
  SCHEDULED = 'scheduled',  // Created but not started yet
  WAITING = 'waiting',      // Teacher opened, students joining
  ACTIVE = 'active',        // Exam in progress, timer running
  SCORING = 'scoring',      // Time expired, calculating scores
  CLOSED = 'closed',        // Results revealed to students
}

/**
 * Live Exam Session Settings
 */
export interface LiveExamSettings {
  randomizeAnswers: boolean;      // Shuffle answer options per student
  showLeaderboard: boolean;       // Show live leaderboard during exam
  allowLateJoin: boolean;         // Can students join after start?
  passingScore?: number;          // Optional passing threshold (0-100)
}

/**
 * Live Exam Session
 * Main entity representing a synchronized exam session
 */
export interface LiveExamSession {
  id: string;
  title: string;
  quizId: string;
  teacherId: string;
  classId: string;
  className?: string;
  quizTitle?: string;
  participantCount?: number;
  submittedCount?: number;
  averageScore?: number;
  archivedAt?: string;
  
  // Timing
  duration: number;                // Duration in minutes
  scheduledAt?: string;            // ISO 8601 timestamp (optional)
  startedAt?: string;              // When exam actually started
  endsAt?: string;                 // Calculated: startedAt + duration
  closedAt?: string;               // When teacher/system closed session
  
  // Settings
  settings: LiveExamSettings;
  
  // State
  status: LiveExamStatus;
  
  // Access
  accessCode: string;              // 6-digit code (e.g., "ABC123")
  
  // Metadata
  createdAt: string;
  updatedAt: string;
}

/**
 * Student Answers
 * Map of question ID to selected answer
 */
export interface StudentAnswers {
  [questionId: string]: string;    // questionId → selected option ("A", "B", etc.)
}

/**
 * Anti-cheat Warning
 */
export interface AntiCheatWarning {
  type: 'tab_switch' | 'fullscreen_exit' | 'suspicious_timing';
  timestamp: string;               // ISO 8601
  details?: string;
}

/**
 * Live Exam Participant
 * Represents a student's participation in a live exam session
 */
export interface LiveExamParticipant {
  id: string;
  liveExamId: string;
  studentId: string;
  username: string;                // Denormalized for display
  
  // Timing
  joinedAt: string;                // When student joined waiting room
  startedAt?: string;              // When student started exam
  submittedAt?: string;            // When student submitted (or auto-submitted)
  
  // Answers
  answers?: StudentAnswers;
  
  // Results (calculated after session closes)
  score?: number;                  // Total score (0-100)
  correctCount?: number;           // Number of correct answers
  wrongCount?: number;             // Number of wrong answers
  rank?: number;                   // Rank within this session (1 = best)
  
  // Anti-cheat tracking
  tabSwitches: number;             // Number of times student switched tabs
  warnings?: AntiCheatWarning[];
  
  // Metadata
  createdAt: string;
  updatedAt: string;
}

/**
 * Live Exam Activity
 * Real-time activity tracking for polling optimization
 */
export interface LiveExamActivity {
  liveExamId: string;
  studentId: string;
  
  // Current state
  currentQuestion?: number;        // Which question student is on (1-based)
  answeredCount: number;           // How many questions answered so far
  lastActivity: string;            // ISO 8601 timestamp of last action
  isOnline: boolean;               // false if student hasn't polled in 10+ seconds
}

/**
 * Live Exam Session Status Response
 * What students poll every 3 seconds
 */
export interface LiveExamStatusResponse {
  session: {
    id: string;
    status: LiveExamStatus;
    startedAt?: string;
    endsAt?: string;
    duration: number;
    chatEnabled?: boolean;
  };
  participantCount: number;
  timeRemaining?: number;          // Seconds remaining (only when active)
}

export type WaitingRoomChatSenderRole = 'student' | 'teacher' | 'system';
export type WaitingRoomChatMessageKind = 'message' | 'announcement';

export interface WaitingRoomChatMessage {
  id: string;
  sessionId: string;
  senderRole: WaitingRoomChatSenderRole;
  senderId: string;
  senderName: string;
  content: string;
  kind: WaitingRoomChatMessageKind;
  isHidden: boolean;
  createdAt: string;
}

export interface WaitingRoomChatSettings {
  enabled: boolean;
}

export interface WaitingRoomChatResponse {
  messages: WaitingRoomChatMessage[];
  settings: WaitingRoomChatSettings;
}

export interface SendWaitingRoomMessageRequest {
  content: string;
}

export interface UpdateWaitingRoomChatSettingsRequest {
  enabled: boolean;
}

/**
 * Live Exam Participants Response
 * What teachers poll every 3 seconds
 */
export interface LiveExamParticipantsResponse {
  participants: Array<{
    id: string;
    username: string;
    joinedAt: string;
    submittedAt?: string;
    currentQuestion?: number;
    answeredCount: number;
    isOnline: boolean;
  }>;
  totalCount: number;
  submittedCount: number;
  onlineCount: number;
}

/**
 * Live Exam Results Response
 * Shown after session closes
 */
export interface LiveExamResultsResponse {
  participant: {
    score: number;
    rank: number;
    correctCount: number;
    wrongCount: number;
    submittedAt: string;
  };
  rewards: {
    coins: number;
    xp: number;
    bonusCoins?: number;           // Top 3 bonus
  };
  leaderboardVisible?: boolean;
  leaderboard: Array<{
    rank: number;
    username: string;
    score: number;
  }>;
}

/**
 * Temporary score returned immediately after submit.
 */
export interface LiveExamSubmissionResponse {
  participant: {
    score: number;
    correctCount: number;
    wrongCount: number;
    submittedAt: string;
  };
}

/**
 * Create Live Exam Request
 */
export interface CreateLiveExamRequest {
  title: string;
  quizId: string;
  classId: string;
  duration: number;                // Minutes
  scheduledAt?: string;            // ISO 8601 (optional)
  settings: LiveExamSettings;
}

/**
 * Join Live Exam Request
 */
export interface JoinLiveExamRequest {
  accessCode: string;              // 6-digit code
  studentId: string;
  username: string;
}

/**
 * Submit Answers Request
 */
export interface SubmitAnswersRequest {
  liveExamId: string;
  studentId: string;
  answers: StudentAnswers;
}

/**
 * Update Activity Request
 * Sent with every poll to track student progress
 */
export interface UpdateActivityRequest {
  liveExamId: string;
  studentId: string;
  currentQuestion?: number;
  answeredCount: number;
}

/**
 * Teacher Control Actions
 */
export enum TeacherAction {
  OPEN_SESSION = 'open_session',   // scheduled → waiting
  START_EXAM = 'start_exam',       // waiting → active
  END_EARLY = 'end_early',         // active → scoring
  CANCEL = 'cancel',               // any → cancelled
}

/**
 * Teacher Control Request
 */
export interface TeacherControlRequest {
  action: TeacherAction;
  liveExamId: string;
  teacherId: string;
}
