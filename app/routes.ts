import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("login", "routes/login.tsx"),
  route("logout", "routes/logout.tsx"),
  route("dashboard", "routes/dashboard.tsx"),
  route("documents", "routes/documents/index.tsx"),
  route("documents/upload", "routes/documents/upload.tsx"),
  route("documents/translate", "routes/documents/translate.ts"),
  route("documents/:id", "routes/documents/$id.tsx"),
  route("documents/download/:documentId", "routes/documents/download.ts"),
  route("uploads/presigned", "routes/uploads/presigned.ts"),
  route("admin", "routes/admin/index.tsx"),
] satisfies RouteConfig;
