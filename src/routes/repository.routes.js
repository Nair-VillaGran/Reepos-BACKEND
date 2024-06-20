import { Router } from "express";
import RepositoryController from "../controllers/repository.controller.js";
import MulterController from "../controllers/multer.controller.js";

const router = Router()

// Create a repository in database
router.post("/create", RepositoryController.create)
// Upload a repository to supabase
router.post("/upload-cloud", RepositoryController.uploadCloud)
// Upload a repository to backend
router.post("/upload-backend", MulterController.uploadRepository)
// Get files of repository from cloud
router.get("/get-files", RepositoryController.getFiles)

export default router
