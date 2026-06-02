import Docker from "dockerode";

/**
 * Singleton Docker client shared across the server.
 * Avoids creating multiple connections to the Docker daemon.
 */
export const docker = new Docker();
