import Repository from "../models/repository.model.js";
import Commit from "../models/commit.model.js";
import Branch from "../models/branch.model.js";
import File from "../models/file.model.js";
import Contributor from "../models/contributor.model.js";
import Modification from "../models/modification.model.js";
import Commit_Branch from "../models/commit_branch.model.js";
import Repository_Language from "../models/repository_language.model.js";
import Auth from "../models/auth.model.js";
import Language from "../models/language.model.js";
import User from "../models/user.model.js";
import repoInfo from "../lib/getReposInfo.js";
import downloadFiles from "../lib/downloadFiles.js";
import validationHandler from "../lib/validationHandler.js";
import { BAD_REQUEST, FORBIDDEN, NOT_FOUND } from "../lib/constants/errors.js";
import ServiceError from "../lib/serviceError.js";
import {ServiceResult,Repository} from "../lib/types.js"

/**
 * Service to handle repositories proccesses
 * */
export default class RepositoryService {
    /**
     * Save a repository in database
     * @param {Repository} repoData - Repository data
     * @param {string} token - JWT Token
     * @return {Promise<ServiceResult>} Service result object
     * @async
     * */
    static async createRepository(repoData, token) {
        const { name, description, languages } = repoData;

        const validation = validationHandler([
            await Repository.validateRepoName(name),
            Auth.validateToken(token),
            await Repository.validateDescription(description),
            await Repository.validateLanguages(languages),
        ]);
        if (validation.error)
            return new ServiceError(validation.error, BAD_REQUEST);

        const existsBackend = await Repository.checkIfExistsInBackend(name);
        if (!existsBackend)
            return new ServiceError(
                "Repositorio no existe en el servidor!",
                NOT_FOUND,
            );

        const userHasRepo = await Repository.checkIfUserHasRepo(
            name,
            validation.data,
        );
        if (userHasRepo)
            return new ServiceError(
                "Usuario ya tiene el repositorio!",
                BAD_REQUEST,
            );

        for (const lang of languages) {
            const lang_exists = await Language.checkIfExists(lang);
            if (!lang_exists)
                return new ServiceError(
                    `Lenguaje ${lang} no existe en la base de datos!`,
                    NOT_FOUND,
                );
        }

        const { commits, files, branches, contributors, modifications } =
            await repoInfo(name);

        // Create repository in database
        const repoSaved = await Repository.save({
            name,
            description,
            user_owner: validation.data,
        });

        // Relate languages with repository
        for (const language of languages) {
            await Repository_Language.save(repoSaved.id, language);
        }

        // Save the contributors of the repository in database
        const contributorsSaved = [];
        for (const contributor of contributors) {
            contributorsSaved.push(
                await Contributor.save({
                    name: contributor,
                    repo: repoSaved.id,
                }),
            );
        }

        // Save branches of the repository in database
        const branchesSaved = [];
        for (const branch of branches) {
            branchesSaved.push(
                await Branch.save({
                    name: branch.name,
                    type: branch.type,
                    repo: repoSaved.id,
                }),
            );
        }

        // Save commits of the repository in database
        const commitsSaved = [];
        for (const commit of commits) {
            const contributor = contributorsSaved.find(
                (c) => c.name == commit.author,
            ).id;
            const commitSaved = await Commit.save({
                title: commit.title,
                content: commit.content,
                hash: commit.hash,
                author: contributor,
                created_at: commit.created_at,
                repo: repoSaved.id,
            });

            commitsSaved.push(commitSaved);

            const commitBranchesSaved = branchesSaved.filter((b) =>
                commit.branches.includes(b.name),
            );

            // Relate commits with branches
            for (const branchSaved of commitBranchesSaved) {
                await Commit_Branch.save(commitSaved.id, branchSaved.id);
            }
        }

        // Save files of the repository in database
        const filesSaved = [];
        const modificationsSaved = [];
        for (const file of files) {
            // Relate with languages
            const ext = file.name.slice(file.name.lastIndexOf(".") + 1);
            const language_id = await Language.getByExt(ext);

            const fileSaved = await File.save({
                name: file.name,
                size: file.size,
                path: file.path,
                repo: repoSaved.id,
                language: language_id,
            });
            filesSaved.push(fileSaved);

            // Save modifications in database
            const fileModifications = modifications.filter(
                (m) => m.file == file.path,
            );

            for (const fileModification of fileModifications) {
                const commit = commitsSaved.find(
                    (c) => c.hash == fileModification.commit,
                ).id;
                modificationsSaved.push(
                    await Modification.save({
                        type: fileModification.type,
                        commit,
                        file: fileSaved.id,
                    }),
                );
            }
        }
        // Save files deleted previously in database
        const deletedFilesModifications = modifications.filter(
            (m) => !filesSaved.some((f) => f.path == m.file),
        );
        for (const modification of deletedFilesModifications) {
            const commit = commitsSaved.find(
                (c) => c.hash == modification.commit,
            ).id;

            const file_name = modification.file.slice(
                modification.file.lastIndexOf("/") + 1,
            );

            const fileSaved = await File.save({
                name: file_name,
                size: "N/A",
                path: modification.file,
                repo: repoSaved.id,
            });

            modificationsSaved.push(
                await Modification.save({
                    type: modification.type,
                    commit,
                    file: fileSaved.id,
                }),
            );
        }
        return {
            success: true,
            error: null,
            data: null,
        };
    }
    /**
     * Upload a repository stored in backend to cloud storage
     * @param {string} repoName - Repository name
     * @return {Promise<ServiceResult>} Service result object
     * @async
     * */
    static async uploadRepository(repoName, token) {
        const validation = validationHandler([
            await Repository.validateRepoName(repoName),
            Auth.validateToken(token),
        ]);
        if (validation.error)
            return new ServiceError(validation.error, BAD_REQUEST);

        const repoExists = await Repository.checkIfExistsInBackend(repoName);
        if (!repoExists)
            return new ServiceError(
                "Repositorio no existe en el servidor!",
                NOT_FOUND,
            );

        await Repository.upload(repoName, validation.data);
        return {
            success: true,
            error: null,
            data: null,
        };
    }
    /**
     * Generate a zip file with the repository content
     * @param {string} repoName - Repository name
     * @return {Promise<ServiceResult>} Service result object
     * @async
     * */
    static async download(repoName, username) {
        const validation = validationHandler([
            await Repository.validateRepoName(repoName),
            await User.validateUsername(username),
        ]);
        if (validation.error)
            return new ServiceError(validation.error, BAD_REQUEST);

        const existsDb = await Repository.checkIfExistsInDb(repoName);

        if (!existsDb)
            return new ServiceError(
                "Repositorio no existe en la base de datos!",
                NOT_FOUND,
            );

        const user_exists = await User.checkIfExistsByUsername(username);
        if (!user_exists)
            return new ServiceError("Usuario no existe!", NOT_FOUND);

        const user = await User.getByUsername(username);

        const userHasRepo = await Repository.checkIfUserHasRepo(
            repoName,
            user.id,
        );
        if (!userHasRepo)
            return new ServiceError(
                "Usuario no tiene el repositorio!",
                FORBIDDEN,
            );

        const existsCloud = await Repository.checkIfExistsInCloud(
            repoName,
            user.id,
        );

        if (!existsCloud)
            return new ServiceError(
                "Repositorio no existe en el cloud!",
                NOT_FOUND,
            );

        const files = await Repository.getFiles(repoName, user.id);

        const zip_file = await downloadFiles(files, repoName);
        return {
            success: true,
            error: null,
            data: zip_file,
        };
    }
    /**
     * Delete a repository from database and clout storage
     * @param {string} repoName - Repository name
     * @param {string} token - JWT Token
     * @return {Promise<ServiceResult>} Service result object
     * @async
     * */
    static async delete(repoName, token, password) {
        const validation = validationHandler([
            await Repository.validateRepoName(repoName),
            Auth.validateToken(token),
            await User.validatePassword(password),
        ]);
        if (validation.error)
            return new ServiceError(validation.error, BAD_REQUEST);

        const user = await User.getById(validation.data);

        const match_password = await Auth.comparePassword(
            password,
            user.password,
        );
        if (!match_password)
            return new ServiceError("Contraseña invalida!", FORBIDDEN);

        await Repository.deleteCloud(repoName, validation.data);
        await Repository.deleteDb(repoName, validation.data);
        return {
            success: true,
            error: null,
            data: null,
        };
    }
    /**
     * Like a repository by name and user token
     * @param {string} repoName - Repository name
     * @param {string} username - User owner name
     * @return {Promise<ServiceResult>} Service result object
     * @async
     * */
    static async like(username, repoName, userOwnerName) {
        const validation = validationHandler([
            await Repository.validateRepoName(repoName),
            await User.validateUsername(username),
            await User.validateUsername(userOwnerName),
        ]);
        if (validation.error)
            return new ServiceError(validation.error, BAD_REQUEST);

        const existsDb = await Repository.checkIfExistsInDb(repoName);
        if (!existsDb)
            return new ServiceError(
                "Repositorio no existe en la base de datos!",
                NOT_FOUND,
            );

        const user_exists = await User.checkIfExistsByUsername(username);
        if (!user_exists)
            return new ServiceError("Usuario no existe!", NOT_FOUND);

        const userOwner_exists =
            await User.checkIfExistsByUsername(userOwnerName);
        if (!userOwner_exists)
            return new ServiceError(
                "Usuario dueño del repositorio no existe!",
                NOT_FOUND,
            );

        const userOwner = await User.getByUsername(userOwnerName);

        const userHasRepo = await Repository.checkIfUserHasRepo(
            repoName,
            userOwner.id,
        );
        if (!userHasRepo)
            return new ServiceError(
                "Usuario dueño no tiene el repositorio!",
                FORBIDDEN,
            );

        const hasUserLike = await Repository.checkIfLike(
            username,
            repoName,
            userOwner.id,
        );
        if (hasUserLike)
            return new ServiceError(
                "Usuario ya dió like al repositorio!",
                BAD_REQUEST,
            );

        const user = await User.getByUsername(username);
        await Repository.like(user.id, repoName, userOwner.id);
        return {
            success: true,
            error: null,
            data: null,
        };
    }
    /**
     * Search repositories by name
     * @return {Promise<ServiceResult>} Service result object
     * */
    static async search(repoName) {
        const validation = validationHandler([
            await Repository.validateRepoName(repoName),
        ]);
        if (validation.error)
            return new ServiceError(validation.error, BAD_REQUEST);

        const repos = await Repository.search(repoName);

        if (repos.length == 0)
            return new ServiceError(
                "No hay repositorios que coincidan con la búsqueda!",
                NOT_FOUND,
            );

        return {
            success: true,
            error: null,
            data: repos,
        };
    }
    /**
     * Change name of repository
     * @param {string} newRepoName - New repository name
     * @param {string} repoName - Repository name
     * @return {Promise<ServiceResult>} Service result object
     * @async
     * */
    static async changeName(newRepoName, repoName, token) {
        const validation = validationHandler([
            await Repository.validateRepoName(newRepoName),
            await Repository.validateRepoName(repoName),
            Auth.validateToken(token),
        ]);
        if (validation.error)
            return new ServiceError(validation.error, BAD_REQUEST);

        const existsDb = await Repository.checkIfExistsInDb(repoName);
        if (!existsDb)
            return new ServiceError(
                "Repositorio no existe en la base de datos!",
                NOT_FOUND,
            );

        const user_exists = await User.checkIfExistsById(validation.data);
        if (!user_exists)
            return new ServiceError("Usuario no existe!", NOT_FOUND);

        const userHasRepo = await Repository.checkIfUserHasRepo(
            repoName,
            validation.data,
        );
        if (!userHasRepo)
            return new ServiceError(
                "Usuario no tiene el repositorio!",
                FORBIDDEN,
            );

        await Repository.changeName(newRepoName, repoName, validation.data);
        return {
            success: true,
            error: null,
            data: null,
        };
    }
    /**
     * Change description of repository
     * @param {string} newDescription - New repository description
     * @param {string} repoName - Repository name
     * @param {string} token - JWT Token
     * @return {Promise<ServiceResult>} Service result object
     * @async
     * */
    static async changeDescription(newDescription, repoName, token) {
        const validation = validationHandler([
            await Repository.validateDescription(newDescription),
            await Repository.validateRepoName(repoName),
            Auth.validateToken(token),
        ]);
        if (validation.error)
            return new ServiceError(validation.error, BAD_REQUEST);

        const existsDb = await Repository.checkIfExistsInDb(repoName);
        if (!existsDb)
            return new ServiceError(
                "Repositorio no existe en la base de datos!",
                NOT_FOUND,
            );

        const user_exists = await User.checkIfExistsById(validation.data);
        if (!user_exists)
            return new ServiceError("Usuario no existe!", NOT_FOUND);

        const userHasRepo = await Repository.checkIfUserHasRepo(
            repoName,
            validation.data,
        );
        if (!userHasRepo)
            return new ServiceError(
                "Usuario no tiene el repositorio!",
                FORBIDDEN,
            );

        await Repository.changeDescription(
            newDescription,
            repoName,
            validation.data,
        );
        return {
            success: true,
            error: null,
            data: null,
        };
    }
    /**
     * Get full information of repository
     * @param {string} repoName - Repository name
     * @param {string} username - User owner name
     * @return {Promise<ServiceResult>} Service result object
     * @async
     * */
    static async getInfo(repoName, username) {
        const validation = validationHandler([
            await Repository.validateRepoName(repoName),
            await User.validateUsername(username),
        ]);
        if (validation.error)
            return new ServiceError(validation.error, BAD_REQUEST);

        const existsDb = await Repository.checkIfExistsInDb(repoName);
        if (!existsDb)
            return new ServiceError(
                "Repositorio no eixste en la base de datos!",
                NOT_FOUND,
            );

        const user_exists = await User.checkIfExistsByUsername(username);
        if (!user_exists)
            return new ServiceError("Usuario no existe!", NOT_FOUND);

        const user = await User.getByUsername(username);

        const userHasRepo = await Repository.checkIfUserHasRepo(
            repoName,
            user.id,
        );
        if (!userHasRepo)
            return new ServiceError(
                "Usuario no tiene el repositorio!",
                FORBIDDEN,
            );

        const info = await Repository.getFullInfo(repoName, user.id);
        const files = await Repository.getFiles(repoName, user.id);
        return {
            success: true,
            error: null,
            data: {
                ...info,
                files,
            },
        };
    }
    /**
     * Get repositories from an user by ID
     * @param {string} username - User owner name
     * @return {Promise<ServiceResult>} Service result object
     * @async
     * */
    static async getFromUser(username) {
        const validation = validationHandler([
            await User.validateUsername(username),
        ]);
        if (validation.error)
            return new ServiceError(validation.error, BAD_REQUEST);

        const user_exists = await User.checkIfExistsByUsername(username);
        if (!user_exists)
            return new ServiceError("Usuario no existe!", NOT_FOUND);

        const repos = await Repository.getFromUser(username);

        if (repos.length == 0)
            return new ServiceError(
                "Usuario no tiene el repositorios!",
                NOT_FOUND,
            );

        return {
            success: true,
            error: null,
            data: repos,
        };
    }
    /**
     * Delete a temp zip file of repository
     * @param {string} fileName - Zip file name
     * @return {Promise<ServiceResult>} Service result object
     * @async
     * */
    static async deleteZip(fileName) {
        await Repository.deleteZip(fileName);
        return {
            success: true,
            error: null,
            data: null,
        };
    }
    /**
     * Remove like from a repo
     * @param {string} repoName - Repository name
     * @param {string} userOwnerName - User owner name
     * @param {string} username - User name
     * @return {Promise<ServiceResult>} Service result object
     * @async
     * */
    static async removeLike(repoName, userOwnerName, username) {
        const validation = validationHandler([
            await Repository.validateRepoName(repoName),
            await User.validateUsername(userOwnerName),
            await User.validateUsername(username),
        ]);
        if (validation.error)
            return new ServiceError(validation.error, BAD_REQUEST);

        const user_exists = await User.checkIfExistsByUsername(username);
        if (!user_exists)
            return new ServiceError("Usuario no existe!", NOT_FOUND);

        const userOwner_exists =
            await User.checkIfExistsByUsername(userOwnerName);
        if (!userOwner_exists)
            return new ServiceError("Usuario dueño no existe!", NOT_FOUND);

        const repo_exists = await Repository.checkIfExistsInDb(repoName);
        if (!repo_exists)
            return new ServiceError("Repositorio no existe!", NOT_FOUND);

        const userOwner = await User.getByUsername(userOwnerName);
        const userHasRepo = await Repository.checkIfUserHasRepo(
            repoName,
            userOwner.id,
        );
        if (!userHasRepo)
            return new ServiceError(
                "Usuario no tiene el repositorio!",
                FORBIDDEN,
            );

        const userHasLike = await Repository.checkIfLike(
            username,
            repoName,
            userOwner.id,
        );
        if (!userHasLike)
            return new ServiceError("Usuario no ha dado me gusta!", FORBIDDEN);

        const user = await User.getByUsername(username);

        await Repository.removeLike(repoName, userOwner.id, user.id);
        return {
            success: true,
            error: null,
            data: null,
        };
    }
    /**
     * Remove repo from temp directory
     * @param {string} repoName - Repository name
     * @return {Promise<ServiceResult>} Service result object
     * @async
     * */
    static async removeTemp(repoName) {
        const exists = await Repository.checkIfExistsInBackend(repoName);
        if (!exists)
            return new ServiceError(
                "Repositorio no existe en el servidor!",
                NOT_FOUND,
            );

        await Repository.removeTemp(repoName);
        return {
            success: true,
            error: null,
            data: null,
        };
    }
    /**
     * Delete from database without password
     * @param {string} repoName - Repository name
     * @param {string} token - JWT Token
     * @return {Promise<ServiceResult>} Service result object
     * @async
     * */
    static async deleteDb(repoName, token) {
        const validation = Auth.validateToken(token);
        if (validation.error)
            return new ServiceError(validation.error, BAD_REQUEST);

        await Repository.deleteDb(repoName, validation.data);
        return {
            success: true,
            error: null,
            data: null,
        };
    }
    /**
     * Check if an user already liked a repository
     * @param {string} token - JWT Token
     * @param {string} repoName - Repository name
     * @return {Promise<ServiceResult>} Service result object
     * @async
     * */
    static async checkIfLike(token, repoName, userOwnerName) {
        const validation = validationHandler([
            Auth.validateToken(token),
            await Repository.validateRepoName(repoName),
            await User.validateUsername(userOwnerName),
        ]);
        if (validation.error)
            return new ServiceError(validation.error, BAD_REQUEST);

        const repoExists = await Repository.checkIfExistsInDb(repoName);
        if (!repoExists)
            return new ServiceError("Repositorio no existe!", NOT_FOUND);

        const userExists = await User.checkIfExistsById(validation.data);
        if (!userExists)
            return new ServiceError("Usuario no existe!", NOT_FOUND);

        const userOwnerExists =
            await User.checkIfExistsByUsername(userOwnerName);
        if (!userOwnerExists)
            return new ServiceError("Usuario dueño no existe!", NOT_FOUND);

        const user = await User.getById(validation.data);
        const userOwner = await User.getByUsername(userOwnerName);
        const alreadyLike = await Repository.checkIfLike(
            user.username,
            repoName,
            userOwner.id,
        );

        return {
            success: true,
            error: null,
            data: alreadyLike,
        };
    }
}
