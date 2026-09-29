declare module 'express-list-endpoints' {
  export default function listEndpoints(app: unknown): Array<{ path: string; methods: string[] }>;
}
