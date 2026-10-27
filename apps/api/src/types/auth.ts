export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export interface ApiKeyContext {
  apiKeyId: string;
  projectId: string;
  ownerId: string;
}
