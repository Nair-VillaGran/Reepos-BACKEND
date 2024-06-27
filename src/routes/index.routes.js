<<<<<<< HEAD
import { Router } from "express";
import authRoutes from "./auth.routes.js"
import userRoutes from "./user.routes.js"
import repositoryRoutes from "./repository.routes.js"
import fileRoutes from "./file.routes.js"
=======
import express from "express";
import authRoutes from "./auth.routes.js";
import userRoutes from "./user.routes.js";
import repositoryRoutes from "./repository.routes.js";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
>>>>>>> feature/download-repository

const downloadsDir = join(
    dirname(fileURLToPath(import.meta.url)),
    "../temp/downloads",
);

const router = express.Router();

// Base URL of auth service
router.use("/auth", authRoutes);
// Base URL of users service
router.use("/users", userRoutes);
// Base URL of repositories routes
<<<<<<< HEAD
router.use("/repositories", repositoryRoutes)
// Base URL of files routes
router.use("/files", fileRoutes)
=======
router.use("/repositories", repositoryRoutes);
// Serve downloads directory
router.use(express.static(downloadsDir));
>>>>>>> feature/download-repository

export default router;
