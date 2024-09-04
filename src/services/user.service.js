import User from "../models/user.model.js"
import Auth from "../models/auth.model.js"
import validationHandler from "../lib/validationHandler.js"
import { BAD_REQUEST, NOT_FOUND } from "../lib/constants/errors.js"

/**
 * Service to handle user proccesses
 * */
export default class UserService {
    /**
     * @typedef {Object} ErrorType
     * @property {string} message - Error message
     * @property {string} type - Error Type
     *
     * @typedef {Object} ServiceResult
     * @property {boolean} success
     * @property {?ErrorType} error - Error object
     * @property {*} data - Result Data
     * */
    /**
     * Delete a user from database
     * @param {string} token - JWT Token
     * @param {string} password - User password
     * @return {Promise<ServiceResult>} Service result object
     * @async
     * */
    static async deleteUser(token, password) {
        const validation = validationHandler([
            Auth.validateToken(token),
            await User.validatePassword(password)
        ])
        if (validation.error) return {
            success: false,
            error: {
                message: validation.error,
                type: BAD_REQUEST
            },
            data: null
        }

        const userExists = await User.checkIfExistsById(validation.data)

        if (!userExists) return {
            success: false,
            error: {
                message: "Usuario no existe!",
                type: NOT_FOUND
            },
            data: null
        }

        const storedUser = await User.getById(validation.data)

        const storedPassword = storedUser.password

        const matchPassword = await Auth.comparePassword(password, storedPassword)

        if (!matchPassword) return {
            success: false,
            error: {
                message: "Contraseña invalida!",
                type: FORBIDDEN
            },
            data: null
        }

        await User.delete(validation.data)
        return {
            success: true,
            error: null,
            data: null
        }
    }
    /**
     * Change username validating token and password
     * @param {string} newUsername - New username
     * @param {string} token - JWT Token
     * @param {string} password - User password
     * @return {Promise<ServiceResult>} Service result object
     * @async
     * */
    static async changeUsername(newUsername, token, password) {
        const validation = validationHandler([
            Auth.validateToken(token),
            await User.validateUsername(newUsername),
            await User.validatePassword(password)
        ])
        if (validation.error) return {
            success: false,
            error: {
                message: validation.error,
                type: BAD_REQUEST
            },
            data: null
        }

        const userExists = await User.checkIfExistsById(validation.data)

        if (!userExists) return {
            success: false,
            error: {
                message: "Usuario no existe!",
                type: NOT_FOUND
            },
            data: null
        }

        const user = await User.getById(validation.data)

        const matchPassword = await Auth.comparePassword(password, user.password)

        if (!matchPassword) return {
            success: false,
            error: {
                message: "Contraseña invalida!",
                type: FORBIDDEN
            },
            data: null
        }

        await User.changeUsername(newUsername, validation.data)
        return {
            success: true,
            error: null,
            data: null
        }
    }
    /**
     * Change password validating token and password
     * @param {string} newPassword - New user password
     * @param {string} token - JWT Token
     * @param {string} password - User password
     * @return {Promise<ServiceResult>} Service result object
     * @async
     * */
    static async changePassword(newPassword, token, password) {
        const validation = validationHandler([
            Auth.validateToken(token),
            await User.validatePassword(newPassword),
            await User.validatePassword(password)
        ])
        if (validation.error) return {
            success: false,
            error: {
                message: validation.error,
                type: BAD_REQUEST
            },
            data: null
        }

        const userExists = await User.checkIfExistsById(validation.data)

        if (!userExists) return {
            success: false,
            error: {
                message: "Usuario no existe!",
                type: NOT_FOUND
            },
            data: null
        }

        const user = await User.getById(validation.data)

        const matchPassword = await Auth.comparePassword(password, user.password)

        if (!matchPassword) return {
            success: false,
            error: {
                message: "Contraseña invalida!",
                type: FORBIDDEN
            },
            data: null
        }

        const encryptedPassword = await Auth.encryptPassword(newPassword)

        await User.changePassword(encryptedPassword, validation.data)
        return {
            success: true,
            error: null,
            data: null
        }
    }
    /**
     * Change description validating token
     * @param {string} newDescription - New description
     * @param {string} token - JWT Token
     * @return {Promise<ServiceResult>} Service result object
     * @async
     * */
    static async changeDescription(newDescription, token) {
        const validation = validationHandler([
            Auth.validateToken(token),
            await User.validateDescription(newDescription)
        ])
        if (validation.error) return {
            success: false,
            error: {
                message: validation.error,
                type: BAD_REQUEST
            },
            data: null
        }

        const userExists = await User.checkIfExistsById(validation.data)

        if (!userExists) return {
            success: false,
            error: {
                message: "Usuario no existe!",
                type: NOT_FOUND
            },
            data: null
        }

        await User.changeDescription(newDescription, validation.data)
        return {
            success: true,
            error: null,
            data: null
        }
    }
    /**
     * Change image validating token
     * @param {string} image - User image URL
     * @param {string} token - JWT Token
     * @return {Promise<ServiceResult>} Service result object
     * @async
     * */
    static async changeImage(image, token) {
        const validation = validationHandler([
            Auth.validateToken(token)
        ])
        if (validation.error) return {
            success: false,
            error: {
                message: validation.error,
                type: BAD_REQUEST
            },
            data: null
        }

        const userExists = await User.checkIfExistsById(validation.data)

        if (!userExists) return {
            success: false,
            error: {
                message: "Usuario no existe!",
                type: NOT_FOUND
            },
            data: null
        }

        const imageUrl = await User.changeImage(image, validation.data)
        return {
            success: true,
            error: null,
            data: imageUrl
        }
    }
    /**
     * Add a user has follower
     * @param {string} userFollowedId - User followed ID
     * @param {string} token - JWT Token
     * @return {Promise<ServiceResult>} Service result object
     * @async
     * */
    static async followUser(username, token) {
        const validation = validationHandler([
            Auth.validateToken(token)
        ])
        if (validation.error) return {
            success: false,
            error: {
                message: validation.error,
                type: BAD_REQUEST
            },
            data: null
        }

        const userExists = await User.checkIfExistsById(validation.data)

        if (!userExists) return {
            success: false,
            error: {
                message: "Usuario no existe!",
                type: NOT_FOUND
            },
            data: null
        }

        const followerExists = await User.checkIfExistsByUsername(username)
        if (!followerExists) return {
            success: false,
            error: {
                message: "Seguidor no existe!",
                type: NOT_FOUND
            },
            data: null
        }

        const user = await User.getByUsername(username)
        if (user.id == validation.data) return {
            success: false,
            error: {
                message: "Usuario no se puede seguir a si mismo!",
                type: BAD_REQUEST
            },
            data: null
        }

        const alreadyFollow = await User.checkIfFollow(validation.data,username)
        if (alreadyFollow) return {
            success: false,
            error:  {
                message: "Usuario ya seguido!",
                type: BAD_REQUEST
            },
            data: null
        }

        await User.followUser(validation.data,username)
        return {
            success: true,
            error: null,
            data: null
        }
    }
    /**
     * Search a user by username
     * @param {string} username - User name
     * @return {Promise<ServiceResult>} Service result object
     * @async
     * */
    static async search(username) {
        const users = await User.search(username)
        if (users.length == 0) return {
            success: false,
            error: {
                message: "Usuarios no encontrados!",
                type: NOT_FOUND
            },
            data: null
        }
        return {
            success: true,
            error: null,
            data: users
        }
    }
    /**
     * Get followers of a user by username
     * @param {string} username - User name
     * @return {Promise<ServiceResult>} Service result object
     * @async
     * */
    static async getFollowers(username) {
        const validation = validationHandler([
            await User.validateUsername(username)
        ])
        if (validation.error) return {
            success: false,
            error: {
                message: validation.error,
                type: BAD_REQUEST
            },
            data: null
        }

        const userExists = await User.checkIfExistsByUsername(username)
        if (!userExists) return {
            success: false,
            error: {
                message: "Usuario no existe!",
                type: NOT_FOUND
            },
            data: null
        }

        const followers = await User.getFollowers(username)
        return {
            success: true,
            error: null,
            data: followers
        }
    }
    /**
     * Get user profile information
     * @param {string} username - User name
     * @return {Promise<ServiceResult>} Service result object
     * @async
     * */
    static async getProfileInfo(username) {
        const validation = validationHandler([
            await User.validateUsername(username)
        ])
        if (validation.error) return {
            success: false,
            error: {
                message: validation.error,
                type: BAD_REQUEST
            },
            data: null
        }

        const userExists = await User.checkIfExistsByUsername(username)
        if (!userExists) return {
            success: false,
            error: {
                message: "Usuario no existe!",
                type: NOT_FOUND
            },
            data: null
        }
        
        const profileInfo = await User.getProfileInfo(username)
        return {
            success: true,
            error: null,
            data: profileInfo
        }
    }
    /**
     * Unfollow an user
     * @param {string} username - User name
     * @param {string} token - JWT Token
     * @return {Promise<ServiceResult>} Service result object
     * @async
     * */
    static async unfollow(username,token) {
        const validation = validationHandler([
            await User.validateUsername(username),
            Auth.validateToken(token)
        ])
        if (validation.error) return {
            success: false,
            error: {
                message: validation.error,
                type: BAD_REQUEST
            },
            data: null
        }

        const exists = await User.checkIfExistsByUsername(username)
        if (!exists) return {
            success: false,
            error: {
                message: "Usuario no existe!",
                type: NOT_FOUND
            },
            data: null
        }

        const isFollowing = await User.checkIfFollow(validation.data,username)
        if (!isFollowing) return {
            success: false,
            error: {
                message: "Usuario no lo sigue!",
                type: BAD_REQUEST
            },
            data: null
        }

        await User.unfollowUser(validation.data,username)
        
        return {
            success: true,
            error: null,
            data: null
        }
    }
}
