import { body, check, param, validationResult } from 'express-validator';
import { ErrorHandler } from '../utils/utility.js';

const validateHandler = (req, res, next) => {
    const errors = validationResult(req);
    const errorMessages = errors
        .array()
        .map((error) => error.msg)
        .join(", ");

    if (errors.isEmpty()) {
        return next();
    } else {
        next(new ErrorHandler(errorMessages, 400))
    }
}

const registerValidator = () => [
    body("name", "Please Enter Name").notEmpty(),
    body("username", "Please Enter username").notEmpty(),
    body("bio", "Please Enter bio").notEmpty(),
    body("password", "Please Enter password").notEmpty(),
];

const loginValidator = () => [
    body("username", "Please Enter username").notEmpty(),
    body("password", "Please Enter password").notEmpty(),
];

const newGroupValidator = () => [
    body("name", "Please Enter Name").notEmpty(),
    body("members").notEmpty()
        .withMessage("Please Enter Members")
        .isArray({ min: 2, max: 100 })
        .withMessage("Members must be 2-100"),
];

const addMemberValidator = () => [
    body("chatId", "Please Enter Chat Id").notEmpty(),
    body("members").notEmpty()
        .withMessage("Please Enter Members")
        .isArray({ min: 1, max: 97 })
        .withMessage("Members must be 1-97"),
];

const removeMemberValidator = () => [
    body("chatId", "Please Enter Chat Id").notEmpty(),
    body("userID", "Please Enter User Id").notEmpty()
];


const sendAttachmentsValidator = () => [
    body("chatId", "Please Enter Chat Id").notEmpty(),
];


const chatIdValidator = () => [
    param("id", "Please Enter Chat Id").notEmpty(),
];

const renameGroupValidator = () => [
    param("id", "Please Enter Chat Id").notEmpty(),
    body("name", "Please Enter Group Name").notEmpty(),
];

const sendRequestValidator = () => [
    body("userId", "Please Enter User ID").notEmpty(),
];

const acceptRequestValidator = () => [
    body("requestId", "Please Enter Request Id").notEmpty(),

    body("accept")
        .notEmpty()
        .withMessage("Please add accept")
        .isBoolean()
        .withMessage("accept must be boolean"),
];

const adminLoginValidator = () => [
    body("secretKey", "Please Enter Secret Key").notEmpty(),
];

export {
    addMemberValidator, chatIdValidator, loginValidator,
    newGroupValidator, registerValidator, removeMemberValidator,
    renameGroupValidator, sendAttachmentsValidator, validateHandler,
    sendRequestValidator, acceptRequestValidator, adminLoginValidator
};

