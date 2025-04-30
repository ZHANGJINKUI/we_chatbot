export interface LoginRequest {
  userid: string
  password: string
}

export interface UserInfo {
  userid: string
  username: string
  email: string
}

export interface LoginResponse {
  user: UserInfo
  token: string
}