export type User = {
  name: string;
  email: string;
  picture: string;
}

export type AuthState = {
  user: User | null;
}