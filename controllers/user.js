import { compare } from "bcrypt";
import { User } from "../models/user.js";
import { Chat } from "../models/chat.js";
import { Request } from "../models/request.js";
import { cookieOptions, emitEvent, sendToken, uploadFilesToCloudinary } from "../utils/features.js";
import { TryCatch } from "../middlewares/error.js";
import { ErrorHandler } from "../utils/utility.js";
import { NEW_REQUEST, REFETCH_CHATS } from "../constants/event.js";
import { getOtherMember } from "../lib/helper.js";



// Create a new User and save token in cookie
const newUser = TryCatch(async (req, res, next) => {

    const file = req.file;

    const { name, username, password, bio } = req.body;

    if (!file) return next(new ErrorHandler("Please Upload Avatar"))

    const result = await uploadFilesToCloudinary([file]);

    const avatar = {
        public_id: result[0].public_id,
        url: result[0].url
    }

    const user = await User.create({
        name,
        username,
        password,
        avatar,
        bio
    })

    sendToken(res, user, 201, "User Created")
})

//login  User and save token in cookie
const login = TryCatch(async (req, res, next) => {
    const { username, password } = req.body;

    const user = await User.findOne({ username }).select("+password") //select is used when you define select false in model

    if (!user) { return next(new ErrorHandler("Invalid Username or Password", 404)) }
    const isMatch = await compare(password, user.password)

    if (!isMatch) { return next(new ErrorHandler("Invalid Username or Password", 404)) }
    sendToken(res, user, 200, `Welcome Back , ${user.name}`)
})

//Get logged in user details
const getMyProfile = TryCatch(async (req, res, next) => {
    const user = await User.findById(req.userID);
    if (!user) return next(new ErrorHandler("User not found", 404));
    return res.status(200).json({
        success: true,
        user
    })
})

const logout = TryCatch(async (req, res) => {
    return res.status(200).cookie("chatapp-token", "", { ...cookieOptions, maxAge: 0 }).json({
        success: true,
        message: "Logged out Successfully"
    })
})

const searchUser = TryCatch(async (req, res) => {
    const { name = "" } = req.query;
    // find all my chats
    const myChats = await Chat.find({ groupChat: false, members: req.userID });

    //extracting All users from my chat my friends or a people i have chatted with
    const allUsersFromMyChats = myChats.flatMap((chat) => chat.members);

    //finding All users that not are my freinds
    const allUsersExpectMeAndFriends = await User.find({
        _id: { $nin: [...allUsersFromMyChats, req.userID] },
        name: { $regex: name, $options: "i" }
    })

    // modifying the response
    const users = allUsersExpectMeAndFriends.map(({ _id, name, avatar }) => ({
        _id,
        name,
        avatar: avatar.url
    }))

    return res.status(200).json({
        success: true,
        users
    })
})

const sendFriendRequest = TryCatch(async (req, res, next) => {

    const { userId } = req.body

    if (userId === req.userID) return next(new ErrorHandler("You can't  send request to yourself", 400))

    const request = await Request.findOne({
        $or: [
            { sender: req.userID, receiver: userId },
            { sender: userId, receiver: req.userID }
        ]
    });

    if (request) return next(new ErrorHandler("Request allready sent", 400))

    await Request.create({
        sender: req.userID,
        receiver: userId
    })

    emitEvent(req, NEW_REQUEST, [userId])

    return res.status(200).json({
        success: true,
        message: "Friend Request Sent"
    })
})

const acceptFriendRequest = TryCatch(async (req, res, next) => {
    const { requestId, accept } = req.body;

    const request = await Request.findById(requestId)
        .populate("sender", "name")
        .populate("receiver", "name");

    if (!request) return next(new ErrorHandler("Request not found", 404));

    if (request.receiver._id.toString() !== req.userID.toString()) return next(new ErrorHandler("you are not authorized to accept this request", 401));

    if (!accept) {
        await request.deleteOne();
        return res.status(200).json({
            success: true,
            message: "Friend Request Rejected"
        });
    }

    const members = [request.sender._id, request.receiver._id]

    await Promise.all([
        Chat.create({
            members,
            name: `${request.sender.name}-${request.receiver.name}`,
        }),
        request.deleteOne()
    ])

    emitEvent(req, REFETCH_CHATS, members)

    return res.status(200).json({
        success: true,
        message: "Friend request accepted",
        senderId: request.sender._id
    })
})

const getMyNotifications = TryCatch(async (req, res, next) => {
    const requests = await Request.find({ receiver: req.userID })
        .populate("sender", "name avatar");

    const allRequest = requests.map(({ _id, sender }) => ({
        _id,
        sender: {
            _id: sender._id,
            name: sender.name,
            avatar: sender.avatar.url
        }
    }))

    return res.status(200).json({
        success: true,
        message: "Notifications Fetched",
        allRequest
    })
})

const getMyFriends = TryCatch(async (req, res, next) => {
    const chatId = req.query.chatId;

    const chats = await Chat.find({
        member: req.user,
        groupChat: false,
    }).populate("members", "name avatar")

    const friends = chats.map(({ members }) => {
        const otherUser = getOtherMember(members, req.userID);

        return {
            _id: otherUser._id,
            name: otherUser.name,
            avatar: otherUser.avatar,
        }
    })
    if (chatId) {
        const chat = await Chat.findById(chatId);
        const availableFriends = friends.filter(
            (friend) => !chat.members.includes(friend._id));
        return res.status(200).json({
            success: true,
            friends: availableFriends
        })

    } else {
        return res.status(200).json({
            success: true,
            friends
        })
    }
})


export { login, newUser, getMyProfile, logout, searchUser, sendFriendRequest, acceptFriendRequest, getMyNotifications, getMyFriends };