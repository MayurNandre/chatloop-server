import jwt from "jsonwebtoken";
import { ErrorHandler } from "../utils/utility.js";
import { TryCatch } from "./error.js";
import { adminSecretKey } from "../app.js";
import { CHATAPP_TOKEN } from "../constants/config.js";
import { User } from "../models/user.js";

const isAuthenticated = TryCatch(async (req, res, next) => {
    const token = req.cookies[CHATAPP_TOKEN]
    if (!token) {
        return next(new ErrorHandler("Please Login First", 401));
    }
    const decodedData = jwt.verify(token, process.env.JWT_SECRET);
    req.userID = decodedData._id
    next();
});

const isAdmin = TryCatch(async (req, res, next) => {
    const token = req.cookies["chatapp-admin-token"]

    if (!token) {
        return next(new ErrorHandler("Only Admin is allowed to access this route", 401));
    }

    const secretKey = jwt.verify(token, process.env.JWT_SECRET);

    const isMatched = secretKey === adminSecretKey;
    if (!isMatched) return next(new ErrorHandler("Only Admin is allowed to access this route", 401));

    next();
});

const socketAuthenticater = async (err, socket, next) => {
    try {
        if (err) return next(err)

        const authToken = socket.request.cookies[CHATAPP_TOKEN];

        if (!authToken) return next(new ErrorHandler("Please Login to access this route"))

        const decodedData = jwt.verify(authToken, process.env.JWT_SECRET)

        const user = await User.findById(decodedData._id)

        if (!user) return next(new ErrorHandler("Please Login to access this route"))

        socket.user = user;

        return next()
    } catch (error) {
        console.log(error)
        return next(new ErrorHandler("Please Login to access this route"))
    }
}

export { isAuthenticated, isAdmin, socketAuthenticater }