// ============================================
// Services Export Index
// ============================================

export { apiClient, ApiResponse, ApiError } from './api/client';
export { authService } from './authService';
export { ticketService } from './ticketService';
export { userService } from './userService';
export { reportService } from './reportService';
export { stockService } from './stockService';
export { sopService } from './sopService';
export { vmsService } from './vmsService';
export { meetingRoomService } from './meetingRoomService';
export { propertyService } from './propertyService';

// Re-export types
export type { LoginCredentials, SignupData, ResetPasswordData, UpdatePasswordData } from './authService';
export type { CreateTicketData, UpdateTicketData, TicketFilters } from './ticketService';
export type { CreateUserData, UpdateUserData, UserFilters } from './userService';
export type { DashboardStats } from '@/types';
