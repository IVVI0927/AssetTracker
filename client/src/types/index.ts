export interface User {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  permissions: string[];
  tenantId: string;
  isActive: boolean;
  isVerified: boolean;
  mfaEnabled: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Asset {
  id: string;
  name: string;
  description?: string;
  category: string;
  status: AssetStatus;
  serialNumber?: string;
  purchaseDate?: Date;
  purchasePrice?: number;
  location?: Location;
  assignedTo?: User;
  tenantId: string;
  tags: string[];
  customFields: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Location {
  building?: string;
  floor?: string;
  room?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  settings: TenantSettings;
  usage: TenantUsage;
  createdAt: Date;
  updatedAt: Date;
}

export interface TenantSettings {
  requireEmailVerification: boolean;
  passwordMinLength: number;
  sessionTimeout: number;
  mfaRequired: boolean;
  allowUserRegistration: boolean;
}

export interface TenantUsage {
  users: number;
  assets: number;
  storage: number;
  apiCalls: number;
}

export interface AuthContextType {
  user: User | null;
  tenant: Tenant | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  register: (data: RegisterData) => Promise<void>;
}

export interface LoginCredentials {
  identifier: string;
  password: string;
  tenantSlug: string;
  mfaToken?: string;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  tenantSlug: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  errors?: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export enum AssetStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  MAINTENANCE = 'maintenance',
  RETIRED = 'retired',
  DISPOSED = 'disposed'
}

export interface AuditEvent {
  id: string;
  eventType: string;
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  actor: {
    type: 'user' | 'system' | 'service' | 'api_key';
    id: string;
    name: string;
    email?: string;
  };
  resource: {
    type: string;
    id: string;
    name: string;
  };
  action: string;
  description: string;
  timestamp: Date;
  tenantId: string;
}