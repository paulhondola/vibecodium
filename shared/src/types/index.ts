export type ApiResponse = {
  message: string;
  success: true;
}

export type ExecuteRequest = {
  language: string;
  version: string;
  code: string;
}

export type ExecuteResponse = {
  success: boolean;
  stdout: string;
  stderr: string;
  compileOutput?: string;
  error?: string;
}
