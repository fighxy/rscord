import axios, { AxiosHeaders } from "axios";
import { useAuth } from "../../modules/auth/store";

export const http = axios.create({ baseURL: "http://127.0.0.1:14702" });

http.interceptors.request.use((config) => {
  const token = useAuth.getState().token;
  if (token) {
    const headers = AxiosHeaders.from(config.headers);
    headers.set("Authorization", `Bearer ${token}`);
    config.headers = headers;
  }
  return config;
});


