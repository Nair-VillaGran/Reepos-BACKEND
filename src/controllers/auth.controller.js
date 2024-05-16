import AuthService from "../services/auth.service.js";
import ErrorHandler from "../lib/errorHandler.js"
import ResponseHandler from "../lib/responseHandler.js"

// Class used in 'auth.routes.js' that contains request handlers
export default class AuthController {
    // Register (create) a new user
    static async signup(req, res) {
        const { username, password } = req.body;
        let userRegistered;
        try {
            userRegistered = await AuthService.signupUser({
                username,
                password,
            });
        } catch (e) {
            console.error(e);
            return new ErrorHandler(res).internalServer()
        }
        // Send response depending on validations 
        if (userRegistered.validationError) {
            return new ErrorHandler(res).badRequest(userRegistered.validationError, userRegistered.validationField)
        } else if (userRegistered.userExists) {
            return new ErrorHandler(res).badRequest("User already Exists!", username)
        } else {
            return ResponseHandler.ok("User Registered!", userRegistered, res)
        }
    }
    // Loggin (authenticate) a existing user with credentials (username and password)
    static async signin(req, res) {
        const { username, password } = req.body;
        let userAuthenticated;
        try {
            userAuthenticated = await AuthService.signinUser({
                username,
                password,
            });
        } catch (e) {
            console.error(e);
            return new ErrorHandler(res).internalServer()
        }
        // Send response depending on validations 
        if (userAuthenticated.validationError) {
            return new ErrorHandler(res).badRequest(userAuthenticated.validationError, userAuthenticated.validationField)
        } else if (userAuthenticated.userNotExists) {
            return new ErrorHandler(res).badRequest("User doesn't Exists!", username)
        } else if (userAuthenticated.passwordNotMatch) {
            return new ErrorHandler(res).unauthorized("Password Incorrect!", password)
        } else {
            return ResponseHandler.ok("User Authenticated!", { user: userAuthenticated.user, token: userAuthenticated.token }, res)
        }
    }
    // Loggin (authenticate) a existing user with JWT token
    static async signinWithToken(req, res) {
        const { token } = req.body

        let user
        try {
            user = await AuthService.signinUserWithToken(token)
        } catch (e) {
            console.error(e)
            return new ErrorHandler(res).internalServer()
        }
        // Send response depending on validations 
        if (user.validationError) {
            return new ErrorHandler(res).badRequest(user.validationError, user.validationField)
        } else if (user.isUnauthorized) {
            return new ErrorHandler(res).unauthorized("User Unauthorized!", token)
        } else {
            return ResponseHandler.ok("User Authenticated!", { user: userAuthenticated.user, token: userAuthenticated.token }, res)
        }
    }
}
