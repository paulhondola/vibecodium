
export type ExecuteRequest = {
  language: string;
  version: string;
  code: string;
  projectId?: string;
  entryFile?: string;
}

export type ExecuteResponse = {
  success: boolean;
  stdout: string;
  stderr: string;
  compileOutput?: string;
  error?: string;
}
