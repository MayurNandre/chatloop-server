import { v2 as cloudinary } from 'cloudinary';
import jwt from 'jsonwebtoken';
import mongoose from "mongoose";
import { v4 as uuid } from 'uuid';
import { getBase64, getSockets } from "../lib/helper.js";

const cookieOptions = {
    maxAge: 15 * 24 * 60 * 60 * 1000,
    sameSite: "none",
    httpOnly: true,
    secure: true,
}


const connectDB = (uri) => {
    mongoose.connect(uri, { dbName: "ChatLoop" }).then((data) => {
        console.log(`Connected to db : ${data.connection.host}`)
    }).catch((err) => {
        throw err;
    })
}

const sendToken = (res, user, code, message) => {
    const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET)
    return res.status(code).cookie("chatapp-token", token, cookieOptions).json({
        success: true,
        user,
        message,
    })
}


const emitEvent = (req, event, users, data) => {
    let io = req.app.get("io");
    const usersSocket = getSockets(users)
    io.to(usersSocket).emit(event, data)
}

const uploadFilesToCloudinary = async (files = []) => {
    // creating promise for each file
    const uploadPromises = files.map((file) => {
        return new Promise((resolve, reject) => {
            cloudinary.uploader.upload(
                getBase64(file),
                {
                    resource_type: "auto",
                    public_id: uuid(),
                    folder: "chatapp_data"
                },
                (error, result) => {
                    if (error) return reject(error);
                    resolve(result)
                }
            );
        });
    });

    // resolving promises
    try {
        const results = await Promise.all(uploadPromises);
        const formatedResults = results.map((result) => ({
            public_id: result.public_id,
            url: result.secure_url
        }));
        return formatedResults;
    } catch (err) {
        throw new Error("Error in uploading files - Check internet connection ", err)
    }
}

const deleteFilesFromCloudinary = async (public_ids) => {
    //Delete files from cloudinary
}


export { connectDB, cookieOptions, deleteFilesFromCloudinary, emitEvent, sendToken, uploadFilesToCloudinary };
