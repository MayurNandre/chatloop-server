import express from "express"
import { connectDB } from "./utils/features.js"
import dotenv from "dotenv"
import cookieParser from 'cookie-parser';
import cors from 'cors'
import { v2 as cloudinary } from 'cloudinary'
import { CHAT_JOINED, NEW_MESSAGE, NEW_MESSAGE_ALERT, START_TYPING, STOP_TYPING, ONLINE_USERS, CHAT_LEAVED } from "./constants/event.js";

import { getSockets } from "./lib/helper.js";
import { Message } from "./models/message.js";
import { corsOption } from "./constants/config.js";
import { socketAuthenticater } from "./middlewares/auth.js";


import userRoute from './routes/user.js'
import chatRoute from './routes/chat.js'
import adminRoute from './routes/admin.js'
import { errorMiddleware } from "./middlewares/error.js";
import { Server } from 'socket.io'
import { createServer } from 'http'
import { v4 as uuid } from 'uuid'
const onlineUsers = new Set();


dotenv.config({ path: "./.env" })
connectDB(process.env.MONGODB_URI)

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
})

const PORT = process.env.PORT || 3000
const envMode = process.env.NODE_ENV.trim() || "PRODUCTION"
const adminSecretKey = process.env.ADMIN_SECRET_KEY || "owbiubicneuwbeicweic"

const userSocketIDs = new Map();

const app = express()
const server = createServer(app)
const io = new Server(server, { cors: corsOption })

app.set("io", io);

// middleware for accesing json data from body
app.use(express.json())
// for accesing cookie from browser
app.use(cookieParser())

app.use(cors(corsOption))


app.use("/api/v1/user", userRoute)
app.use("/api/v1/chat", chatRoute)
app.use("/api/v1/admin", adminRoute)

io.use((socket, next) => {
    cookieParser()(socket.request, socket.request.res,
        async (err) => await socketAuthenticater(err, socket, next)
    )
})

io.on("connection", (socket) => {
    const user = socket.user;
    userSocketIDs.set(user._id.toString(), socket.id)

    // socket.emit(ONLINE_USERS, Array.from(onlineUsers));

    socket.on(NEW_MESSAGE, async ({ chatId, members, message }) => {
        const messageForRealTime = {
            content: message,
            _id: uuid(),
            sender: {
                _id: user._id,
                name: user.name
            },
            chat: chatId,
            createdAt: new Date().toISOString(),
        }

        const messageForDB = {
            content: message,
            sender: user._id,
            chat: chatId,
        }

        const membersSocket = getSockets(members)
        io.to(membersSocket).emit(NEW_MESSAGE, {
            chatId,
            message: messageForRealTime
        })

        io.to(membersSocket).emit(NEW_MESSAGE_ALERT, {
            chatId
        })

        try {
            await Message.create(messageForDB)
        } catch (error) {
            throw new Error(error)
        }
    })

    socket.on(START_TYPING, ({ members, chatId }) => {
        const membersSockets = getSockets(members)
        socket.to(membersSockets).emit(START_TYPING, { chatId })
    })

    socket.on(STOP_TYPING, ({ members, chatId }) => {
        const membersSockets = getSockets(members)
        socket.to(membersSockets).emit(STOP_TYPING, { chatId })
    })

    socket.on(CHAT_JOINED, ({ userId, members }) => {
        onlineUsers.add(userId.toString())

        const membersSockets = getSockets(members)
        io.to(membersSockets).emit(ONLINE_USERS, Array.from(onlineUsers))
    })

    socket.on(CHAT_LEAVED, ({ userId, members }) => {
        onlineUsers.delete(userId.toString())

        const membersSockets = getSockets(members)
        io.to(membersSockets).emit(ONLINE_USERS, Array.from(onlineUsers))
    })

    socket.on("disconnect", () => {
        userSocketIDs.delete(user._id.toString());
        onlineUsers.delete(user._id.toString())
        socket.broadcast.emit(ONLINE_USERS, Array.from(onlineUsers));
    })
})

app.use(errorMiddleware)

server.listen(PORT, () => {
    console.log(`Server is running on ${PORT} in ${envMode} mode`)
})

export { envMode, adminSecretKey, userSocketIDs }