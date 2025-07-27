import { envMode } from '../app.js'

const errorMiddleware = (err, req, res, next) => {
    err.message ||= "Internal Server Error";
    err.statusCode ||= 500

    //for duplicate key error
    if (err.code === 11000) {
        const error = Object.keys(err.keyPattern).join(",");
        err.message = `Duplicate field - ${error}`;
        err.statusCode = 400;
    }
    //for invalid _id error
    if (err.name === "CastError") {
        const errorPath = err.path
        err.message = `Invalid Format of - ${errorPath}`;
        err.statusCode = 400;
    }

    const response = {
        success: false,
        message: err.message,
    }

    if (envMode === "DEVELOPEMENT") {
        response.error = err;
    }

    return res.status(err.statusCode).json(response);
}

const TryCatch = (passedFunction) => async (req, res, next) => {
    try {
        await passedFunction(req, res, next);
    } catch (error) {
        next(error)
    }
};

export { errorMiddleware, TryCatch };